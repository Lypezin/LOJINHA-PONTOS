import { CalendarClock, IdCard, Mail, ShieldCheck, Store, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentAccount } from "@/features/points/period";
import { pointsCycleLastUseDate } from "@/features/points/cycle";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatPoints } from "@/lib/format";
import { formatCnpj, formatCpf, periodLabel } from "@/lib/presentation";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  if (!user.courierId) return null;

  const [courier, { period, account }] = await Promise.all([
    db.courier.findUnique({ where: { id: user.courierId } }),
    getCurrentAccount(user.courierId),
  ]);
  if (!courier) return null;

  const isAppManagedEmail = user.email.endsWith("@interno.entrego.local");

  const fields = [
    { label: "Nome completo", value: courier.name, icon: UserRound },
    {
      label: "E-mail de acesso",
      value: isAppManagedEmail ? "Conectado automaticamente pelo aplicativo" : user.email,
      icon: Mail,
    },
    { label: "CPF vinculado", value: formatCpf(courier.cpf), icon: IdCard },
    { label: "CNPJ vinculado", value: formatCnpj(courier.cnpj), icon: Store },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        description="Personalize sua foto, confira seus dados cadastrais e acompanhe o ciclo vigente."
      />

      <ProfileEditor
        legalName={courier.name}
        initialDisplayName={user.displayName || courier.name}
        initialEmail={user.email}
        avatarVersion={user.avatarUpdatedAt?.getTime() ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        <section
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
          aria-labelledby="data-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="data-title" className="font-display text-lg font-bold text-[var(--brand-navy)]">
              Dados operacionais
            </h2>
            <StatusBadge
              tone={
                courier.status === "ACTIVE"
                  ? "success"
                  : courier.status === "PENDING"
                    ? "warning"
                    : "danger"
              }
            >
              {courier.status === "ACTIVE"
                ? "Cadastro ativo"
                : courier.status === "PENDING"
                  ? "Cadastro pendente"
                  : "Cadastro inativo"}
            </StatusBadge>
          </div>

          <dl className="mt-5 grid gap-3.5 sm:grid-cols-2">
            {fields.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Icon className="size-3.5 text-[var(--brand-blue)]" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1.5 break-words text-sm font-semibold text-[var(--brand-navy)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-pretty text-xs leading-relaxed text-slate-500">
            Seu nome operacional, CPF e CNPJ são sincronizados com o aplicativo e com a planilha mensal de pontos.
          </p>
        </section>

        <div className="space-y-5">
          <section
            className="rounded-2xl bg-[var(--brand-navy)] p-5 text-white shadow-[0_6px_20px_-6px_rgba(11,22,51,0.25)]"
            aria-labelledby="points-title"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <CalendarClock className="size-4 text-emerald-400" aria-hidden="true" />
              <span id="points-title">{periodLabel(period)}</span>
            </div>
            <p className="font-display mt-2.5 text-3xl font-bold tabular-nums">
              {formatPoints(account?.balancePoints ?? 0)}{" "}
              <span className="text-sm font-medium text-slate-300">pts</span>
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
              Saldo válido até{" "}
              <strong className="font-semibold tabular-nums text-white">
                {formatDate(pointsCycleLastUseDate(period.endsAt))}
              </strong>
              .
            </p>
          </section>

          <section
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            aria-labelledby="security-title"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--brand-blue)]" aria-hidden="true" />
              <h2 id="security-title" className="font-display text-base font-bold text-[var(--brand-navy)]">
                Sessão
              </h2>
            </div>
            <p className="mt-2 text-pretty text-xs leading-relaxed text-slate-500">
              Sua sessão fica conectada automaticamente no aplicativo. Use o botão abaixo apenas se precisar trocar de conta.
            </p>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
