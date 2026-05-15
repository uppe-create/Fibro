import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileClock, ShieldCheck } from 'lucide-react';
import {
  createGovernanceRequestSecure,
  createSecurityIncidentSecure,
  updateGovernanceRequestSecure,
  updateSecurityIncidentSecure
} from '@/lib/admin-rpc';
import { formatCpf } from '@/lib/dashboard-utils';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/layout';

type LgpdRequestRow = {
  id: string;
  protocol: string;
  request_type: string;
  data_subject_name: string;
  data_subject_cpf: string;
  channel: string;
  status: string;
  received_at: string;
  due_at: string | null;
  response_summary: string | null;
  legal_notes: string | null;
  owner_name: string | null;
};

type SecurityIncidentRow = {
  id: string;
  protocol: string;
  title: string;
  severity: string;
  status: string;
  occurred_at: string | null;
  discovered_at: string;
  summary: string;
  affected_data: string | null;
  affected_subjects: number;
  containment_actions: string | null;
  notification_required: boolean;
  notified_anpd_at: string | null;
  notified_subjects_at: string | null;
  owner_name: string | null;
};

type RetentionRow = {
  dataset_key: string;
  dataset_label: string;
  retention_summary: string;
  archive_strategy: string;
  purge_blocked: boolean;
  legal_basis_notes: string;
};

type OperatorRow = {
  operator_key: string;
  operator_name: string;
  category: string;
  purpose: string;
  shared_data: string;
  active: boolean;
  notes: string | null;
};

const initialRequestForm = {
  requestType: 'acesso',
  dataSubjectName: '',
  dataSubjectCpf: '',
  channel: 'presencial',
  dueAt: '',
  legalNotes: '',
  ownerName: ''
};

const initialIncidentForm = {
  title: '',
  severity: 'medium',
  occurredAt: '',
  summary: '',
  affectedData: '',
  affectedSubjects: '0',
  containmentActions: '',
  notificationRequired: false,
  ownerName: ''
};

