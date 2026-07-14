function toOrigin(value: string | undefined | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedPostOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set<string>();

  const configuredOrigins = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL];
  const candidates = process.env.NODE_ENV === "production"
    ? configuredOrigins
    : [requestUrl.origin, ...configuredOrigins];
  for (const candidate of candidates) {
    const origin = toOrigin(candidate);
    if (origin) allowedOrigins.add(origin);
  }

  const suppliedOrigin = toOrigin(request.headers.get("origin"));
  if (suppliedOrigin) return allowedOrigins.has(suppliedOrigin);

  if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  // Ferramentas locais não enviam os cabeçalhos de navegador. Em produção,
  // exigir um deles mantém cada POST protegido contra solicitações cross-site.
  return process.env.NODE_ENV !== "production";
}
