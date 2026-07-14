import { ProductManager, type AdminProduct } from "@/components/admin/product-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Produtos" };

export default async function AdminProductsPage() {
  await requirePageAdmin();
  const products = await db.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      version: true,
      name: true,
      description: true,
      category: true,
      imageUrl: true,
      pointsCost: true,
      referenceValueCents: true,
      stockQuantity: true,
      maxPerCourierPerPeriod: true,
      status: true,
      featured: true,
      sortOrder: true,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Catálogo" title="Produtos" description="Gerencie tudo o que aparece na loja: imagem, detalhes, custo, estoque, limite e disponibilidade." />
      <ProductManager products={products satisfies AdminProduct[]} />
    </div>
  );
}
