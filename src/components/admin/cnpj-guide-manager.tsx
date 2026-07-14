"use client";

import { Check, FileSpreadsheet, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { formatCnpj } from "@/lib/presentation";

export type CnpjGuideEntryView = {
  id: string;
  name: string;
  cnpj: string;
  courierId: string | null;
  courier: { name: string } | null;
  source: string;
  notes: string | null;
};

export type CnpjGuideCourierOption = { id: string; name: string; cnpj: string | null };

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function GuideForm({
  entry,
  couriers,
  initialCourierId = "",
  onDone,
}: {
  entry?: CnpjGuideEntryView;
  couriers: CnpjGuideCourierOption[];
  initialCourierId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const initialCourier = couriers.find((courier) => courier.id === (entry?.courierId ?? initialCourierId));
  const [name, setName] = useState(entry?.name ?? initialCourier?.name ?? "");
  const [cnpj, setCnpj] = useState(entry ? formatCnpj(entry.cnpj) : "");
  const [courierId, setCourierId] = useState(entry?.courierId ?? initialCourierId);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(entry ? `/api/admin/cnpj-guide/${entry.id}` : "/api/admin/cnpj-guide", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cnpj, courierId: courierId || null, notes: notes || null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o registro.");
      if (!entry) {
        setName("");
        setCnpj("");
        setCourierId("");
        setNotes("");
      }
      onDone?.();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o registro.");
    } finally {
      setPending(false);
    }
  }

  function selectCourier(value: string) {
    setCourierId(value);
    const courier = couriers.find((item) => item.id === value);
    if (courier) setName(courier.name);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div><label className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]" htmlFor={`guide-name-${entry?.id ?? "new"}`}>Nome usado na planilha</label><input id={`guide-name-${entry?.id ?? "new"}`} required maxLength={180} className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do entregador" /></div>
        <div><label className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]" htmlFor={`guide-cnpj-${entry?.id ?? "new"}`}>CNPJ</label><input id={`guide-cnpj-${entry?.id ?? "new"}`} required inputMode="numeric" className={fieldClass} value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="00.000.000/0000-00" /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div><label className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]" htmlFor={`guide-courier-${entry?.id ?? "new"}`}>Vincular ao entregador <span className="font-normal text-slate-500">(recomendado)</span></label><select id={`guide-courier-${entry?.id ?? "new"}`} className={fieldClass} value={courierId} onChange={(event) => selectCourier(event.target.value)}><option value="">Somente usar pelo nome</option>{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name}{courier.cnpj ? ` — ${formatCnpj(courier.cnpj)}` : " — pendente"}</option>)}</select></div>
        <div><label className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]" htmlFor={`guide-notes-${entry?.id ?? "new"}`}>Observação <span className="font-normal text-slate-500">(opcional)</span></label><input id={`guide-notes-${entry?.id ?? "new"}`} maxLength={500} className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: confirmado por documento" /></div>
      </div>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">{entry && onDone ? <Button variant="ghost" onClick={onDone}><X className="size-4" />Cancelar</Button> : null}<Button type="submit" disabled={pending}>{entry ? <Check className="size-4" /> : <Plus className="size-4" />}{pending ? "Salvando…" : entry ? "Salvar alterações" : "Adicionar à guia"}</Button></div>
    </form>
  );
}

export function CnpjGuideManager({
  entries,
  couriers,
  page,
  total,
  query,
  initialCourierId,
}: {
  entries: CnpjGuideEntryView[];
  couriers: CnpjGuideCourierOption[];
  page: number;
  total: number;
  query: string;
  initialCourierId?: string;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(total / 40));
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  async function remove(id: string) {
    const entry = byId.get(id);
    if (!entry || !window.confirm(`Remover ${entry.name} da Guia de CNPJ? O cadastro atual do entregador será preservado.`)) return;
    const response = await fetch(`/api/admin/cnpj-guide/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return window.alert(data.error || "Não foi possível remover o registro.");
    router.refresh();
  }

  const pageHref = (nextPage: number) => `/admin/conciliacao?tab=guia&page=${nextPage}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--brand-blue)] shadow-sm"><FileSpreadsheet className="size-5" /></span><div><h2 className="text-lg font-extrabold text-[var(--brand-navy)]">Adicionar nome e CNPJ</h2><p className="mt-1 text-sm leading-6 text-slate-600">Esta base é usada automaticamente em todas as próximas importações.</p></div></div>
        <GuideForm couriers={couriers} initialCourierId={initialCourierId} />
      </section>

      <form method="get" className="flex max-w-xl gap-2"><input type="hidden" name="tab" value="guia" /><label className="relative flex-1"><span className="sr-only">Buscar na Guia de CNPJ</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={query} className={`${fieldClass} pl-10`} placeholder="Buscar por nome ou CNPJ" /></label><Button type="submit" variant="secondary">Buscar</Button></form>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Nome na guia</th><th className="px-5 py-4">CNPJ</th><th className="px-5 py-4">Vínculo</th><th className="px-5 py-4">Origem</th><th className="px-5 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => editingId === entry.id ? <tr key={entry.id}><td colSpan={5} className="bg-blue-50/40 p-5"><GuideForm entry={entry} couriers={couriers} onDone={() => setEditingId(null)} /></td></tr> : <tr key={entry.id} className="align-top"><td className="px-5 py-4 font-bold text-[var(--brand-navy)]">{entry.name}{entry.notes ? <p className="mt-1 max-w-sm text-xs font-normal text-slate-500">{entry.notes}</p> : null}</td><td className="px-5 py-4 font-bold tabular-nums text-slate-700">{formatCnpj(entry.cnpj)}</td><td className="px-5 py-4 text-slate-600">{entry.courier?.name ?? <span className="text-amber-700">Somente por nome</span>}</td><td className="px-5 py-4 text-xs font-semibold text-slate-500">{entry.source === "INFORMATIVO" ? "Informativo" : entry.source === "BASE_EXISTENTE" ? "Base anterior" : "Manual"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditingId(entry.id)}><Pencil className="size-4" />Editar</Button><Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => remove(entry.id)}><Trash2 className="size-4" />Remover</Button></div></td></tr>)}</tbody></table></div>
        {!entries.length ? <p className="p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</p> : null}
      </div>

      {total > 40 ? <nav className="flex flex-col items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-4 sm:flex-row" aria-label="Páginas da Guia de CNPJ"><p className="text-sm text-slate-600"><strong className="tabular-nums text-[var(--brand-navy)]">{total.toLocaleString("pt-BR")}</strong> registros • página {page} de {pageCount}</p><div className="flex gap-2">{page > 1 ? <Link href={pageHref(page - 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>Anterior</Link> : null}{page < pageCount ? <Link href={pageHref(page + 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>Próxima</Link> : null}</div></nav> : null}
    </div>
  );
}
