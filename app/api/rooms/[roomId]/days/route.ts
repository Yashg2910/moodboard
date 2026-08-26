export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room, CATEGORIES, type Category } from "@/lib/models/Room";

// POST /api/rooms/:roomId/days — append a new blank day to the board.
// Body (all optional): { location, title, caption, stayNote }
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();

  const body = (await req.json().catch(() => ({}))) as {
    location?: string;
    title?: string;
    caption?: string;
    stayNote?: string;
  } | null;

  const room = await Room.findById(params.roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const num = room.days.length + 1;
  // Derive the id from the highest existing suffix so it can't collide with a
  // day that outlived a deletion (dayIds are stable; `num` is what renumbers).
  const maxSuffix = room.days.reduce((mx, d) => {
    const n = parseInt(String(d.dayId).replace(/^d/, ""), 10);
    return Number.isFinite(n) ? Math.max(mx, n) : mx;
  }, 0);
  const emptyPins = () =>
    Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<Category, []>;

  const day = {
    dayId: `d${maxSuffix + 1}`,
    num,
    date: "",
    location: body?.location || "",
    title: body?.title || `Day ${num}`,
    caption: body?.caption || "",
    artSeed: (num - 1) % 11,
    stayNote: body?.stayNote || "",
    pins: emptyPins(),
  };

  room.days.push(day);
  await room.save();

  return NextResponse.json(day, { status: 201 });
}
