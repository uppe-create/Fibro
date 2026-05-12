import { daysUntil, parseBRDate } from '@/lib/date';
import { getDocumentIssues } from '@/lib/dashboard-utils';
import { normalizeRegistrationStatus } from '@/lib/registration-status';
import type { AppUser, CIPFRegistration } from '@/store/useAppStore';
import { getApprovalWhatsAppUrl, maskCpf, onlyDigits } from './notification-utils';

export type NotificationTone = 'blue' | 'red' | 'amber' | 'orange' | 'green' | 'purple' | 'slate' | 'zinc';
export type NotificationIconKey =
  | 'database'
  | 'alert'
  | 'clipboard-check'
  | 'file-warning'
  | 'printer'
  | 'message-circle'
  | 'phone-off'
  | 'ban'
  | 'clock';

export type NotificationAction =
  | { kind: 'backup'; label: string }
  | { kind: 'link'; label: string; href: string };

export type NotificationEntry = {
  id: string;
  title: string;
  subtitle: string;
  action?: NotificationAction;
};

export type NotificationSection = {
  id: string;
  tone: NotificationTone;
  icon: NotificationIconKey;
  title: string;
  description: string;
  entries?: NotificationEntry[];
  action?: NotificationAction;
};

type BuildNotificationSectionsParams = {
  registrations: CIPFRegistration[];
  currentUser: AppUser | null;
  lastBackupDate?: number | null;
};

const sortByExpiryDateAsc = (a: CIPFRegistration, b: CIPFRegistration) => {
  const aDate = parseBRDate(a.expiryDate);
  const bDate = parseBRDate(b.expiryDate);
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  return aDate.getTime() - bDate.getTime();
};

const byStatus = (registrations: CIPFRegistration[], status: string) =>
  registrations.filter((registration) => normalizeRegistrationStatus(registration.status) === status);

const buildRegEntry = (registration: CIPFRegistration, subtitle: string, action?: NotificationAction): NotificationEntry => ({
  id: registration.id,
  title: registration.fullName,
  subtitle,
  action
});

