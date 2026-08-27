export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import { verifyPassword, cookieToken, boardCookieName, boardCookieOptions } from "@/lib/board-auth";

// POST /api/rooms/:roomId/auth — check a board password. On success, set a
// long-lived httpOnly cookie granting access to this board.
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  await dbConnect();

  const room = await Room.findById(params.roomId).select("passwordHash").lean();
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room.passwordHash) {
    return NextResponse.json({ ok: true }); // open board — nothing to unlock
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!verifyPassword(password, room.passwordHash)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    boardCookieName(params.roomId),
    cookieToken(params.roomId, room.passwordHash),
    boardCookieOptions
  );
  return res;
}
