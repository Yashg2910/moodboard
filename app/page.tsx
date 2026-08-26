import { dbConnect } from "@/lib/db";
import { Room } from "@/lib/models/Room";
import CreateRoomForm from "@/components/CreateRoomForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await dbConnect();
  const recent = await Room.find({}, { title: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="kicker">Trip Planning</div>
        <h1>
          <em>Pinboard</em>
        </h1>
        <p className="sub-lede">
          A shareable, day-by-day trip moodboard. Start one, share the link, and pin restaurants, sights, and ideas
          to each day as you find them.
        </p>
      </header>

      <CreateRoomForm />

      {recent.length > 0 && (
        <div style={{ maxWidth: 480, margin: "34px auto 0" }}>
          <p
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#6a6a5e",
              marginBottom: 10,
            }}
          >
            Recent boards
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((r) => (
              <li key={r._id}>
                <a
                  href={`/board/${r._id}`}
                  style={{
                    display: "block",
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontSize: 13.5,
                    padding: "10px 14px",
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 7,
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
