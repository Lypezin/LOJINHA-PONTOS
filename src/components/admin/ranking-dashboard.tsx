"use client";

import { useState } from "react";
import { Award, Coins, Crown, ShoppingBag, Sparkles, Trophy, Search } from "lucide-react";
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

      {/* Controle de Abas e Pesquisa */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTab("balances"); setSearchQuery(""); }}
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
            onClick={() => { setActiveTab("earners"); setSearchQuery(""); }}
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
            onClick={() => { setActiveTab("spenders"); setSearchQuery(""); }}
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

        {/* Input de Busca */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar entregador no ranking..."
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100"
          />
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
                    className={`flex flex-col items-center w-full max-w-xs rounded-[24px] border bg-white p-6 shadow-md transition-all duration-200 hover:scale-[1.03] ${
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
                          <Crown className="size-7 animate-bounce" style={{ animationDuration: '3s' }} />
                        ) : (
                          <Award className="size-7" />
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
                  {/* Map the remaining entries, or all entries if searched */}
                  {(searchQuery ? filteredList : remaining).map((entry, index) => {
                    const originalIndex = searchQuery
                      ? activeList.findIndex((item) => item.courierId === entry.courierId)
                      : index + 3;
                    const position = originalIndex + 1;

                    return (
                      <tr
                        key={entry.courierId}
                        className="group hover:bg-slate-50/50 transition-colors duration-150"
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
