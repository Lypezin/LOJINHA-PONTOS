"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { CircleDollarSign, Pencil, Search, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatPoints } from "@/lib/format";
import { formatCnpj, matchLabels } from "@/lib/presentation";

type CourierStatus = "PENDING" | "ACTIVE" | "INACTIVE";
type MatchStatus = keyof typeof matchLabels;

export type AdminCourier = {
  id: string;
  name: string;
  cnpj: string | null;
  status: CourierStatus;
  cnpjMatchStatus: MatchStatus;
  plaza: string | null;
  subPlaza: string | null;
  email: string | null;
  lastImportedAt: string | null;
  balance: number;
  importedPoints: number;
  redeemedPoints: number;
};

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function courierTone(status: CourierStatus) {
  return status === "ACTIVE" ? "success" : status === "PENDING" ? "warning" : "danger";
}

function courierLabel(status: CourierStatus) {
  return status === "ACTIVE" ? "Ativo" : status === "PENDING" ? "Pendente" : "Inativo";
}

function EditCourierDialog({ courier, onSaved }: { courier: AdminCourier; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: courier.name, cnpj: courier.cnpj ?? "", status: courier.status, plaza: courier.plaza ?? "", subPlaza: courier.subPlaza ?? "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft({ name: courier.name, cnpj: courier.cnpj ?? "", status: courier.status, plaza: courier.plaza ?? "", subPlaza: courier.subPlaza ?? "" });
      setError("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/couriers/${courier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, cnpj: draft.cnpj || null, plaza: draft.plaza || null, subPlaza: draft.subPlaza || null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o entregador.");
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o entregador.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Trigger asChild><Button variant="ghost" size="sm"><Pencil className="size-4" aria-hidden="true" />Editar</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-balance text-xl font-extrabold text-[var(--brand-navy)]">Editar entregador</Dialog.Title><Dialog.Description className="mt-2 text-pretty text-sm leading-6 text-slate-600">Corrija os dados de cadastro usados no vínculo com a planilha.</Dialog.Description></div><Dialog.Close asChild><button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar edição"><X className="size-5" aria-hidden="true" /></button></Dialog.Close></div>
          <form onSubmit={save} className="mt-6 space-y-4">
            <div><label htmlFor={`courier-name-${courier.id}`} className="mb-1.5 block text-sm font-bold">Nome completo</label><input id={`courier-name-${courier.id}`} className={fieldClass} value={draft.name} minLength={2} required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div>
            <div><label htmlFor={`courier-cnpj-${courier.id}`} className="mb-1.5 block text-sm font-bold">CNPJ</label><input id={`courier-cnpj-${courier.id}`} className={`${fieldClass} tabular-nums`} value={draft.cnpj} inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, cnpj: event.target.value }))} placeholder="00.000.000/0000-00" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`courier-plaza-${courier.id}`} className="mb-1.5 block text-sm font-bold">Praça</label><input id={`courier-plaza-${courier.id}`} className={fieldClass} value={draft.plaza} onChange={(event) => setDraft((current) => ({ ...current, plaza: event.target.value }))} /></div><div><label htmlFor={`courier-subplaza-${courier.id}`} className="mb-1.5 block text-sm font-bold">Subpraça</label><input id={`courier-subplaza-${courier.id}`} className={fieldClass} value={draft.subPlaza} onChange={(event) => setDraft((current) => ({ ...current, subPlaza: event.target.value }))} /></div></div>
            <div><label htmlFor={`courier-status-${courier.id}`} className="mb-1.5 block text-sm font-bold">Status do cadastro</label><select id={`courier-status-${courier.id}`} className={fieldClass} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as CourierStatus }))}><option value="PENDING">Pendente</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></div>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><Dialog.Close asChild><Button variant="secondary" disabled={pending}>Cancelar</Button></Dialog.Close><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar alterações"}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AdjustPointsDialog({ courier, onSaved }: { courier: AdminCourier; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const numericAmount = Number(amount || 0);
  const after = courier.balance + numericAmount;

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount("");
      setDescription("");
      setError("");
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(numericAmount) || numericAmount === 0) {
      setError("Informe uma quantidade inteira, positiva ou negativa, diferente de zero.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/points/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courierId: courier.id, amount: numericAmount, description, idempotencyKey }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível ajustar os pontos.");
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ajustar os pontos.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpen}>
      <AlertDialog.Trigger asChild><Button variant="secondary" size="sm"><CircleDollarSign className="size-4" aria-hidden="true" />Ajustar pontos</Button></AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Lançamento auditável</p><AlertDialog.Title className="mt-1 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Ajustar pontos de {courier.name}</AlertDialog.Title></div><AlertDialog.Cancel asChild><button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar ajuste"><X className="size-5" aria-hidden="true" /></button></AlertDialog.Cancel></div>
          <AlertDialog.Description className="mt-3 text-pretty text-sm leading-6 text-slate-600">Use valor positivo para adicionar ou negativo para remover. O motivo ficará registrado no extrato.</AlertDialog.Description>
          <form onSubmit={adjust} className="mt-5 space-y-4">
            <div><label htmlFor={`amount-${courier.id}`} className="mb-1.5 block text-sm font-bold">Quantidade de pontos</label><input id={`amount-${courier.id}`} type="number" step="1" required className={`${fieldClass} tabular-nums`} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex.: 50 ou -20" /></div>
            <div><label htmlFor={`reason-${courier.id}`} className="mb-1.5 block text-sm font-bold">Motivo do ajuste</label><textarea id={`reason-${courier.id}`} required minLength={8} maxLength={300} className={`${fieldClass} min-h-24 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva por que este ajuste está sendo feito" /></div>
            <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><dt className="text-slate-500">Saldo antes</dt><dd className="mt-1 font-extrabold tabular-nums">{formatPoints(courier.balance)} pts</dd></div><div><dt className="text-slate-500">Saldo depois</dt><dd className={after < 0 ? "mt-1 font-extrabold tabular-nums text-red-700" : "mt-1 font-extrabold tabular-nums text-[var(--brand-mint-ink)]"}>{formatPoints(after)} pts</dd></div></dl>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button variant="secondary" disabled={pending}>Cancelar</Button></AlertDialog.Cancel><Button type="submit" disabled={pending || after < 0}>{pending ? "Registrando ajuste…" : "Confirmar ajuste"}</Button></div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function CourierManager({ couriers, total, page, query, status }: { couriers: AdminCourier[]; total: number; page: number; query: string; status: "ALL" | CourierStatus }) {
  const router = useRouter();
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const refresh = () => router.refresh();
  const pageHref = (nextPage: number) => `/admin/entregadores?page=${nextPage}${query ? `&q=${encodeURIComponent(query)}` : ""}${status !== "ALL" ? `&status=${status}` : ""}`;

  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-col gap-3 sm:flex-row"><label className="relative block max-w-lg flex-1"><span className="sr-only">Buscar entregador</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input name="q" className={`${fieldClass} pl-10`} defaultValue={query} placeholder="Buscar por nome, CNPJ ou e-mail" /></label><label><span className="sr-only">Filtrar cadastro por status</span><select name="status" className={`${fieldClass} sm:w-48`} defaultValue={status}><option value="ALL">Todos os status</option><option value="ACTIVE">Ativos</option><option value="PENDING">Pendentes</option><option value="INACTIVE">Inativos</option></select></label><Button type="submit" variant="secondary">Buscar</Button></form>
      {couriers.length ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
          {couriers.map((courier) => (
            <article key={courier.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="line-clamp-2 text-balance text-lg font-extrabold text-[var(--brand-navy)]">{courier.name}</h2><p className="mt-1 truncate text-sm text-slate-600">{courier.email || "Ainda sem conta de acesso"}</p></div><StatusBadge tone={courierTone(courier.status)}>{courierLabel(courier.status)}</StatusBadge></div>
              <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><dt className="text-xs font-semibold text-slate-500">CNPJ</dt><dd className="mt-1 font-bold tabular-nums text-[var(--brand-navy)]">{formatCnpj(courier.cnpj)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Praça</dt><dd className="mt-1 font-bold text-[var(--brand-navy)]">{courier.plaza || "Não informada"}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Conciliação</dt><dd className="mt-1 font-bold text-[var(--brand-navy)]">{matchLabels[courier.cnpjMatchStatus]}</dd></div></dl>
              <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Saldo</p><p className="mt-1 font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(courier.balance)}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Importados</p><p className="mt-1 font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(courier.importedPoints)}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Usados</p><p className="mt-1 font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(courier.redeemedPoints)}</p></div></div>
              {courier.lastImportedAt ? <p className="mt-3 text-xs tabular-nums text-slate-500">Atualizado pela planilha em {formatDate(courier.lastImportedAt)}</p> : null}
              <div className="mt-5 flex flex-wrap justify-end gap-2"><EditCourierDialog courier={courier} onSaved={refresh} /><AdjustPointsDialog courier={courier} onSaved={refresh} /></div>
            </article>
          ))}
          </div>
          {pageCount > 1 ? (
            <nav className="flex flex-col items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-4 sm:flex-row" aria-label="Páginas de entregadores">
              <p className="text-sm text-slate-600"><span className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(total)}</span> entregadores • página <span className="font-bold tabular-nums">{page} de {pageCount}</span></p>
              <div className="flex gap-2">{page > 1 ? <Link href={pageHref(page - 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>Anterior</Link> : null}{page < pageCount ? <Link href={pageHref(page + 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>Próxima</Link> : null}</div>
            </nav>
          ) : null}
        </>
      ) : <EmptyState icon={<UsersRound className="size-6" />} title={query || status !== "ALL" ? "Nenhum entregador encontrado" : "Nenhum entregador importado"} description={query || status !== "ALL" ? "Revise a busca ou o filtro selecionado." : "Importe a planilha mensal para criar a base de entregadores."} action={query || status !== "ALL" ? <Link href="/admin/entregadores" className={buttonStyles({ variant: "secondary" })}>Limpar filtros</Link> : undefined} />}
    </div>
  );
}
