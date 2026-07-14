import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <AuthShell
      eyebrow="Primeiro acesso"
      title="Crie sua conta"
      description="Informe seu CNPJ para conectarmos seu cadastro ao nome e aos pontos enviados pela empresa."
      footer={
        <p>
          Já criou sua conta?{" "}
          <Link href="/login" className="font-bold text-[var(--brand-blue-dark)] hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
