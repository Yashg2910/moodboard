import CreateRoomForm from "@/components/CreateRoomForm";

export const dynamic = "force-dynamic";

export default function HomePage() {
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
    </div>
  );
}
