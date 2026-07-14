import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Proteja seu acesso"
      description="Escolha uma nova senha. Ao salvar, os acessos anteriores serão encerrados por segurança."
      footer={
        <Link href="/login" className="font-bold text-[var(--brand-blue-dark)] hover:underline">
          Voltar para entrar
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
