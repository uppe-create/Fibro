import { CalendarClock, Eye, FileBadge2, FileText, MoreHorizontal, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getExpiryHighlight, isReadyToPrint, maskCpf } from '@/lib/dashboard-utils';
import { isPrintableStatus } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';
import { StatusChip } from './StatusParts';

type Permissions = {
  canPrintCarteirinha: boolean;
  canEditRegistration: boolean;
  canViewDocuments: boolean;
  canViewHistory: boolean;
  canDeleteRegistration: boolean;
};

type Props = {
  registrations: CIPFRegistration[];
  isLoading: boolean;
  permissions: Permissions;
  onPreview: (reg: CIPFRegistration) => void;
  onDetails: (reg: CIPFRegistration) => void;
  onEdit: (reg: CIPFRegistration) => void;
  onDocument: (reg: CIPFRegistration) => void;
  onHistory: (reg: CIPFRegistration) => void;
  onDelete: (reg: CIPFRegistration) => void;
};

export function DashboardResults({ registrations, isLoading, permissions, onPreview, onDetails, onEdit, onDocument, onHistory, onDelete }: Props) {
  return (
    <div id="dashboard-results" className="cipf-panel scroll-mt-32 overflow-hidden">
      {isLoading ? (
        <div className="p-12 text-center text-[#6f617b]">Carregando registros...</div>
      ) : registrations.length === 0 ? (
        <div className="cipf-empty m-4 text-center">Nenhum registro encontrado para os filtros aplicados.</div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {registrations.map((reg) => (
              <div key={reg.id}>
                <MobileCard
                  reg={reg}
                  permissions={permissions}
                  onPreview={onPreview}
                  onDetails={onDetails}
                  onEdit={onEdit}
                  onDocument={onDocument}
                  onHistory={onHistory}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#faf8fb] text-xs uppercase text-[#6f617b]">
                <tr>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">Titular</th>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">CPF</th>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">Cartão SUS</th>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">Bairro</th>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">Status</th>
                  <th className="px-5 py-4 text-left font-bold tracking-wide">Validade</th>
                  <th className="px-5 py-4 text-right font-bold tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece7f3]">
                {registrations.map((reg) => (
                  <tr key={reg.id} className={`hover:bg-[#faf8fb] ${getExpiryHighlight(reg)}`}>
                    <td className="min-w-[260px] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Initials name={reg.fullName} />
                        <button type="button" onClick={() => onDetails(reg)} className="text-left font-bold text-[#170b24] hover:text-[var(--fibro-purple)]">
                          {reg.fullName}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#4f455f]">{maskCpf(reg.cpf)}</td>
                    <td className="px-5 py-4 font-mono text-xs text-[#4f455f]">{formatCns(reg.cns)}</td>
                    <td className="px-5 py-4 text-[#4f455f]">{reg.bairro || '-'}</td>
                    <td className="px-5 py-4"><StatusChip status={reg.status} /></td>
                    <td className="px-5 py-4 text-[#4f455f]">{reg.expiryDate || '-'}</td>
                    <td className="px-5 py-4">
                      <ActionButtons
                        reg={reg}
                        permissions={permissions}
                        onPreview={onPreview}
                        onDetails={onDetails}
                        onEdit={onEdit}
                        onDocument={onDocument}
                        onHistory={onHistory}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#ece7f3] px-5 py-4 text-sm text-[#6f617b]">
            <span>Mostrando {registrations.length} registro(s)</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled>Anterior</Button>
              <Button type="button" variant="outline" disabled>Próxima</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1eaf8] text-xs font-black text-[var(--fibro-purple)]">{initials}</span>;
}

function formatCns(cns?: string) {
  const digits = String(cns || '').replace(/\D/g, '');
  if (!digits) return '-';
  return digits.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
}

function MobileCard(props: Omit<Props, 'registrations' | 'isLoading'> & { reg: CIPFRegistration }) {
  const { reg, permissions } = props;
  return (
    <div className={`cipf-subpanel p-4 ${getExpiryHighlight(reg)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          <Initials name={reg.fullName} />
          <div className="min-w-0">
            <p className="break-words text-sm font-bold leading-5 text-[#170b24]">{reg.fullName}</p>
            <p className="text-xs text-[#6f617b]">{maskCpf(reg.cpf)}</p>
            <p className="text-xs text-[#6f617b]">{reg.bairro || '-'} - Validade {reg.expiryDate || '-'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusChip status={reg.status} />
          {isReadyToPrint(reg) && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-800">Pronto p/ imprimir</span>}
        </div>
      </div>
      <div className="mt-4 border-t border-[#ece7f3] pt-3">
        <ActionButtons {...props} permissions={permissions} mobile />
      </div>
    </div>
  );
}

function ActionButtons({ reg, permissions, onPreview, onDetails, onEdit, onDocument, onHistory, onDelete, mobile = false }: Omit<Props, 'registrations' | 'isLoading'> & { reg: CIPFRegistration; mobile?: boolean }) {
  const wrapperClass = mobile ? 'grid grid-cols-4 gap-2' : 'flex flex-wrap justify-end gap-1';
  const buttonClass = mobile ? 'dashboard-action-button h-11 w-full rounded-xl' : 'dashboard-action-button';
  return (
    <div className={wrapperClass}>
      {permissions.canPrintCarteirinha && isPrintableStatus(reg.status) && <Button variant="ghost" size="icon" onClick={() => onPreview(reg)} aria-label="Pre-visualizar carteirinha" title="Carteirinha" className={buttonClass}><FileBadge2 className="dashboard-action-icon h-4 w-4" /></Button>}
      <Button variant="ghost" size="icon" onClick={() => onDetails(reg)} aria-label="Ver detalhes" title="Ver detalhes" className={buttonClass}><Eye className="dashboard-action-icon h-4 w-4" /></Button>
      {permissions.canEditRegistration && <Button variant="ghost" size="icon" onClick={() => onEdit(reg)} aria-label="Editar cadastro" title="Editar" className={buttonClass}><Pencil className="dashboard-action-icon h-4 w-4" /></Button>}
      {permissions.canViewDocuments && <Button variant="ghost" size="icon" onClick={() => onDocument(reg)} aria-label="Abrir laudo" title="Laudo" className={buttonClass}><FileText className="dashboard-action-icon h-4 w-4" /></Button>}
      {permissions.canViewHistory && <Button variant="ghost" size="icon" onClick={() => onHistory(reg)} aria-label="Ver historico" title="Historico" className={buttonClass}><CalendarClock className="dashboard-action-icon h-4 w-4" /><ShieldAlert className="hidden" /></Button>}
      {permissions.canDeleteRegistration && <Button variant="ghost" size="icon" onClick={() => onDelete(reg)} aria-label="Arquivar cadastro" title="Arquivar" className={buttonClass}><Trash2 className="dashboard-action-icon h-4 w-4 text-red-600" /></Button>}
      {!mobile && <MoreHorizontal className="mt-2 h-4 w-4 text-[#6f617b]" />}
    </div>
  );
}
