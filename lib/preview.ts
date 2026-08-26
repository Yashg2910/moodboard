// Server-side link-preview fetcher — reads the same Open Graph / Twitter-card
// meta tags that WhatsApp, Slack, etc. use. Best-effort and network-tolerant:
// any failure (timeout, non-HTML, blocked bot, no tags) resolves to null and the
// pin is still saved without a preview.

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

// Present as a real browser — many travel/booking sites challenge or 403 an
// obvious bot UA but serve normal OG tags to a browser-looking request.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// A crawler-style UA. Some Google/Meta endpoints behave BETTER for bots:
// Instagram's /embed/ returns the simple thumbnail HTML (a browser UA gets the
// full JS app), and Google Maps short links only 302 to the /place/ URL for a
// crawler (a browser UA gets no redirect).
const CRAWLER_UA = "Mozilla/5.0 (compatible; VietnamPinboard/1.0; link-preview bot)";

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  // Some platforms (YouTube) block generic bot scraping and serve a consent
  // page instead of OG tags. Use their public oEmbed endpoint when we can.
  const viaOembed = await tryOembed(rawUrl);
  if (viaOembed) return viaOembed;

  // Google Maps serves every share link the same generic "Find local
  // businesses" OG card — the real place name lives in the resolved URL path.
  const viaMaps = await tryMaps(rawUrl);
  if (viaMaps) return viaMaps;

  // Instagram shows a login wall to anonymous OG scrapers, but its /embed/
  // view exposes the thumbnail + author without auth.
  const viaInstagram = await tryInstagram(rawUrl);
  if (viaInstagram) return viaInstagram;

  return fetchOpenGraph(rawUrl);
}

async function tryInstagram(rawUrl: string): Promise<LinkPreview | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (!/(^|\.)instagram\.com$/.test(host)) return null;

  const m = parsed.pathname.match(/^\/(p|reel|reels|tv)\/([^/]+)/);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  const embedUrl = `https://www.instagram.com/${kind}/${m[2]}/embed/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(embedUrl, {
      signal: controller.signal,
      headers: { "user-agent": CRAWLER_UA, accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 400_000);

    const imgTag = html.match(/<img[^>]*EmbeddedMediaImage[^>]*>/i)?.[0] || "";
    const image = decodeEntities(imgTag.match(/\bsrc="([^"]+)"/i)?.[1] || "");
    const username =
      html.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim() ||
      html.match(/"username":"([^"]+)"/)?.[1]?.trim() ||
      "";

    let caption = "";
    const capBlock = html.match(/class="Caption"[\s\S]*?<\/div>/i);
    if (capBlock) caption = decodeEntities(capBlock[0].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (username && caption.toLowerCase().startsWith(username.toLowerCase())) {
      caption = caption.slice(username.length).trim();
    }

    if (!image && !username) return null;
    return {
      title: username ? `@${username}` : "Instagram",
      description: caption.slice(0, 300),
      image: image.slice(0, 1000),
      siteName: "Instagram",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryMaps(rawUrl: string): Promise<LinkPreview | null> {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return null;
  }

  const isMaps =
    /(^|\.)maps\.app\.goo\.gl$/.test(host) ||
    (/(^|\.)goo\.gl$/.test(host) && /\/maps/.test(rawUrl)) ||
    (/(^|\.)google\.[a-z.]+$/.test(host) && (/\/maps/.test(rawUrl) || /[?&]q=/.test(rawUrl)));
  if (!isMaps) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    // Follow the short-link redirect to the expanded /maps/place/<name> URL.
    // Must use the crawler UA — a browser UA gets no redirect from Google.
    const res = await fetch(rawUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": CRAWLER_UA,
        accept: "text/html,application/xhtml+xml",
      },
    });
    const finalUrl = res.url || rawUrl;
    const name = placeNameFromMapsUrl(finalUrl);
    if (!name) return null; // fall through to generic OG so we still show something

    const coords = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    return {
      title: name.slice(0, 200),
      description: coords ? `${coords[1]}, ${coords[2]}` : "",
      image: "",
      siteName: "Google Maps",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function placeNameFromMapsUrl(u: string, depth = 0): string {
  try {
    const url = new URL(u);

    // Google may bounce short links through a consent page whose `continue`
    // param holds the real maps URL — unwrap it once.
    if (depth === 0 && /(^|\.)(consent|accounts)\.google\./.test(url.hostname)) {
      const cont = url.searchParams.get("continue");
      if (cont) return placeNameFromMapsUrl(cont, depth + 1);
    }

    const m = url.pathname.match(/\/place\/([^/@]+)/);
    if (m) {
      const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      // Skip coordinate-only segments like "21.03,105.85".
      if (name && !/^-?\d+\.\d+,/.test(name)) return name;
    }
    const q = url.searchParams.get("q");
    if (q && !/^-?\d+\.\d/.test(q)) return decodeURIComponent(q.replace(/\+/g, " ")).trim();
    return "";
  } catch {
    return "";
  }
}

// Providers that expose a no-auth oEmbed endpoint returning title + thumbnail.
async function tryOembed(rawUrl: string): Promise<LinkPreview | null> {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return null;
  }

  const isYouTube = /(^|\.)(youtube\.com|youtu\.be)$/.test(host);
  if (!isYouTube) return null;

  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
      provider_name?: string;
    };
    if (!data.title && !data.thumbnail_url) return null;
    return {
      title: (data.title || "").slice(0, 200),
      description: (data.author_name || "").slice(0, 300),
      image: (data.thumbnail_url || "").slice(0, 1000),
      siteName: (data.provider_name || "YouTube").slice(0, 100),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenGraph(rawUrl: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(rawUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Identify as a preview crawler — many sites serve OG tags to bots.
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) return null;

    // Cap the body so a giant page can't blow up memory; OG tags live in <head>.
    const html = (await res.text()).slice(0, 500_000);
    const preview = parseMeta(html, res.url || rawUrl);
    if (!preview.title && !preview.image && !preview.description) return null;
    return preview;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseMeta(html: string, baseUrl: string): LinkPreview {
  const metas: Record<string, string> = {};
  const tagRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const key = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !(key in metas)) metas[key] = decodeEntities(content);
  }

  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const title = metas["og:title"] || metas["twitter:title"] || decodeEntities(titleTag) || "";
  const description =
    metas["og:description"] || metas["twitter:description"] || metas["description"] || "";
  let image =
    metas["og:image"] ||
    metas["og:image:secure_url"] ||
    metas["og:image:url"] ||
    metas["twitter:image"] ||
    metas["twitter:image:src"] ||
    "";
  const siteName = metas["og:site_name"] || "";

  if (image) {
    try {
      image = new URL(image, baseUrl).href;
    } catch {
      image = "";
    }
  }

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image: image.slice(0, 1000),
    siteName: siteName.slice(0, 100),
  };
}

// Reads a single HTML attribute value (double- or single-quoted) from one tag.
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? m[2] ?? m[3] ?? "" : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*32;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .trim();
}

function safeCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
  } catch {
    return "";
  }
}
