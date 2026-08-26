export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room, CATEGORIES, type Category } from "@/lib/models/Room";

interface DayInput {
  location: string;
  title: string;
  caption?: string;
  stayNote?: string;
}

// POST /api/rooms — create a new moodboard room. Body: { title, days? }
// Generic on purpose: any future trip can call this, not just Vietnam.
export async function POST(req: NextRequest) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const emptyPins = () =>
    Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<Category, []>;

  const rawDays: DayInput[] =
    Array.isArray(body.days) && body.days.length > 0
      ? body.days
      : [{ location: "", title: "Day 1", caption: "" }];

  const days = rawDays.map((d, i) => ({
    dayId: `d${i + 1}`,
    num: i + 1,
    date: "",
    location: d.location || "",
    title: d.title || `Day ${i + 1}`,
    caption: d.caption || "",
    artSeed: i % 11,
    stayNote: d.stayNote || "",
    pins: emptyPins(),
  }));

  const room = await Room.create({ title: body.title.trim(), days });

  return NextResponse.json({ id: room._id, title: room.title }, { status: 201 });
}
