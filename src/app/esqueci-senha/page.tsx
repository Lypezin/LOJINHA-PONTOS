import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      eyebrow="Recuperação de acesso"
      title="Vamos recuperar sua conta"
      description="Digite o e-mail do seu cadastro. Se ele estiver na nossa base, enviaremos um link válido por 1 hora."
      footer={
        <Link href="/login" className="font-bold text-[var(--brand-blue-dark)] hover:underline">
          Voltar para entrar
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
