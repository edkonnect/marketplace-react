// Links the assistant may show. Subdomains are allowed (e.g. edkonnect.zoom.us).
const ALLOWED_LINK_HOSTS = ["edkonnect-academy.com", "zoom.us"];

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_LINK_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

function allowedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && hostAllowed(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Removes images, risky HTML and links to other sites from the assistant's reply. */
export function sanitizeReply(text: string): string {
  let out = text;
  // 1. Images are never shown (they could load an outside address)
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // 2. Markdown links: keep only allowed ones, otherwise keep just the label
  out = out.replace(/\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/g, (_m, label: string, url: string) => {
    const ok = allowedUrl(url);
    return ok ? `[${label}](${ok})` : label;
  });
  // 3. Bare links
  out = out.replace(/https?:\/\/[^\s)\]>]+/g, (url) => (allowedUrl(url) ? url : "[link removed]"));
  // 4. Risky HTML tags (only known tags, so "x < 5 and y > 3" stays untouched)
  out = out.replace(/<\/?(img|script|iframe|a|svg|style|link|object|embed|form|input|video|audio|source)\b[^>]*>/gi, "");
  return out;
}