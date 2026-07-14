import { digitsOnly, formatCnpj as formatDocumentCnpj, isValidCnpj as validateCnpj } from "@/lib/documents";

export function normalizeCnpj(value: string) {
  return digitsOnly(value);
}

export function formatCnpj(value: string) {
  const digits = normalizeCnpj(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/^(\d{2})(\d+)/, "$1.$2");
  if (digits.length <= 8) return digits.replace(/^(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (digits.length <= 12) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
}

export function cnpjStorageCandidates(value: string) {
  const cnpj = normalizeCnpj(value);
  return Array.from(new Set([cnpj, formatDocumentCnpj(cnpj)]));
}

export function isValidCnpj(value: string) {
  return validateCnpj(value);
}

export function normalizeEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function getPasswordError(value: string) {
  if (value.length < 8) return "Use pelo menos 8 caracteres.";
  if (new TextEncoder().encode(value).length > 72) {
    return "A senha deve ter no máximo 72 bytes.";
  }
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
    return "Inclua pelo menos uma letra e um número.";
  }

  return null;
}

export function isStrongPassword(value: string) {
  return getPasswordError(value) === null;
}
