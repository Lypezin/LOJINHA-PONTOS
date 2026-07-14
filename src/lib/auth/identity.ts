const CPF_LENGTH = 11;

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, CPF_LENGTH);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function cpfStorageCandidates(value: string) {
  const cpf = normalizeCpf(value);
  return Array.from(new Set([cpf, formatCpf(cpf)]));
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);

  if (cpf.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }

    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
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
