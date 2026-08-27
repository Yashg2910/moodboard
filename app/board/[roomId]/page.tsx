import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import { cookieToken, boardCookieName } from "@/lib/board-auth";
import Board from "@/components/Board";
import BoardGate from "@/components/BoardGate";
import type { RoomData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: { roomId: string } }) {
  await dbConnect();
  const room = await Room.findById(params.roomId).lean();

  if (!room) {
    return (
      <div className="wrap">
        <div className="state-msg">
          <p>This board doesn't exist — check the link, or start a new one from the homepage.</p>
        </div>
      </div>
    );
  }

  // Password gate: a board with a passwordHash needs a matching access cookie.
  if (room.passwordHash) {
    const token = cookies().get(boardCookieName(params.roomId))?.value;
    if (!token || token !== cookieToken(params.roomId, room.passwordHash)) {
      return <BoardGate roomId={params.roomId} title={room.title} />;
    }
  }

  // Strip the secret before it can cross the server→client boundary.
  const { passwordHash: _omit, ...safe } = room;

  // Mongoose's .lean() returns plain objects but Dates/ObjectIds need to
  // cross the server→client boundary as plain JSON-safe values.
  const plain = JSON.parse(JSON.stringify(safe)) as RoomData;

  return <Board initialRoom={plain} />;
}
