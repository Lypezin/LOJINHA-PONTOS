import { redirect } from "next/navigation";
import { buildAppSsoQueryString, hasAppSsoParams } from "@/lib/auth/app-sso-parser";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (hasAppSsoParams(params)) {
    const query = buildAppSsoQueryString(params);
    redirect(`/api/auth/app-login?${query}`);
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/trocar-senha");
  redirect(user.role === "ADMIN" ? "/admin" : "/loja");
}
