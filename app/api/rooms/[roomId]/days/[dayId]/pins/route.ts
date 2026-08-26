export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { dbConnect } from "@/lib/db";
import { Room, CATEGORIES, type Category } from "@/lib/models/Room";
import { detectSource, isHttpUrl } from "@/lib/source";
import { fetchLinkPreview } from "@/lib/preview";

// POST /api/rooms/:roomId/days/:dayId/pins — add a pin to one category on one day.
// Body: { category: "eat"|"see"|"do"|"stay", text: string, url?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string; dayId: string } }
) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  const category = body?.category as Category | undefined;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "category must be one of " + CATEGORIES.join(", ") }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (url && !isHttpUrl(url)) {
    return NextResponse.json({ error: "url must start with http:// or https://" }, { status: 400 });
  }

  const preview = url ? await fetchLinkPreview(url) : null;

  const pin = {
    id: nanoid(10),
    text: text.slice(0, 140),
    url: url.slice(0, 500),
    source: url ? detectSource(url) : "",
    ...(preview ? { preview } : {}),
    createdAt: new Date(),
  };

  const result = await Room.updateOne(
    { _id: params.roomId, "days.dayId": params.dayId },
    { $push: { [`days.$.pins.${category}`]: pin } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room or day not found" }, { status: 404 });
  }

  return NextResponse.json(pin, { status: 201 });
}
