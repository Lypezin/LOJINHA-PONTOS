import { UserManager } from "@/components/admin/user-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Usuários administrativos" };

export default async function AdminUsersPage() {
  const currentAdmin = await requirePageAdmin();
  const users = await db.user.findMany({
    where: { role: "ADMIN" },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Segurança e acessos" title="Controle de usuários" description="Crie acessos administrativos individuais, acompanhe o status e bloqueie imediatamente contas que não devem mais entrar." />
      <UserManager
        currentUserId={currentAdmin.id}
        initialUsers={users.map((user) => ({ ...user, createdAtLabel: formatDate(user.createdAt) }))}
      />
    </div>
  );
}
