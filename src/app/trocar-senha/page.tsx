import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Trocar senha inicial" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(user.role === "ADMIN" ? "/admin" : "/loja");

  return (
    <AuthShell
      eyebrow="Primeiro acesso"
      title="Crie uma senha só sua"
      description="Antes de acessar a lojinha, substitua a senha inicial por uma combinação pessoal e segura."
      footer={<Link href="/login" className="inline-flex min-h-11 items-center font-bold text-[var(--brand-blue-dark)] hover:underline">Voltar para a entrada</Link>}
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}