export function buildNotificationSections({
  registrations,
  currentUser,
  lastBackupDate
}: BuildNotificationSectionsParams): { sections: NotificationSection[]; unreadCount: number } {
  const canHandleOperationalAlerts = currentUser?.role === 'admin' || currentUser?.role === 'attendant';
  const pendingApprovalRegistrations = canHandleOperationalAlerts ? byStatus(registrations, 'under_review').slice(0, 8) : [];
  const approvedAwaitingContact = canHandleOperationalAlerts
    ? byStatus(registrations, 'approved').filter((registration) => !registration.patient_notified_at).slice(0, 8)
    : [];
  const approvedReadyToIssue = canHandleOperationalAlerts
    ? byStatus(registrations, 'approved').filter((registration) => getDocumentIssues(registration).length === 0).slice(0, 8)
    : [];
  const missingPhoneApproved = canHandleOperationalAlerts
    ? byStatus(registrations, 'approved').filter((registration) => !onlyDigits(registration.phone)).slice(0, 6)
    : [];
  const documentIssueRegistrations = canHandleOperationalAlerts
    ? registrations
        .filter((registration) => ['under_review', 'approved'].includes(normalizeRegistrationStatus(registration.status)))
        .filter((registration) => getDocumentIssues(registration).length > 0)
        .slice(0, 6)
    : [];
  const cancelledRegistrations = currentUser?.role === 'admin' ? byStatus(registrations, 'cancelled').slice(0, 4) : [];
  const issuedWithoutPhone = canHandleOperationalAlerts
    ? byStatus(registrations, 'issued').filter((registration) => !onlyDigits(registration.phone)).slice(0, 4)
    : [];
  const issuedAwaitingPickup =
    currentUser?.role === 'admin'
      ? byStatus(registrations, 'issued').filter((registration) => !registration.picked_up_at).slice(0, 8)
      : [];

  const expiringRegistrations = registrations
    .filter((registration) => {
      if (!registration.expiryDate) return false;
      const diffDays = daysUntil(registration.expiryDate);
      return diffDays !== null && diffDays <= 30 && !['under_review', 'cancelled'].includes(normalizeRegistrationStatus(registration.status));
    })
    .sort(sortByExpiryDateAsc);

  const queueIsHigh = pendingApprovalRegistrations.length >= 5;
  const needsBackup = currentUser?.role === 'admin' && (!lastBackupDate || Date.now() - lastBackupDate > 7 * 24 * 60 * 60 * 1000);

  const sections: NotificationSection[] = [];

  if (needsBackup) {
    sections.push({
      id: 'backup-needed',
      tone: 'blue',
      icon: 'database',
      title: 'Backup necessário',
      description: 'Já faz mais de 7 dias desde o último backup do sistema.',
      action: { kind: 'backup', label: 'Fazer Backup Agora' }
    });
  }

  if (queueIsHigh) {
    sections.push({
      id: 'queue-high',
      tone: 'red',
      icon: 'alert',
      title: 'Fila de análise alta',
      description: `Existem ${pendingApprovalRegistrations.length} cadastros aguardando conferência. Vale priorizar a triagem.`
    });
  }

  if (pendingApprovalRegistrations.length > 0) {
    sections.push({
      id: 'pending-approval',
      tone: 'amber',
      icon: 'clipboard-check',
      title: 'Carteirinhas aguardando aprovação',
      description: `${pendingApprovalRegistrations.length} cadastro(s) em análise precisam de conferência.`,
      entries: pendingApprovalRegistrations.slice(0, 4).map((registration) =>
        buildRegEntry(registration, `CPF: ${maskCpf(registration.cpf)}`)
      )
    });
  }

  if (documentIssueRegistrations.length > 0) {
    sections.push({
      id: 'document-issues',
      tone: 'orange',
      icon: 'file-warning',
      title: 'Pendências documentais',
      description: 'Revise laudo, foto, documento ou comprovante antes de aprovar.',
      entries: documentIssueRegistrations.slice(0, 3).map((registration) =>
        buildRegEntry(registration, getDocumentIssues(registration).slice(0, 2).join(' • '))
      )
    });
  }

  if (approvedReadyToIssue.length > 0) {
    sections.push({
      id: 'approved-ready-to-issue',
      tone: 'green',
      icon: 'printer',
      title: 'Prontas para emissão',
      description: 'Carteirinhas aprovadas e sem pendência documental para o administrador emitir.',
      entries: approvedReadyToIssue.slice(0, 3).map((registration) =>
        buildRegEntry(registration, `Validade prevista: ${registration.expiryDate || '-'}`)
      )
    });
  }

  if (approvedAwaitingContact.length > 0) {
    sections.push({
      id: 'approved-awaiting-contact',
      tone: 'purple',
      icon: 'message-circle',
      title: 'Aprovadas: avisar paciente',
      description: 'Envie a mensagem pronta pelo WhatsApp quando houver telefone cadastrado.',
      entries: approvedAwaitingContact.slice(0, 4).map((registration) => {
        const whatsAppUrl = getApprovalWhatsAppUrl(registration.phone, registration.fullName);
        return buildRegEntry(
          registration,
          `Telefone: ${registration.phone || 'não informado'}`,
          whatsAppUrl ? { kind: 'link', label: 'Abrir WhatsApp', href: whatsAppUrl } : undefined
        );
      })
    });
  }

  if (issuedAwaitingPickup.length > 0) {
    sections.push({
      id: 'issued-awaiting-pickup',
      tone: 'blue',
      icon: 'printer',
      title: 'Aguardando retirada',
      description: 'Carteirinhas emitidas que ainda precisam de confirmação de retirada.',
      entries: issuedAwaitingPickup.slice(0, 4).map((registration) =>
        buildRegEntry(registration, `Telefone: ${registration.phone || 'não informado'}`)
      )
    });
  }

  if (missingPhoneApproved.length > 0) {
    sections.push({
      id: 'approved-missing-phone',
      tone: 'purple',
      icon: 'phone-off',
      title: 'Aprovadas sem telefone',
      description: 'Complete o telefone para facilitar o aviso ao paciente.',
      entries: missingPhoneApproved.slice(0, 3).map((registration) =>
        buildRegEntry(registration, `CPF: ${maskCpf(registration.cpf)}`)
      )
    });
  }

  if (issuedWithoutPhone.length > 0) {
    sections.push({
      id: 'issued-without-phone',
      tone: 'slate',
      icon: 'phone-off',
      title: 'Emitidas sem telefone',
      description: 'Registros emitidos sem contato podem dificultar renovação ou retirada.',
      entries: issuedWithoutPhone.slice(0, 3).map((registration) =>
        buildRegEntry(registration, `Validade: ${registration.expiryDate || '-'}`)
      )
    });
  }

  if (cancelledRegistrations.length > 0) {
    sections.push({
      id: 'cancelled-registrations',
      tone: 'zinc',
      icon: 'ban',
      title: 'Registros cancelados',
      description: 'Confira se os cancelamentos recentes foram auditados com motivo.',
      entries: cancelledRegistrations.slice(0, 3).map((registration) =>
        buildRegEntry(registration, `CPF: ${maskCpf(registration.cpf)}`)
      )
    });
  }

  expiringRegistrations.forEach((registration) => {
    const diffDays = daysUntil(registration.expiryDate) ?? 0;
    const expired = diffDays < 0;
    sections.push({
      id: `expiring-${registration.id}`,
      tone: expired ? 'red' : 'amber',
      icon: 'clock',
      title: registration.fullName,
      description: expired
        ? `Venceu há ${Math.abs(diffDays)} dias`
        : diffDays === 0
          ? 'Vence hoje!'
          : `Vence em ${diffDays} dias`,
      entries: [buildRegEntry(registration, `CPF: ${maskCpf(registration.cpf)}`)]
    });
  });

  const unreadCount = sections.reduce((sum, section) => sum + Math.max(section.entries?.length || 0, 1), 0);
  return { sections, unreadCount };
}
