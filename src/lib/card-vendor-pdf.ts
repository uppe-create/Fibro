import { getStatusLabel, isPrintableStatus } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';

export type CardVendorPdfTarget = {
  registration: CIPFRegistration;
  photoDataUri: string;
};

export type CardVendorPdfRow = {
  id: string;
  fullName: string;
  cpfDigits: string;
  cpfFormatted: string;
  cns: string;
  birthDate: string;
  cid: string;
  registryNumber: string;
  issueDate: string;
  expiryDate: string;
  statusLabel: string;
  visualCode: string;
  photoDataUri: string;
};

export function toDigits(value = ''): string {
  return value.replace(/\D/g, '');
}

export function formatCpf(cpf = ''): string {
  const digits = toDigits(cpf);
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatRegistro(id: string, year = new Date().getFullYear()): string {
  return `${id.substring(0, 8).toUpperCase()}/${year}`;
}

export function formatManualSignature(signature?: string): string {
  const cleanSignature = (signature || '------').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const printableSignature = cleanSignature.slice(0, 8);
  return printableSignature.length > 4
    ? `${printableSignature.slice(0, 4)}-${printableSignature.slice(4)}`
    : printableSignature;
}

export function getCardVendorPdfTargets(
  registrations: CIPFRegistration[],
  selectedReg: CIPFRegistration | null,
  batchIds: string[]
): CIPFRegistration[] {
  if (batchIds.length > 0) {
    const byId = new Map(registrations.map((registration) => [registration.id, registration]));
    return batchIds
      .map((id) => byId.get(id) || null)
      .filter((registration): registration is CIPFRegistration => Boolean(registration) && isPrintableStatus(registration.status));
  }

  return selectedReg && isPrintableStatus(selectedReg.status) ? [selectedReg] : [];
}

export function buildCardVendorPdfRows(targets: CardVendorPdfTarget[], year = new Date().getFullYear()): CardVendorPdfRow[] {
  return targets.map(({ registration, photoDataUri }) => ({
    id: registration.id,
    fullName: registration.fullName,
    cpfDigits: toDigits(registration.cpf),
    cpfFormatted: formatCpf(registration.cpf),
    cns: toDigits(registration.cns || ''),
    birthDate: registration.birthDate || '-',
    cid: registration.cid || 'M79.7',
    registryNumber: formatRegistro(registration.id, year),
    issueDate: registration.issueDate || '-',
    expiryDate: registration.expiryDate || '-',
    statusLabel: getStatusLabel(registration.status),
    visualCode: formatManualSignature(registration.visualSignature),
    photoDataUri
  }));
}

export function getCardVendorPdfFileName(targets: CardVendorPdfTarget[], now = new Date()): string {
  if (targets.length === 1) {
    return `ficha_grafica_${toDigits(targets[0].registration.cpf)}.pdf`;
  }

  return `fichas_grafica_lote_${now.toISOString().slice(0, 10)}.pdf`;
}

async function normalizePhotoDataUriForPdf(dataUri: string): Promise<string> {
  if (!dataUri) return '';
  if (dataUri.startsWith('data:image/jpeg') || dataUri.startsWith('data:image/jpg')) return dataUri;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width || 240;
      canvas.height = image.naturalHeight || image.height || 320;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve('');
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.onerror = () => resolve('');
    image.src = dataUri;
  });
}

function drawField(doc: any, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(value || '-', width);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 5;
}

export async function generateCardVendorPdf(targets: CardVendorPdfTarget[]): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const now = new Date();
  const rows = buildCardVendorPdfRows(targets, now.getFullYear());
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (index > 0) doc.addPage('a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Ficha tecnica para confeccao', 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Gerado em ${now.toLocaleString('pt-BR')}`, 15, 24);

    doc.setDrawColor(203, 213, 225);
    doc.line(15, 28, 195, 28);

    doc.setDrawColor(148, 163, 184);
    doc.rect(152, 34, 38, 50);
    const normalizedPhoto = await normalizePhotoDataUriForPdf(row.photoDataUri);
    if (normalizedPhoto) {
      doc.addImage(normalizedPhoto, 'JPEG', 152, 34, 38, 50);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Foto', 171, 56, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('indisponivel', 171, 62, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Identificacao', 15, 38);
    let y = 45;
    y = drawField(doc, 'Nome completo', row.fullName, 15, y, 125);
    y = drawField(doc, 'CPF', row.cpfFormatted, 15, y + 3, 55);
    y = drawField(doc, 'Cartao SUS/CNS', row.cns || '-', 80, y - 8, 60);
    y = drawField(doc, 'Data de nascimento', row.birthDate, 15, y + 3, 55);
    y = drawField(doc, 'CID', row.cid, 80, y - 8, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dados de producao', 15, 108);
    y = 115;
    y = drawField(doc, 'Registro CIPF', row.registryNumber, 15, y, 55);
    y = drawField(doc, 'Emissao', row.issueDate, 80, y - 8, 40);
    y = drawField(doc, 'Validade', row.expiryDate, 125, y - 8, 40);
    y = drawField(doc, 'Status', row.statusLabel, 15, y + 3, 55);
    y = drawField(doc, 'Codigo manual', row.visualCode || '-', 80, y - 8, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Observacao operacional', 15, 162);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const observation = doc.splitTextToSize(
      'Documento tecnico para envio a empresa de confeccao. Nao usar como documento final do titular.',
      175
    );
    doc.text(observation, 15, 169);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 280, 195, 280);
    doc.setFontSize(9);
    doc.text(`Pagina ${index + 1} de ${rows.length}`, 15, 286);
    doc.text(`ID interno ${row.id}`, 195, 286, { align: 'right' });
  }

  doc.save(getCardVendorPdfFileName(targets, now));
}
