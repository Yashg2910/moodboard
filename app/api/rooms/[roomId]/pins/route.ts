export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import { buildPin } from "@/lib/build-pin";
import { hasBoardAccess } from "@/lib/board-auth";

// POST /api/rooms/:roomId/pins — add a general ("across the trip") link, not
// tied to any day. Body: { text: string, url?: string, note?: string }
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const built = await buildPin(body ?? {});
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const result = await Room.updateOne(
    { _id: params.roomId },
    { $push: { generalPins: built.pin } }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json(built.pin, { status: 201 });
}
