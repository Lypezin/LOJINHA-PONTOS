import { NextResponse } from "next/server";
import { getRequestIpHash } from "@/lib/auth/audit";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const MAX_AVATAR_BYTES = 1_500_000;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function GET() {
  try {
    const user = await requireUser();
    const avatar = await db.user.findUnique({
      where: { id: user.id },
      select: { avatarData: true, avatarMimeType: true, avatarUpdatedAt: true },
    });
    if (!avatar?.avatarData || !avatar.avatarMimeType) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    return new NextResponse(Buffer.from(avatar.avatarData), {
      headers: {
        "Content-Type": avatar.avatarMimeType,
        "Content-Length": String(avatar.avatarData.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ETag: `"${avatar.avatarUpdatedAt?.getTime() ?? 0}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const user = await requireUser();
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES + 64_000) {
      throw new DomainError("A foto deve ter no máximo 1,5 MB.", "AVATAR_TOO_LARGE", 413);
    }
    const form = await request.formData();
    const file = form.get("avatar");
    if (!(file instanceof File)) {
      throw new DomainError("Selecione uma foto.", "AVATAR_REQUIRED", 422);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new DomainError("Use uma imagem JPG, PNG ou WebP.", "AVATAR_TYPE_INVALID", 422);
    }
    if (file.size < 32 || file.size > MAX_AVATAR_BYTES) {
      throw new DomainError("A foto deve ter no máximo 1,5 MB.", "AVATAR_SIZE_INVALID", 422);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, file.type)) {
      throw new DomainError("O arquivo enviado não é uma imagem válida.", "AVATAR_CONTENT_INVALID", 422);
    }
    const now = new Date();
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { avatarData: bytes, avatarMimeType: file.type, avatarUpdatedAt: now },
      }),
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PROFILE_AVATAR_UPDATED",
          entityType: "User",
          entityId: user.id,
          metadata: { mimeType: file.type, bytes: file.size },
          ipHash: getRequestIpHash(request),
        },
      }),
    ]);
    return NextResponse.json({ updatedAt: now.toISOString() });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const user = await requireUser();
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
      }),
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PROFILE_AVATAR_REMOVED",
          entityType: "User",
          entityId: user.id,
          ipHash: getRequestIpHash(request),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
