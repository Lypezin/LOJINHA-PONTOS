"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, CheckCircle2, FileCheck2, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatPoints } from "@/lib/format";

type ImportIssue = { code: string; severity: "error" | "warning"; message: string; row?: number; count?: number };
type ImportColumn = { index: number; letter: string; header: string; normalizedHeader: string; nonEmptyCount: number; integerCount: number; invalidIntegerCount: number; canBePoints: boolean };
type ImportPreview = {
  filename: string;
  fileHash: string;
  sheets: { data: string; cnpj: string; dataHeaderRow: number; cnpjHeaderRow: number };
  columns: ImportColumn[];
  selection: { pointsColumn: string; pointsColumnIndex: number; pointsColumnLetter: string; periodKey: string | null; detectedPeriodKeys: string[] };
  summary: { rows: number; couriers: number; totalPoints: number; cnpjRegistryEntries: number; cnpjMatches: { exact: number; fuzzy: number; ambiguous: number; notFound: number }; errors: number; warnings: number };
  issues: ImportIssue[];
  canCommit: boolean;
  duplicate: boolean;
  duplicateBatchId: string | null;
};

type CommitResult = { batchId: string; status: string; duplicate: boolean; periodKey: string; rows: number; couriers: number; totalPoints: number; warningCount: number };

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[var(--brand-blue-dark)] focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function responseError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const direct = "error" in data ? data.error : undefined;
    if (typeof direct === "string") return direct;
    if (direct && typeof direct === "object" && "message" in direct && typeof direct.message === "string") return direct.message;
  }
  return fallback;
}

