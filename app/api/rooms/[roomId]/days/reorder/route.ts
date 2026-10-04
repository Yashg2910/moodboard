export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import { hasBoardAccess } from "@/lib/board-auth";

// POST /api/rooms/:roomId/days/reorder — move one day to a new position.
// Body: { dayId, toNum } where toNum is the 1-based slot the day should land in.
// The day is spliced out and re-inserted; every day's display `num` is then
// renumbered to stay sequential (dayIds and artSeed are left untouched).
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { dayId?: string; toNum?: number } | null;
  const dayId = body?.dayId;
  const toNum = body?.toNum;
  if (typeof dayId !== "string" || typeof toNum !== "number" || !Number.isFinite(toNum)) {
    return NextResponse.json({ error: "dayId and toNum are required" }, { status: 400 });
  }

  const room = await Room.findById(params.roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const from = room.days.findIndex((d) => d.dayId === dayId);
  if (from === -1) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  // Clamp the target into [0, length-1] so an out-of-range slot just pins to an end.
  const to = Math.min(Math.max(toNum - 1, 0), room.days.length - 1);
  if (to !== from) {
    const [moved] = room.days.splice(from, 1);
    room.days.splice(to, 0, moved);
    room.days.forEach((d, i) => {
      d.num = i + 1;
    });
    room.markModified("days");
    await room.save();
  }

  return NextResponse.json({ ok: true });
}
