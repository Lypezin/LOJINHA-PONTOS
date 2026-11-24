import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { buildAppSsoQueryString, hasAppSsoParams } from "@/lib/auth/app-sso-parser";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (hasAppSsoParams(params)) {
    const query = buildAppSsoQueryString(params);
    redirect(`/api/auth/app-login?${query}`);
  }

  const initialMessage =
    params.cidade === "indisponivel"
      ? "A Lojinha ainda não está disponível na sua cidade. Fale com a equipe responsável para mais informações."
      : params.erro === "inativo"
        ? "Seu cadastro está inativo no momento. Fale com a equipe responsável para mais informações."
        : params.erro === "sso"
          ? "Não foi possível concluir o acesso automático pelo aplicativo. Entre com seus dados abaixo ou abra novamente pelo app."
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
          <Link href="/cadastro" className="font-semibold text-[var(--brand-blue)] hover:underline">
            Criar minha conta
          </Link>
        </p>
      }
    >
      <LoginForm initialMessage={initialMessage} />
    </AuthShell>
  );
}
