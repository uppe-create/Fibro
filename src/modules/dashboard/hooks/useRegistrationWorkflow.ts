import { buildAuditEvent, type AuditEventInput } from '@/lib/audit-events';
import {
  archiveDatabaseSecure,
  recordPatientContactSecure,
  recordPickupSecure,
  runAdminWorkflowRpc
} from '@/lib/admin-rpc';
import { getAuthMode } from '@/lib/auth-mode';
import { logAuditEvent } from '@/lib/audit';
import { datePlusYearsBR, todayBR, toDigits } from '@/lib/dashboard-utils';
import { getStatusLabel, normalizeRegistrationStatus, type RegistrationStatus } from '@/lib/registration-status';
import { supabase } from '@/lib/supabase';
import type { AppUser, CIPFRegistration } from '@/store/useAppStore';

type WorkflowOptions = {
  currentUser: AppUser | null;
  reload: () => Promise<void>;
  onError: (message: string) => void;
};

export function useRegistrationWorkflow({ currentUser, reload, onError }: WorkflowOptions) {
  const isSupabaseAuth = getAuthMode((import.meta as any).env || {}) === 'supabase';

  const writeAudit = async (event: AuditEventInput) => {
    await logAuditEvent({
      userId: currentUser?.id || null,
      userName: currentUser?.name || 'Sistema',
      ...event
    });
  };

  const updateOperationalFields = async (reg: CIPFRegistration, payload: Partial<CIPFRegistration>) => {
    const { error } = await supabase.from('registrations').update(payload).eq('id', reg.id);
    if (error) throw error;
    await reload();
  };

  const updateWorkflow = async (
    reg: CIPFRegistration,
    nextStatus: RegistrationStatus,
    eventCode: string,
    details: string,
    extraFields: Partial<Pick<CIPFRegistration, 'issueDate' | 'expiryDate'>> = {}
  ) => {
    const payload = { status: nextStatus, ...extraFields };
    const indexPayload = { status: nextStatus, updated_at: new Date().toISOString() };

    const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', reg.id);
    if (registrationError) throw registrationError;

    const { error: publicError } = await supabase.from('public_validations').update(payload).eq('id', reg.id);
    if (publicError) throw publicError;

    const { error: indexError } = await supabase.from('registration_index').update(indexPayload).eq('cpf', toDigits(reg.cpf));
    if (indexError) throw indexError;

    await writeAudit(buildAuditEvent(eventCode, { registrationId: reg.id, targetLabel: reg.fullName, details }));
    await reload();
  };

  const runSecureWorkflow = async (reg: CIPFRegistration, action: 'approve' | 'issue' | 'cancel' | 'renew' | 'reissue' | 'archive', details?: string) => {
    if (!isSupabaseAuth) return false;
    await runAdminWorkflowRpc(reg.id, action, details);
    await reload();
    return true;
  };

  const run = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (error: any) {
      onError(error?.message || 'Nao foi possivel concluir a acao.');
    }
  };

  return {
    writeAudit,
    approve: (reg: CIPFRegistration, details = 'Cadastro aprovado para emissao administrativa') =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'approve', details)) return;
        await updateWorkflow(reg, 'approved', 'registration.approved', details);
      }),
    issue: (reg: CIPFRegistration, details = 'Emissao administrativa para impressao') =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'issue', details)) return;
        if (normalizeRegistrationStatus(reg.status) === 'approved') {
          await updateWorkflow(reg, 'issued', 'card.issued', details, {
            issueDate: todayBR(),
            expiryDate: datePlusYearsBR(2)
          });
          return;
        }

        await writeAudit(buildAuditEvent('card.print_accessed', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details: 'Carteirinha ja emitida'
        }));
      }),
    cancel: (reg: CIPFRegistration, details: string) =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'cancel', details)) return;
        await updateWorkflow(reg, 'cancelled', 'registration.cancelled', details);
      }),
    renew: (reg: CIPFRegistration, details: string) =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'renew', details)) return;
        await updateWorkflow(reg, 'approved', 'registration.renewed', `${details}; nova validade=${datePlusYearsBR(2)}`, {
          issueDate: todayBR(),
          expiryDate: datePlusYearsBR(2)
        });
      }),
    reissue: (reg: CIPFRegistration, details: string) =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'reissue', details)) return;
        await writeAudit(buildAuditEvent('card.reissued', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details
        }));
      }),
    notifyPatient: (reg: CIPFRegistration, channel: string) =>
      run(async () => {
        if (isSupabaseAuth) {
          await recordPatientContactSecure(reg.id, channel);
          await reload();
          return;
        }
        const payload = {
          patient_notified_at: new Date().toISOString(),
          patient_notified_by: currentUser?.name || 'Sistema',
          patient_notification_channel: channel || 'Aviso registrado'
        };
        await updateOperationalFields(reg, payload);
        await writeAudit(buildAuditEvent('patient.notified', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details: `${payload.patient_notification_channel}; status=${getStatusLabel(reg.status)}`
        }));
      }),
    registerPickup: (reg: CIPFRegistration, note: string) =>
      run(async () => {
        if (isSupabaseAuth) {
          await recordPickupSecure(reg.id, note);
          await reload();
          return;
        }
        const payload = {
          picked_up_at: new Date().toISOString(),
          picked_up_by: currentUser?.name || 'Sistema',
          pickup_note: note || 'Retirada registrada'
        };
        await updateOperationalFields(reg, payload);
        await writeAudit(buildAuditEvent('card.picked_up', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details: `${payload.pickup_note}; retirada presencial`
        }));
      }),
    archive: (reg: CIPFRegistration, details: string) =>
      run(async () => {
        if (await runSecureWorkflow(reg, 'archive', details)) return;
        await writeAudit(buildAuditEvent('registration.archived', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details: details || `Arquivamento seguro de ${reg.fullName}`
        }));
        await Promise.all([
          supabase.from('registrations').update({ status: 'cancelled' }).eq('id', reg.id),
          supabase.from('public_validations').update({ status: 'cancelled' }).eq('id', reg.id),
          supabase.from('registration_index').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('cpf', toDigits(reg.cpf))
        ]);
        await reload();
      }),
    archiveAll: (reason: string) =>
      run(async () => {
        if (isSupabaseAuth) {
          await archiveDatabaseSecure(reason);
          await reload();
        }
      }),
    addInternalNote: (reg: CIPFRegistration, note: string) =>
      run(() =>
        writeAudit(buildAuditEvent('note.internal_added', {
          registrationId: reg.id,
          targetLabel: reg.fullName,
          details: note
        }))
      )
  };
}
