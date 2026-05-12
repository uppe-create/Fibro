import { CalendarClock, Copy, Loader2, MessageCircle, Save, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalShell } from '@/components/ui/modal-shell';
import type { AuditTimelineEntry } from '@/lib/audit-events';
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getChecklistItems,
  getDocumentIssues,
  getNextOperationalAction,
  maskCpf,
  toDigits,
  type EditRegistrationForm
} from '@/lib/dashboard-utils';
import {
  canApproveStatus,
  canCancelStatus,
  canIssueStatus,
  canReissueStatus,
  canRenewStatus,
  getStatusBadgeClass,
  getStatusLabel,
  normalizeRegistrationStatus,
  WORKFLOW_STATUS_OPTIONS
} from '@/lib/registration-status';
import { formatCNS, formatPhone } from '@/lib/utils';
import type { CIPFRegistration } from '@/store/useAppStore';
import type { ConfirmActionConfig, DashboardModalState } from '../lib/types';
import { ChecklistBadge } from './StatusParts';

type Props = {
  modal: DashboardModalState;
  setModal: (patch: Partial<DashboardModalState>) => void;
  editForm: EditRegistrationForm | null;
  updateEditField: <K extends keyof EditRegistrationForm>(field: K, value: EditRegistrationForm[K]) => void;
  saveEdit: () => void;
  isSavingEdit: boolean;
  historyFilter: string;
  setHistoryFilter: (value: string) => void;
  filteredHistoryEntries: AuditTimelineEntry[];
  internalNote: string;
  setInternalNote: (value: string) => void;
  onAddInternalNote: () => void;
  onCopySummary: (reg: CIPFRegistration) => void;
  onResolveIssue: (reg: CIPFRegistration, issue?: string) => void;
  onWorkflow: (action: 'approve' | 'issue' | 'cancel' | 'renew' | 'reissue', reg: CIPFRegistration) => void;
  onOpenHistory: (reg: CIPFRegistration) => void;
  onConfirmWhatsApp: () => void;
  onConfirmPickup: () => void;
  onConfirmAction: (config: ConfirmActionConfig, value: string) => void;
  onPreviewPrint: (reg: CIPFRegistration) => void;
  previewPhotoUri: string;
  isPreviewLoading: boolean;
  permissions: {
    canApproveRegistration: boolean;
    canIssueRegistration: boolean;
    canPrintCarteirinha: boolean;
    canCancelRegistration: boolean;
    canRenewRegistration: boolean;
    canReissueRegistration: boolean;
  };
};

const historyFilters = ['all', 'cadastro', 'edicao', 'aprovacao', 'emissao', 'contato', 'retirada', 'renovacao', 'cancelamento', 'documentos', 'observacao'];

