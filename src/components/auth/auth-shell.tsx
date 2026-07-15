import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Gift, History, PackageCheck, ShieldCheck } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

const benefits = [
  { icon: PackageCheck, title: "Pedidos viram pontos", text: "Seu saldo mensal acompanha os pedidos concluídos." },
  { icon: Gift, title: "Escolha seus prêmios", text: "Troque pontos por itens disponíveis na loja." },
  { icon: History, title: "Tudo fica registrado", text: "Consulte seu saldo, resgates e movimentações." },
];

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center bg-[var(--surface-soft)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden bg-[var(--brand-blue)] p-6 text-white sm:p-8 lg:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 size-64 rounded-full border-[36px] border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-20 size-72 rounded-full border-[44px] border-[var(--brand-mint)]/20"
          />

          <div className="relative flex h-full flex-col">
            <Link
              href="/login"
              className="inline-flex min-h-11 w-fit items-center gap-3 rounded-xl focus-visible:outline-white"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-white text-[var(--brand-blue)] shadow-sm">
                <Gift aria-hidden="true" className="size-6" strokeWidth={2.4} />
              </span>
              <span className="text-lg font-extrabold">Lojinha EntreGÔ</span>
            </Link>

            <div className="mt-12 hidden lg:block">
              <p className="text-sm font-bold text-white/80">Seu trabalho vale mais</p>
              <h2 className="mt-3 max-w-md text-balance text-4xl font-extrabold leading-tight">
                Conquistas que acompanham cada entrega.
              </h2>
              <p className="mt-4 max-w-md text-pretty text-base leading-7 text-white/80">
                Uma loja simples e segura para você acompanhar seus pontos e escolher seus prêmios.
              </p>

              <div className="mt-10 space-y-5">
                {benefits.map(({ icon: Icon, title: benefitTitle, text }) => (
                  <div key={benefitTitle} className="flex gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold">{benefitTitle}</p>
                      <p className="mt-1 max-w-sm text-pretty text-sm leading-6 text-white/85">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 hidden items-start gap-3 rounded-[20px] border border-white/20 bg-[var(--brand-blue-dark)] p-4 lg:flex">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--brand-mint)]" />
              <p className="text-pretty text-sm leading-6 text-white/85">
                Os pontos valem até o fim de cada mês. Planeje seus resgates antes da virada.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[#EEF3FF] px-3 text-sm font-bold text-[var(--brand-blue-dark)]">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {eyebrow}
            </div>
             <h1 className="mt-5 text-balance text-3xl font-extrabold leading-tight text-[var(--brand-navy)] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-pretty leading-7 text-slate-700">{description}</p>

            <div className="mt-8">{children}</div>
            <div className="mt-7 border-t border-[var(--line)] pt-6 text-center text-sm text-slate-700">
              {footer}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
