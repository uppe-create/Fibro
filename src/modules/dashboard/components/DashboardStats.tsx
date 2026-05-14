import { AlertTriangle, Clock, MessageCircle, PackageCheck, PhoneCall, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCpf, getDocumentIssues, getNextOperationalAction } from '@/lib/dashboard-utils';
import { getStatusLabel } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';
import { InfoCard } from './StatusParts';

type Props = {
  stats: any;
  todayActions: Array<{ label: string; value: number }>;
  showTodayActions?: boolean;
  quickSearchTerm: string;
  onQuickSearchChange: (value: string) => void;
  quickResults: CIPFRegistration[];
  onOpenDetails: (reg: CIPFRegistration) => void;
  onCopySummary: (reg: CIPFRegistration) => void;
};

const actionIcons = [Clock, MessageCircle, Printer, PackageCheck, PhoneCall, AlertTriangle];

export function DashboardStats({
  stats,
  todayActions,
  showTodayActions = true,
  quickSearchTerm,
  onQuickSearchChange,
  quickResults,
  onOpenDetails,
  onCopySummary
}: Props) {
  return (
    <>
      <div className={showTodayActions ? 'grid gap-8 xl:grid-cols-[1.15fr_0.85fr]' : 'grid gap-8'}>
        {showTodayActions && (
          <div className="cipf-panel p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#17324d]">Acoes de hoje</h3>
              <p className="mt-1 text-sm text-[#617184]">Fila pratica para decidir o proximo passo sem abrir cada cadastro.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {todayActions.map((action, index) => {
                const Icon = actionIcons[index] || Clock;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => document.getElementById('dashboard-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="rounded-2xl border border-[#e3e9ef] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#7b2cbf] hover:shadow-[0_12px_28px_rgba(123,44,191,0.1)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-wide text-[#617184]">{action.label}</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4ecff] text-[#7b2cbf]">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-4 text-3xl font-black text-[#17324d]">{action.value}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`cipf-panel p-6 sm:p-8 ${showTodayActions ? '' : 'max-w-4xl'}`}>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#17324d]">Atendimento rapido</h3>
          <p className="mt-1 text-sm text-[#617184]">Digite nome, CPF ou Cartao SUS para abrir uma ficha resumida.</p>
          <Input value={quickSearchTerm} onChange={(event) => onQuickSearchChange(event.target.value)} placeholder="Buscar atendimento..." className="mt-5 h-12 rounded-xl border-[#d9e1ea] bg-white" />
          <div className="mt-4 space-y-3">
            {quickResults.map((reg) => {
              const issues = getDocumentIssues(reg);
              return (
                <div key={reg.id} className="rounded-2xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#17324d]">{reg.fullName}</p>
                      <p className="text-xs text-[#617184]">{formatCpf(reg.cpf)} - {getStatusLabel(reg.status)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${issues.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                      {issues.length ? `${issues.length} pend.` : 'OK'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#617184]">{getNextOperationalAction(reg)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenDetails(reg)} className="h-8 rounded-xl text-xs">Ver ficha</Button>
                    <Button type="button" variant="outline" onClick={() => onCopySummary(reg)} className="h-8 rounded-xl text-xs">Copiar resumo</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-7 md:grid-cols-3 xl:grid-cols-6">
        <InfoCard label="Em analise" value={stats.underReview} tone="amber" />
        <InfoCard label="Aprovadas" value={stats.approved} tone="purple" />
        <InfoCard label="Emitidas" value={stats.issued} tone="green" />
        <InfoCard label="Vencendo 30d" value={stats.expiring30} tone="amber" />
        <InfoCard label="Pend. docs" value={stats.documentIssues} tone="red" />
        <InfoCard label="Filtrado" value={stats.filtered} />
      </div>
    </>
  );
}
