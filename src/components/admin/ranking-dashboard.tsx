"use client";

import { useState, useEffect } from "react";
import { Award, Coins, Crown, ShoppingBag, Sparkles, Trophy, Search, Download, HelpCircle } from "lucide-react";
import { formatPoints, initials } from "@/lib/format";
import { formatCnpj } from "@/lib/presentation";
import { StatCard } from "@/components/ui/stat-card";

export type RankingEntry = {
  courierId: string;
  courierName: string;
  cnpj: string | null;
  plaza: string | null;
  value: number;
};

type Props = {
  topEarners: RankingEntry[];
  topSpenders: RankingEntry[];
  topBalances: RankingEntry[];
  stats: {
    totalDistributed: number;
    totalRedeemed: number;
    averageBalance: number;
    activeAccounts: number;
  };
};

type TabType = "earners" | "spenders" | "balances";

export function RankingDashboard({ topEarners, topSpenders, topBalances, stats }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("balances");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);


  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "1") {
        setActiveTab("balances");
        setSearchQuery("");
      } else if (e.key === "2") {
        setActiveTab("earners");
        setSearchQuery("");
      } else if (e.key === "3") {
        setActiveTab("spenders");
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const exportToCsv = () => {
    const headers = ["Posição", "Entregador", "CNPJ", "Praça", valueLabel];
    const rows = activeList.map((entry, index) => [
      (index + 1).toString(),
      entry.courierName.replace(/,/g, " "),
      entry.cnpj ? `"${entry.cnpj}"` : "",
      entry.plaza ? entry.plaza.replace(/,/g, " ") : "",
      entry.value.toString(),
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ranking_${activeTab}_lojinha.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeList =
    activeTab === "earners"
      ? topEarners
      : activeTab === "spenders"
      ? topSpenders
      : topBalances;

  const tabTitle =
    activeTab === "earners"
      ? "Mais Pontos Acumulados"
      : activeTab === "spenders"
      ? "Mais Pontos Gastos"
      : "Maior Saldo Atual";

  const tabIcon =
    activeTab === "earners" ? (
      <Sparkles className="size-5" />
    ) : activeTab === "spenders" ? (
      <ShoppingBag className="size-5" />
    ) : (
      <Coins className="size-5" />
    );

  const valueLabel =
    activeTab === "earners"
      ? "Acumulado"
      : activeTab === "spenders"
      ? "Resgatado"
      : "Saldo";

  const filteredList = activeList.filter((entry) =>
    entry.courierName.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const top3 = filteredList.slice(0, 3);
  const remaining = filteredList.slice(3);

  // Reorder top 3 for classic podium layout: [2nd, 1st, 3rd]
  const podium = [
    top3[1], // 2nd place
    top3[0], // 1st place
    top3[2], // 3rd place
  ].filter(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Resumo Estatístico do Período */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Estatísticas do Período">
        <StatCard
          label="Total Distribuído"
          value={`${formatPoints(stats.totalDistributed)} pts`}
          helper="Total de créditos importados neste mês"
          icon={Sparkles}
        />
        <StatCard
          label="Total Resgatado"
          value={`${formatPoints(stats.totalRedeemed)} pts`}
          helper="Pontos convertidos em prêmios"
          icon={ShoppingBag}
        />
        <StatCard
          label="Saldo Médio"
          value={`${formatPoints(Math.round(stats.averageBalance))} pts`}
          helper="Média de pontos por entregador"
          icon={Coins}
        />
        <StatCard
          label="Contas Ativas"
          value={formatPoints(stats.activeAccounts)}
          helper="Entregadores movimentando pontos"
          icon={Trophy}
        />
      </section>

      {/* Guia Rápido de Métricas para Jordan (First-Timer) */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 text-sm text-blue-900/90 flex items-start gap-3">
        <HelpCircle className="mt-0.5 size-5 shrink-0 text-[var(--brand-blue)]" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-extrabold text-[var(--brand-navy)]">Guia de Métricas do Ranking:</p>
          <p className="text-xs text-slate-600 font-medium">
            Entenda o que cada indicador representa. Dica: você pode usar as teclas <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] shadow-sm font-mono">1</kbd>, <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] shadow-sm font-mono">2</kbd> ou <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] shadow-sm font-mono">3</kbd> no seu teclado para alternar entre as abas.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 font-medium pt-1">
            <li><strong className="text-[var(--brand-navy)]">Saldo Atual:</strong> Pontos disponíveis na carteira do entregador hoje (pode ser usado para resgates).</li>
            <li><strong className="text-[var(--brand-navy)]">Maior Acúmulo:</strong> Total de pontos creditados de faturas importadas ao longo do mês.</li>
            <li><strong className="text-[var(--brand-navy)]">Maior Gasto:</strong> Total acumulado de pontos trocados por brindes na Lojinha.</li>
          </ul>
        </div>
      </div>

      {/* Controle de Abas e Pesquisa */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTab("balances"); setSearchQuery(""); setShowAll(false); }}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-150 ${
              activeTab === "balances"
                ? "bg-[var(--brand-blue-dark)] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Coins className="size-4" />
            Saldo Atual
          </button>
          <button
            onClick={() => { setActiveTab("earners"); setSearchQuery(""); setShowAll(false); }}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-150 ${
              activeTab === "earners"
                ? "bg-[var(--brand-blue-dark)] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="size-4" />
            Maior Acúmulo
          </button>
          <button
            onClick={() => { setActiveTab("spenders"); setSearchQuery(""); setShowAll(false); }}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-150 ${
              activeTab === "spenders"
                ? "bg-[var(--brand-blue-dark)] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ShoppingBag className="size-4" />
            Maior Gasto
          </button>
        </div>

        {/* Busca e Exportação */}
        <div className="flex w-full items-center gap-2 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar entregador..."
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 size-6 -translate-y-1/2 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Limpar pesquisa"
              >
                <span className="text-lg font-bold leading-none">&times;</span>
              </button>
            )}
          </div>
          <button
            onClick={exportToCsv}
            title="Exportar dados para CSV"
            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 hover:text-[var(--brand-navy)] transition-all duration-150 shadow-sm"
          >
            <Download className="size-5" />
          </button>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="rounded-[20px] border border-slate-200 bg-white py-16 text-center">
          <Trophy className="mx-auto size-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-bold text-[var(--brand-navy)]">Nenhum entregador encontrado</h3>
          <p className="mt-2 text-sm text-slate-500">Tente buscar por outro termo ou limpe a pesquisa.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Pódio visual dos 3 melhores */}
          {!searchQuery && podium.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-6 pt-6 md:flex-row md:items-end md:gap-4 lg:gap-8">
              {podium.map((entry) => {
                // Determine original ranking position:
                const isFirst = top3[0]?.courierId === entry.courierId;
                const isSecond = top3[1]?.courierId === entry.courierId;
                const position = isFirst ? 1 : isSecond ? 2 : 3;

                return (
                  <div
                    key={entry.courierId}
                    className={`group flex flex-col items-center w-full max-w-xs rounded-[24px] border bg-white p-6 shadow-md transition-all duration-200 hover:scale-[1.03] ${
                      isFirst
                        ? "border-amber-400 ring-2 ring-amber-400/20 order-1 md:order-2 md:pb-12 md:-translate-y-4"
                        : isSecond
                        ? "border-slate-300 order-2 md:order-1 md:pb-8"
                        : "border-orange-300 order-3 md:pb-8"
                    }`}
                  >
                    {/* Medalha / Badge de Posição */}
                    <div className="relative">
                      <div
                        className={`flex size-16 items-center justify-center rounded-full text-white font-extrabold shadow-sm ${
                          isFirst
                            ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                            : isSecond
                            ? "bg-gradient-to-r from-slate-400 to-slate-500"
                            : "bg-gradient-to-r from-orange-400 to-amber-600"
                        }`}
                      >
                        {isFirst ? (
                          <Crown className="size-7 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-12" />
                        ) : (
                          <Award className="size-7 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-1" />
                        )}
                        <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--brand-navy)] text-xs text-white border-2 border-white">
                          {position}º
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-4 text-center text-base font-extrabold text-[var(--brand-navy)] truncate max-w-full">
                      {entry.courierName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {entry.cnpj ? formatCnpj(entry.cnpj) : "CNPJ não cadastrado"}
                    </p>
                    {entry.plaza && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {entry.plaza}
                      </span>
                    )}

                    {/* Valor do Indicador */}
                    <div className="mt-5 w-full rounded-xl bg-slate-50 py-3 text-center">
                      <p className="text-xs text-slate-500 font-semibold">{valueLabel}</p>
                      <p className="mt-1 text-xl font-black text-[var(--brand-navy)] tabular-nums">
                        {formatPoints(entry.value)} pts
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Listagem completa (Tabela / Grid) */}
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--brand-navy)]">
                {tabIcon}
                {tabTitle}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="px-5 py-3.5 text-center">Posição</th>
                    <th className="px-5 py-3.5">Entregador</th>
                    <th className="px-5 py-3.5">CNPJ</th>
                    <th className="px-5 py-3.5">Praça</th>
                    <th className="px-5 py-3.5 text-right">{valueLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {(() => {
                    const displayedItems = searchQuery
                      ? filteredList
                      : showAll
                      ? remaining
                      : remaining.slice(0, 10);

                    return displayedItems.map((entry, index) => {
                      const originalIndex = searchQuery
                        ? activeList.findIndex((item) => item.courierId === entry.courierId)
                        : index + 3;
                      const position = originalIndex + 1;
                      const isSearchResultHighlight =
                        searchQuery.trim() !== "" &&
                        entry.courierName.toLowerCase().includes(searchQuery.trim().toLowerCase());

                      return (
                        <tr
                          key={entry.courierId}
                          className={`group transition-colors duration-150 hover:bg-slate-50/50 ${
                            isSearchResultHighlight ? "bg-blue-50/60 border-l-2 border-l-blue-500" : ""
                          }`}
                        >
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-black tabular-nums ${
                                position <= 3
                                  ? position === 1
                                    ? "bg-amber-100 text-amber-800"
                                    : position === 2
                                    ? "bg-slate-100 text-slate-800"
                                    : "bg-orange-100 text-orange-850"
                                  : "text-slate-500"
                              }`}
                            >
                              {position}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-[var(--brand-navy)]">
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xxs font-extrabold text-slate-600">
                                {initials(entry.courierName)}
                              </span>
                              <span className="truncate max-w-[200px] sm:max-w-xs">{entry.courierName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 tabular-nums text-slate-500">
                            {entry.cnpj ? formatCnpj(entry.cnpj) : "—"}
                          </td>
                          <td className="px-5 py-4 text-slate-600">{entry.plaza ?? "—"}</td>
                          <td className="px-5 py-4 text-right font-extrabold text-[var(--brand-navy)] tabular-nums">
                            {formatPoints(entry.value)} pts
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {remaining.length > 10 && !searchQuery && (
              <div className="flex justify-center border-t border-slate-100 p-4 bg-slate-50/30">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white border border-slate-200 px-5 text-sm font-bold text-[var(--brand-blue)] hover:bg-slate-50 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {showAll ? "Mostrar apenas Top 10" : `Ver ranking completo (mais ${remaining.length - 10} entregadores)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
