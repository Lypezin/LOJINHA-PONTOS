"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Check, PackageCheck, Search, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatPoints } from "@/lib/format";
import { redemptionLabels, redemptionTone } from "@/lib/presentation";

type RedemptionStatus = keyof typeof redemptionLabels;

export type AdminRedemption = {
  id: string;
  code: string;
  courierName: string;
  courierCpf: string | null;
  productName: string;
  quantity: number;
  pointsSpent: number;
  status: RedemptionStatus;
  periodKey: string;
  requestedAt: string;
};

const nextStatus: Partial<Record<RedemptionStatus, { status: RedemptionStatus; label: string }>> = {
  REQUESTED: { status: "APPROVED", label: "Aprovar" },
  APPROVED: { status: "PREPARING", label: "Iniciar preparo" },
  PREPARING: { status: "READY", label: "Marcar como pronto" },
  READY: { status: "DELIVERED", label: "Confirmar entrega" },
};

const fieldClass = "min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

export function RedemptionManager({ redemptions, page, total }: { redemptions: AdminRedemption[]; page: number; total: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | RedemptionStatus>("ALL");
  const [pendingId, setPendingId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const filtered = useMemo(() => redemptions.filter((item) => {
    const haystack = `${item.code} ${item.courierName} ${item.productName}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query.trim().toLocaleLowerCase("pt-BR")) && (status === "ALL" || item.status === status);
  }), [redemptions, query, status]);

  async function update(id: string, value: RedemptionStatus) {
    setPendingId(id);
    setErrors((current) => ({ ...current, [id]: "" }));
    try {
      const response = await fetch(`/api/admin/redemptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o resgate.");
      router.refresh();
    } catch (caught) {
      setErrors((current) => ({ ...current, [id]: caught instanceof Error ? caught.message : "Não foi possível atualizar o resgate." }));
    } finally {
      setPendingId("");
    }
  }

  function Actions({ item }: { item: AdminRedemption }) {
    const next = nextStatus[item.status];
    const canCancel = !["DELIVERED", "CANCELED"].includes(item.status);
    if (!next && !canCancel) return <span className="text-xs font-semibold text-slate-500">Fluxo encerrado</span>;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {next ? <Button size="sm" onClick={() => void update(item.id, next.status)} disabled={pendingId === item.id}><Check className="size-4" aria-hidden="true" />{pendingId === item.id ? "Atualizando…" : next.label}</Button> : null}
        {canCancel ? (
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild><Button variant="ghost" size="sm" disabled={pendingId === item.id}><XCircle className="size-4 text-red-700" aria-hidden="true" />Cancelar</Button></AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
              <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white p-6 shadow-xl focus:outline-none">
                <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-red-700">Ação de cancelamento</p><AlertDialog.Title className="mt-1 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Cancelar o resgate {item.code}?</AlertDialog.Title></div><AlertDialog.Cancel asChild><button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar confirmação"><X className="size-5" aria-hidden="true" /></button></AlertDialog.Cancel></div>
                <AlertDialog.Description className="mt-3 text-pretty text-sm leading-6 text-slate-600">O estoque será devolvido. Se a competência ainda estiver aberta, os <strong className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(item.pointsSpent)} pontos</strong> também voltarão ao saldo do entregador.</AlertDialog.Description>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button variant="secondary">Manter resgate</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button variant="danger" onClick={() => void update(item.id, "CANCELED")}>Confirmar cancelamento</Button></AlertDialog.Action></div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative block max-w-lg flex-1"><span className="sr-only">Buscar resgate</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input className={`${fieldClass} w-full pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, entregador ou item" /></label>
        <label><span className="sr-only">Filtrar por status</span><select className={`${fieldClass} w-full sm:w-52`} value={status} onChange={(event) => setStatus(event.target.value as "ALL" | RedemptionStatus)}><option value="ALL">Todos os status</option>{Object.entries(redemptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      {filtered.length ? (
        <>
          <div className="hidden overflow-hidden rounded-[20px] border border-slate-200 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-5 py-3 font-bold">Resgate</th><th scope="col" className="px-4 py-3 font-bold">Entregador</th><th scope="col" className="px-4 py-3 font-bold">Item</th><th scope="col" className="px-4 py-3 font-bold">Status</th><th scope="col" className="px-5 py-3 text-right font-bold">Próximo passo</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => <tr key={item.id} className="align-top"><td className="px-5 py-4"><p className="font-extrabold tabular-nums text-[var(--brand-navy)]">{item.code}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{formatDateTime(item.requestedAt)} • {item.periodKey}</p></td><td className="px-4 py-4"><p className="font-bold text-[var(--brand-navy)]">{item.courierName}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{item.courierCpf ?? "CPF não informado"}</p></td><td className="px-4 py-4"><p className="font-bold text-[var(--brand-navy)]">{item.productName}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{item.quantity} un. • {formatPoints(item.pointsSpent)} pts</p></td><td className="px-4 py-4"><StatusBadge tone={redemptionTone[item.status]}>{redemptionLabels[item.status]}</StatusBadge>{errors[item.id] ? <p className="mt-2 max-w-xs text-xs font-semibold text-red-700" role="alert">{errors[item.id]}</p> : null}</td><td className="px-5 py-4"><Actions item={item} /></td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 lg:hidden">
            {filtered.map((item) => <article key={item.id} className="rounded-[20px] border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold tabular-nums text-[var(--brand-navy)]">{item.code}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{formatDateTime(item.requestedAt)}</p></div><StatusBadge tone={redemptionTone[item.status]}>{redemptionLabels[item.status]}</StatusBadge></div><div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-500">Entregador</p><p className="mt-1 font-bold text-[var(--brand-navy)]">{item.courierName}</p></div><div><p className="text-xs font-semibold text-slate-500">Item</p><p className="mt-1 font-bold text-[var(--brand-navy)]">{item.quantity}x {item.productName}</p><p className="mt-1 text-xs font-extrabold tabular-nums text-slate-600">{formatPoints(item.pointsSpent)} pts</p></div></div>{errors[item.id] ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{errors[item.id]}</p> : null}<div className="mt-4"><Actions item={item} /></div></article>)}
          </div>
        </>
      ) : (
        <EmptyState icon={<PackageCheck className="size-6" />} title={redemptions.length ? "Nenhum resgate encontrado" : "A fila de resgates está vazia"} description={redemptions.length ? "Revise a busca ou o filtro selecionado." : "Novos pedidos aparecerão aqui para aprovação, preparo e entrega."} action={redemptions.length ? <Button variant="secondary" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar filtros</Button> : undefined} />
      )}
      {total > 50 ? (
        <nav className="flex flex-col items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-4 sm:flex-row" aria-label="Páginas de resgates">
          <p className="text-sm text-slate-600"><span className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(total)}</span> resgates • página <span className="font-bold tabular-nums">{page} de {Math.ceil(total / 50)}</span></p>
          <div className="flex gap-2">{page > 1 ? <Link href={`/admin/resgates?page=${page - 1}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Anterior</Link> : <span className={buttonStyles({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-50" })}>Anterior</span>}{page < Math.ceil(total / 50) ? <Link href={`/admin/resgates?page=${page + 1}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Próxima</Link> : <span className={buttonStyles({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-50" })}>Próxima</span>}</div>
        </nav>
      ) : null}
    </div>
  );
}
