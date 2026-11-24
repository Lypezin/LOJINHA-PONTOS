"use client";

import { Camera, CheckCircle2, Save, Trash2, UserRound } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MAX_AVATAR_INPUT_BYTES, optimizeAvatar } from "@/lib/avatar-client";
import { initials } from "@/lib/format";

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-blue-500/15";

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
  const isAppEmail = savedEmail.endsWith("@interno.entrego.local");

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setPhotoMessage("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      setError("A foto deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }
    setPhotoPending(true);
    try {
      const optimized = await optimizeAvatar(file);
      setSelectedFile(optimized);
      setPreviewUrl(URL.createObjectURL(optimized));
      const reduction = Math.max(0, Math.round((1 - optimized.size / file.size) * 100));
      setPhotoMessage(reduction > 0 ? `Foto otimizada: ${reduction}% menor.` : "Foto preparada para envio.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível preparar a foto.");
      event.target.value = "";
    } finally {
      setPhotoPending(false);
    }
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
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-labelledby="edit-profile-title"
    >
      <div className="border-b border-slate-200/70 bg-slate-50/70 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white bg-[var(--brand-navy)] text-white shadow-sm">
            {shownAvatar ? (
              // A imagem é privada, autenticada e pode ser uma prévia local.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownAvatar} alt={`Foto de ${displayName}`} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-lg font-bold">
                {initials(displayName || legalName)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--brand-blue)]">Identidade da conta</p>
            <h2 id="edit-profile-title" className="font-display mt-0.5 truncate text-xl font-bold text-[var(--brand-navy)]">
              {displayName || legalName}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Personalize seu nome de exibição e foto de perfil.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--brand-navy)]">Foto de perfil</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            JPG, PNG ou WebP de até 5 MB. Redimensionada automaticamente.
          </p>
          <input
            ref={inputRef}
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void choosePhoto(event)}
            className="sr-only"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={photoPending}>
              <Camera className="size-4" aria-hidden="true" />
              {photoPending ? "Otimizando…" : "Escolher foto"}
            </Button>
            {selectedFile ? (
              <Button size="sm" onClick={uploadPhoto} disabled={photoPending}>
                <Save className="size-4" aria-hidden="true" />
                {photoPending ? "Enviando…" : "Salvar foto"}
              </Button>
            ) : null}
            {avatarUrl ? (
              <Button variant="ghost" size="sm" onClick={removePhoto} disabled={photoPending}>
                <Trash2 className="size-4" aria-hidden="true" />
                Remover
              </Button>
            ) : null}
          </div>
          {photoMessage ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700" role="status">
              <CheckCircle2 className="size-4" />
              {photoMessage}
            </p>
          ) : null}
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Nome de exibição
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="profile-name"
                className={`${fieldClass} pl-9`}
                required
                minLength={2}
                maxLength={100}
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setProfileMessage("");
                }}
              />
            </div>
            {showOperationalName ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Nome operacional na planilha: {legalName}.
              </p>
            ) : null}
          </div>

          {!isAppEmail ? (
            <div>
              <label htmlFor="profile-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                E-mail de acesso
              </label>
              <input
                id="profile-email"
                type="email"
                autoComplete="email"
                className={fieldClass}
                required
                maxLength={254}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setProfileMessage("");
                }}
              />
            </div>
          ) : null}

          {emailChanged && !isAppEmail ? (
            <div>
              <label htmlFor="profile-current-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Senha atual para confirmar o novo e-mail
              </label>
              <input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                className={fieldClass}
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {profileMessage ? (
            <p
              className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
              role="status"
            >
              <CheckCircle2 className="size-4" />
              {profileMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={profilePending}>
            <Save className="size-4" aria-hidden="true" />
            {profilePending ? "Salvando…" : "Salvar perfil"}
          </Button>
        </form>
      </div>
    </section>
  );
}
