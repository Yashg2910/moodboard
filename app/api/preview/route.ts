export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { fetchLinkPreview } from "@/lib/preview";
import { isHttpUrl } from "@/lib/source";

// GET /api/preview?url=... — fetch a link preview on demand, so the pin form can
// show the card while you're still pasting (before the pin is saved).
export async function GET(req: NextRequest) {
  const url = (req.nextUrl.searchParams.get("url") || "").trim();
  if (!isHttpUrl(url)) {
    return NextResponse.json({ preview: null });
  }
  const preview = await fetchLinkPreview(url);
  return NextResponse.json({ preview });
}
