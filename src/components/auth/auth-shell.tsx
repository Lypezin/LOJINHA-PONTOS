import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Gift, History, PackageCheck } from "lucide-react";
import { AppMark } from "@/components/ui/app-mark";

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

const benefits = [
  {
    icon: PackageCheck,
    title: "Pedidos viram pontos",
    text: "Seu saldo acompanha os pedidos concluídos em cada ciclo.",
  },
  {
    icon: Gift,
    title: "Prêmios ou PIX",
    text: "Troque pontos por itens físicos ou 50% do valor via PIX.",
  },
  {
    icon: History,
    title: "Extrato transparente",
    text: "Acompanhe créditos, resgates e datas de validade em tempo real.",
  },
];

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(11,22,51,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col justify-between bg-[var(--brand-navy)] p-6 text-white sm:p-8 lg:p-11">
          <div>
            <AppMark href="/login" inverse />

            <div className="mt-10 hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Clube de vantagens EntreGô
              </p>
              <h2 className="font-display mt-3 max-w-md text-balance text-3xl font-bold leading-snug tracking-tight">
                Conquistas que acompanham cada entrega.
              </h2>
              <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-slate-300">
                Uma loja leve e segura para consultar seu saldo de pontos e resgatar recompensas.
              </p>

              <div className="mt-9 space-y-4">
                {benefits.map(({ icon: Icon, title: benefitTitle, text }) => (
                  <div key={benefitTitle} className="flex gap-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-emerald-300">
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{benefitTitle}</p>
                      <p className="mt-0.5 max-w-xs text-pretty text-xs leading-relaxed text-slate-300">
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-8 hidden text-xs text-slate-400 lg:block">
            Acesso direto pelo app EntreGô ou com suas credenciais.
          </p>
        </aside>

        <section className="flex items-center px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            {eyebrow ? (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {eyebrow}
              </div>
            ) : null}
            <h1 className="font-display text-balance text-2xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-slate-600">
              {description}
            </p>

            <div className="mt-7">{children}</div>
            <div className="mt-7 border-t border-slate-200/80 pt-5 text-center text-sm text-slate-600">
              {footer}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
