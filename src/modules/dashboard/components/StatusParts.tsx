import { AlertTriangle, CheckCircle, Clock, FileBadge2, Filter } from 'lucide-react';
import { getStatusBadgeClass, getStatusLabel } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';

export function StatusChip({ status }: { status: CIPFRegistration['status'] }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(status)}`}>{getStatusLabel(status)}</span>;
}

export function ChecklistBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {ok ? 'OK' : 'Atenção'} • {label}
    </div>
  );
}

export function InfoCard({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'green' | 'purple' | 'amber' | 'red' }) {
  const Icon = tone === 'green' ? FileBadge2 : tone === 'purple' ? CheckCircle : tone === 'amber' ? Clock : tone === 'red' ? AlertTriangle : Filter;
  const toneClass =
    tone === 'green'
      ? 'bg-[#e8f5ea] text-[#168821]'
      : tone === 'purple'
        ? 'bg-[#edf4fb] text-[#005eb8]'
        : tone === 'amber'
          ? 'bg-[#fef7e6] text-[#8a5a00]'
          : tone === 'red'
            ? 'bg-red-50 text-red-700'
            : 'bg-[#f6f8fb] text-[#071d41]';
  return (
    <div className="cipf-panel dashboard-stat-card p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
        <div className={`dashboard-stat-icon flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-[var(--brand-ink)] tabular-nums">{value}</p>
    </div>
  );
}