export function Governanca() {
  const currentUser = useAppStore((state) => state.currentUser);
  const [requests, setRequests] = useState<LgpdRequestRow[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncidentRow[]>([]);
  const [retentionRules, setRetentionRules] = useState<RetentionRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [incidentForm, setIncidentForm] = useState(initialIncidentForm);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, { status: string; ownerName: string; responseSummary: string; legalNotes: string }>>({});
  const [incidentDrafts, setIncidentDrafts] = useState<Record<string, { status: string; ownerName: string; summary: string; containmentActions: string; notificationRequired: boolean; notifiedAnpdAt: string; notifiedSubjectsAt: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const ownerDefault = currentUser?.name || '';

  const loadData = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const [requestResult, incidentResult, retentionResult, operatorResult] = await Promise.all([
        supabase.from('lgpd_requests').select('*').order('received_at', { ascending: false }),
        supabase.from('security_incidents').select('*').order('discovered_at', { ascending: false }),
        supabase.from('lgpd_retention_rules').select('*').order('dataset_label'),
        supabase.from('lgpd_operator_registry').select('*').order('operator_name')
      ]);

      if (requestResult.error) throw requestResult.error;
      if (incidentResult.error) throw incidentResult.error;
      if (retentionResult.error) throw retentionResult.error;
      if (operatorResult.error) throw operatorResult.error;

      const nextRequests = (requestResult.data || []) as LgpdRequestRow[];
      const nextIncidents = (incidentResult.data || []) as SecurityIncidentRow[];

      setRequests(nextRequests);
      setIncidents(nextIncidents);
      setRetentionRules((retentionResult.data || []) as RetentionRow[]);
      setOperators((operatorResult.data || []) as OperatorRow[]);
      setRequestDrafts(
        Object.fromEntries(
          nextRequests.map((item) => [
            item.id,
            {
              status: item.status,
              ownerName: item.owner_name || '',
              responseSummary: item.response_summary || '',
              legalNotes: item.legal_notes || ''
            }
          ])
        )
      );
      setIncidentDrafts(
        Object.fromEntries(
          nextIncidents.map((item) => [
            item.id,
            {
              status: item.status,
              ownerName: item.owner_name || '',
              summary: item.summary,
              containmentActions: item.containment_actions || '',
              notificationRequired: item.notification_required,
              notifiedAnpdAt: item.notified_anpd_at ? item.notified_anpd_at.slice(0, 16) : '',
              notifiedSubjectsAt: item.notified_subjects_at ? item.notified_subjects_at.slice(0, 16) : ''
            }
          ])
        )
      );
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao carregar governanca.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setRequestForm((current) => ({ ...current, ownerName: current.ownerName || ownerDefault }));
    setIncidentForm((current) => ({ ...current, ownerName: current.ownerName || ownerDefault }));
  }, [ownerDefault]);

  const openRequests = useMemo(() => requests.filter((item) => item.status !== 'closed').length, [requests]);
  const openIncidents = useMemo(() => incidents.filter((item) => item.status !== 'closed').length, [incidents]);

  const submitRequest = async () => {
    try {
      setMessage('');
      await createGovernanceRequestSecure({
        requestType: requestForm.requestType,
        dataSubjectName: requestForm.dataSubjectName,
        dataSubjectCpf: requestForm.dataSubjectCpf,
        channel: requestForm.channel,
        dueAt: requestForm.dueAt,
        legalNotes: requestForm.legalNotes,
        ownerName: requestForm.ownerName || ownerDefault
      });
      setRequestForm({ ...initialRequestForm, ownerName: ownerDefault });
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao registrar pedido LGPD.');
    }
  };

  const submitIncident = async () => {
    try {
      setMessage('');
      await createSecurityIncidentSecure({
        title: incidentForm.title,
        severity: incidentForm.severity,
        occurredAt: incidentForm.occurredAt ? new Date(incidentForm.occurredAt).toISOString() : null,
        summary: incidentForm.summary,
        affectedData: incidentForm.affectedData,
        affectedSubjects: Number(incidentForm.affectedSubjects || '0'),
        containmentActions: incidentForm.containmentActions,
        notificationRequired: incidentForm.notificationRequired,
        ownerName: incidentForm.ownerName || ownerDefault
      });
      setIncidentForm({ ...initialIncidentForm, ownerName: ownerDefault });
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao registrar incidente.');
    }
  };

  const saveRequest = async (requestId: string) => {
    const draft = requestDrafts[requestId];
    if (!draft) return;
    try {
      setMessage('');
      await updateGovernanceRequestSecure(requestId, draft);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao atualizar pedido LGPD.');
    }
  };

  const saveIncident = async (incidentId: string) => {
    const draft = incidentDrafts[incidentId];
    if (!draft) return;
    try {
      setMessage('');
      await updateSecurityIncidentSecure(incidentId, {
        status: draft.status,
        ownerName: draft.ownerName,
        summary: draft.summary,
        containmentActions: draft.containmentActions,
        notificationRequired: draft.notificationRequired,
        notifiedAnpdAt: draft.notifiedAnpdAt ? new Date(draft.notifiedAnpdAt).toISOString() : null,
        notifiedSubjectsAt: draft.notifiedSubjectsAt ? new Date(draft.notifiedSubjectsAt).toISOString() : null
      });
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao atualizar incidente.');
    }
  };

  return (
    <div className="cipf-page cipf-page-stack">
      <PageHeader
        eyebrow="Controle / LGPD"
        title="Governanca LGPD"
        description="Pedidos do titular, incidente, retencao e operadores ativos."
        tone="purple"
      />

      {message ? <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard icon={FileClock} label="Pedidos abertos" value={String(openRequests)} />
        <SummaryCard icon={AlertTriangle} label="Incidentes abertos" value={String(openIncidents)} />
        <SummaryCard icon={ShieldCheck} label="Operadores catalogados" value={String(operators.filter((item) => item.active).length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="cipf-panel p-5">
          <h3 className="cipf-title text-lg">Novo pedido do titular</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Tipo" value={requestForm.requestType} onChange={(value) => setRequestForm((current) => ({ ...current, requestType: value }))} />
            <Field label="Canal" value={requestForm.channel} onChange={(value) => setRequestForm((current) => ({ ...current, channel: value }))} />
            <Field label="Titular" value={requestForm.dataSubjectName} onChange={(value) => setRequestForm((current) => ({ ...current, dataSubjectName: value }))} wide />
            <Field label="CPF" value={requestForm.dataSubjectCpf} onChange={(value) => setRequestForm((current) => ({ ...current, dataSubjectCpf: value }))} />
            <Field label="Prazo" type="date" value={requestForm.dueAt} onChange={(value) => setRequestForm((current) => ({ ...current, dueAt: value }))} />
            <Field label="Responsavel" value={requestForm.ownerName} onChange={(value) => setRequestForm((current) => ({ ...current, ownerName: value }))} wide />
          </div>
          <TextArea label="Notas legais" value={requestForm.legalNotes} onChange={(value) => setRequestForm((current) => ({ ...current, legalNotes: value }))} />
          <Button className="mt-4" onClick={submitRequest} disabled={!requestForm.dataSubjectName.trim() || !requestForm.dataSubjectCpf.trim()}>
            Registrar pedido
          </Button>
        </div>

        <div className="cipf-panel p-5">
          <h3 className="cipf-title text-lg">Novo incidente</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Titulo" value={incidentForm.title} onChange={(value) => setIncidentForm((current) => ({ ...current, title: value }))} wide />
            <Field label="Severidade" value={incidentForm.severity} onChange={(value) => setIncidentForm((current) => ({ ...current, severity: value }))} />
            <Field label="Ocorrido em" type="datetime-local" value={incidentForm.occurredAt} onChange={(value) => setIncidentForm((current) => ({ ...current, occurredAt: value }))} />
            <Field label="Titulares afetados" type="number" value={incidentForm.affectedSubjects} onChange={(value) => setIncidentForm((current) => ({ ...current, affectedSubjects: value }))} />
            <Field label="Responsavel" value={incidentForm.ownerName} onChange={(value) => setIncidentForm((current) => ({ ...current, ownerName: value }))} />
          </div>
          <TextArea label="Resumo" value={incidentForm.summary} onChange={(value) => setIncidentForm((current) => ({ ...current, summary: value }))} />
          <TextArea label="Dados afetados" value={incidentForm.affectedData} onChange={(value) => setIncidentForm((current) => ({ ...current, affectedData: value }))} />
          <TextArea label="Contencao" value={incidentForm.containmentActions} onChange={(value) => setIncidentForm((current) => ({ ...current, containmentActions: value }))} />
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#17324d]">
            <input type="checkbox" checked={incidentForm.notificationRequired} onChange={(event) => setIncidentForm((current) => ({ ...current, notificationRequired: event.target.checked }))} />
            Exige avaliacao de notificacao ANPD/titular
          </label>
          <Button className="mt-4" onClick={submitIncident} disabled={!incidentForm.title.trim() || !incidentForm.summary.trim()}>
            Registrar incidente
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="cipf-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="cipf-title text-lg">Fila de pedidos LGPD</h3>
            <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>Atualizar</Button>
          </div>
          <div className="mt-4 space-y-4">
            {requests.map((item) => {
              const draft = requestDrafts[item.id];
              return (
                <article key={item.id} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-[#17324d]">{item.protocol} · {item.data_subject_name}</p>
                      <p className="text-xs text-[#617184]">{formatCpf(item.data_subject_cpf)} · {item.request_type} · {item.channel}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#5b2785]">{item.status}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Status" value={draft?.status || item.status} onChange={(value) => setRequestDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], status: value } }))} />
                    <Field label="Responsavel" value={draft?.ownerName || ''} onChange={(value) => setRequestDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], ownerName: value } }))} />
                  </div>
                  <TextArea label="Resposta" value={draft?.responseSummary || ''} onChange={(value) => setRequestDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], responseSummary: value } }))} />
                  <TextArea label="Notas legais" value={draft?.legalNotes || ''} onChange={(value) => setRequestDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], legalNotes: value } }))} />
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#617184]">
                    <span>Recebido em {new Date(item.received_at).toLocaleString('pt-BR')}</span>
                    <Button size="sm" onClick={() => void saveRequest(item.id)}>Salvar</Button>
                  </div>
                </article>
              );
            })}
            {requests.length === 0 ? <EmptyState title="Sem pedidos LGPD" description="Registre uma solicitacao do titular para iniciar o fluxo." icon={<FileClock className="h-5 w-5" />} /> : null}
          </div>
        </div>

        <div className="cipf-panel p-5">
          <h3 className="cipf-title text-lg">Incidentes e notificacao</h3>
          <div className="mt-4 space-y-4">
            {incidents.map((item) => {
              const draft = incidentDrafts[item.id];
              return (
                <article key={item.id} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-[#17324d]">{item.protocol} · {item.title}</p>
                      <p className="text-xs text-[#617184]">{item.severity} · {item.affected_subjects} titular(es)</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#5b2785]">{item.status}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Status" value={draft?.status || item.status} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], status: value } }))} />
                    <Field label="Responsavel" value={draft?.ownerName || ''} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], ownerName: value } }))} />
                    <Field label="Notificado ANPD" type="datetime-local" value={draft?.notifiedAnpdAt || ''} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], notifiedAnpdAt: value } }))} />
                    <Field label="Notificado titular" type="datetime-local" value={draft?.notifiedSubjectsAt || ''} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], notifiedSubjectsAt: value } }))} />
                  </div>
                  <TextArea label="Resumo" value={draft?.summary || ''} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], summary: value } }))} />
                  <TextArea label="Contencao" value={draft?.containmentActions || ''} onChange={(value) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], containmentActions: value } }))} />
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#17324d]">
                    <input type="checkbox" checked={draft?.notificationRequired || false} onChange={(event) => setIncidentDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], notificationRequired: event.target.checked } }))} />
                    Avaliacao de notificacao obrigatoria
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#617184]">
                    <span>Descoberto em {new Date(item.discovered_at).toLocaleString('pt-BR')}</span>
                    <Button size="sm" onClick={() => void saveIncident(item.id)}>Salvar</Button>
                  </div>
                </article>
              );
            })}
            {incidents.length === 0 ? <EmptyState title="Sem incidentes abertos" description="Quando houver evento de seguranca, registre aqui para rastreio." icon={<AlertTriangle className="h-5 w-5" />} /> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="cipf-panel p-5">
          <h3 className="cipf-title text-lg">Retencao declarada</h3>
          <div className="mt-4 space-y-3">
            {retentionRules.map((item) => (
              <article key={item.dataset_key} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                <p className="text-sm font-black text-[#17324d]">{item.dataset_label}</p>
                <p className="mt-1 text-sm text-[#617184]">{item.retention_summary}</p>
                <p className="mt-2 text-xs text-[#617184]">Arquivo: {item.archive_strategy}</p>
                <p className="mt-2 text-xs font-semibold text-[#7b2cbf]">{item.purge_blocked ? 'Purge automatico bloqueado' : 'Purge liberado'}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="cipf-panel p-5">
          <h3 className="cipf-title text-lg">Operadores e bases de apoio</h3>
          <div className="mt-4 space-y-3">
            {operators.map((item) => (
              <article key={item.operator_key} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-[#17324d]">{item.operator_name}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#5b2785]">{item.category}</span>
                </div>
                <p className="mt-2 text-sm text-[#617184]">{item.purpose}</p>
                <p className="mt-2 text-xs text-[#617184]">{item.shared_data}</p>
                {item.notes ? <p className="mt-2 text-xs font-semibold text-[#17324d]">{item.notes}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof FileClock; label: string; value: string }) {
  return (
    <div className="cipf-panel p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[#7b2cbf]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-black text-[#17324d]">{value}</p>
          <p className="text-xs text-[#617184]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  wide = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={`space-y-1 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-xs font-semibold uppercase text-[#617184]">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block space-y-1">
      <span className="text-xs font-semibold uppercase text-[#617184]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[96px] w-full rounded-xl border border-[#d9e1ea] bg-white px-3 py-2 text-sm text-[#17324d]" />
    </label>
  );
}
