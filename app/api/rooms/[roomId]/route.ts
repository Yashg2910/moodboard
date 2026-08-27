export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import { hasBoardAccess } from "@/lib/board-auth";

// GET /api/rooms/:roomId — fetch a room's full state (days + pins).
export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const room = await Room.findById(params.roomId).select("-passwordHash").lean();
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(room);
}

// PATCH /api/rooms/:roomId — update the board title. Body: { title }
export async function PATCH(req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title can't be empty" }, { status: 400 });
  }

  const result = await Room.updateOne(
    { _id: params.roomId },
    { $set: { title: body.title.trim().slice(0, 120) } }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
