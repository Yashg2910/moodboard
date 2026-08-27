"use client";

import { useState } from "react";

// Shown by the board page (server-side) when a protected board has no valid
// access cookie. On success the auth route sets the cookie and we do a full
// reload so the server gate re-runs and renders the board.
export default function BoardGate({ roomId, title }: { roomId: string; title: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Wrong password.");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="kicker">Protected board</div>
        <h1>
          <em>{title}</em>
        </h1>
      </header>
      <form className="create-card" onSubmit={handleSubmit}>
        <label htmlFor="board-password">Enter the password to open this board</label>
        <input
          id="board-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn-primary" type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
        {error && <div className="form-error">{error}</div>}
        <p className="form-note">Once unlocked, this board stays open on this device.</p>
      </form>
    </div>
  );
}
