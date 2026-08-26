"use client";

import { useState } from "react";

export default function CreateRoomForm() {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create the board.");
      }
      const data = await res.json();
      window.location.href = `/board/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="create-card" onSubmit={handleSubmit}>
      <label htmlFor="title">Board name</label>
      <input
        id="title"
        type="text"
        placeholder="e.g. Vietnam Honeymoon"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
      />
      <button className="btn-primary" type="submit" disabled={busy || !title.trim()}>
        {busy ? "Creating…" : "Start a board"}
      </button>
      {error && <div className="form-error">{error}</div>}
      <p className="form-note">
        Starts with one blank day — add more structure later, or ask for a full itinerary to be seeded in. Anyone
        with the board's link can view and edit it; there's no login.
      </p>
    </form>
  );
}
