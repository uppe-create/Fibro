import {
  buildMonthlyReport,
  maskCpf,
  normalizeForExport,
  type StatusFilter
} from '@/lib/dashboard-utils';
import { authorizeAdminExport, isSecureAdminBackendEnabled } from '@/lib/admin-rpc';
import { buildAuditEvent, type AuditEventInput } from '@/lib/audit-events';
import { getStatusLabel } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';

type ExportOptions = {
  writeAudit: (event: AuditEventInput) => Promise<void>;
  exportDatabase: () => Promise<void>;
  onError: (message: string) => void;
};

export function safeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

export function useDashboardExports({ writeAudit, exportDatabase, onError }: ExportOptions) {
  const useBackendAuthorization = isSecureAdminBackendEnabled();

  const run = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (error: any) {
      onError(error?.message || 'Erro ao exportar dados.');
    }
  };

  const exportCsv = (registrations: CIPFRegistration[]) =>
    run(async () => {
      await authorizeAdminExport('dashboard_csv', { count: registrations.length });
      const rows = registrations.map(normalizeForExport);
      const headers = Object.keys(rows[0] || normalizeForExport({ id: '', fullName: '', cpf: '', birthDate: '', photoUrl: '', issueDate: '', expiryDate: '', status: 'under_review' } as CIPFRegistration));
      const csv = [headers.map(safeCsvCell).join(';'), ...rows.map((row) => headers.map((header) => safeCsvCell((row as any)[header])).join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dashboard_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      if (!useBackendAuthorization) {
        await writeAudit(buildAuditEvent('export.dashboard_csv', { details: `${registrations.length} registros exportados` }));
      }
    });

  const exportPdf = (
    registrations: CIPFRegistration[],
    filters: { cidFilter: string; bairroFilter: string; statusFilter: StatusFilter; expiryFilter: string }
  ) =>
    run(async () => {
      await authorizeAdminExport('dashboard_pdf', filters);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const now = new Date();
      doc.setFontSize(14);
      doc.text('Relatorio Dashboard CIPF - Prefeitura de Ipero', 10, 12);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${now.toLocaleString('pt-BR')}`, 10, 18);
      const statusFilterLabel = filters.statusFilter === 'all' ? 'Todos' : getStatusLabel(filters.statusFilter);
      doc.text(`Filtros: CID=${filters.cidFilter} | Bairro=${filters.bairroFilter} | Status=${statusFilterLabel} | Vencimento=${filters.expiryFilter}`, 10, 24);
      let y = 34;
      registrations.slice(0, 32).forEach((reg) => {
        if (y > 280) return;
        doc.text(reg.fullName.slice(0, 48), 10, y);
        doc.text(maskCpf(reg.cpf), 92, y);
        doc.text(getStatusLabel(reg.status), 142, y);
        doc.text(reg.expiryDate || '-', 178, y);
        y += 7;
      });
      doc.save(`dashboard_relatorio_${now.toISOString().slice(0, 10)}.pdf`);
      if (!useBackendAuthorization) {
        await writeAudit(buildAuditEvent('export.dashboard_pdf', { details: `${registrations.length} registros exportados` }));
      }
    });

  const exportMonthlyPdf = (registrations: CIPFRegistration[]) =>
    run(async () => {
      await authorizeAdminExport('monthly_pdf', { count: registrations.length });
      const report = buildMonthlyReport(registrations);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const now = new Date();
      doc.setFontSize(15);
      doc.text('Relatorio mensal CIPF', 12, 14);
      doc.setFontSize(10);
      doc.text(`Competencia: ${report.monthLabel}`, 12, 21);
      doc.text(`Gerado em: ${now.toLocaleString('pt-BR')}`, 12, 27);
      let y = 39;
      [
        `Emitidas no mes: ${report.issued}`,
        `Aprovadas aguardando emissao: ${report.approved}`,
        `Retiradas confirmadas no mes: ${report.pickedUp}`,
        `Vencidas na base: ${report.expired}`,
        `Cadastros com pendencias documentais: ${report.documentIssues}`
      ].forEach((line) => {
        doc.text(line, 14, y);
        y += 7;
      });
      y += 6;
      doc.text('Bairros com maior volume', 12, y);
      y += 7;
      Object.entries(report.bairroStats)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 12)
        .forEach(([bairro, count]) => {
          doc.text(`${bairro}: ${count}`, 14, y);
          y += 6;
        });
      doc.save(`relatorio_mensal_cipf_${now.toISOString().slice(0, 10)}.pdf`);
      if (!useBackendAuthorization) {
        await writeAudit(buildAuditEvent('export.monthly_pdf', { details: `Competencia ${report.monthLabel}` }));
      }
    });

  const guidedBackup = () =>
    run(async () => {
      await authorizeAdminExport('backup_json');
      await exportDatabase();
      if (!useBackendAuthorization) {
        await writeAudit(buildAuditEvent('system.backup_downloaded', { details: 'Copia de seguranca baixada manualmente pelo dashboard' }));
      }
    });

  return { exportCsv, exportPdf, exportMonthlyPdf, guidedBackup };
}
