"use client";

import { Camera, CheckCircle2, Save, Trash2, UserRound } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-blue-100";

type ApiResult = { error?: string; profile?: { displayName: string; email: string }; updatedAt?: string };

async function readResult(response: Response) {
  return response.json().catch(() => ({})) as Promise<ApiResult>;
}

export function ProfileEditor({
  legalName,
  initialDisplayName,
  initialEmail,
  avatarVersion,
  showOperationalName = true,
}: {
  legalName: string;
  initialDisplayName: string;
  initialEmail: string;
  avatarVersion: number | null;
  showOperationalName?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(avatarVersion ? `/api/profile/avatar?v=${avatarVersion}` : "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [profilePending, setProfilePending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [error, setError] = useState("");

  const emailChanged = email.trim().toLowerCase() !== savedEmail.toLowerCase();

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setPhotoMessage("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 1_500_000) {
      setError("A foto deve ter no máximo 1,5 MB.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!selectedFile) return;
    setPhotoPending(true);
    setError("");
    setPhotoMessage("");
    try {
      const form = new FormData();
      form.set("avatar", selectedFile);
      const response = await fetch("/api/profile/avatar", { method: "PUT", body: form });
      const data = await readResult(response);
      if (!response.ok || !data.updatedAt) throw new Error(data.error || "Não foi possível salvar a foto.");
      setAvatarUrl(`/api/profile/avatar?v=${new Date(data.updatedAt).getTime()}`);
      setSelectedFile(null);
      setPreviewUrl("");
      if (inputRef.current) inputRef.current.value = "";
      setPhotoMessage("Foto atualizada com sucesso.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a foto.");
    } finally {
      setPhotoPending(false);
    }
  }

  async function removePhoto() {
    setPhotoPending(true);
    setError("");
    setPhotoMessage("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await readResult(response);
      if (!response.ok) throw new Error(data.error || "Não foi possível remover a foto.");
      setAvatarUrl("");
      setSelectedFile(null);
      setPreviewUrl("");
      if (inputRef.current) inputRef.current.value = "";
      setPhotoMessage("Foto removida.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível remover a foto.");
    } finally {
      setPhotoPending(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfilePending(true);
    setError("");
    setProfileMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, currentPassword: currentPassword || undefined }),
      });
      const data = await readResult(response);
      if (!response.ok || !data.profile) throw new Error(data.error || "Não foi possível atualizar o perfil.");
      setDisplayName(data.profile.displayName);
      setEmail(data.profile.email);
      setSavedEmail(data.profile.email);
      setCurrentPassword("");
      setProfileMessage("Perfil atualizado com sucesso.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o perfil.");
    } finally {
      setProfilePending(false);
    }
  }

  const shownAvatar = previewUrl || avatarUrl;

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" aria-labelledby="edit-profile-title">
      <div className="bg-[var(--brand-blue-dark)] px-5 py-7 text-white sm:px-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-full border-4 border-white/90 bg-white/10 shadow-lg">
            {shownAvatar ? (
              // A imagem é privada, autenticada e pode ser uma prévia local.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownAvatar} alt={`Foto de ${displayName}`} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl font-extrabold">{initials(displayName || legalName)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-blue-100">Seu perfil</p>
            <h2 id="edit-profile-title" className="mt-1 truncate text-2xl font-extrabold">{displayName || legalName}</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">Personalize como seu nome aparece e escolha uma foto nítida para identificar sua conta.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[19rem_1fr]">
        <div>
          <h3 className="font-extrabold text-[var(--brand-navy)]">Foto de perfil</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG ou WebP de até 1,5 MB. Prefira uma foto quadrada.</p>
          <input ref={inputRef} id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="sr-only" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={photoPending}>
              <Camera className="size-4" aria-hidden="true" />Escolher foto
            </Button>
            {selectedFile ? (
              <Button onClick={uploadPhoto} disabled={photoPending}>
                <Save className="size-4" aria-hidden="true" />{photoPending ? "Enviando…" : "Salvar foto"}
              </Button>
            ) : null}
            {avatarUrl ? (
              <Button variant="ghost" onClick={removePhoto} disabled={photoPending}>
                <Trash2 className="size-4" aria-hidden="true" />Remover
              </Button>
            ) : null}
          </div>
          {photoMessage ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700" role="status"><CheckCircle2 className="size-4" />{photoMessage}</p> : null}
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-sm font-bold">Nome de exibição</label>
            <div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><input id="profile-name" className={`${fieldClass} pl-10`} required minLength={2} maxLength={100} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setProfileMessage(""); }} /></div>
            {showOperationalName ? <p className="mt-1.5 text-xs text-slate-500">O nome operacional da planilha continua protegido: {legalName}.</p> : null}
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-sm font-bold">E-mail de acesso</label>
            <input id="profile-email" type="email" autoComplete="email" className={fieldClass} required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setProfileMessage(""); }} />
          </div>
          {emailChanged ? (
            <div>
              <label htmlFor="profile-current-password" className="mb-1.5 block text-sm font-bold">Senha atual para confirmar o novo e-mail</label>
              <input id="profile-current-password" type="password" autoComplete="current-password" className={fieldClass} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
          ) : null}
          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
          {profileMessage ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status"><CheckCircle2 className="size-4" />{profileMessage}</p> : null}
          <Button type="submit" disabled={profilePending}>
            <Save className="size-4" aria-hidden="true" />{profilePending ? "Salvando…" : "Salvar perfil"}
          </Button>
        </form>
      </div>
    </section>
  );
}
