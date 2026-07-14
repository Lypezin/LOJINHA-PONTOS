import type { Instrumentation } from "next";

function safeMessage(error: Error) {
  return error.message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[redacted]@")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const normalized = error instanceof Error ? error : new Error("Unknown server error");
  const details = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  const errorCode = typeof details.code === "string" ? details.code : undefined;
  const digest = typeof details.digest === "string" ? details.digest : undefined;
  console.error("[server:request-error]", {
    digest,
    name: normalized.name,
    code: errorCode,
    message: safeMessage(normalized),
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};