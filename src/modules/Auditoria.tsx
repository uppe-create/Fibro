import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { filterAuditEntries, normalizeAuditEntries } from '@/lib/audit-history';
import { AUDIT_CATEGORY_LABELS, AUDIT_SEVERITY_LABELS, type AuditCategory, type AuditEntryRow, type AuditMode, type AuditSeverity } from '@/lib/audit-events';
import { supabase } from '@/lib/supabase';

const modeOptions: { value: AuditMode; label: string }[] = [
  { value: 'all', label: 'Todos os eventos' },
  { value: 'sensitive', label: 'Eventos sensiveis' },
  { value: 'registration', label: 'Por cadastro' }
];

export function Auditoria() {
  const [entries, setEntries] = useState<AuditEntryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all');
  const [mode, setMode] = useState<AuditMode>('all');
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(300);
      if (error) throw error;
      setEntries((data || []) as AuditEntryRow[]);
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar auditoria.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const normalizedEntries = useMemo(() => normalizeAuditEntries(entries), [entries]);
  const filteredEntries = useMemo(
    () =>
      filterAuditEntries({
        entries: normalizedEntries,
        search: searchTerm,
        category,
        severity,
        mode,
        actor: actorFilter,
        targetId: targetFilter
      }),
    [actorFilter, category, mode, normalizedEntries, searchTerm, severity, targetFilter]
  );

  return (
    <div className="cipf-page cipf-page-stack">
      <Header onRefresh={loadData} isLoading={isLoading} />

      {loadError && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>}

      <section className="cipf-panel p-6 sm:p-8">
        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_220px]">
          <div className="relative xl:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-muted)]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar evento, responsavel, registro..." className="pl-10" />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value as AuditCategory | 'all')} className="text-sm">
            <option value="all">Todas categorias</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value as AuditSeverity | 'all')} className="text-sm">
            <option value="all">Toda severidade</option>
            {Object.entries(AUDIT_SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={mode} onChange={(event) => setMode(event.target.value as AuditMode)} className="text-sm">
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} placeholder="Filtrar por responsavel" />
          <Input value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} placeholder="Filtrar por registro" />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <StatPill label="Eventos" value={String(filteredEntries.length)} />
          <StatPill label="Sensiveis" value={String(filteredEntries.filter((entry) => entry.severity === 'sensitive').length)} />
          <StatPill label="Cadastros" value={String(filteredEntries.filter((entry) => entry.targetType === 'registration').length)} />
        </div>

        <AuditTimeline entries={filteredEntries} emptyMessage="Nenhum evento encontrado para filtros atuais." />
      </section>
    </div>
  );
}

function Header({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <PageHeader
      eyebrow="Auditoria geral"
      title="Linha do tempo do sistema"
      description="Quem fez, o que fez, em qual cadastro, quando e com qual impacto."
      tone="purple"
      actions={
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
          <ShieldCheck className="ml-2 h-4 w-4 text-[var(--fibro-purple)]" />
        </Button>
      }
    />
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#d9e1ea] bg-[#f8fafc] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#617184]">
      <span>{label}</span>
      <span className="text-[var(--brand-ink)]">{value}</span>
    </span>
  );
}
