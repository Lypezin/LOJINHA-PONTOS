import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getRequestIpHash, hashForAudit } from "@/lib/auth/audit";
import { secureJson } from "@/lib/auth/http";

type RateLimitRule = {
  scope: "ip" | "identity";
  max: number;
  windowMs: number;
  blockMs: number;
};

type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function clientKey(request: Request) {
  return getRequestIpHash(request) ?? hashForAudit(request.headers.get("user-agent") ?? "unknown-client");
}

export async function consumeAuthRateLimit(
  request: Request,
  action: string,
  identity: string,
  rules: RateLimitRule[],
): Promise<RateLimitDecision> {
  const ipKey = clientKey(request);
  const identityKey = hashForAudit(identity.trim().toLowerCase());
  const now = new Date();

  return db.$transaction(
    async (tx) => {
      for (const rule of rules) {
        const material = rule.scope === "ip" ? ipKey : identityKey;
        const id = hashForAudit(`${action}:${rule.scope}:${material}`);
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`);
        const bucket = await tx.rateLimitBucket.findUnique({ where: { id } });

        if (bucket?.blockedUntil && bucket.blockedUntil > now) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000)),
          };
        }

        const windowExpired = !bucket || now.getTime() - bucket.windowStartedAt.getTime() >= rule.windowMs;
        const nextCount = windowExpired ? 1 : bucket.count + 1;
        const blockedUntil = nextCount > rule.max ? new Date(now.getTime() + rule.blockMs) : null;
        await tx.rateLimitBucket.upsert({
          where: { id },
          update: {
            action,
            scope: rule.scope,
            count: nextCount,
            windowStartedAt: windowExpired ? now : bucket!.windowStartedAt,
            blockedUntil,
          },
          create: {
            id,
            action,
            scope: rule.scope,
            count: nextCount,
            windowStartedAt: now,
            blockedUntil,
          },
        });

        if (blockedUntil) {
          return { allowed: false, retryAfterSeconds: Math.ceil(rule.blockMs / 1000) };
        }
      }
      return { allowed: true };
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return secureJson(
    { ok: false, message: "Muitas tentativas. Aguarde um pouco e tente novamente." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export const AUTH_RATE_LIMITS = {
  login: [
    { scope: "ip", max: 40, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
    { scope: "identity", max: 8, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  ],
  register: [
    { scope: "ip", max: 20, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
    { scope: "identity", max: 4, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  ],
  forgotPassword: [
    { scope: "ip", max: 20, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
    { scope: "identity", max: 4, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  ],
  resetPassword: [
    { scope: "ip", max: 20, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
    { scope: "identity", max: 6, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  ],
  changePassword: [
    { scope: "ip", max: 20, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
    { scope: "identity", max: 8, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  ],
} satisfies Record<string, RateLimitRule[]>;
