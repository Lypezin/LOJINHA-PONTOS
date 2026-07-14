import { SessionKeeper } from "@/components/auth/session-keeper";
import { AdminShell } from "@/components/protected/admin-shell";
import { requirePageAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePageAdmin();
  return <AdminShell email={admin.email} name={admin.displayName} avatarVersion={admin.avatarUpdatedAt?.getTime() ?? null}><SessionKeeper />{children}</AdminShell>;
}
