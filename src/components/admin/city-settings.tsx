"use client";

import { useState } from "react";
import { MapPin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CitySettings({ cities, activeCities }: { cities: Array<{ key: string; name: string }>; activeCities: string[] }) {
  const [selected, setSelected] = useState(activeCities);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function save() {
    setPending(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "store.activeCities", value: { cities: selected } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar as cidades.");
      setMessage("Cidades atualizadas.");
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "Não foi possível salvar as cidades."); }
    finally { setPending(false); }
  }
  return <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="cities-title">
    <MapPin className="size-6 text-[var(--brand-blue)]" aria-hidden="true" />
    <h2 id="cities-title" className="mt-4 text-xl font-extrabold text-[var(--brand-navy)]">Cidades atendidas</h2>
    <p className="mt-2 text-sm text-slate-600">Marque as cidades onde os entregadores podem acessar a Lojinha. Novas cidades aparecem conforme os cadastros são importados. Entregadores sem cidade informada precisam ter o cadastro corrigido.</p>
    <fieldset className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><legend className="sr-only">Cidades ativas</legend>{cities.map((city) => <label key={city.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700"><input type="checkbox" className="size-4 accent-blue-600" checked={selected.includes(city.key)} onChange={(event) => { setSelected((current) => event.target.checked ? [...current, city.key] : current.filter((key) => key !== city.key)); setMessage(""); }} />{city.name}</label>)}</fieldset>
    {message && <p role={error ? "alert" : "status"} className={`mt-4 text-sm font-semibold ${error ? "text-red-700" : "text-emerald-700"}`}>{message}</p>}
    <Button type="button" className="mt-5" disabled={pending} onClick={save}><Save className="size-4" />{pending ? "Salvando…" : "Salvar cidades"}</Button>
  </section>;
}
