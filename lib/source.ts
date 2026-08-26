// Detects a friendly source label from a URL — no network call, just parsing.
// Used both when a pin is created (server) and when rendering (client), so
// it's a plain pure function with no side effects.
export function detectSource(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (/(^|\.)instagram\.com$/.test(host)) return "Instagram";
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "YouTube";
    if (/(^|\.)tiktok\.com$/.test(host)) return "TikTok";
    if (/(^|\.)pinterest\.[a-z.]+$/.test(host)) return "Pinterest";
    if (/(^|\.)maps\.app\.goo\.gl$/.test(host)) return "Maps";
    if (/(^|\.)google\.[a-z.]+$/.test(host) && /maps|goo\.gl\/maps/.test(rawUrl)) return "Maps";
    return host;
  } catch {
    return "";
  }
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
