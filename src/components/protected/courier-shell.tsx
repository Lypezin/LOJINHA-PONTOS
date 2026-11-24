"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, History, UserRound, WalletCards } from "lucide-react";
import { AppMark } from "@/components/ui/app-mark";
import { cn } from "@/lib/cn";
import { formatPoints, initials } from "@/lib/format";

const items = [
  { href: "/loja", label: "Loja", icon: Gift },
  { href: "/historico", label: "Resgates", icon: History },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function CourierShell({
  children,
  name,
  balance,
  avatarVersion,
}: {
  children: React.ReactNode;
  name: string;
  balance: number;
  avatarVersion: number | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="sticky top-0 z-[var(--z-header)] border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <AppMark />

          <nav
            className="hidden items-center gap-1 rounded-xl bg-slate-100/80 p-1 md:flex"
            aria-label="Navegação principal"
          >
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    active
                      ? "bg-white text-[var(--brand-navy)] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                      : "text-slate-600 hover:text-[var(--brand-navy)]",
                  )}
                >
                  <Icon
                    className={cn("size-4", active ? "text-[var(--brand-blue)]" : "text-slate-500")}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/historico"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:px-3.5 sm:text-sm"
              aria-label={`Saldo atual: ${formatPoints(balance)} pontos. Ver extrato.`}
            >
              <WalletCards className="size-3.5 shrink-0 text-emerald-700 sm:size-4" aria-hidden="true" />
              <span className="tabular-nums font-bold">
                {formatPoints(balance)} <span className="font-medium text-emerald-800">pts</span>
              </span>
            </Link>

            <Link
              href="/perfil"
              className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-navy)] text-xs font-semibold text-white ring-2 ring-slate-100 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              aria-label={`Abrir perfil de ${name}`}
            >
              {avatarVersion ? (
                // A imagem é privada e servida por uma rota autenticada do próprio app.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/profile/avatar?v=${avatarVersion}`} alt="" className="size-full object-cover" />
              ) : (
                initials(name)
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-8 md:pb-10 lg:px-8">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] border-t border-slate-200/80 bg-white/95 px-3 pt-1.5 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  active
                    ? "bg-blue-50/80 text-[var(--brand-blue)]"
                    : "text-slate-500 hover:text-[var(--brand-navy)]",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
