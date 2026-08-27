export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room, CATEGORIES, type Category } from "@/lib/models/Room";
import { hasBoardAccess } from "@/lib/board-auth";

// DELETE /api/rooms/:roomId/days/:dayId/pins/:pinId?category=eat
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string; dayId: string; pinId: string } }
) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category") as Category | null;
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "category query param must be one of " + CATEGORIES.join(", ") }, { status: 400 });
  }

  const result = await Room.updateOne(
    { _id: params.roomId, "days.dayId": params.dayId },
    { $pull: { [`days.$.pins.${category}`]: { id: params.pinId } } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room or day not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
