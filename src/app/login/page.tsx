import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string | string[]; cadastro?: string | string[]; cidade?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialMessage =
    params.cidade === "indisponivel"
      ? "A Lojinha ainda não está disponível na sua cidade. Fale com a equipe responsável para mais informações."
      : params.senha === "redefinida"
      ? "Senha atualizada. Agora você já pode entrar."
      : params.cadastro === "concluido"
        ? "Cadastro criado. Entre com seu e-mail e senha."
        : undefined;

  return (
    <AuthShell
      title="Que bom ter você de volta"
      description="Entre para acompanhar seu saldo de pontos e escolher o próximo prêmio."
      footer={
        <p>
          Ainda não tem uma conta?{" "}
          <Link href="/cadastro" className="font-bold text-[var(--brand-blue-dark)] hover:underline">
            Criar minha conta
          </Link>
        </p>
      }
    >
      <LoginForm initialMessage={initialMessage} />
    </AuthShell>
  );
}
