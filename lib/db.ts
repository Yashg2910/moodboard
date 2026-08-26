import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Cache the connection across hot-reloads (dev) and across warm serverless
// invocations (prod) so we don't open a new connection per request/function
// instance. This is the standard Mongoose-on-serverless pattern.
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cache;

export async function dbConnect(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and fill in your Atlas connection string."
    );
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
