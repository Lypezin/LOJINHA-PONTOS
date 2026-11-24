"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  FileSpreadsheet,
  Gauge,
  Menu,
  PackageCheck,
  Settings,
  Trophy,
  UserCog,
  UserRound,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";
import { AppMark } from "@/components/ui/app-mark";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const navGroups = [
  {
    label: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: Gauge },
      { href: "/admin/resgates", label: "Resgates", icon: PackageCheck },
      { href: "/admin/produtos", label: "Produtos", icon: Boxes },
      { href: "/admin/ranking", label: "Ranking", icon: Trophy },
    ],
  },
  {
    label: "Base e Pontos",
    items: [
      { href: "/admin/entregadores", label: "Entregadores", icon: UsersRound },
      { href: "/admin/importacoes", label: "Importações", icon: FileSpreadsheet },
      { href: "/admin/conciliacao", label: "Conciliação", icon: UserRoundSearch },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: UserCog },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/perfil", label: "Meu perfil", icon: UserRound },
    ],
  },
];

function AdminNav({ pathname, closeOnNavigate = false }: { pathname: string; closeOnNavigate?: boolean }) {
  return (
    <nav className="space-y-5" aria-label="Navegação administrativa">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              const link = (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    active
                      ? "bg-blue-50/80 font-semibold text-[var(--brand-blue)]"
                      : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-[var(--brand-navy)]",
                  )}
                >
                  <Icon
                    className={cn("size-[18px]", active ? "text-[var(--brand-blue)]" : "text-slate-400")}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              );
              return closeOnNavigate ? <Dialog.Close asChild key={href}>{link}</Dialog.Close> : link;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  children,
  email,
  name,
  avatarVersion,
}: {
  children: React.ReactNode;
  email: string;
  name: string | null;
  avatarVersion: number | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--background)] lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-slate-200/80 bg-white p-4 lg:flex lg:flex-col">
        <div className="px-1 pt-1">
          <AppMark href="/admin" />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          <AdminNav pathname={pathname} />
        </div>
        <div className="mt-4 border-t border-slate-200/80 pt-4">
          <Link
            href="/admin/perfil"
            className="flex min-h-11 items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            aria-label="Abrir meu perfil"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-navy)] text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {avatarVersion ? (
                // A imagem é privada e servida por uma rota autenticada.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/profile/avatar?v=${avatarVersion}`} alt="" className="size-full object-cover" />
              ) : (
                initials(name || email)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-500">{name || "Administrador"}</p>
              <p className="truncate text-xs font-semibold text-[var(--brand-navy)]">{email}</p>
            </div>
          </Link>
        </div>
        <div className="mt-2.5">
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[var(--z-header)] flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <AppMark href="/admin" />
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button
                className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[var(--brand-navy)] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                aria-label="Abrir menu administrativo"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-slate-950/40 backdrop-blur-[2px]" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-[var(--z-drawer)] w-[min(86vw,19rem)] overflow-y-auto bg-white p-5 shadow-xl focus:outline-none">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="font-display text-base font-bold text-[var(--brand-navy)]">
                    Painel Admin
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                      aria-label="Fechar menu administrativo"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="mt-0.5 text-xs text-slate-500">
                  Gerencie a lojinha e os pontos.
                </Dialog.Description>
                <div className="mt-6">
                  <AdminNav pathname={pathname} closeOnNavigate />
                </div>
                <div className="mt-6 border-t border-slate-200/80 pt-4">
                  <Link
                    href="/admin/perfil"
                    className="flex min-h-11 items-center gap-3 rounded-xl px-1.5 py-1"
                    aria-label="Abrir meu perfil"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-navy)] text-xs font-semibold text-white"
                      aria-hidden="true"
                    >
                      {avatarVersion ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/profile/avatar?v=${avatarVersion}`} alt="" className="size-full object-cover" />
                      ) : (
                        initials(name || email)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-500">{name || "Administrador"}</p>
                      <p className="truncate text-xs font-semibold text-[var(--brand-navy)]">{email}</p>
                    </div>
                  </Link>
                </div>
                <div className="mt-3">
                  <LogoutButton />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
