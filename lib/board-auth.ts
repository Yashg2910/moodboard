import { scryptSync, randomBytes, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { Room } from "@/lib/models/Room";

// Per-board password auth using only Node's built-in crypto — no session store,
// no extra deps. A board with an empty passwordHash is "open" (backward compat).

const KEYLEN = 64;

// Store as a self-contained "scrypt$<saltHex>$<derivedHex>" string.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// Deterministic, unforgeable cookie value: it depends on the server-only hash,
// so a client can't fabricate it, and it auto-invalidates when the password
// changes. No session storage needed.
export function cookieToken(roomId: string, passwordHash: string): string {
  return createHash("sha256").update(`${roomId}:${passwordHash}`).digest("hex");
}

export const boardCookieName = (roomId: string) => `bp_${roomId}`;

export const boardCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // ~1 year — "accessed indefinitely"
  secure: process.env.NODE_ENV === "production",
};

// Route-handler access check. Call AFTER dbConnect(). Returns true when the
// board is open, missing (let the handler's own 404 run), or the cookie matches.
export async function hasBoardAccess(roomId: string): Promise<boolean> {
  const room = await Room.findById(roomId).select("passwordHash").lean();
  if (!room) return true;
  if (!room.passwordHash) return true;
  const token = cookies().get(boardCookieName(roomId))?.value;
  return !!token && token === cookieToken(roomId, room.passwordHash);
}
