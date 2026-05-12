import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractImageFromPdf, QR_PROCESSING_TIMEOUT_MS, scanValidationQrFile } from '@/modules/valida/lib/qrScanner';

const pdfMock = vi.hoisted(() => ({
  getDocument: vi.fn()
}));

const qrMock = vi.hoisted(() => ({
  scanFile: vi.fn(),
  Html5Qrcode: vi.fn()
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: pdfMock.getDocument
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({
  default: 'worker.js'
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: qrMock.Html5Qrcode
}));

const pdfFile = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'qr.pdf', { type: 'application/pdf' });
const pngFile = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'qr.png', { type: 'image/png' });

describe('QR scanner file hardening', () => {
  beforeEach(() => {
    pdfMock.getDocument.mockReset();
    qrMock.scanFile.mockReset();
    qrMock.Html5Qrcode.mockReset();
    qrMock.Html5Qrcode.mockImplementation(function Html5Qrcode() {
      return { scanFile: qrMock.scanFile };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects invalid files before QR parsing', async () => {
    const bad = new File([new Uint8Array([0, 1, 2])], 'qr.pdf', { type: 'application/pdf' });
    await expect(scanValidationQrFile(bad, 'reader')).rejects.toThrow('Assinatura');
    expect(qrMock.Html5Qrcode).not.toHaveBeenCalled();
  });

  it('rejects PDFs with too many pages', async () => {
    pdfMock.getDocument.mockReturnValueOnce({
      promise: Promise.resolve({ numPages: 3 })
    });

    await expect(extractImageFromPdf(pdfFile())).rejects.toThrow('páginas demais');
  });

  it('returns QR params after secure image validation', async () => {
    qrMock.scanFile.mockResolvedValueOnce('https://example.test/valida?id=abc&sig=xyz');
    await expect(scanValidationQrFile(pngFile(), 'reader')).resolves.toEqual({ id: 'abc', sig: 'xyz' });
    expect(qrMock.Html5Qrcode).toHaveBeenCalledWith('reader');
  });

  it('returns a safe timeout error when QR reading hangs', async () => {
    vi.useFakeTimers();
    qrMock.scanFile.mockReturnValueOnce(new Promise(() => undefined));

    const promise = expect(scanValidationQrFile(pngFile(), 'reader')).rejects.toThrow('Tempo limite ao ler o QR Code.');
    await vi.advanceTimersByTimeAsync(QR_PROCESSING_TIMEOUT_MS);

    await promise;
  });
});
