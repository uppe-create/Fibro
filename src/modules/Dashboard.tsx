import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Download, FileDown, FileWarning, LayoutDashboard, PackageCheck, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { buildMonthlyReport } from '@/lib/dashboard-utils';
import { hasPermission, type Permission } from '@/lib/permissions';
import { getStatusLabel } from '@/lib/registration-status';
import { useAppStore } from '@/store/useAppStore';
import { InfoCard } from './dashboard/components/StatusParts';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { useDashboardExports } from './dashboard/hooks/useDashboardExports';
import { useRegistrationWorkflow } from './dashboard/hooks/useRegistrationWorkflow';

export function Dashboard() {
  const { registrations, currentUser, fetchRegistrations, setActiveTab, exportDatabase } = useAppStore();
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dashboard = useDashboardData(registrations);
  const workflow = useRegistrationWorkflow({ currentUser, reload: async () => fetchRegistrations(), onError: setMessage });
  const exports = useDashboardExports({ writeAudit: workflow.writeAudit, exportDatabase, onError: setMessage });
  const monthlyReport = useMemo(() => buildMonthlyReport(registrations), [registrations]);

  const topBairros = useMemo(
    () =>
      Object.entries(dashboard.bairroStats)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6),
    [dashboard.bairroStats]
  );

  const statusRows = [
    { label: getStatusLabel('under_review'), value: dashboard.stats.underReview, tone: 'amber' as const },
    { label: getStatusLabel('approved'), value: dashboard.stats.approved, tone: 'default' as const },
    { label: getStatusLabel('issued'), value: dashboard.stats.issued, tone: 'green' as const },
    { label: getStatusLabel('expired'), value: dashboard.stats.expired, tone: 'red' as const }
  ];

  const shortcuts = [
    { label: 'Abrir Pessoas', description: 'Pesquisar e editar cadastros.', tab: 'pessoas', icon: Users, permission: 'viewPeople' },
    { label: 'Aprovar cadastros', description: 'Conferir documentos, aprovar e emitir.', tab: 'operacao', icon: LayoutDashboard, permission: 'viewOperations' },
    { label: 'Documentos', description: 'Pendencias.', tab: 'documentos', icon: FileWarning, permission: 'viewDocumentsQueue' },
    { label: 'Retiradas', description: 'Confirmar entregas presenciais.', tab: 'retiradas', icon: PackageCheck, permission: 'viewPickupQueue' }
  ].filter((item) => hasPermission(currentUser, item.permission as Permission));

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar indicadores.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const canViewReports = hasPermission(currentUser, 'viewReports');

  return (
    <div className="cipf-page cipf-page-stack">
      <Header onRefresh={loadData} isLoading={isLoading} />

      {(loadError || message) && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError || message}</div>}

      <section className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
        <InfoCard label="Total" value={dashboard.stats.total} />
        <InfoCard label="Pendente" value={dashboard.stats.underReview} tone="amber" />
        <InfoCard label="Aprovada" value={dashboard.stats.approved} />
        <InfoCard label="Emitida" value={dashboard.stats.issued} tone="green" />
        <InfoCard label="Vencendo 30d" value={dashboard.stats.expiring30} tone="amber" />
        <InfoCard label="Pend. docs" value={dashboard.stats.documentIssues} tone="red" />
      </section>

      <section className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
        <div className="cipf-panel p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#005eb8]">Resumo</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-[#071d41]">Situacao da base</h3>
            <p className="mt-2 text-sm leading-6 text-[#617184]">Indicadores principais.</p>
          </div>

          <div className="space-y-4">
            {statusRows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-[#17324d]">{row.label}</span>
                  <span className="text-sm font-black text-[#071d41]">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <progress
                    className={`cipf-progress h-full w-full ${row.tone === 'green' ? 'cipf-progress-green' : row.tone === 'red' ? 'cipf-progress-red' : row.tone === 'amber' ? 'cipf-progress-amber' : 'cipf-progress-blue'}`}
                    max={dashboard.stats.total || 1}
                    value={Number(row.value)}
                    aria-label={`${row.label}: ${row.value}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cipf-panel p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#005eb8]">Atalhos</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-[#071d41]">Para onde ir agora</h3>
            <p className="mt-2 text-sm leading-6 text-[#617184]">Cada aba tem uma responsabilidade clara para diminuir bugs e cliques errados.</p>
          </div>

          <div className="grid gap-3">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <button
                  key={shortcut.tab}
                  type="button"
                  onClick={() => setActiveTab(shortcut.tab)}
                  className="group flex items-center justify-between gap-4 border border-[#d9e1ea] bg-white p-4 text-left transition hover:border-[#005eb8] hover:bg-[#f8fbfd]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center bg-[#edf4fb] text-[#005eb8]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-black text-[#17324d]">{shortcut.label}</span>
                      <span className="block text-sm text-[#617184]">{shortcut.description}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#005eb8] transition group-hover:translate-x-1" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="cipf-panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#005eb8]">Territorio</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-[#071d41]">Bairros com maior volume</h3>
          </div>
          <Button type="button" variant="outline" onClick={() => setActiveTab('pessoas')} className="rounded-xl">
            Ver lista completa
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {topBairros.map(([bairro, count]) => (
            <div key={bairro} className="rounded-2xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-bold text-[#17324d]">{bairro}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#071d41]">{count}</span>
              </div>
            </div>
          ))}
          {topBairros.length === 0 && <p className="rounded-2xl border border-[#e3e9ef] bg-[#f8fafc] p-4 text-sm text-[#617184]">Nenhum bairro encontrado ainda.</p>}
        </div>
      </section>

      {canViewReports && (
        <section className="cipf-panel p-6 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <p className="cipf-kicker">Relatorios</p>
              <h3 className="cipf-title mt-2 text-2xl">Indicadores e exportacoes</h3>
              <p className="cipf-description mt-2 max-w-2xl text-sm">CSV, PDF e relatorio mensal ficam juntos da visao executiva.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button type="button" variant="outline" onClick={() => exports.exportCsv(registrations)}>
                <FileDown className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => exports.exportPdf(registrations, dashboard.filters)}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => exports.exportMonthlyPdf(registrations)}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Mensal
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
            <InfoCard label="Emitidas mes" value={monthlyReport.issued} tone="green" />
            <InfoCard label="Aprovadas" value={monthlyReport.approved} />
            <InfoCard label="Retiradas mes" value={monthlyReport.pickedUp} tone="green" />
            <InfoCard label="Vencidas" value={monthlyReport.expired} tone="red" />
            <InfoCard label="Pend. docs" value={monthlyReport.documentIssues} tone="amber" />
          </div>
        </section>
      )}
    </div>
  );
}

function Header({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <PageHeader
      eyebrow="Painel executivo"
      title="Visao geral da CIPF"
      description="Indicadores para acompanhar a saude da operacao. Use Aprovar cadastros para conferir documentos e liberar emissoes."
      tone="blue"
      actions={
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    />
  );
}
