import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { cnpjStorageCandidates } from "@/lib/auth/identity";
import { hashForAudit, writeAuditLog } from "@/lib/auth/audit";
import { createSession } from "@/lib/auth/session";
import { originDeniedResponse, parseJsonBody, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { registerSchema } from "@/lib/auth/validation";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";

const REGISTRATION_DENIED_MESSAGE =
  "Não foi possível concluir o cadastro. Confira os dados ou fale com a equipe responsável.";

class RegistrationDeniedError extends Error {}

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  const parsed = await parseJsonBody(request, registerSchema);
  if (!parsed.success) return parsed.response;

  const { cnpj, email, password } = parsed.data;
  const identityHash = hashForAudit(cnpj);
  let createdUserId: string | null = null;
  let createdUserRole: "ADMIN" | "COURIER" = "COURIER";
  let createdUserName = "Entregador";

  try {
    const limit = await consumeAuthRateLimit(request, "register", cnpj, AUTH_RATE_LIMITS.register);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
    // Mantém o custo da resposta parecido para CNPJs existentes e inexistentes.
    const passwordHash = await bcrypt.hash(password, 12);
    const courier = await db.courier.findFirst({
      where: { cnpj: { in: cnpjStorageCandidates(cnpj) } },
      select: {
        id: true,
        name: true,
        status: true,
        user: { select: { id: true } },
      },
    });

    if (!courier || courier.user || courier.status === "INACTIVE") {
      await writeAuditLog({
        request,
        action: "auth.registration_denied",
        entityType: "Auth",
        metadata: { identityHash },
      });
      return secureJson({ ok: false, message: REGISTRATION_DENIED_MESSAGE }, { status: 400 });
    }

    const user = await db.$transaction(async (transaction) => {
      const availableCourier = await transaction.courier.findUnique({
        where: { id: courier.id },
        select: {
          id: true,
          name: true,
          status: true,
          user: { select: { id: true } },
        },
      });

      if (!availableCourier || availableCourier.user || availableCourier.status === "INACTIVE") {
        throw new RegistrationDeniedError();
      }

      const created = await transaction.user.create({
        data: {
          email,
          emailNormalized: email,
          passwordHash,
          courierId: availableCourier.id,
        },
        select: { id: true, email: true, role: true, courier: { select: { name: true } } },
      });
      await transaction.courier.update({
        where: { id: availableCourier.id },
        data: { status: "ACTIVE" },
      });
      return created;
    });

    createdUserId = user.id;
    createdUserRole = user.role;
    createdUserName = user.courier?.name ?? courier.name;

    await writeAuditLog({
      request,
      action: "auth.registered",
      entityType: "User",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { courierId: courier.id },
    });

    await createSession(user.id, request);

    return secureJson(
      {
        ok: true,
        message: "Cadastro concluído.",
        user: { name: user.courier?.name ?? courier.name, email: user.email, role: user.role },
        redirectTo: user.role === "ADMIN" ? "/admin" : "/loja",
      },
      { status: 201 },
    );
  } catch (error) {
    const isConflict =
      error instanceof RegistrationDeniedError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");

    if (createdUserId) {
      console.error("[auth:register] Cadastro criado, mas o login automático falhou.");
      return secureJson(
        {
          ok: true,
          message: "Cadastro criado. Entre com seu e-mail e senha para continuar.",
          user: { name: createdUserName, email, role: createdUserRole },
          redirectTo: "/login?cadastro=concluido",
        },
        { status: 201 },
      );
    }

    await writeAuditLog({
      request,
      action: "auth.registration_failed",
      entityType: "Auth",
      metadata: { identityHash, reason: isConflict ? "conflict" : "internal" },
    });

    if (!isConflict) console.error("[auth:register] Falha interna ao criar o cadastro.");
    return secureJson(
      { ok: false, message: isConflict ? REGISTRATION_DENIED_MESSAGE : "Não foi possível concluir o cadastro agora." },
      { status: isConflict ? 409 : 500 },
    );
  }
}
