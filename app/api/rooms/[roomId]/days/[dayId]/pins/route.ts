export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Room, CATEGORIES, type Category } from "@/lib/models/Room";
import { buildPin } from "@/lib/build-pin";
import { hasBoardAccess } from "@/lib/board-auth";

// POST /api/rooms/:roomId/days/:dayId/pins — add a pin to one category on one day.
// Body: { category: "eat"|"see"|"do"|"stay", text: string, url?: string, note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string; dayId: string } }
) {
  await dbConnect();
  if (!(await hasBoardAccess(params.roomId))) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const category = body?.category as Category | undefined;
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "category must be one of " + CATEGORIES.join(", ") }, { status: 400 });
  }

  const built = await buildPin(body ?? {});
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const result = await Room.updateOne(
    { _id: params.roomId, "days.dayId": params.dayId },
    { $push: { [`days.$.pins.${category}`]: built.pin } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Room or day not found" }, { status: 404 });
  }

  return NextResponse.json(built.pin, { status: 201 });
}
