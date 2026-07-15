import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Prevent DoS via large payloads (M3 / Security Bypass)
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const isMultipart = contentType.startsWith("multipart/form-data");
    const limit = isMultipart ? 210 * 1024 * 1024 : 256 * 1024; // 210 MB for uploads, 256 KB for JSON/text
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > limit) {
      return new NextResponse(
        JSON.stringify({ error: "A solicitação é muito grande.", code: "PAYLOAD_TOO_LARGE" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const response = NextResponse.next();

  // Enforce security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // HSTS (only on HTTPS/production)
  const isHttps = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  if (isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: http: https:;
    font-src 'self' data:;
    connect-src 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, " ").trim();

  response.headers.set("Content-Security-Policy", cspHeader);

  // Prevent caching of dynamic API routes to avoid exposing sensitive info (M2)
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: [
    // Ensure all API routes are matched to prevent suffix bypasses
    "/api/:path*",
    // Apply to all routes except static files (_next/static, _next/image, favicon.ico, images)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
