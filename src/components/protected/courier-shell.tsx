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

export function CourierShell({ children, name, balance }: { children: React.ReactNode; name: string; balance: number }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[#f7f9fc]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <AppMark />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                    active ? "bg-blue-50 text-[var(--brand-blue-dark)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-navy)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/historico"
              className="hidden min-h-11 items-center gap-2 rounded-full bg-emerald-50 px-4 text-sm font-extrabold text-[var(--brand-mint-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:inline-flex"
              aria-label={`Saldo atual: ${formatPoints(balance)} pontos. Ver extrato.`}
            >
              <WalletCards className="size-4" aria-hidden="true" />
              <span className="tabular-nums">{formatPoints(balance)} pts</span>
            </Link>
            <Link
              href="/perfil"
              className="flex size-11 items-center justify-center rounded-full bg-[var(--brand-navy)] text-sm font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              aria-label={`Abrir perfil de ${name}`}
            >
              {initials(name)}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 md:pb-10 lg:px-8">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 pt-2 md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                  active ? "bg-blue-50 text-[var(--brand-blue-dark)]" : "text-slate-600",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
