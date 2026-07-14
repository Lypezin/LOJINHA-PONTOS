import { CalendarClock, Mail, MapPin, ShieldCheck, Store, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentAccount } from "@/features/points/period";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatPoints } from "@/lib/format";
import { formatCnpj, monthLabel } from "@/lib/presentation";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  if (!user.courierId) return null;
  const [courier, { period, account }] = await Promise.all([
    db.courier.findUnique({ where: { id: user.courierId } }),
    getCurrentAccount(user.courierId),
  ]);
  if (!courier) return null;

  const fields = [
    { label: "Nome completo", value: courier.name, icon: UserRound },
    { label: "E-mail de acesso", value: user.email, icon: Mail },
    { label: "CNPJ de acesso", value: formatCnpj(courier.cnpj), icon: Store },
    { label: "Praça", value: courier.plaza || "Não informada", icon: MapPin },
    { label: "Subpraça", value: courier.subPlaza || "Não informada", icon: MapPin },
  ];

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Sua conta" title="Meu perfil" description="Atualize seus dados, personalize sua foto e confira as informações operacionais vinculadas ao cadastro." />

      <ProfileEditor
        legalName={courier.name}
        initialDisplayName={user.displayName || courier.name}
        initialEmail={user.email}
        avatarVersion={user.avatarUpdatedAt?.getTime() ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="data-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="data-title" className="text-balance text-xl font-extrabold text-[var(--brand-navy)]">Dados do entregador</h2>
            <StatusBadge tone={courier.status === "ACTIVE" ? "success" : courier.status === "PENDING" ? "warning" : "danger"}>
              {courier.status === "ACTIVE" ? "Cadastro ativo" : courier.status === "PENDING" ? "Cadastro pendente" : "Cadastro inativo"}
            </StatusBadge>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {fields.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <dt className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Icon className="size-4 text-[var(--brand-blue)]" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-2 break-words text-sm font-bold text-[var(--brand-navy)]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-pretty text-xs leading-5 text-slate-500">Praça, subpraça, nome operacional e CNPJ são validados pelas guias da planilha mensal. Se algum deles estiver incorreto, fale com a equipe administrativa.</p>
        </section>

        <div className="space-y-6">
          <section className="rounded-[20px] bg-[var(--brand-blue-dark)] p-6 text-white" aria-labelledby="points-title">
            <CalendarClock className="size-6 text-[var(--brand-mint)]" aria-hidden="true" />
            <h2 id="points-title" className="mt-4 text-balance text-lg font-extrabold">{monthLabel(period.year, period.month)}</h2>
            <p className="mt-2 text-4xl font-extrabold tabular-nums">{formatPoints(account?.balancePoints ?? 0)} <span className="text-base text-blue-100">pts</span></p>
            <p className="mt-3 text-sm leading-6 text-blue-100">Este saldo expira em <strong className="font-extrabold text-white tabular-nums">{formatDate(period.endsAt)}</strong>.</p>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="security-title">
            <ShieldCheck className="size-6 text-[var(--brand-blue)]" aria-hidden="true" />
            <h2 id="security-title" className="mt-4 text-balance text-lg font-extrabold text-[var(--brand-navy)]">Segurança da conta</h2>
            <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Sua sessão é protegida. Ao usar um aparelho compartilhado, encerre a conta quando terminar.</p>
            <div className="mt-5"><LogoutButton /></div>
          </section>
        </div>
      </div>
    </div>
  );
}
