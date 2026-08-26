export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";

// Which day fields may be edited inline, and how long each may be.
const EDITABLE: Record<string, number> = {
  title: 120,
  location: 200,
  date: 60,
  caption: 500,
  stayNote: 500,
};

// PATCH /api/rooms/:roomId/days/:dayId — update one or more editable text fields
// on a single day. Body: any subset of { title, location, date, caption, stayNote }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string; dayId: string } }
) {
  await dbConnect();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const set: Record<string, string> = {};
  for (const [key, max] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (typeof raw !== "string") {
      return NextResponse.json({ error: `${key} must be a string` }, { status: 400 });
    }
    const value = raw.trim().slice(0, max);
    if (key === "title" && !value) {
      return NextResponse.json({ error: "title can't be empty" }, { status: 400 });
    }
    set[`days.$.${key}`] = value;
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const result = await Room.updateOne(
    { _id: params.roomId, "days.dayId": params.dayId },
    { $set: set }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room or day not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
