// Run with: npm run seed:vietnam
// Requires MONGODB_URI in .env.local (dotenv loads it below).
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { dbConnect } from "./db";
import { Room, CATEGORIES } from "./models/Room";
import { VIETNAM_DAYS } from "./vietnam-seed-data";

async function main() {
  await dbConnect();

  const emptyPins = () =>
    Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<(typeof CATEGORIES)[number], []>;

  const room = await Room.create({
    title: "Vietnam Honeymoon",
    days: VIETNAM_DAYS.map((d) => ({ ...d, pins: emptyPins() })),
  });

  console.log("Seeded room:", room._id);
  console.log("Shareable URL path: /board/" + room._id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
