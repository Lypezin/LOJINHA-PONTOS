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
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";
import { AppMark } from "@/components/ui/app-mark";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const items = [
  { href: "/admin", label: "Visão geral", icon: Gauge },
  { href: "/admin/produtos", label: "Produtos", icon: Boxes },
  { href: "/admin/resgates", label: "Resgates", icon: PackageCheck },
  { href: "/admin/entregadores", label: "Entregadores", icon: UsersRound },
  { href: "/admin/importacoes", label: "Importações", icon: FileSpreadsheet },
  { href: "/admin/conciliacao", label: "Conciliação", icon: UserRoundSearch },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function AdminNav({ pathname, closeOnNavigate = false }: { pathname: string; closeOnNavigate?: boolean }) {
  return (
    <nav className="space-y-1" aria-label="Navegação administrativa">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        const link = (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
              active ? "bg-blue-50 text-[var(--brand-blue-dark)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-navy)]",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
        return closeOnNavigate ? <Dialog.Close asChild key={href}>{link}</Dialog.Close> : link;
      })}
    </nav>
  );
}

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--surface-soft)] lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col">
        <AppMark href="/admin" />
        <div className="mt-8 flex-1 overflow-y-auto">
          <AdminNav pathname={pathname} />
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-navy)] text-xs font-extrabold text-white" aria-hidden="true">
            {initials(email)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Administrador</p>
            <p className="truncate text-sm font-bold text-[var(--brand-navy)]">{email}</p>
          </div>
        </div>
        <div className="mt-3"><LogoutButton /></div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:hidden">
          <AppMark href="/admin" />
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-[var(--brand-navy)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Abrir menu administrativo">
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(88vw,20rem)] overflow-y-auto bg-white p-5 shadow-xl focus:outline-none">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-extrabold text-[var(--brand-navy)]">Menu administrativo</Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Fechar menu administrativo">
                      <X className="size-5" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="mt-1 text-sm text-slate-600">Gerencie a lojinha e os pontos.</Dialog.Description>
                <div className="mt-7">
                  <AdminNav pathname={pathname} closeOnNavigate />
                </div>
                <div className="mt-6 border-t border-slate-200 pt-5"><LogoutButton /></div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
