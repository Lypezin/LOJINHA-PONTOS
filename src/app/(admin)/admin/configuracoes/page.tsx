import { CalendarClock, ShieldCheck } from "lucide-react";
import { SettingsForms } from "@/components/admin/settings-forms";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Configurações" };

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function AdminSettingsPage() {
  await requirePageAdmin();
  const [settings, audits] = await Promise.all([
    db.systemSetting.findMany({ where: { key: { in: ["points.defaultColumn", "points.expirationPolicy", "store.profile"] } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { email: true } } } }),
  ]);
  const byKey = new Map(settings.map((setting) => [setting.key, jsonObject(setting.value)]));
  const column = byKey.get("points.defaultColumn") ?? {};
  const profile = byKey.get("store.profile") ?? {};
  const defaultColumn = { letter: typeof column.letter === "string" ? column.letter : "R", header: typeof column.header === "string" ? column.header : "numero_de_pedidos_aceitos_e_concluidos" };
  const storeProfile = { name: typeof profile.name === "string" ? profile.name : "Lojinha EntreGô", supportEmail: typeof profile.supportEmail === "string" ? profile.supportEmail : "" };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferências e auditoria" title="Configurações" description="Defina os padrões da operação e consulte as alterações administrativas mais recentes." />
      <SettingsForms defaultColumn={defaultColumn} storeProfile={storeProfile} />

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Regras fixas da operação">
        <div className="rounded-[20px] border border-slate-200 bg-white p-6"><CalendarClock className="size-6 text-[var(--brand-blue)]" aria-hidden="true" /><h2 className="mt-4 text-lg font-extrabold text-[var(--brand-navy)]">Expiração mensal</h2><p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Os pontos valem apenas na competência em que foram importados. Na virada do mês, o saldo restante é zerado e preservado no extrato como expiração.</p><p className="mt-3 text-xs font-bold text-[var(--brand-blue-dark)]">Fuso horário: America/Sao_Paulo</p></div>
        <div className="rounded-[20px] border border-slate-200 bg-white p-6"><ShieldCheck className="size-6 text-[var(--brand-blue)]" aria-hidden="true" /><h2 className="mt-4 text-lg font-extrabold text-[var(--brand-navy)]">Trilha de auditoria</h2><p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Importações, ajustes, produtos, conciliações e mudanças de pedido registram o administrador, a data e a entidade alterada.</p></div>
      </section>

      <section aria-labelledby="audit-title"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Segurança operacional</p><h2 id="audit-title" className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Atividade recente</h2></div>{audits.length ? <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-white"><div className="hidden grid-cols-[1.2fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-600 sm:grid"><span>Ação</span><span>Administrador</span><span>Data</span></div><div className="divide-y divide-slate-200">{audits.map((audit) => <article key={audit.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1.2fr_0.8fr_1fr] sm:items-center sm:gap-4"><div><p className="font-bold text-[var(--brand-navy)]">{audit.action}</p><p className="mt-1 text-xs text-slate-500">{audit.entityType}</p></div><p className="truncate text-slate-600">{audit.actor?.email ?? "Sistema"}</p><p className="tabular-nums text-slate-600">{formatDateTime(audit.createdAt)}</p></article>)}</div></div> : <p className="mt-5 rounded-[20px] border border-slate-200 bg-white p-6 text-sm text-slate-600">As primeiras alterações administrativas aparecerão aqui.</p>}</section>
    </div>
  );
}
