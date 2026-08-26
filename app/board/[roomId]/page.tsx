import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import Board from "@/components/Board";
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

  // Mongoose's .lean() returns plain objects but Dates/ObjectIds need to
  // cross the server→client boundary as plain JSON-safe values.
  const plain = JSON.parse(JSON.stringify(room)) as RoomData;

  return <Board initialRoom={plain} />;
}
