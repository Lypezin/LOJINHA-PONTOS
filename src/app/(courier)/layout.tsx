import { redirect } from "next/navigation";
import { CourierShell } from "@/components/protected/courier-shell";
import { getCurrentAccount } from "@/features/points/period";
import { requirePageUser } from "@/lib/auth/session";

export default async function CourierLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (user.role === "ADMIN") redirect("/admin");
  if (!user.courierId || !user.courier) redirect("/login?erro=vinculo");
  const { account } = await getCurrentAccount(user.courierId);

  return (
    <CourierShell
      name={user.displayName || user.courier.name}
      balance={account?.balancePoints ?? 0}
      avatarVersion={user.avatarUpdatedAt?.getTime() ?? null}
    >
      {children}
    </CourierShell>
  );
}
