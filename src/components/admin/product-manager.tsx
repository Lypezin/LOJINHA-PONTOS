"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Boxes, ImagePlus, Package, Pencil, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatPoints } from "@/lib/format";
import { productLabels, productTone } from "@/lib/presentation";

type ProductStatus = keyof typeof productLabels;

export type AdminProduct = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  referenceValueCents: number | null;
  stockQuantity: number;
  maxPerCourierPerPeriod: number | null;
  status: ProductStatus;
  featured: boolean;
  sortOrder: number;
};

type ProductDraft = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  pointsCost: string;
  referenceValue: string;
  stockQuantity: string;
  maxPerCourierPerPeriod: string;
  status: ProductStatus;
  featured: boolean;
  sortOrder: string;
};

const emptyDraft: ProductDraft = {
  name: "",
  description: "",
  category: "",
  imageUrl: "",
  pointsCost: "",
  referenceValue: "",
  stockQuantity: "0",
  maxPerCourierPerPeriod: "",
  status: "DRAFT",
  featured: false,
  sortOrder: "0",
};

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function toDraft(product?: AdminProduct): ProductDraft {
  if (!product) return emptyDraft;
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrl: product.imageUrl ?? "",
    pointsCost: String(product.pointsCost),
    referenceValue: product.referenceValueCents == null ? "" : (product.referenceValueCents / 100).toFixed(2),
    stockQuantity: String(product.stockQuantity),
    maxPerCourierPerPeriod: product.maxPerCourierPerPeriod == null ? "" : String(product.maxPerCourierPerPeriod),
    status: product.status,
    featured: product.featured,
    sortOrder: String(product.sortOrder),
  };
}

function ProductThumb({ product }: { product: Pick<AdminProduct, "name" | "imageUrl"> }) {
  if (!product.imageUrl) return <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand-blue)]"><Package className="size-5" aria-hidden="true" /></div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
  );
}

