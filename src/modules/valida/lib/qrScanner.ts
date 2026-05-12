import { FileSecurityError, getSafeFileSecurityMessage, validateFileSecurity, withTimeout } from '@/lib/file-security';

export type QrValidationParams = {
  id: string;
  sig: string;
};

export const QR_PROCESSING_TIMEOUT_MS = 12_000;
export const MAX_QR_PDF_PAGES = 2;

export async function extractImageFromPdf(file: File): Promise<File | null> {
  await validateFileSecurity(file, 'publicQr');
  const pdfjsLib = await import('pdfjs-dist');
  const pdfWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  if (pdf.numPages > MAX_QR_PDF_PAGES) throw new FileSecurityError('PDF com páginas demais para validação.');

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], 'pdf-page.png', { type: 'image/png' }) : null);
    }, 'image/png');
  });
}

export function extractValidationParamsFromQrText(decodedText: string): QrValidationParams | null {
  let url: URL;
  try {
    url = new URL(decodedText);
  } catch {
    return null;
  }
  const id = url.searchParams.get('id');
  const sig = url.searchParams.get('sig');
  if (!id || !sig) return null;
  return { id, sig };
}

export async function scanValidationQrFile(file: File, readerElementId: string): Promise<QrValidationParams> {
  try {
    await validateFileSecurity(file, 'publicQr');
    let fileToScan = file;

    if (file.type === 'application/pdf') {
      const extractedImage = await withTimeout(extractImageFromPdf(file), QR_PROCESSING_TIMEOUT_MS, 'Tempo limite ao processar o PDF.');
      if (!extractedImage) throw new FileSecurityError('Não foi possível processar o PDF.');
      fileToScan = extractedImage;
    }

    const { Html5Qrcode } = await import('html5-qrcode');
    const html5QrCode = new Html5Qrcode(readerElementId);
    const decodedText = await withTimeout(html5QrCode.scanFile(fileToScan, true), QR_PROCESSING_TIMEOUT_MS, 'Tempo limite ao ler o QR Code.');
    const params = extractValidationParamsFromQrText(decodedText);
    if (!params) throw new FileSecurityError('QR Code inválido. Não foi possível extrair os dados da carteirinha.');
    return params;
  } catch (error) {
    const safeMessage = getSafeFileSecurityMessage(error);
    if (safeMessage !== 'Arquivo inválido. Verifique o formato e tente novamente.') throw new Error(safeMessage);
    throw error;
  }
}
