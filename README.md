# Pinboard

A shareable, day-by-day trip moodboard. Anyone with a board's link can pin
restaurants, sights, things to do, and stay ideas to each day — no login.

Node.js/Next.js API routes for the backend, MongoDB for storage. One repo,
one deployment (see "Why one repo" below if you're wondering about a
separate backend).

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes
- **MongoDB** via **Mongoose** — one document per board (room), with days
  and pins embedded. This isn't a relational schema forced into Mongo: a
  board is always read and written as a whole, so one document per board is
  the natural fit, not a compromise.
- Deploy target: **Vercel** (frontend + API, free tier) + **MongoDB Atlas**
  (free M0 cluster). Both are genuinely free, no card expiry traps.

## Project layout

```
app/
  page.tsx                 landing page — create a board
  board/[roomId]/page.tsx  the board itself (server component, fetches from DB directly)
  api/rooms/route.ts                              POST create a room
  api/rooms/[roomId]/route.ts                     GET a room's state
  api/rooms/[roomId]/days/[dayId]/pins/route.ts            POST add a pin
  api/rooms/[roomId]/days/[dayId]/pins/[pinId]/route.ts    DELETE a pin
components/
  CreateRoomForm.tsx   the landing page's "start a board" form
  Board.tsx            the grid + day overlay + pin add/remove (client component)
lib/
  db.ts                 cached Mongoose connection (serverless-safe)
  models/Room.ts         the Mongoose schema
  source.ts              detects "Instagram" / "YouTube" / "Maps" etc. from a URL — no network call
  art.ts                 deterministic per-day gradient, keyed by day order
  types.ts               plain TS types the client uses (API responses aren't Mongoose docs)
  vietnam-seed-data.ts    the actual Vietnam trip's 11 days
  seed-vietnam.ts         script that inserts that trip as a real, shareable room
```

## Run it locally

You need Node 18+ and a MongoDB connection string (see "Get a database"
below — takes about 3 minutes).

```bash
npm install
cp .env.example .env.local   # then paste your MONGODB_URI in
npm run dev                   # http://localhost:3000
```

To get your actual Vietnam trip in as a real board (not a blank one):

```bash
npm run seed:vietnam
```

This prints the board's URL path, e.g. `/board/aB3xK9pQ`. Visit
`http://localhost:3000/board/aB3xK9pQ` to see it before deploying.

## Deploy (free)

**1. Database — MongoDB Atlas**
- Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (free, no card required for the M0 tier).
- Create a free M0 cluster (any region close to you).
- Under Database Access, create a user + password.
- Under Network Access, add `0.0.0.0/0` (allow from anywhere) — fine for a
  low-stakes shared app with no auth; Vercel's functions don't have fixed
  IPs on the free tier so you can't scope it tighter without a paid add-on.
- Click Connect → Drivers → copy the connection string. It looks like
  `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pinboard?retryWrites=true&w=majority`.

**2. Seed your trip** — run `npm run seed:vietnam` locally once, pointed at
this real connection string (via `.env.local`). This is a one-time step;
don't wire it into the deploy pipeline or you'll create a duplicate trip on
every deploy.

**3. Host — Vercel**
- Push this folder to a GitHub repo.
- Sign up at [vercel.com](https://vercel.com) (GitHub login is fastest).
- "Add New Project" → import the repo → it auto-detects Next.js.
- Before deploying, add an environment variable: `MONGODB_URI` = the same
  connection string from step 1.
- Deploy. You'll get a URL like `your-project.vercel.app`.

**4. Share it** — the board you seeded is at
`your-project.vercel.app/board/<the id printed by the seed script>`.
Anyone with that link can open it and pin things.

## Why one repo, not a separate frontend/backend

Vercel doesn't run a long-lived Express server on its free tier anyway —
everything becomes a serverless function under the hood regardless. A
standalone Express API would mean a second free-tier service to host
elsewhere (Render/Railway/Fly), a second deploy pipeline, and CORS to
configure between them — for the same functionality. The API routes here
(`app/api/**/route.ts`) are genuine Node.js server code
(`export const runtime = "nodejs"` is set explicitly on each one); they're
just colocated with the frontend instead of split into another repo.

## What's verified vs. not

- `npm run build` compiles and type-checks clean — every route, every
  component, no errors.
- The API route logic (Mongoose queries, `$push`/`$pull` on the embedded
  pin arrays, the positional `$` operator against `days.dayId`) was
  reviewed carefully but **not exercised against a live MongoDB** — this
  sandbox's network allowlist blocks the `mongodb.org` binary download that
  `mongodb-memory-server` needs, and there's no Docker daemon available
  here either, so I couldn't stand up a real or in-memory Mongo to test
  against. The first real test is your `npm run seed:vietnam` run and a
  few adds/removes against your actual Atlas cluster — do that before
  trusting it with real data, and tell me if anything breaks.

## Known limitations (by design, for v1)

- No auth — anyone with a board's link can edit it, same trust model as
  the Claude Artifact version.
- No image/thumbnail previews on pinned links — text + optional URL only
  (a source badge like "Instagram"/"Maps" is shown, detected from the URL
  itself, not fetched).
- The landing page's "start a board" only creates a single blank day; a
  full itinerary (like the Vietnam seed) currently has to be seeded via a
  script, not through the UI.
