import { nanoid } from "nanoid";
import { detectSource, isHttpUrl } from "@/lib/source";
import { fetchLinkPreview } from "@/lib/preview";

export interface PinInput {
  text?: unknown;
  url?: unknown;
  note?: unknown;
}

// Validates a pin body and builds the stored pin (fetching a link preview when
// a url is present). Shared by day pins and general/board-level pins.
// Returns either the pin or an error string.
export async function buildPin(body: PinInput): Promise<{ pin: Record<string, unknown> } | { error: string }> {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (!text) return { error: "text is required" };
  if (url && !isHttpUrl(url)) return { error: "url must start with http:// or https://" };

  const preview = url ? await fetchLinkPreview(url) : null;

  const pin = {
    id: nanoid(10),
    text: text.slice(0, 140),
    url: url.slice(0, 500),
    note: note.slice(0, 500),
    source: url ? detectSource(url) : "",
    ...(preview ? { preview } : {}),
    createdAt: new Date(),
  };

  return { pin };
}
