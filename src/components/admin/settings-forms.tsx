"use client";

import { CheckCircle2, FileSpreadsheet, Save, Store } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

function columnIndex(letter: string) {
  return letter.trim().toUpperCase().split("").reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

async function updateSetting(key: "points.defaultColumn" | "store.profile", value: Record<string, unknown>) {
  const response = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível salvar a configuração.");
}

function Feedback({ error, saved }: { error: string; saved: boolean }) {
  if (error) return <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p>;
  if (saved) return <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-[var(--brand-mint-ink)]" role="status"><CheckCircle2 className="size-4" aria-hidden="true" />Configuração salva.</p>;
  return null;
}

export function SettingsForms({ defaultColumn, storeProfile }: { defaultColumn: { letter: string; header: string }; storeProfile: { name: string; supportEmail: string } }) {
  const [letter, setLetter] = useState(defaultColumn.letter);
  const [header, setHeader] = useState(defaultColumn.header);
  const [columnPending, setColumnPending] = useState(false);
  const [columnError, setColumnError] = useState("");
  const [columnSaved, setColumnSaved] = useState(false);
  const [name, setName] = useState(storeProfile.name);
  const [supportEmail, setSupportEmail] = useState(storeProfile.supportEmail);
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  async function saveColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedLetter = letter.trim().toUpperCase();
    if (!/^[A-Z]{1,3}$/.test(normalizedLetter) || columnIndex(normalizedLetter) > 16_384) {
      setColumnError("Informe uma coluna do Excel entre A e XFD.");
      return;
    }
    setColumnPending(true); setColumnError(""); setColumnSaved(false);
    try {
      await updateSetting("points.defaultColumn", { letter: normalizedLetter, index: columnIndex(normalizedLetter), header: header.trim() });
      setLetter(normalizedLetter); setColumnSaved(true);
    } catch (caught) { setColumnError(caught instanceof Error ? caught.message : "Não foi possível salvar a coluna."); }
    finally { setColumnPending(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfilePending(true); setProfileError(""); setProfileSaved(false);
    try { await updateSetting("store.profile", { name: name.trim(), supportEmail: supportEmail.trim() }); setProfileSaved(true); }
    catch (caught) { setProfileError(caught instanceof Error ? caught.message : "Não foi possível salvar a identidade."); }
    finally { setProfilePending(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="column-title">
        <FileSpreadsheet className="size-6 text-[var(--brand-blue)]" aria-hidden="true" />
        <h2 id="column-title" className="mt-4 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Coluna padrão de pontos</h2>
        <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Esta seleção abre automaticamente nas novas importações. Ela ainda pode ser trocada na prévia de cada arquivo.</p>
        <form onSubmit={saveColumn} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]"><div><label htmlFor="default-letter" className="mb-1.5 block text-sm font-bold">Coluna</label><input id="default-letter" className={`${fieldClass} uppercase tabular-nums`} required maxLength={3} value={letter} onChange={(event) => { setLetter(event.target.value); setColumnSaved(false); }} placeholder="R" /></div><div><label htmlFor="default-header" className="mb-1.5 block text-sm font-bold">Cabeçalho esperado</label><input id="default-header" className={fieldClass} required value={header} onChange={(event) => { setHeader(event.target.value); setColumnSaved(false); }} placeholder="numero_de_pedidos_aceitos_e_concluidos" /></div></div>
          <Feedback error={columnError} saved={columnSaved} />
          <Button type="submit" disabled={columnPending}><Save className="size-4" aria-hidden="true" />{columnPending ? "Salvando…" : "Salvar coluna padrão"}</Button>
        </form>
      </section>

      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="profile-title">
        <Store className="size-6 text-[var(--brand-blue)]" aria-hidden="true" />
        <h2 id="profile-title" className="mt-4 text-balance text-xl font-extrabold text-[var(--brand-navy)]">Identidade da loja</h2>
        <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Defina o nome interno e o contato que a equipe usa para suporte aos entregadores.</p>
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <div><label htmlFor="store-name" className="mb-1.5 block text-sm font-bold">Nome da loja</label><input id="store-name" className={fieldClass} required minLength={2} value={name} onChange={(event) => { setName(event.target.value); setProfileSaved(false); }} /></div>
          <div><label htmlFor="support-email" className="mb-1.5 block text-sm font-bold">E-mail de suporte</label><input id="support-email" type="email" className={fieldClass} required value={supportEmail} onChange={(event) => { setSupportEmail(event.target.value); setProfileSaved(false); }} /></div>
          <Feedback error={profileError} saved={profileSaved} />
          <Button type="submit" disabled={profilePending}><Save className="size-4" aria-hidden="true" />{profilePending ? "Salvando…" : "Salvar identidade"}</Button>
        </form>
      </section>
    </div>
  );
}
