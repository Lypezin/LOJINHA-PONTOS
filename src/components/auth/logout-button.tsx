"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível sair agora. Tente novamente.");
      window.location.assign("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível sair agora.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={logout} disabled={pending}>
        <LogOut className="size-4" aria-hidden="true" />
        {pending ? "Saindo…" : "Sair da conta"}
      </Button>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
