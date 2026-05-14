import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCpf, getDocumentIssues, toDigits } from '@/lib/dashboard-utils';
import {
  canApproveStatus,
  canIssueStatus,
  normalizeRegistrationStatus,
  getStatusLabel
} from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';
import type { DashboardQueueItem } from '../lib/types';

type Permissions = {
  canApproveRegistration: boolean;
  canIssueRegistration: boolean;
  canPrintCarteirinha: boolean;
  canRegisterPatientContact: boolean;
  canRegisterPickup: boolean;
  canEditRegistration: boolean;
};

type Props = {
  operationalQueue: DashboardQueueItem[];
  documentIssueQueue: CIPFRegistration[];
  batchPrintableRegistrations: CIPFRegistration[];
  selectedBatchIds: string[];
  setSelectedBatchIds: (updater: (current: string[]) => string[]) => void;
  permissions: Permissions;
  onOpenDetails: (reg: CIPFRegistration) => void;
  onResolveIssue: (reg: CIPFRegistration, issue?: string) => void;
  onApprove: (reg: CIPFRegistration) => void;
  onIssue: (reg: CIPFRegistration) => void;
  onNotify: (reg: CIPFRegistration, template: 'approved' | 'pickup') => void;
  onRegisterNotice: (reg: CIPFRegistration) => void;
  onPickup: (reg: CIPFRegistration) => void;
  onBatchPrint: () => void;
  showDocumentIssues?: boolean;
};

export function DashboardQueues({
  operationalQueue,
  documentIssueQueue,
  batchPrintableRegistrations,
  selectedBatchIds,
  setSelectedBatchIds,
  permissions,
  onOpenDetails,
  onResolveIssue,
  onApprove,
  onIssue,
  onNotify,
  onRegisterNotice,
  onPickup,
  onBatchPrint,
  showDocumentIssues = true
}: Props) {
  return (
    <>
      {permissions.canIssueRegistration && permissions.canPrintCarteirinha && batchPrintableRegistrations.length > 0 && (
        <div className="cipf-panel p-4 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-[#17324d]">Impressão em lote</h3>
              <p className="mt-1 text-sm text-[#617184]">Selecione carteirinhas aprovadas e sem pendências.</p>
            </div>
            <Button type="button" onClick={onBatchPrint} className="w-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" /> Preparar lote ({selectedBatchIds.length})
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batchPrintableRegistrations.slice(0, 9).map((reg) => (
              <label key={reg.id} className="flex min-h-[72px] cursor-pointer items-start gap-3 rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4 transition hover:border-[#7b2cbf] hover:bg-white">
                <input
                  type="checkbox"
                  checked={selectedBatchIds.includes(reg.id)}
                  onChange={(event) => setSelectedBatchIds((current) => (event.target.checked ? [...current, reg.id] : current.filter((id) => id !== reg.id)))}
                  className="mt-1 h-4 w-4"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#17324d]">{reg.fullName}</span>
                  <span className="block text-xs text-[#617184]">{formatCpf(reg.cpf)} • validade {reg.expiryDate || '-'}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-8 ${showDocumentIssues ? 'xl:grid-cols-2' : ''}`}>
        <div className="cipf-panel p-4 sm:p-8 lg:p-10">
          <div className="mb-5 flex items-start justify-between gap-5 sm:mb-8">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-[#17324d]">Fila de aprovação, emissão e retirada</h3>
              <p className="mt-1 text-sm text-[#617184]">Cadastros que ainda precisam de decisão, aviso ou retirada.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{operationalQueue.length}</span>
          </div>
          <div className="space-y-5">
            {operationalQueue.map((item) => {
              const reg = item.registration;
              const status = normalizeRegistrationStatus(reg.status);
              return (
                <div key={reg.id} className="grid gap-4 rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,auto)] lg:items-center lg:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="break-words text-sm font-bold text-[#17324d]">{reg.fullName}</p>
                      <span className="w-fit rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#5b2785]">{getStatusLabel(reg.status)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#617184]">{formatCpf(reg.cpf)} - Validade {reg.expiryDate || '-'}</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#7b2cbf]">{item.nextAction}</p>
                    {item.staleAlerts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.staleAlerts.map((alert) => <span key={alert} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{alert}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[360px]">
                    <Button type="button" variant="outline" onClick={() => onOpenDetails(reg)} className="h-11 rounded-xl px-3 text-sm sm:h-10">Ver ficha</Button>
                    {permissions.canApproveRegistration && canApproveStatus(reg.status) && <Button type="button" onClick={() => onApprove(reg)} size="sm">Aprovar</Button>}
                    {status === 'approved' && toDigits(reg.phone || '') && !reg.patient_notified_at && <Button type="button" onClick={() => onNotify(reg, 'approved')} variant="success" size="sm">WhatsApp</Button>}
                    {status === 'issued' && toDigits(reg.phone || '') && !reg.picked_up_at && <Button type="button" onClick={() => onNotify(reg, 'pickup')} variant="success" size="sm">Avisar</Button>}
                    {permissions.canRegisterPatientContact && ['approved', 'issued'].includes(status) && <Button type="button" variant="outline" onClick={() => onRegisterNotice(reg)} className="h-11 rounded-xl px-3 text-sm sm:h-10">Registrar aviso</Button>}
                    {permissions.canIssueRegistration && permissions.canPrintCarteirinha && canIssueStatus(reg.status) && <Button type="button" onClick={() => onIssue(reg)} variant="success" size="sm">Emitir</Button>}
                    {permissions.canRegisterPickup && status === 'issued' && <Button type="button" onClick={() => onPickup(reg)} size="sm">Retirada</Button>}
                  </div>
                </div>
              );
            })}
            {operationalQueue.length === 0 && <p className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4 text-sm text-[#617184]">Nenhuma pendência operacional agora.</p>}
          </div>
        </div>

        {showDocumentIssues && <div className="cipf-panel p-4 sm:p-8 lg:p-10">
          <div className="mb-8">
            <h3 className="text-sm font-black uppercase tracking-wide text-[#17324d]">Revisão documental</h3>
            <p className="mt-1 text-sm text-[#617184]">Itens com foto, documento, comprovante ou laudo pendente/vencido.</p>
          </div>
          <div className="space-y-5">
            {documentIssueQueue.map((reg) => {
              const issues = getDocumentIssues(reg);
              return (
                <div key={reg.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#17324d]">{reg.fullName}</p>
                      <p className="text-xs text-amber-800">{issues.slice(0, 2).join(' • ')}</p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <Button type="button" variant="outline" onClick={() => onOpenDetails(reg)} className="h-11 rounded-xl border-amber-300 bg-white sm:h-9">Conferir</Button>
                      {permissions.canEditRegistration && <Button type="button" onClick={() => onResolveIssue(reg, issues[0])} className="h-11 rounded-xl bg-amber-600 text-white hover:bg-amber-700 sm:h-9">Resolver</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {documentIssueQueue.length === 0 && <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Nenhuma pendência documental detectada.</p>}
          </div>
        </div>}
      </div>
    </>
  );
}
