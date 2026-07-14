import type { Prisma } from "@prisma/client";
import { CircleAlert, FileSpreadsheet, UsersRound } from "lucide-react";
import Link from "next/link";

import { CnpjGuideManager, type CnpjGuideCourierOption, type CnpjGuideEntryView } from "@/components/admin/cnpj-guide-manager";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Conciliação" };

type SearchParams = { tab?: string; page?: string; q?: string; courierId?: string };

export default async function AdminReconciliationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageAdmin();
  const params = await searchParams;
  const tab = params.tab === "guia" ? "guia" : "pendencias";
  const requestedPage = Number(params.page ?? 1);
  const query = params.q?.trim() ?? "";

  const [pendingTotal, guideTotal, matchedTotal] = await Promise.all([
    db.courier.count({ where: { cnpj: null, status: { not: "INACTIVE" } } }),
    db.cnpjGuideEntry.count(),
    db.courier.count({ where: { cnpj: { not: null }, status: { not: "INACTIVE" } } }),
  ]);

  const tabs = [
    { id: "pendencias", label: `Pendências (${pendingTotal.toLocaleString("pt-BR")})`, icon: UsersRound },
    { id: "guia", label: `Guia de CNPJ (${guideTotal.toLocaleString("pt-BR")})`, icon: FileSpreadsheet },
  ] as const;

  let content: React.ReactNode;
  if (tab === "guia") {
    const where: Prisma.CnpjGuideEntryWhereInput = query
      ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { cnpj: { contains: query.replace(/\D/g, "") } }, { courier: { is: { name: { contains: query, mode: "insensitive" } } } }] }
      : {};
    const filteredTotal = await db.cnpjGuideEntry.count({ where });
    const pageCount = Math.max(1, Math.ceil(filteredTotal / 40));
    const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
    const [entries, couriers] = await Promise.all([
      db.cnpjGuideEntry.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * 40, take: 40, select: { id: true, name: true, cnpj: true, courierId: true, courier: { select: { name: true } }, source: true, notes: true } }),
      db.courier.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, cnpj: true } }),
    ]);
    content = <CnpjGuideManager entries={entries satisfies CnpjGuideEntryView[]} couriers={couriers satisfies CnpjGuideCourierOption[]} page={page} total={filteredTotal} query={query} initialCourierId={params.courierId} />;
  } else {
    const pageCount = Math.max(1, Math.ceil(pendingTotal / 30));
    const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
    const couriers = await db.courier.findMany({ where: { cnpj: null, status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, skip: (page - 1) * 30, take: 30, select: { id: true, name: true, plaza: true, externalCourierId: true } });
    content = couriers.length ? <div className="space-y-5"><div className="grid gap-4 xl:grid-cols-2">{couriers.map((courier) => <article key={courier.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-balance font-extrabold text-[var(--brand-navy)]">{courier.name}</h2><p className="mt-1 text-sm text-slate-500">{courier.plaza || "Praça não informada"}</p><p className="mt-1 truncate text-xs tabular-nums text-slate-400">{courier.externalCourierId}</p></div></div><div className="mt-5 flex justify-end"><Link className={buttonStyles({ size: "sm" })} href={`/admin/conciliacao?tab=guia&courierId=${courier.id}`}>Informar CNPJ</Link></div></article>)}</div>{pendingTotal > 30 ? <nav className="flex justify-end gap-2">{page > 1 ? <Link className={buttonStyles({ variant: "secondary", size: "sm" })} href={`/admin/conciliacao?page=${page - 1}`}>Anterior</Link> : null}{page < pageCount ? <Link className={buttonStyles({ variant: "secondary", size: "sm" })} href={`/admin/conciliacao?page=${page + 1}`}>Próxima</Link> : null}</nav> : null}</div> : <EmptyState icon={<UsersRound className="size-6" />} title="Todos os entregadores estão conciliados" description="Nenhum entregador ativo está sem CNPJ." />;
  }

  return <div className="space-y-8"><PageHeader eyebrow="Nomes e CNPJ" title="Conciliação" description={`${matchedTotal.toLocaleString("pt-BR")} entregadores com CNPJ. Mantenha a guia interna atualizada e ela será usada automaticamente nas importações mensais.`} /><nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Seções da conciliação">{tabs.map(({ id, label, icon: Icon }) => <Link key={id} href={`/admin/conciliacao?tab=${id}`} className={buttonStyles({ variant: tab === id ? "primary" : "ghost", size: "sm" })}><Icon className="size-4" />{label}</Link>)}</nav>{content}</div>;
}
