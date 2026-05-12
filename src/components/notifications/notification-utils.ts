export const SECRETARIA_RETIRADA = 'Secretaria Municipal de Saúde';

export function onlyDigits(value = '') {
  return value.replace(/\D/g, '');
}

export function maskCpf(value = '') {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value || '-';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function getApprovalWhatsAppUrl(phone = '', fullName = '') {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  const phoneWithCountry = digits.length <= 11 ? `55${digits}` : digits;
  const firstName = fullName.trim().split(/\s+/)[0] || 'paciente';
  const message = `Olá, ${firstName}. Informamos que sua Carteirinha de Fibromialgia foi aprovada. Você já pode comparecer a ${SECRETARIA_RETIRADA} para orientações sobre a retirada.`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}
