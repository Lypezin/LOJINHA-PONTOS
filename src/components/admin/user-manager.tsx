"use client";

import { CheckCircle2, KeyRound, ShieldCheck, UserPlus, UserRoundCheck, UserRoundX } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

export type ManagedAdmin = {
  id: string;
  displayName: string | null;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAtLabel: string;
};

type ApiAdmin = Omit<ManagedAdmin, "createdAtLabel"> & { createdAt: string };
type ApiResult = { error?: string; user?: ApiAdmin };

export function UserManager({ initialUsers, currentUserId }: { initialUsers: ManagedAdmin[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [changingId, setChangingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function normalize(user: ApiAdmin): ManagedAdmin {
    return {
      ...user,
      createdAtLabel: new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(user.createdAt)),
    };
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      const data = await response.json() as ApiResult;
      if (!response.ok || !data.user) throw new Error(data.error || "Não foi possível criar o administrador.");
      setUsers((current) => [...current, normalize(data.user!)]);
      setDisplayName(""); setEmail(""); setPassword("");
      setMessage("Administrador criado. No primeiro acesso, ele deverá definir uma nova senha.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o administrador.");
    } finally {
      setPending(false);
    }
  }

  async function setActive(user: ManagedAdmin, active: boolean) {
    setChangingId(user.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await response.json() as ApiResult;
      if (!response.ok || !data.user) throw new Error(data.error || "Não foi possível alterar este acesso.");
      const normalized = normalize(data.user);
      setUsers((current) => current.map((item) => item.id === normalized.id ? normalized : item));
      setMessage(active ? "Acesso administrativo reativado." : "Acesso desativado e sessões encerradas.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar este acesso.");
    } finally {
      setChangingId("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="new-admin-title">
        <UserPlus className="size-6 text-[var(--brand-blue)]" aria-hidden="true" />
        <h2 id="new-admin-title" className="mt-4 text-xl font-extrabold text-[var(--brand-navy)]">Novo administrador</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Crie um acesso individual. A senha informada é temporária e deverá ser trocada no primeiro login.</p>
        <form onSubmit={createUser} className="mt-5 space-y-4">
          <div><label htmlFor="admin-name" className="mb-1.5 block text-sm font-bold">Nome</label><input id="admin-name" className={fieldClass} required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>
          <div><label htmlFor="admin-email" className="mb-1.5 block text-sm font-bold">E-mail</label><input id="admin-email" type="email" autoComplete="off" className={fieldClass} required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div><label htmlFor="admin-password" className="mb-1.5 block text-sm font-bold">Senha temporária</label><input id="admin-password" type="password" autoComplete="new-password" className={fieldClass} required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} /><p className="mt-1.5 text-xs text-slate-500">Use ao menos 8 caracteres, uma letra e um número.</p></div>
          <Button type="submit" disabled={pending}><KeyRound className="size-4" />{pending ? "Criando…" : "Criar acesso ADM"}</Button>
        </form>
      </section>

      <section aria-labelledby="admin-list-title">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-[var(--brand-blue)]">Acessos protegidos</p><h2 id="admin-list-title" className="mt-1 text-2xl font-extrabold text-[var(--brand-navy)]">Administradores</h2></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-extrabold text-[var(--brand-blue-dark)]">{users.filter((user) => user.active).length} ativos</span></div>
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{message}</p> : null}
        <div className="mt-5 space-y-3">
          {users.map((user) => {
            const iconBg = user.active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600";
            return (
              <article key={user.id} className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
                    <ShieldCheck className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-extrabold text-[var(--brand-navy)]">{user.displayName || "Administrador"}</h3>
                      {user.id === currentUserId ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-blue-dark)]">
                          Você
                        </span>
                      ) : null}
                      {user.mustChangePassword ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          Troca de senha pendente
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500 font-medium">Criado em {user.createdAtLabel}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {user.active ? <Button variant="ghost" disabled={changingId === user.id || user.id === currentUserId} onClick={() => setActive(user, false)}><UserRoundX className="size-4" />Desativar</Button> : <Button variant="secondary" disabled={changingId === user.id} onClick={() => setActive(user, true)}><UserRoundCheck className="size-4" />Reativar</Button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
