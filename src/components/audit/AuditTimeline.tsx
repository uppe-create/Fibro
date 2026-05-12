import { AlertTriangle, CalendarClock, Eye, FileStack, Fingerprint, ShieldCheck, UserCircle2 } from 'lucide-react';
import { AUDIT_CATEGORY_LABELS, AUDIT_SEVERITY_LABELS, type AuditCategory, type AuditSeverity, type AuditTimelineEntry } from '@/lib/audit-events';

const categoryIcon: Record<AuditCategory, typeof ShieldCheck> = {
  auth: ShieldCheck,
  registration: UserCircle2,
  workflow: CalendarClock,
  document: FileStack,
  export: Fingerprint,
  system: AlertTriangle
};

const severityClasses: Record<AuditSeverity, string> = {
  info: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  sensitive: 'border-violet-200 bg-violet-50 text-violet-900'
};

const categoryClasses: Record<AuditCategory, string> = {
  auth: 'border-sky-200 bg-sky-50 text-sky-800',
  registration: 'border-slate-200 bg-slate-50 text-slate-800',
  workflow: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  document: 'border-rose-200 bg-rose-50 text-rose-800',
  export: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  system: 'border-amber-200 bg-amber-50 text-amber-900'
};

export function AuditTimeline({
  entries,
  emptyMessage = 'Nenhum evento encontrado.',
  compact = false
}: {
  entries: AuditTimelineEntry[];
  emptyMessage?: string;
  compact?: boolean;
}) {
  if (!entries.length) {
    return <div className="cipf-empty text-sm">{emptyMessage}</div>;
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {entries.map((entry) => {
        const CategoryIcon = categoryIcon[entry.category] || Eye;
        return (
          <article key={entry.id} className="cipf-subpanel bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${categoryClasses[entry.category]}`}>
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {AUDIT_CATEGORY_LABELS[entry.category]}
                  </span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${severityClasses[entry.severity]}`}>
                    {AUDIT_SEVERITY_LABELS[entry.severity]}
                  </span>
                  {entry.targetLabel && (
                    <span className="inline-flex rounded-full border border-[#d9e1ea] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#617184]">
                      {entry.targetLabel}
                    </span>
                  )}
                </div>

                <p className="text-sm font-black text-[var(--brand-ink)] sm:text-base">{entry.summary}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[#617184]">
                  <span>Responsavel: {entry.actor}</span>
                  {entry.targetId && <span>Registro: {entry.targetId}</span>}
                  {entry.ip && <span>IP: {entry.ip}</span>}
                </div>

                {entry.details && <p className="mt-3 text-sm leading-6 text-[#617184]">{entry.details}</p>}

                {entry.metadata && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(entry.metadata)
                      .filter(([, value]) => value !== null && value !== undefined && value !== '')
                      .slice(0, compact ? 2 : 4)
                      .map(([key, value]) => (
                        <span key={key} className="rounded-full border border-[#d9e1ea] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#617184]">
                          {key}: {String(value)}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d9e1ea] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#617184]">
                <CalendarClock className="h-3.5 w-3.5" />
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString('pt-BR') : 'sem data'}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
