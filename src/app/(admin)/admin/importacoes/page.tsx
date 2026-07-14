import { FileSpreadsheet } from "lucide-react";
import { ImportWizard } from "@/components/admin/import-wizard";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { periodKeyForDate } from "@/features/points/period";
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
    db.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, filename: true, pointsColumn: true, status: true, rowCount: true, courierCount: true, totalPoints: true, warningCount: true, createdAt: true, period: { select: { key: true } } } }),
  ]);
  const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : {};
  const defaultColumn = typeof value.letter === "string" ? value.letter : "R";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Fonte mensal de pontos" title="Importações" description="Envie a planilha, escolha a competência e a coluna de pontos, valide a prévia e só então atualize os saldos." />
      <ImportWizard defaultPeriodKey={periodKeyForDate()} defaultPointsColumn={defaultColumn} />

      <section aria-labelledby="history-title">
        <div><p className="text-sm font-bold text-[var(--brand-blue)]">Auditoria</p><h2 id="history-title" className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Histórico de importações</h2></div>
        {batches.length ? (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-600 md:grid"><span>Arquivo</span><span>Competência</span><span>Entregadores</span><span>Pontos</span><span>Status</span></div>
            <div className="divide-y divide-slate-200">
              {batches.map((batch) => { const state = importState(batch.status); return <article key={batch.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1fr] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate font-bold text-[var(--brand-navy)]">{batch.filename}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{formatDateTime(batch.createdAt)} • coluna {batch.pointsColumn}</p></div><p className="font-bold tabular-nums text-[var(--brand-navy)]">{batch.period.key}</p><p className="font-bold tabular-nums text-slate-700">{formatPoints(batch.courierCount)}</p><p className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(batch.totalPoints)}</p><div><StatusBadge tone={state.tone}>{state.label}</StatusBadge>{batch.warningCount ? <p className="mt-1 text-xs font-semibold tabular-nums text-amber-800">{batch.warningCount} aviso(s)</p> : null}</div></article>; })}
            </div>
          </div>
        ) : <div className="mt-5"><EmptyState icon={<FileSpreadsheet className="size-6" />} title="Nenhuma planilha importada" description="Conclua a primeira importação para iniciar o histórico auditável." /></div>}
      </section>
    </div>
  );
}
