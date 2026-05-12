import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, FileDown, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { ModalShell } from '@/components/ui/modal-shell';
import { buildMonthlyReport } from '@/lib/dashboard-utils';
import { useAppStore } from '@/store/useAppStore';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { useDashboardExports } from './dashboard/hooks/useDashboardExports';
import { useRegistrationWorkflow } from './dashboard/hooks/useRegistrationWorkflow';
import { InfoCard } from './dashboard/components/StatusParts';

export function Relatorios() {
  const { registrations, currentUser, fetchRegistrations, exportDatabase } = useAppStore();
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const dashboard = useDashboardData(registrations);
  const workflow = useRegistrationWorkflow({ currentUser, reload: async () => fetchRegistrations(), onError: setMessage });
  const exports = useDashboardExports({ writeAudit: workflow.writeAudit, exportDatabase, onError: setMessage });

  const monthlyReport = useMemo(() => buildMonthlyReport(registrations), [registrations]);
  const topBairros = useMemo(
    () =>
      Object.entries(monthlyReport.bairroStats)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 8),
    [monthlyReport.bairroStats]
  );

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar relatórios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const confirmBackup = async () => {
    await exports.guidedBackup();
    setBackupOpen(false);
  };

  return (
    <div className="cipf-page cipf-page-stack">
      <Header onRefresh={loadData} isLoading={isLoading} />

      {(loadError || message) && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError || message}</div>}

      <section className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
        <InfoCard label="Emitidas mês" value={monthlyReport.issued} tone="green" />
        <InfoCard label="Aprovadas" value={monthlyReport.approved} tone="purple" />
        <InfoCard label="Retiradas mês" value={monthlyReport.pickedUp} tone="green" />
        <InfoCard label="Vencidas" value={monthlyReport.expired} tone="red" />
        <InfoCard label="Pend. docs" value={monthlyReport.documentIssues} tone="amber" />
      </section>

      <section className="cipf-panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="cipf-kicker">Exportações</p>
            <h3 className="cipf-title mt-2 text-2xl">Relatórios administrativos</h3>
            <p className="cipf-description mt-2 max-w-2xl text-sm">Arquivos podem conter dados pessoais. Baixe apenas em computador autorizado.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button type="button" variant="outline" onClick={() => exports.exportCsv(registrations)} className="h-11 rounded-xl">
              <FileDown className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => exports.exportPdf(registrations, dashboard.filters)} className="h-11 rounded-xl">
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => exports.exportMonthlyPdf(registrations)} className="h-11 rounded-xl">
              <CalendarClock className="mr-2 h-4 w-4" />
              Mensal
            </Button>
            <Button type="button" onClick={() => setBackupOpen(true)}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Backup
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1fr]">
          <div className="cipf-subpanel p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">Competência</p>
            <h4 className="cipf-title mt-2 text-2xl">{monthlyReport.monthLabel}</h4>
            <p className="cipf-description mt-3 text-sm">O relatório mensal resume emissões, retiradas, vencimentos e pendências documentais para acompanhamento interno.</p>
          </div>

          <div className="cipf-subpanel bg-white p-5">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">Bairros com maior volume</p>
            <div className="space-y-3">
              {topBairros.map(([bairro, count]) => {
                const max = Math.max(...topBairros.map(([, value]) => Number(value)), 1);
                return (
                  <div key={bairro}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-[#17324d]">{bairro}</span>
                      <span className="font-black text-[#071d41]">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#eef3f8]">
                      <progress
                        className="cipf-progress cipf-progress-blue h-full w-full"
                        max={max}
                        value={Number(count)}
                        aria-label={`${bairro}: ${count}`}
                      />
                    </div>
                  </div>
                );
              })}
              {!topBairros.length && <p className="text-sm text-[#617184]">Ainda não há dados suficientes para exibir bairros.</p>}
            </div>
          </div>
        </div>
      </section>

      {backupOpen && (
        <ModalShell open onClose={() => setBackupOpen(false)} title="Baixar cópia de segurança" description="O arquivo pode conter dados pessoais e documentos sensíveis." size="md">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Guarde o backup somente em local autorizado pela Secretaria. Não envie por aplicativos pessoais.
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBackupOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmBackup}>Baixar backup</Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function Header({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <PageHeader
      eyebrow="Relatórios"
      title="Indicadores e exportações"
      description="Área concentrada para CSV, PDF, relatório mensal e backup guiado."
      tone="purple"
      actions={
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    />
  );
}
