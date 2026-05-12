import { supabase } from '@/lib/supabase';
import { daysUntil } from '@/lib/date';

export type ValidationStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'error';

export type PublicValidationData = {
  id: string;
  fullName: string;
  cpfMasked: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending' | string;
  visualSignature?: string;
  checksum?: string;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSignature(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function normalizeManualRegistryCode(value: string) {
  const trimmed = value.trim();
  if (UUID_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  return trimmed.split('/')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
}

export function formatDisplaySignature(value?: string) {
  const clean = normalizeSignature(value || '').slice(0, 8);
  if (!clean) return '------';
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function getValiditySummary(data: PublicValidationData | null) {
  if (!data?.expiryDate) return 'Validade nao informada.';
  const days = daysUntil(data.expiryDate);
  if (days === null) return 'Validade em formato invalido.';
  if (days < 0) return `Venceu ha ${Math.abs(days)} dia(s).`;
  if (days === 0) return 'Vence hoje.';
  return `Valida por mais ${days} dia(s).`;
}

export function isRateLimitError(error: unknown): boolean {
  const message = String((error as any)?.message || '');
  const details = String((error as any)?.details || '');
  return message.includes('RATE_LIMITED') || details.includes('RATE_LIMITED');
}

export async function fetchPublicValidation(cleanId: string, cleanSig: string) {
  if (cleanId.length < 6 || cleanSig.length < 6) {
    return { data: null, signatureCheckedByDb: false };
  }

  const { data: publicRpcData, error: publicRpcError } = await supabase
    .rpc('validate_cipf_public', { p_registry: cleanId, p_sig: cleanSig })
    .maybeSingle();

  if (!publicRpcError) {
    return { data: publicRpcData as PublicValidationData | null, signatureCheckedByDb: true };
  }

  if (isRateLimitError(publicRpcError)) {
    throw new Error('Limite de consultas excedido. Tente novamente em 1 minuto.');
  }

  throw new Error('Serviço de validação indisponível. Tente novamente mais tarde.');
}
