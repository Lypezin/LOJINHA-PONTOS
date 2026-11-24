import { FileSpreadsheet } from "lucide-react";
import { ImportWizard } from "@/components/admin/import-wizard";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, formatPoints } from "@/lib/format";

export const metadata = { title: "Importações" };

function importState(status: string) {
  if (status === "COMPLETED") return { label: "Concluída", tone: "success" as const };
  if (status === "COMPLETED_WITH_WARNINGS") return { label: "Concluída com avisos", tone: "warning" as const };
  if (status === "FAILED") return { label: "Falhou", tone: "danger" as const };
  if (status === "DUPLICATE") return { label: "Duplicada", tone: "neutral" as const };
  return { label: "Processando", tone: "info" as const };
}

export default async function AdminImportsPage() {
  await requirePageAdmin();
  const [setting, batches] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: "points.defaultColumn" }, select: { value: true } }),
    db.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, filename: true, competenceKey: true, pointsColumn: true, status: true, rowCount: true, courierCount: true, totalPoints: true, warningCount: true, createdAt: true } }),
  ]);
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : {};
  const defaultColumn = typeof value.letter === "string" ? value.letter : "R";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Planilhas de pontos" title="Importações" description="Envie a planilha, confira as datas e a coluna de pontos e some os créditos ao ciclo vigente." />
      <ImportWizard defaultPointsColumn={defaultColumn} />

      <section aria-labelledby="history-title">
        <div><p className="text-xs font-semibold text-[var(--brand-blue)]">Auditoria</p><h2 id="history-title" className="font-display mt-0.5 text-balance text-xl font-bold text-[var(--brand-navy)]">Histórico de importações</h2></div>
        {batches.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 border-b border-slate-200/80 bg-slate-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid"><span>Arquivo</span><span>Meses na planilha</span><span className="text-right">Entregadores</span><span className="text-right">Pontos</span><span>Status</span></div>
            <div className="divide-y divide-slate-200/70">
              {batches.map((batch) => { const state = importState(batch.status); return <article key={batch.id} className="grid gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50/50 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1fr] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--brand-navy)]">{batch.filename}</p><p className="mt-0.5 text-xs tabular-nums text-slate-500">{formatDateTime(batch.createdAt)} • coluna {batch.pointsColumn}</p></div><p className="font-semibold tabular-nums text-[var(--brand-navy)]">{batch.competenceKey}</p><p className="font-semibold tabular-nums text-slate-700 md:text-right">{formatPoints(batch.courierCount)}</p><p className="font-bold tabular-nums text-[var(--brand-navy)] md:text-right">{formatPoints(batch.totalPoints)} pts</p><div><StatusBadge tone={state.tone}>{state.label}</StatusBadge>{batch.warningCount ? <p className="mt-1 text-xs font-semibold tabular-nums text-amber-700">{batch.warningCount} aviso(s)</p> : null}</div></article>; })}
            </div>
          </div>
        ) : <div className="mt-4"><EmptyState icon={<FileSpreadsheet className="size-5" />} title="Nenhuma planilha importada" description="Conclua a primeira importação para iniciar o histórico auditável." /></div>}
      </section>
    </div>
  );
}
