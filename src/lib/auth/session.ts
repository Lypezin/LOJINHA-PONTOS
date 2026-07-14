import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { CourierStatus, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getRequestIpHash } from "@/lib/auth/audit";
import { DomainError } from "@/lib/domain-error";

export const SESSION_COOKIE_NAME = "lojinha_session";
const DEFAULT_SESSION_DAYS = 30;
const LAST_SEEN_WRITE_INTERVAL_MS = 15 * 60 * 1000;
const SESSION_RENEWAL_WINDOW_RATIO = 0.5;

export type SessionUser = {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  avatarUpdatedAt: Date | null;
  courierId: string | null;
  courier: {
    id: string;
    name: string;
    status: CourierStatus;
  } | null;
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionDurationMs() {
  const configuredDays = Number(process.env.SESSION_DURATION_DAYS ?? DEFAULT_SESSION_DAYS);
  const days = Number.isFinite(configuredDays)
    ? Math.min(Math.max(Math.floor(configuredDays), 1), 90)
    : DEFAULT_SESSION_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

function cookieIsSecure() {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.APP_URL?.startsWith("https://") ?? false;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieIsSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge,
    priority: "high",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieIsSecure(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    priority: "high",
  });
}

export async function createSession(userId: string, request: Request) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs());
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipHash: getRequestIpHash(request),
      userAgent,
    },
    select: { id: true },
  });

  try {
    await setSessionCookie(token, expiresAt);
  } catch (error) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    throw error;
  }

  return { id: session.id, expiresAt };
}

export async function refreshCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;

  const now = new Date();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          active: true,
          courier: { select: { status: true } },
        },
      },
    },
  });

  if (
    !session ||
    session.expiresAt <= now ||
    !session.user.active ||
    session.user.courier?.status === "INACTIVE"
  ) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    await clearSessionCookie();
    return false;
  }

  const duration = sessionDurationMs();
  if (session.expiresAt.getTime() - now.getTime() <= duration * SESSION_RENEWAL_WINDOW_RATIO) {
    const expiresAt = new Date(now.getTime() + duration);
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt, lastSeenAt: now },
    });
    await setSessionCookie(token, expiresAt);
  }

  return true;
}

const loadCurrentUser = async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const now = new Date();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          emailNormalized: true,
          displayName: true,
          role: true,
          active: true,
          mustChangePassword: true,
          avatarUpdatedAt: true,
          courierId: true,
          courier: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt <= now || !session.user.active || session.user.courier?.status === "INACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    void db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: now } })
      .catch(() => undefined);
  }

  return session.user;
};

// Layouts e páginas protegidas consultam o mesmo usuário durante uma renderização.
// O cache do React é isolado por requisição e evita viagens duplicadas ao banco.
export const getCurrentUser = cache(loadCurrentUser);

export async function destroyCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  try {
    if (token) {
      await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    }
  } finally {
    await clearSessionCookie();
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("Faça login para continuar.", "AUTH_REQUIRED", 401);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.mustChangePassword) {
    throw new DomainError("Troque a senha inicial antes de continuar.", "PASSWORD_CHANGE_REQUIRED", 403);
  }
  if (user.role !== "ADMIN") {
    throw new DomainError("Acesso permitido somente para administradores.", "ADMIN_REQUIRED", 403);
  }
  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/trocar-senha");
  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/loja");
  return user;
}
