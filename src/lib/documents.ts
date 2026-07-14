export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(value: string) {
  const cnpj = digitsOnly(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = weights.reduce((sum, weight, index) => sum + Number(cnpj[index]) * weight, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function formatCnpj(value: string) {
  const cnpj = digitsOnly(value).slice(0, 14);
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function maskDocument(value?: string | null) {
  if (!value) return "Não informado";
  const digits = digitsOnly(value);
  return `${digits.slice(0, 2)}${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}
