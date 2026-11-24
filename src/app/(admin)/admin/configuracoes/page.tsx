import { CalendarClock, History, ShieldCheck, Smartphone } from "lucide-react";
import { activeCityKeys } from "@/lib/city-access";
import { normalizeName } from "@/features/imports/normalization";
import { CitySettings } from "@/components/admin/city-settings";
import { SettingsForms } from "@/components/admin/settings-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { ensureCurrentPeriod } from "@/features/points/period";
import { pointsCycleLastUseDate } from "@/features/points/cycle";

export const metadata = { title: "Configurações" };

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function AdminSettingsPage() {
  await requirePageAdmin();
  const [settings, audits, currentPeriod, courierCities] = await Promise.all([
    db.systemSetting.findMany({
      where: {
        key: { in: ["points.defaultColumn", "points.expirationPolicy", "store.profile", "store.activeCities"] },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { email: true } } },
    }),
    ensureCurrentPeriod(),
    db.courier.groupBy({ by: ["plaza"], where: { plaza: { not: null } } }),
  ]);

  const byKey = new Map(settings.map((setting) => [setting.key, jsonObject(setting.value)]));
  const citySetting = settings.find((setting) => setting.key === "store.activeCities");
  const activeCities = activeCityKeys(citySetting?.value);
  const cityNames = new Map<string, string>([["SAO PAULO", "São Paulo"]]);
  for (const { plaza } of courierCities) {
    if (plaza) {
      const key = normalizeName(plaza);
      if (key && !cityNames.has(key)) cityNames.set(key, plaza);
    }
  }
  for (const city of activeCities) if (!cityNames.has(city)) cityNames.set(city, city);
  const cities = [...cityNames]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const column = byKey.get("points.defaultColumn") ?? {};
  const profile = byKey.get("store.profile") ?? {};
  const defaultColumn = {
    letter: typeof column.letter === "string" ? column.letter : "R",
    header: typeof column.header === "string" ? column.header : "numero_de_pedidos_aceitos_e_concluidos",
  };
  const storeProfile = {
    name: typeof profile.name === "string" ? profile.name : "Lojinha EntreGô",
    supportEmail: typeof profile.supportEmail === "string" ? profile.supportEmail : "",
  };

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://sua-lojinha.com.br";
  const directSsoExample = `${appOrigin.replace(/\/$/, "")}/api/auth/app-login?cpf={CPF}&cnpj={CNPJ}&id={ID}&nome={NOME}&cidade={CIDADE}`;
  const signedSsoExample = `${appOrigin.replace(/\/$/, "")}/api/auth/app-login?token={JWT_HS256}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Preferências e auditoria"
        title="Configurações"
        description="Defina os padrões da operação, integração com o aplicativo e trilha de auditoria."
      />

      <CitySettings cities={cities} activeCities={activeCities} />
      <SettingsForms defaultColumn={defaultColumn} storeProfile={storeProfile} />

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
        aria-labelledby="app-sso-title"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand-blue)]">
            <Smartphone className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="app-sso-title" className="font-display text-lg font-bold text-[var(--brand-navy)]">
              Integração com o Aplicativo (Login Automático)
            </h2>
            <p className="mt-1 text-pretty text-sm text-slate-600">
              Configure o botão do aplicativo para redirecionar o entregador diretamente com sessão criada e conta vinculada automaticamente.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-[var(--brand-navy)]">
              URL direta com placeholders do aplicativo
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Compatível com abertura direta na WebView. Recomendamos definir <code className="font-mono text-slate-700">APP_SSO_KEY</code> no ambiente e adicionar <code className="font-mono text-slate-700">&amp;key=CHAVE</code>.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-700">
              {directSsoExample}
            </code>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-[var(--brand-navy)]">
              URL com token JWT assinado (Recomendado)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Quando o backend do app gerar um JWT HS256 com <code className="font-mono text-slate-700">APP_SSO_SECRET</code>, contendo <code className="font-mono text-slate-700">sub, cpf, cnpj, nome, cidade, exp</code>.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-700">
              {signedSsoExample}
            </code>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Regras fixas da operação">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <CalendarClock className="size-5 text-[var(--brand-blue)]" aria-hidden="true" />
          <h2 className="font-display mt-3 text-base font-bold text-[var(--brand-navy)]">Ciclo fixo de 75 dias</h2>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-slate-600">
            Os ciclos começaram em 16/11/2026 e se repetem a cada 75 dias. O ciclo atual começou em{" "}
            {formatDate(currentPeriod.startsAt)} e o saldo pode ser usado até{" "}
            {formatDate(pointsCycleLastUseDate(currentPeriod.endsAt))}.
          </p>
          <p className="mt-2.5 text-xs font-semibold text-[var(--brand-blue)]">Fuso horário: America/Sao_Paulo</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <ShieldCheck className="size-5 text-[var(--brand-blue)]" aria-hidden="true" />
          <h2 className="font-display mt-3 text-base font-bold text-[var(--brand-navy)]">Trilha de auditoria</h2>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-slate-600">
            Importações, ajustes, produtos, conciliações, acessos via aplicativo e mudanças de pedido registram o responsável, a data e a entidade alterada.
          </p>
        </div>
      </section>

      <section aria-labelledby="audit-title">
        <div>
          <p className="text-xs font-semibold text-[var(--brand-blue)]">Segurança operacional</p>
          <h2 id="audit-title" className="font-display mt-0.5 text-xl font-bold text-[var(--brand-navy)]">
            Atividade recente
          </h2>
        </div>

        {audits.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="hidden grid-cols-[1.2fr_0.8fr_1fr] gap-4 border-b border-slate-200/80 bg-slate-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Ação</span>
              <span>Responsável</span>
              <span>Data</span>
            </div>
            <div className="divide-y divide-slate-200/70">
              {audits.map((audit) => (
                <article
                  key={audit.id}
                  className="grid gap-2 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50/50 sm:grid-cols-[1.2fr_0.8fr_1fr] sm:items-center sm:gap-4"
                >
                  <div>
                    <p className="font-semibold text-[var(--brand-navy)]">{audit.action}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{audit.entityType}</p>
                  </div>
                  <p className="truncate text-xs text-slate-600">{audit.actor?.email ?? "Sistema"}</p>
                  <p className="text-xs tabular-nums text-slate-500">{formatDateTime(audit.createdAt)}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<History className="size-5" />}
              title="Nenhuma atividade registrada"
              description="As primeiras alterações administrativas aparecerão aqui."
            />
          </div>
        )}
      </section>
    </div>
  );
}
