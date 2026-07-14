"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { CheckCircle2, Link2, Search, UserRoundSearch, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCnpj, matchLabels } from "@/lib/presentation";

type MatchStatus = keyof typeof matchLabels;
export type ReconciliationEntry = { id: string; sourceName: string; cnpj: string; sourceRow: number; matchStatus: MatchStatus; matchScore: number | null; notes: string | null };
export type ReconciliationCourier = { id: string; name: string; cnpj: string | null };

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function ReconcileDialog({ entry, couriers, onSaved }: { entry: ReconciliationEntry; couriers: ReconciliationCourier[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selected = couriers.find((courier) => courier.id === courierId);

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setCourierId("");
      setNotes(entry.notes ?? "");
      setError("");
    }
  }

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reconciliation/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courierId, notes: notes || undefined }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível confirmar o vínculo.");
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível confirmar o vínculo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpen}>
      <AlertDialog.Trigger asChild><Button><Link2 className="size-4" aria-hidden="true" />Resolver vínculo</Button></AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Conciliação manual</p><AlertDialog.Title className="mt-1 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Vincular CNPJ a um entregador</AlertDialog.Title></div><AlertDialog.Cancel asChild><button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar conciliação"><X className="size-5" aria-hidden="true" /></button></AlertDialog.Cancel></div>
          <AlertDialog.Description className="mt-3 text-pretty text-sm leading-6 text-slate-600">Compare os dois lados com atenção. A confirmação gravará o CNPJ no cadastro escolhido.</AlertDialog.Description>
          <form onSubmit={reconcile} className="mt-6 space-y-5">
            <div><label htmlFor={`courier-link-${entry.id}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Entregador correspondente</label><select id={`courier-link-${entry.id}`} required className={fieldClass} value={courierId} onChange={(event) => setCourierId(event.target.value)}><option value="">Selecione pelo nome</option>{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name} — {courier.cnpj ? formatCnpj(courier.cnpj) : "sem CNPJ"}</option>)}</select></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-labelledby={`source-${entry.id}`}><p className="text-xs font-bold text-amber-900">Origem: DADOS CNPJ</p><h3 id={`source-${entry.id}`} className="mt-2 text-balance font-extrabold text-[var(--brand-navy)]">{entry.sourceName}</h3><p className="mt-2 text-sm font-bold tabular-nums text-slate-700">{formatCnpj(entry.cnpj)}</p><p className="mt-1 text-xs tabular-nums text-slate-500">Linha {entry.sourceRow}</p></section>
              <section className={selected ? "rounded-2xl border border-blue-200 bg-blue-50 p-4" : "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"} aria-labelledby={`target-${entry.id}`}><p className="text-xs font-bold text-[var(--brand-blue-dark)]">Destino: entregador</p>{selected ? <><h3 id={`target-${entry.id}`} className="mt-2 text-balance font-extrabold text-[var(--brand-navy)]">{selected.name}</h3><p className="mt-2 text-sm font-bold tabular-nums text-slate-700">{formatCnpj(selected.cnpj)}</p></> : <p id={`target-${entry.id}`} className="mt-4 text-pretty text-sm leading-6 text-slate-500">Selecione um entregador para comparar os dados.</p>}</section>
            </div>
            <div><label htmlFor={`notes-${entry.id}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Observação <span className="font-normal text-slate-500">(opcional)</span></label><textarea id={`notes-${entry.id}`} maxLength={500} className={`${fieldClass} min-h-24 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre como o vínculo foi confirmado" /></div>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button variant="secondary" disabled={pending}>Cancelar</Button></AlertDialog.Cancel><Button type="submit" disabled={pending || !courierId}>{pending ? "Confirmando vínculo…" : "Confirmar vínculo"}</Button></div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ReconciliationManager({ entries, couriers, page, total }: { entries: ReconciliationEntry[]; couriers: ReconciliationCourier[]; page: number; total: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => entries.filter((entry) => `${entry.sourceName} ${entry.cnpj}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [entries, query]);

  if (!entries.length) return <EmptyState icon={<CheckCircle2 className="size-6" />} title="Conciliação em dia" description="Nenhum nome da guia DADOS CNPJ precisa de revisão manual." action={<Link href="/admin/importacoes" className={buttonStyles({ variant: "secondary" })}>Ver importações</Link>} />;

  return (
    <div className="space-y-6">
      <label className="relative block max-w-lg"><span className="sr-only">Buscar pendência de conciliação</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input className={`${fieldClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome de origem ou CNPJ" /></label>
      {filtered.length ? <div className="grid gap-4 xl:grid-cols-2">{filtered.map((entry) => <article key={entry.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-slate-500">Nome na guia DADOS CNPJ</p><h2 className="mt-1 text-balance text-lg font-extrabold text-[var(--brand-navy)]">{entry.sourceName}</h2></div><StatusBadge tone={entry.matchStatus === "AMBIGUOUS" ? "warning" : "danger"}>{matchLabels[entry.matchStatus]}</StatusBadge></div><dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-500">CNPJ</dt><dd className="mt-1 font-bold tabular-nums">{formatCnpj(entry.cnpj)}</dd></div><div><dt className="text-xs text-slate-500">Linha de origem</dt><dd className="mt-1 font-extrabold tabular-nums">{entry.sourceRow}</dd></div><div><dt className="text-xs text-slate-500">Confiança</dt><dd className="mt-1 font-extrabold tabular-nums">{entry.matchScore == null ? "Sem sugestão" : `${Math.round(entry.matchScore * 100)}%`}</dd></div></dl>{entry.notes ? <p className="mt-3 text-pretty text-xs leading-5 text-slate-600">{entry.notes}</p> : null}<div className="mt-5 flex justify-end"><ReconcileDialog entry={entry} couriers={couriers} onSaved={() => router.refresh()} /></div></article>)}</div> : <EmptyState icon={<UserRoundSearch className="size-6" />} title="Nenhuma pendência encontrada" description="Revise o termo pesquisado para localizar outro nome ou CNPJ." action={<Button variant="secondary" onClick={() => setQuery("")}>Limpar busca</Button>} />}
      {total > 30 ? (
        <nav className="flex flex-col items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-4 sm:flex-row" aria-label="Páginas de conciliação">
          <p className="text-sm text-slate-600"><span className="font-extrabold tabular-nums text-[var(--brand-navy)]">{total.toLocaleString("pt-BR")}</span> pendências • página <span className="font-bold tabular-nums">{page} de {Math.ceil(total / 30)}</span></p>
          <div className="flex gap-2">{page > 1 ? <Link href={`/admin/conciliacao?page=${page - 1}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Anterior</Link> : <span className={buttonStyles({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-50" })}>Anterior</span>}{page < Math.ceil(total / 30) ? <Link href={`/admin/conciliacao?page=${page + 1}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Próxima</Link> : <span className={buttonStyles({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-50" })}>Próxima</span>}</div>
        </nav>
      ) : null}
    </div>
  );
}
