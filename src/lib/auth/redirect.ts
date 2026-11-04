export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}

export function loginErrorUrl(
  requestUrl: string,
  message: string,
  next?: string,
): URL {
  const url = new URL("/login", requestUrl);
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", next);
  return url;
}
