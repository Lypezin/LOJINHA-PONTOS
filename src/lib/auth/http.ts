import { NextResponse } from "next/server";
import type { z } from "zod";

const MAX_AUTH_BODY_BYTES = 16 * 1024;

export function secureJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

type ParsedBody<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = MAX_AUTH_BODY_BYTES
): Promise<ParsedBody<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      success: false,
      response: secureJson({ ok: false, message: "Envie os dados no formato JSON." }, { status: 415 }),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      success: false,
      response: secureJson({ ok: false, message: "A solicitação é muito grande." }, { status: 413 }),
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > maxBytes) {
      return {
        success: false,
        response: secureJson({ ok: false, message: "A solicitação é muito grande." }, { status: 413 }),
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: secureJson({ ok: false, message: "Não foi possível ler os dados enviados." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (parsed.success) return { success: true, data: parsed.data };

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "form";
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return {
    success: false,
    response: secureJson(
      { ok: false, message: "Revise os campos destacados.", fieldErrors },
      { status: 400 },
    ),
  };
}

export function originDeniedResponse() {
  return secureJson({ ok: false, message: "Origem da solicitação não autorizada." }, { status: 403 });
}
