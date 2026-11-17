import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const product = await db.product.findFirst({
      where: { id, status: "ACTIVE" },
      select: { imageUrl: true },
    });
    const match = product?.imageUrl?.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!product || !match) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const body = Buffer.from(match[2], "base64");
    return new Response(body, { headers: {
      "Content-Type": `image/${match[1]}`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return apiError(error);
  }
}