function ProductDialog({ product, onSaved, trigger }: { product?: AdminProduct; onSaved: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(toDraft(product));
      setError("");
    }
  }

  async function handleImage(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("A foto deve ter no máximo 2 MB.");
      return;
    }
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
      reader.readAsDataURL(file);
    });
    update("imageUrl", encoded);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const reference = draft.referenceValue.trim().replace(",", ".");
    const body = {
      name: draft.name,
      description: draft.description,
      category: draft.category,
      imageUrl: draft.imageUrl || null,
      pointsCost: Number(draft.pointsCost),
      referenceValueCents: reference ? Math.round(Number(reference) * 100) : null,
      stockQuantity: Number(draft.stockQuantity),
      maxPerCourierPerPeriod: draft.maxPerCourierPerPeriod ? Number(draft.maxPerCourierPerPeriod) : null,
      status: draft.status,
      featured: draft.featured,
      sortOrder: Number(draft.sortOrder || 0),
      ...(product ? { version: product.version } : {}),
    };
    try {
      const response = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o produto.");
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o produto.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl focus:outline-none sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-balance text-2xl font-extrabold text-[var(--brand-navy)]">{product ? "Editar produto" : "Adicionar produto"}</Dialog.Title>
              <Dialog.Description className="mt-2 text-pretty text-sm leading-6 text-slate-600">Cadastre foto, custo em pontos, estoque, limite por entregador e disponibilidade.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Fechar cadastro de produto"><X className="size-5" aria-hidden="true" /></button>
            </Dialog.Close>
          </div>

          <form className="mt-6 space-y-6" onSubmit={save}>
            <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
              <div>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-blue-50 text-[var(--brand-blue)]">
                  {draft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.imageUrl} alt="Prévia do produto" className="size-full object-cover" />
                  ) : <ImagePlus className="size-8" aria-hidden="true" />}
                </div>
                <label className="mt-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 px-3 text-center text-xs font-bold text-[var(--brand-navy)] focus-within:ring-4 focus-within:ring-blue-100">
                  Enviar foto
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void handleImage(event.target.files?.[0])} />
                </label>
              </div>
              <div className="space-y-4">
                <div><label htmlFor={`name-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Nome</label><input id={`name-${product?.id ?? "new"}`} className={fieldClass} required minLength={2} maxLength={100} value={draft.name} onChange={(event) => update("name", event.target.value)} /></div>
                <div><label htmlFor={`category-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Categoria</label><input id={`category-${product?.id ?? "new"}`} className={fieldClass} required minLength={2} maxLength={60} value={draft.category} onChange={(event) => update("category", event.target.value)} placeholder="Ex.: Equipamentos" /></div>
                <div><label htmlFor={`url-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">URL da foto <span className="font-normal text-slate-500">(opcional)</span></label><input id={`url-${product?.id ?? "new"}`} type="url" className={fieldClass} value={draft.imageUrl.startsWith("data:") ? "" : draft.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://..." /><p className="mt-1 text-xs text-slate-500">Enviar um arquivo substitui a URL informada.</p></div>
              </div>
            </div>

            <div><label htmlFor={`description-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Descrição</label><textarea id={`description-${product?.id ?? "new"}`} className={`${fieldClass} min-h-24 py-3`} required minLength={8} maxLength={800} value={draft.description} onChange={(event) => update("description", event.target.value)} /></div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label htmlFor={`points-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Custo em pontos</label><input id={`points-${product?.id ?? "new"}`} type="number" min="1" step="1" required className={`${fieldClass} tabular-nums`} value={draft.pointsCost} onChange={(event) => update("pointsCost", event.target.value)} /></div>
              <div><label htmlFor={`value-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Valor de referência</label><input id={`value-${product?.id ?? "new"}`} inputMode="decimal" className={`${fieldClass} tabular-nums`} value={draft.referenceValue} onChange={(event) => update("referenceValue", event.target.value)} placeholder="0,00" /></div>
              <div><label htmlFor={`stock-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Estoque</label><input id={`stock-${product?.id ?? "new"}`} type="number" min="0" step="1" required className={`${fieldClass} tabular-nums`} value={draft.stockQuantity} onChange={(event) => update("stockQuantity", event.target.value)} /></div>
              <div><label htmlFor={`limit-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Limite mensal</label><input id={`limit-${product?.id ?? "new"}`} type="number" min="1" max="100" step="1" className={`${fieldClass} tabular-nums`} value={draft.maxPerCourierPerPeriod} onChange={(event) => update("maxPerCourierPerPeriod", event.target.value)} placeholder="Sem limite" /></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor={`status-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Status</label><select id={`status-${product?.id ?? "new"}`} className={fieldClass} value={draft.status} onChange={(event) => update("status", event.target.value as ProductStatus)}><option value="DRAFT">Rascunho</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="ARCHIVED">Arquivado</option></select></div>
              <div><label htmlFor={`order-${product?.id ?? "new"}`} className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Ordem no catálogo</label><input id={`order-${product?.id ?? "new"}`} type="number" min="0" step="1" className={`${fieldClass} tabular-nums`} value={draft.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></div>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-300 px-3 text-sm font-bold text-[var(--brand-navy)]"><input type="checkbox" checked={draft.featured} onChange={(event) => update("featured", event.target.checked)} className="size-5 accent-[var(--brand-blue)]" />Destacar na loja</label>
            </div>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <Dialog.Close asChild><Button variant="secondary" disabled={pending}>Cancelar</Button></Dialog.Close>
              <Button type="submit" disabled={pending}>{pending ? "Salvando produto…" : "Salvar produto"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProductManager({ products }: { products: AdminProduct[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ProductStatus>("ALL");
  const filtered = useMemo(() => products.filter((product) => {
    const matchesText = `${product.name} ${product.category}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    return matchesText && (status === "ALL" || product.status === status);
  }), [products, query, status]);
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="relative block max-w-md flex-1">
            <span className="sr-only">Buscar produto</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} pl-10`} placeholder="Buscar por nome ou categoria" />
          </label>
          <label><span className="sr-only">Filtrar por status</span><select className={`${fieldClass} sm:w-44`} value={status} onChange={(event) => setStatus(event.target.value as "ALL" | ProductStatus)}><option value="ALL">Todos os status</option><option value="ACTIVE">Ativos</option><option value="DRAFT">Rascunhos</option><option value="INACTIVE">Inativos</option><option value="ARCHIVED">Arquivados</option></select></label>
        </div>
        <ProductDialog onSaved={refresh} trigger={<Button><Plus className="size-4" aria-hidden="true" />Adicionar produto</Button>} />
      </div>

      {filtered.length ? (
        <>
          <div className="hidden overflow-hidden rounded-[20px] border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-5 py-3 font-bold">Produto</th><th scope="col" className="px-4 py-3 font-bold">Pontos</th><th scope="col" className="px-4 py-3 font-bold">Estoque</th><th scope="col" className="px-4 py-3 font-bold">Status</th><th scope="col" className="px-5 py-3 text-right font-bold">Ação</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((product) => <tr key={product.id}><td className="px-5 py-4"><div className="flex items-center gap-3"><ProductThumb product={product} /><div className="min-w-0"><p className="truncate font-bold text-[var(--brand-navy)]">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category}{product.featured ? " • Destaque" : ""}</p></div></div></td><td className="px-4 py-4 font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(product.pointsCost)}</td><td className="px-4 py-4"><span className={product.stockQuantity <= 5 ? "font-extrabold tabular-nums text-amber-800" : "font-bold tabular-nums text-slate-700"}>{formatPoints(product.stockQuantity)}</span></td><td className="px-4 py-4"><StatusBadge tone={productTone[product.status]}>{productLabels[product.status]}</StatusBadge></td><td className="px-5 py-4 text-right"><ProductDialog product={product} onSaved={refresh} trigger={<Button variant="ghost" size="sm"><Pencil className="size-4" aria-hidden="true" />Editar</Button>} /></td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 md:hidden">
            {filtered.map((product) => <article key={product.id} className="rounded-[20px] border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><ProductThumb product={product} /><div className="min-w-0 flex-1"><h2 className="font-extrabold text-[var(--brand-navy)]">{product.name}</h2><p className="mt-1 text-xs text-slate-500">{product.category}</p></div><StatusBadge tone={productTone[product.status]}>{productLabels[product.status]}</StatusBadge></div><dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs"><div><dt className="text-slate-500">Pontos</dt><dd className="mt-1 font-extrabold tabular-nums">{formatPoints(product.pointsCost)}</dd></div><div><dt className="text-slate-500">Estoque</dt><dd className="mt-1 font-extrabold tabular-nums">{formatPoints(product.stockQuantity)}</dd></div><div><dt className="text-slate-500">Valor</dt><dd className="mt-1 font-bold tabular-nums">{formatCurrency(product.referenceValueCents) ?? "—"}</dd></div></dl><div className="mt-3"><ProductDialog product={product} onSaved={refresh} trigger={<Button variant="secondary" className="w-full"><Pencil className="size-4" aria-hidden="true" />Editar produto</Button>} /></div></article>)}
          </div>
        </>
      ) : (
        <EmptyState icon={<Boxes className="size-6" />} title={products.length ? "Nenhum produto encontrado" : "Cadastre o primeiro produto"} description={products.length ? "Ajuste a busca ou o filtro para ver outros itens." : "Adicione foto, nome, custo em pontos, valor de referência, estoque e limite mensal."} action={products.length ? <Button variant="secondary" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar filtros</Button> : <ProductDialog onSaved={refresh} trigger={<Button><Plus className="size-4" aria-hidden="true" />Adicionar produto</Button>} />} />
      )}
    </div>
  );
}