export function ImportWizard({ defaultPeriodKey, defaultPointsColumn }: { defaultPeriodKey: string; defaultPointsColumn: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const [pointsColumn, setPointsColumn] = useState(defaultPointsColumn);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [pending, setPending] = useState<"preview" | "commit" | "">("");
  const [error, setError] = useState("");

  function payload() {
    if (!file) throw new Error("Selecione uma planilha .xlsx para continuar.");
    const form = new FormData();
    form.set("file", file);
    form.set("periodKey", periodKey);
    form.set("pointsColumn", pointsColumn || "R");
    return form;
  }

  async function analyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setPending("preview");
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/imports/preview", { method: "POST", body: payload() });
      const data = (await response.json()) as { ok?: boolean; data?: ImportPreview; error?: unknown };
      if (!response.ok || !data.data) throw new Error(responseError(data, "Não foi possível analisar a planilha."));
      setPreview(data.data);
      if (data.data.selection.periodKey) setPeriodKey(data.data.selection.periodKey);
      setPointsColumn(data.data.selection.pointsColumnLetter || data.data.selection.pointsColumn);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar a planilha.");
    } finally {
      setPending("");
    }
  }

  async function commit() {
    setPending("commit");
    setError("");
    try {
      const response = await fetch("/api/admin/imports/commit", { method: "POST", body: payload() });
      const data = (await response.json()) as { ok?: boolean; data?: CommitResult; error?: unknown };
      if (!response.ok || !data.data) throw new Error(responseError(data, "Não foi possível importar a planilha."));
      setResult(data.data);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível importar a planilha.");
    } finally {
      setPending("");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setPointsColumn(defaultPointsColumn);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="wizard-title">
      <div className="grid grid-cols-3 gap-2" aria-label="Etapas da importação">
        {[
          { label: "1. Arquivo", active: true },
          { label: "2. Prévia", active: Boolean(preview) },
          { label: "3. Resultado", active: Boolean(result) },
        ].map((step) => {
          const baseClass = "rounded-xl px-3 py-2 text-center text-xs font-bold";
          const activeClass = "bg-blue-50 text-[var(--brand-blue-dark)]";
          const inactiveClass = "bg-slate-100 text-slate-600";
          return (
            <div key={step.label} className={`${baseClass} ${step.active ? activeClass : inactiveClass}`}>
              {step.label}
            </div>
          );
        })}
      </div>

      <div className="mt-7">
        <h2 id="wizard-title" className="text-balance text-xl font-extrabold text-[var(--brand-navy)]">Nova importação mensal</h2>
        <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Envie a guia BANCO DE DADOS. A Guia de CNPJ interna é aplicada automaticamente; se o Excel também tiver DADOS CNPJ, ela será usada como complemento. A prévia não altera o banco.</p>
      </div>

      <form onSubmit={analyze} className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_0.7fr_0.7fr_auto] lg:items-end">
        <div><label htmlFor="import-file" className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Planilha Excel</label><input ref={fileInputRef} id="import-file" type="file" accept=".xlsx" required className={fieldClass} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setResult(null); }} /><p className="mt-1 text-xs text-slate-500">Formato aceito: .xlsx</p></div>
        <div><label htmlFor="period-key" className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Competência</label><input id="period-key" type="month" required className={`${fieldClass} tabular-nums`} value={periodKey} onChange={(event) => { setPeriodKey(event.target.value); setPreview(null); }} /></div>
        <div><label htmlFor="points-column" className="mb-1.5 block text-sm font-bold text-[var(--brand-navy)]">Coluna de pontos</label>{preview ? <select id="points-column" className={fieldClass} value={pointsColumn} onChange={(event) => { setPointsColumn(event.target.value); setPreview(null); }}>{preview.columns.map((column) => <option key={column.index} value={column.letter}>{column.letter} — {column.header || "Sem cabeçalho"}</option>)}</select> : <input id="points-column" className={`${fieldClass} tabular-nums`} value={pointsColumn} required onChange={(event) => setPointsColumn(event.target.value)} placeholder="R" />}</div>
        <Button type="submit" disabled={pending !== "" || !file}><Upload className="size-4" aria-hidden="true" />{pending === "preview" ? "Analisando…" : preview ? "Atualizar prévia" : "Gerar prévia"}</Button>
      </form>

      <div aria-live="polite">
        {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
        {pending ? <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-[var(--brand-blue-dark)]">{pending === "preview" ? "Lendo guias, validando colunas e conciliando nomes…" : "Aplicando créditos e atualizando os vínculos…"}</p> : null}
      </div>

      {preview ? (
        <div className="mt-7 space-y-6 border-t border-slate-200 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Prévia validada</p><h3 className="mt-1 text-balance text-lg font-extrabold text-[var(--brand-navy)]">{preview.filename}</h3><p className="mt-1 text-xs tabular-nums text-slate-500">Coluna {preview.selection.pointsColumnLetter} • {preview.selection.pointsColumn} • competência {preview.selection.periodKey}</p></div>{preview.duplicate ? <StatusBadge tone="warning">Arquivo já importado</StatusBadge> : preview.canCommit ? <StatusBadge tone="success">Pronto para importar</StatusBadge> : <StatusBadge tone="danger">Correções necessárias</StatusBadge>}</div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Linhas", preview.summary.rows], ["Entregadores", preview.summary.couriers], ["Pontos", preview.summary.totalPoints], ["CNPJs", preview.summary.cnpjRegistryEntries], ["Avisos", preview.summary.warnings], ["Erros", preview.summary.errors],
            ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 p-4"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(Number(value))}</dd></div>)}
          </dl>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-slate-50 p-5" aria-labelledby="match-summary"><h4 id="match-summary" className="font-extrabold text-[var(--brand-navy)]">Conciliação de CNPJ</h4><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Exatas</dt><dd className="mt-1 font-extrabold tabular-nums text-emerald-700">{preview.summary.cnpjMatches.exact}</dd></div><div><dt className="text-slate-500">Aproximadas</dt><dd className="mt-1 font-extrabold tabular-nums text-[var(--brand-blue-dark)]">{preview.summary.cnpjMatches.fuzzy}</dd></div><div><dt className="text-slate-500">Ambíguas</dt><dd className="mt-1 font-extrabold tabular-nums text-amber-800">{preview.summary.cnpjMatches.ambiguous}</dd></div><div><dt className="text-slate-500">Não encontradas</dt><dd className="mt-1 font-extrabold tabular-nums text-red-700">{preview.summary.cnpjMatches.notFound}</dd></div></dl></section>
            <section className="rounded-2xl bg-slate-50 p-5" aria-labelledby="sheet-summary"><h4 id="sheet-summary" className="font-extrabold text-[var(--brand-navy)]">Fontes reconhecidas</h4><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Dados</dt><dd className="font-bold text-right text-[var(--brand-navy)]">{preview.sheets.data} • cabeçalho {preview.sheets.dataHeaderRow}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">CNPJ</dt><dd className="font-bold text-right text-[var(--brand-navy)]">{preview.sheets.cnpj}{preview.sheets.cnpjHeaderRow ? ` • cabeçalho ${preview.sheets.cnpjHeaderRow}` : " • base do sistema"}</dd></div></dl></section>
          </div>

          {preview.issues.length ? <section aria-labelledby="issues-title"><h4 id="issues-title" className="font-extrabold text-[var(--brand-navy)]">Validações da planilha</h4><ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">{preview.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === "error" ? "flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" : "flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"}>{issue.severity === "error" ? <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}<span><strong className="font-extrabold">{issue.severity === "error" ? "Erro" : "Aviso"}</strong>{issue.row ? ` na linha ${issue.row}` : ""}: {issue.message}{issue.count ? ` (${issue.count} ocorrências)` : ""}</span></li>)}</ul></section> : <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-[var(--brand-mint-ink)]"><CheckCircle2 className="size-5" aria-hidden="true" />Nenhum erro ou aviso encontrado.</p>}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setPreview(null)}><RefreshCw className="size-4" aria-hidden="true" />Revisar dados</Button>
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild><Button disabled={!preview.canCommit || pending !== ""}><FileCheck2 className="size-4" aria-hidden="true" />Importar planilha</Button></AlertDialog.Trigger>
              <AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" /><AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white p-6 shadow-xl focus:outline-none"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Confirmação final</p><AlertDialog.Title className="mt-1 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Importar {formatPoints(preview.summary.totalPoints)} pontos?</AlertDialog.Title></div><AlertDialog.Cancel asChild><button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar confirmação"><X className="size-5" aria-hidden="true" /></button></AlertDialog.Cancel></div><AlertDialog.Description className="mt-3 text-pretty text-sm leading-6 text-slate-600">A competência <strong className="font-extrabold tabular-nums text-[var(--brand-navy)]">{periodKey}</strong> será atualizada para {formatPoints(preview.summary.couriers)} entregadores. Reimportações aplicam apenas a diferença auditável.</AlertDialog.Description><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button variant="secondary">Voltar à prévia</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button onClick={() => void commit()}>Confirmar importação</Button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-7 rounded-[20px] border border-emerald-200 bg-emerald-50 p-6" aria-live="polite">
          <CheckCircle2 className="size-8 text-[var(--brand-mint-ink)]" aria-hidden="true" />
          <h3 className="mt-4 text-balance text-xl font-extrabold text-[var(--brand-mint-ink)]">{result.duplicate ? "Esta importação já estava concluída" : "Planilha importada"}</h3>
          <p className="mt-2 text-pretty text-sm leading-6 text-emerald-900">{formatPoints(result.totalPoints)} pontos de {formatPoints(result.couriers)} entregadores foram processados na competência {result.periodKey}. {result.warningCount ? `${result.warningCount} aviso(s) ficaram registrados.` : "Nenhum aviso ficou pendente."}</p>
          <Button variant="secondary" className="mt-5" onClick={reset}><FileSpreadsheet className="size-4" aria-hidden="true" />Importar outro arquivo</Button>
        </div>
      ) : null}
    </section>
  );
}