export function DashboardModals(props: Props) {
  const { modal, setModal } = props;
  return (
    <>
      {modal.detailReg && <DetailModal {...props} reg={modal.detailReg} />}
      {modal.editReg && props.editForm && <EditModal {...props} reg={modal.editReg} form={props.editForm} />}
      {modal.history && <HistoryModal {...props} />}
      {modal.whatsAppDraft && <WhatsAppModal {...props} />}
      {modal.pickupDraft && <PickupModal {...props} />}
      {modal.confirmAction && <ConfirmModal config={modal.confirmAction} onClose={() => setModal({ confirmAction: null })} onConfirm={props.onConfirmAction} />}
      {modal.previewReg && (
        <ModalShell open onClose={() => setModal({ previewReg: null })} title="Pre-visualizacao da Carteirinha" size="xl">
          <div className="flex min-h-[460px] justify-center overflow-x-auto rounded-xl bg-gray-50/50 px-3 py-8 sm:px-6">
            {props.isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center text-[#86868B]">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-600" />
                <p>Carregando foto e dados...</p>
              </div>
            ) : (
              <div className="origin-top scale-[0.85] sm:scale-100">
                <CarteirinhaPreview registration={modal.previewReg} photoDataUri={props.previewPhotoUri} />
                <Button className="mt-5 w-full" onClick={() => props.onPreviewPrint(modal.previewReg!)}>
                  Emitir / ir para impressao
                </Button>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </>
  );
}

function DetailModal(props: Props & { reg: CIPFRegistration }) {
  const { reg, setModal } = props;
  const issues = getDocumentIssues(reg);
  const canUseOperationalActions = props.permissions.canApproveRegistration || props.permissions.canIssueRegistration;
  return (
    <ModalShell open onClose={() => setModal({ detailReg: null })} title="Ficha do Cadastro" description={reg.fullName} size="lg">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#617184]">Proximo passo</p>
              <p className="mt-1 text-lg font-black text-[#17324d]">{getNextOperationalAction(reg)}</p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusBadgeClass(reg.status)}`}>{getStatusLabel(reg.status)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => props.onCopySummary(reg)}><Copy className="mr-2 h-4 w-4" />Copiar resumo</Button>
          {canUseOperationalActions && toDigits(reg.phone || '') && <Button variant="success" onClick={() => {
            const template = normalizeRegistrationStatus(reg.status) === 'issued' ? 'pickup' : 'approved';
            setModal({ whatsAppDraft: { reg, template, message: buildWhatsAppMessage(reg, template) } });
          }}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>}
          {props.permissions.canApproveRegistration && canApproveStatus(reg.status) && <Button onClick={() => props.onWorkflow('approve', reg)}>Aprovar</Button>}
          {props.permissions.canIssueRegistration && props.permissions.canPrintCarteirinha && canIssueStatus(reg.status) && <Button onClick={() => props.onWorkflow('issue', reg)} variant="success">Emitir</Button>}
          {props.permissions.canRenewRegistration && canRenewStatus(reg.status) && <Button variant="outline" onClick={() => props.onWorkflow('renew', reg)}>Renovar</Button>}
          {props.permissions.canReissueRegistration && canReissueStatus(reg.status) && <Button variant="outline" onClick={() => props.onWorkflow('reissue', reg)}>2a via</Button>}
          {props.permissions.canCancelRegistration && canCancelStatus(reg.status) && <Button variant="outline" className="border-red-200 text-red-700" onClick={() => props.onWorkflow('cancel', reg)}>Cancelar</Button>}
        </div>
        <div className="rounded-2xl border border-[#d9e1ea] bg-white p-4">
          <p className="text-sm font-black text-[#17324d]">Checklist documental</p>
          {issues.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{issues.map((issue) => <button key={issue} onClick={() => props.onResolveIssue(reg, issue)} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm font-semibold text-amber-900">{issue}</button>)}</div>}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {getChecklistItems(reg).map((item) => (
              <div key={item.label}>
                <ChecklistBadge ok={item.ok} label={item.label} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['CPF', maskCpf(reg.cpf)],
            ['Cartao SUS', reg.cns ? formatCNS(reg.cns) : 'Nao informado'],
            ['Telefone', reg.phone ? formatPhone(reg.phone) : '-'],
            ['CID', reg.cid || '-'],
            ['CRM', reg.crm || '-'],
            ['Validade', reg.expiryDate || '-']
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#617184]">{label}</p><p className="mt-1 break-words font-semibold text-[#17324d]">{value}</p></div>)}
        </div>
        <div className="rounded-2xl border border-[#d9e1ea] bg-white p-4">
          {canUseOperationalActions && (
            <>
              <div className="mb-3 flex items-start gap-3"><StickyNote className="h-5 w-5 text-[#7b2cbf]" /><div><p className="text-sm font-black text-[#17324d]">Observacao interna</p><p className="text-sm text-[#617184]">Notas ficam no historico auditavel.</p></div></div>
              <textarea value={props.internalNote} onChange={(e) => props.setInternalNote(e.target.value)} className="min-h-[92px] w-full rounded-xl border border-[#d9e1ea] bg-[#f8fafc] px-3 py-2 text-sm" />
              <Button variant="outline" onClick={props.onAddInternalNote} disabled={!props.internalNote.trim()} className="mt-3">Registrar observacao</Button>
            </>
          )}
          <Button variant="outline" onClick={() => props.onOpenHistory(reg)} className={canUseOperationalActions ? 'ml-2 mt-3' : ''}><CalendarClock className="mr-2 h-4 w-4" />Historico</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditModal({ reg, form, updateEditField, saveEdit, isSavingEdit, setModal }: Props & { reg: CIPFRegistration; form: EditRegistrationForm }) {
  return (
    <ModalShell open onClose={() => setModal({ editReg: null, editFocusSection: null })} title="Editar Cadastro" description={`CPF ${maskCpf(reg.cpf)} bloqueado para preservar unicidade.`} size="xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Nome completo" value={form.fullName} onChange={(value) => updateEditField('fullName', value)} wide />
        <label className="space-y-1"><span className="text-xs font-semibold uppercase text-[#86868B]">Status</span><select value={form.status} onChange={(e) => updateEditField('status', e.target.value as EditRegistrationForm['status'])} className="h-11 w-full rounded-xl border border-gray-200 px-3 bg-white">{WORKFLOW_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <Field label="Telefone" value={form.phone} onChange={(value) => updateEditField('phone', formatPhone(value))} />
        <Field label="Cartao SUS" value={form.cns} onChange={(value) => updateEditField('cns', formatCNS(value))} />
        <Field label="Nascimento" value={form.birthDate} onChange={(value) => updateEditField('birthDate', value)} />
        <Field label="CEP" value={form.cep} onChange={(value) => updateEditField('cep', value)} />
        <Field label="Logradouro" value={form.logradouro} onChange={(value) => updateEditField('logradouro', value)} wide />
        <Field label="Bairro" value={form.bairro} onChange={(value) => updateEditField('bairro', value)} />
        <Field label="Cidade" value={form.cidade} onChange={(value) => updateEditField('cidade', value)} />
        <Field label="UF" value={form.estado} onChange={(value) => updateEditField('estado', value)} />
        <Field label="CID" value={form.cid} onChange={(value) => updateEditField('cid', value)} />
        <Field label="CRM" value={form.crm} onChange={(value) => updateEditField('crm', value)} />
        <Field label="Data laudo" value={form.medicalReportDate} onChange={(value) => updateEditField('medicalReportDate', value)} />
        <Field label="Data comprovante" value={form.proofOfResidenceDate} onChange={(value) => updateEditField('proofOfResidenceDate', value)} />
        <Field label="Emissao" value={form.issueDate} onChange={(value) => updateEditField('issueDate', value)} />
        <Field label="Validade" value={form.expiryDate} onChange={(value) => updateEditField('expiryDate', value)} />
      </div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal({ editReg: null })}>Cancelar</Button><Button onClick={saveEdit} disabled={isSavingEdit}>{isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button></div>
    </ModalShell>
  );
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={`space-y-1 ${wide ? 'md:col-span-2' : ''}`}><span className="text-xs font-semibold uppercase text-[#86868B]">{label}</span><Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11" /></label>;
}

function HistoryModal({ modal, setModal, historyFilter, setHistoryFilter, filteredHistoryEntries }: Props) {
  return (
    <ModalShell open onClose={() => setModal({ history: null })} title="Linha do Tempo" description={modal.history?.fullName} size="lg">
      <div className="mb-4 flex flex-wrap gap-2">{historyFilters.map((filter) => <button key={filter} onClick={() => setHistoryFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${historyFilter === filter ? 'border-[#7b2cbf] bg-[#f4ecff] text-[#7b2cbf]' : 'border-[#d9e1ea] bg-white text-[#617184]'}`}>{filter}</button>)}</div>
      <AuditTimeline entries={filteredHistoryEntries} compact emptyMessage="Nenhum evento encontrado para esse cadastro." />
    </ModalShell>
  );
}

