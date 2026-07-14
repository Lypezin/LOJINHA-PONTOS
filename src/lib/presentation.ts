export const redemptionLabels = {
  REQUESTED: "Solicitado",
  APPROVED: "Aprovado",
  PREPARING: "Em preparação",
  READY: "Pronto para retirada",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
} as const;

export const redemptionTone = {
  REQUESTED: "info",
  APPROVED: "info",
  PREPARING: "warning",
  READY: "success",
  DELIVERED: "success",
  CANCELED: "danger",
} as const;

export const productLabels = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
} as const;

export const productTone = {
  DRAFT: "neutral",
  ACTIVE: "success",
  INACTIVE: "warning",
  ARCHIVED: "danger",
} as const;

export const matchLabels = {
  PENDING: "Pendente",
  AUTO_MATCHED: "Conciliado automaticamente",
  MANUAL_MATCHED: "Conciliado manualmente",
  AMBIGUOUS: "Correspondência ambígua",
  NOT_FOUND: "Não encontrado",
} as const;

export function formatCpf(value?: string | null) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : value;
}

export function formatCnpj(value?: string | null) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : value;
}

export function monthLabel(year: number, month: number) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.UTC(year, month - 1, 10)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
