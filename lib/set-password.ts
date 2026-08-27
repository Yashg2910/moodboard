// Set (or clear) a board's password.
// Run with: npx tsx lib/set-password.ts <roomId> <password>
// Pass an empty password ("") to reopen a board (removes protection).
// Requires MONGODB_URI in .env.local.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { dbConnect } from "./db";
import { Room } from "./models/Room";
import { hashPassword } from "./board-auth";

async function main() {
  const roomId = process.argv[2];
  const password = process.argv[3];
  if (!roomId || password === undefined) {
    console.error('Usage: npx tsx lib/set-password.ts <roomId> <password>   (empty "" reopens the board)');
    process.exit(1);
  }
  if (password !== "" && password.length < 4) {
    console.error("Password too short (min 4 characters).");
    process.exit(1);
  }

  await dbConnect();

  const room = await Room.findById(roomId);
  if (!room) {
    console.error("No board found with id:", roomId);
    process.exit(1);
  }

  room.passwordHash = password === "" ? "" : hashPassword(password);
  await room.save();

  console.log(
    password === ""
      ? `Reopened "${room.title}" (${room._id}) — password removed.`
      : `Set password on "${room.title}" (${room._id}).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
