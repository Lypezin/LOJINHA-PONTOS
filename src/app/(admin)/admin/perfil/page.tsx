import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";

export const metadata = { title: "Meu perfil" };

export default async function AdminProfilePage() {
  const admin = await requirePageAdmin();
  const displayName = admin.displayName || "Administrador";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sua conta administrativa"
        title="Meu perfil"
        description="Personalize sua identificação e mantenha o e-mail de acesso atualizado."
      />
      <ProfileEditor
        legalName={displayName}
        initialDisplayName={displayName}
        initialEmail={admin.email}
        avatarVersion={admin.avatarUpdatedAt?.getTime() ?? null}
        showOperationalName={false}
      />
    </div>
  );
}