export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";

// DELETE /api/rooms/:roomId/pins/:pinId — remove a general link.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { roomId: string; pinId: string } }
) {
  await dbConnect();

  const result = await Room.updateOne(
    { _id: params.roomId },
    { $pull: { generalPins: { id: params.pinId } } }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