function WhatsAppModal({ modal, setModal, onConfirmWhatsApp }: Props) {
  const draft = modal.whatsAppDraft!;
  const url = buildWhatsAppUrl(draft.reg.phone, draft.message);
  return <ModalShell open onClose={() => setModal({ whatsAppDraft: null })} title="Mensagem para WhatsApp" description={url ? formatPhone(draft.reg.phone || '') : 'Telefone invalido'} size="md"><textarea value={draft.message} onChange={(e) => setModal({ whatsAppDraft: { ...draft, message: e.target.value } })} className="min-h-[150px] w-full text-sm" /><Button className="mt-4 w-full" variant="success" onClick={onConfirmWhatsApp}>Abrir WhatsApp</Button></ModalShell>;
}

function PickupModal({ modal, setModal, onConfirmPickup }: Props) {
  const draft = modal.pickupDraft!;
  return <ModalShell open onClose={() => setModal({ pickupDraft: null })} title="Confirmar retirada" description={draft.reg.fullName} size="md"><Input value={draft.pickedBy} onChange={(e) => setModal({ pickupDraft: { ...draft, pickedBy: e.target.value } })} placeholder="Quem retirou" /><label className="mt-4 flex gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={draft.documentChecked} onChange={(e) => setModal({ pickupDraft: { ...draft, documentChecked: e.target.checked } })} /> Documento apresentado conferido.</label><textarea value={draft.note} onChange={(e) => setModal({ pickupDraft: { ...draft, note: e.target.value } })} className="mt-4 min-h-[92px] w-full text-sm" /><Button className="mt-4 w-full" variant="success" onClick={onConfirmPickup}>Confirmar retirada</Button></ModalShell>;
}

function ConfirmModal({ config, onClose, onConfirm }: { config: ConfirmActionConfig; onClose: () => void; onConfirm: (config: ConfirmActionConfig, value: string) => void }) {
  const [value, setValue] = useState('');
  const canConfirm = config.requiredText ? value.trim().toUpperCase() === config.requiredText.toUpperCase() : config.requiresReason ? value.trim().length > 2 : true;
  return <ModalShell open onClose={onClose} title={config.title} description={config.description} size="md">{(config.requiresReason || config.requiredText) && <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={config.reasonLabel || config.requiredText || 'Motivo'} />}<div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!canConfirm} onClick={() => onConfirm(config, value)} variant={config.tone === 'danger' ? 'destructive' : 'default'}>{config.confirmLabel}</Button></div></ModalShell>;
}
