// One-off: apply the Vietnam itinerary to an EXISTING board (by id).
// Run with: npx tsx lib/apply-itinerary.ts <roomId>
// Requires MONGODB_URI in .env.local.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { dbConnect } from "./db";
import { Room, CATEGORIES } from "./models/Room";
import { VIETNAM_DAYS } from "./vietnam-seed-data";

async function main() {
  const roomId = process.argv[2];
  if (!roomId) {
    console.error("Usage: npx tsx lib/apply-itinerary.ts <roomId>");
    process.exit(1);
  }

  await dbConnect();

  const emptyPins = () =>
    Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<(typeof CATEGORIES)[number], []>;

  const room = await Room.findById(roomId);
  if (!room) {
    console.error("No board found with id:", roomId);
    process.exit(1);
  }

  const hasPins = room.days.some((d) =>
    CATEGORIES.some((c) => (d.pins?.[c]?.length ?? 0) > 0)
  );
  if (hasPins) {
    console.error("Refusing to overwrite: this board already has pins. Aborting.");
    process.exit(1);
  }

  room.days = VIETNAM_DAYS.map((d) => ({ ...d, pins: emptyPins() })) as typeof room.days;
  await room.save();

  console.log(`Applied ${room.days.length} days to "${room.title}" (${room._id}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
