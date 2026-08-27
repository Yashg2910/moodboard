"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, Day, LinkPreview, Pin, RoomData } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { gradientFor } from "@/lib/art";
import { detectSource, isHttpUrl } from "@/lib/source";

function escapeForKey(id: string) {
  return id;
}

export default function Board({ initialRoom }: { initialRoom: RoomData }) {
  const [room, setRoom] = useState<RoomData>(initialRoom);
  const [openIndex, setOpenIndex] = useState(-1);
  const [note, setNote] = useState<{ text: string; err: boolean } | null>(null);
  const [addingDay, setAddingDay] = useState(false);

  const close = useCallback(() => setOpenIndex(-1), []);
  const next = useCallback(
    () => setOpenIndex((i) => Math.min(room.days.length - 1, i + 1)),
    [room.days.length]
  );
  const prev = useCallback(() => setOpenIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (openIndex < 0) return;
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [openIndex, close]);

  function makeTempPin(text: string, url: string, noteText: string, preview?: LinkPreview | null): Pin {
    return {
      id: "temp-" + Math.random().toString(36).slice(2),
      text: text.slice(0, 140),
      url: url.slice(0, 500),
      note: noteText.slice(0, 500),
      source: url ? detectSource(url) : "",
      ...(preview ? { preview } : {}),
      createdAt: new Date().toISOString(),
    };
  }

  async function addPin(
    dayId: string,
    category: Category,
    text: string,
    url: string,
    noteText: string,
    preview?: LinkPreview | null
  ) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    if (url && !isHttpUrl(url)) {
      setNote({ text: "Link must start with http:// or https://", err: true });
      return;
    }

    // optimistic pin — a real id/source lands once the server responds. If the
    // form already fetched a preview while pasting, reuse it so the card shows
    // instantly instead of flashing a skeleton.
    const tempPin = makeTempPin(trimmedText, url, noteText.trim(), preview);
    setRoom((r) => withPin(r, dayId, category, tempPin));
    setNote(null);

    try {
      const res = await fetch(`/api/rooms/${room._id}/days/${dayId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, text: trimmedText, url, note: noteText.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
      const savedPin: Pin = await res.json();
      setRoom((r) => replacePin(r, dayId, category, tempPin.id, savedPin));
    } catch (err) {
      setRoom((r) => withoutPin(r, dayId, category, tempPin.id));
      setNote({ text: err instanceof Error ? err.message : "Couldn't save — try again.", err: true });
    }
  }

  async function addGeneralPin(text: string, url: string, noteText: string, preview?: LinkPreview | null) {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    if (url && !isHttpUrl(url)) {
      setNote({ text: "Link must start with http:// or https://", err: true });
      return;
    }

    const tempPin = makeTempPin(trimmedText, url, noteText.trim(), preview);
    setRoom((r) => ({ ...r, generalPins: [...(r.generalPins ?? []), tempPin] }));
    setNote(null);

    try {
      const res = await fetch(`/api/rooms/${room._id}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText, url, note: noteText.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
      const savedPin: Pin = await res.json();
      setRoom((r) => ({
        ...r,
        generalPins: (r.generalPins ?? []).map((p) => (p.id === tempPin.id ? savedPin : p)),
      }));
    } catch (err) {
      setRoom((r) => ({ ...r, generalPins: (r.generalPins ?? []).filter((p) => p.id !== tempPin.id) }));
      setNote({ text: err instanceof Error ? err.message : "Couldn't save — try again.", err: true });
    }
  }

  async function removeGeneralPin(pinId: string) {
    const removed = (room.generalPins ?? []).find((p) => p.id === pinId);
    setRoom((r) => ({ ...r, generalPins: (r.generalPins ?? []).filter((p) => p.id !== pinId) }));
    try {
      const res = await fetch(`/api/rooms/${room._id}/pins/${pinId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't remove.");
    } catch (err) {
      if (removed) setRoom((r) => ({ ...r, generalPins: [...(r.generalPins ?? []), removed] }));
      setNote({ text: err instanceof Error ? err.message : "Couldn't remove — try again.", err: true });
    }
  }

  async function removePin(dayId: string, category: Category, pinId: string) {
    const removed = room.days
      .find((d) => d.dayId === dayId)
      ?.pins[category].find((p) => p.id === pinId);
    setRoom((r) => withoutPin(r, dayId, category, pinId));
    try {
      const res = await fetch(
        `/api/rooms/${room._id}/days/${dayId}/pins/${pinId}?category=${category}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't remove.");
    } catch (err) {
      if (removed) setRoom((r) => withPin(r, dayId, category, removed));
      setNote({ text: err instanceof Error ? err.message : "Couldn't remove — try again.", err: true });
    }
  }

  async function addDay() {
    if (addingDay) return;
    setAddingDay(true);
    setNote(null);
    try {
      const res = await fetch(`/api/rooms/${room._id}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't add a day.");
      const day: Day = await res.json();
      setRoom((r) => ({ ...r, days: [...r.days, day] }));
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : "Couldn't add a day — try again.", err: true });
    } finally {
      setAddingDay(false);
    }
  }

  async function updateDay(dayId: string, patch: Partial<Day>) {
    const day = room.days.find((d) => d.dayId === dayId);
    if (!day) return;
    const before: Partial<Day> = {};
    (Object.keys(patch) as (keyof Day)[]).forEach((k) => {
      (before as Record<string, unknown>)[k] = day[k];
    });

    setRoom((r) => withDayPatch(r, dayId, patch));
    setNote(null);
    try {
      const res = await fetch(`/api/rooms/${room._id}/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
    } catch (err) {
      setRoom((r) => withDayPatch(r, dayId, before));
      setNote({ text: err instanceof Error ? err.message : "Couldn't save — try again.", err: true });
    }
  }

  async function deleteDay(dayId: string) {
    if (room.days.length <= 1) {
      setNote({ text: "A board needs at least one day.", err: true });
      return;
    }
    const prevDays = room.days;
    // remove and renumber to match what the server does
    const nextDays = prevDays.filter((d) => d.dayId !== dayId).map((d, i) => ({ ...d, num: i + 1 }));
    setOpenIndex(-1); // close the overlay for the day we're removing
    setRoom((r) => ({ ...r, days: nextDays }));
    setNote(null);
    try {
      const res = await fetch(`/api/rooms/${room._id}/days/${dayId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't delete the day.");
    } catch (err) {
      setRoom((r) => ({ ...r, days: prevDays }));
      setNote({ text: err instanceof Error ? err.message : "Couldn't delete — try again.", err: true });
    }
  }

  async function updateTitle(title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === room.title) return;
    const before = room.title;
    setRoom((r) => ({ ...r, title: trimmed }));
    setNote(null);
    try {
      const res = await fetch(`/api/rooms/${room._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
    } catch (err) {
      setRoom((r) => ({ ...r, title: before }));
      setNote({ text: err instanceof Error ? err.message : "Couldn't save — try again.", err: true });
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="kicker">Shared Board</div>
        <h1>
          <EditableText as="em" value={room.title} onSave={updateTitle} placeholder="Board title" />
        </h1>
        <p className="sub-lede">
          Click any day to pin restaurants, sights, things to do, and stay ideas — anyone with this link sees the
          same board.
        </p>
      </header>

      <div className="grid">
        {room.days.map((day, i) => (
          <DayCard key={day.dayId} day={day} onOpen={() => setOpenIndex(i)} />
        ))}
        <button type="button" className="card add-day-card" onClick={addDay} disabled={addingDay}>
          <span className="add-day-plus">+</span>
          <span className="add-day-label">{addingDay ? "Adding…" : "Add another day"}</span>
        </button>
      </div>
      {note?.err && openIndex < 0 && <div className="board-note err">{note.text}</div>}

      <GeneralPinsPanel
        pins={room.generalPins ?? []}
        onAddPin={addGeneralPin}
        onRemovePin={removeGeneralPin}
      />

      <footer className="page-footer">
        Share this board by copying its URL — everyone with the link can pin and remove references.
      </footer>

      {openIndex >= 0 && (
        <div
          className="overlay-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <DayOverlay
            day={room.days[openIndex]}
            index={openIndex}
            total={room.days.length}
            onClose={close}
            onPrev={prev}
            onNext={next}
            onAddPin={addPin}
            onRemovePin={removePin}
            onUpdateDay={updateDay}
            onDeleteDay={deleteDay}
            canDelete={room.days.length > 1}
            note={note}
          />
        </div>
      )}
    </div>
  );
}

function withDayPatch(room: RoomData, dayId: string, patch: Partial<Day>): RoomData {
  return {
    ...room,
    days: room.days.map((d) => (d.dayId === dayId ? { ...d, ...patch } : d)),
  };
}

function withPin(room: RoomData, dayId: string, category: Category, pin: Pin): RoomData {
  return {
    ...room,
    days: room.days.map((d) =>
      d.dayId === dayId ? { ...d, pins: { ...d.pins, [category]: [...d.pins[category], pin] } } : d
    ),
  };
}

function withoutPin(room: RoomData, dayId: string, category: Category, pinId: string): RoomData {
  return {
    ...room,
    days: room.days.map((d) =>
      d.dayId === dayId
        ? { ...d, pins: { ...d.pins, [category]: d.pins[category].filter((p) => p.id !== pinId) } }
        : d
    ),
  };
}

function replacePin(room: RoomData, dayId: string, category: Category, tempId: string, real: Pin): RoomData {
  return {
    ...room,
    days: room.days.map((d) =>
      d.dayId === dayId
        ? { ...d, pins: { ...d.pins, [category]: d.pins[category].map((p) => (p.id === tempId ? real : p)) } }
        : d
    ),
  };
}

// Click-to-edit text that keeps the exact visual style of the element it
// replaces — it IS the same element, just contentEditable. React never manages
// the text nodes during editing (that would fight the caret), so we push the
// value in via a ref only when the field isn't focused, and read it back on blur.
function EditableText({
  as = "span",
  value,
  onSave,
  className = "",
  placeholder = "",
  multiline = false,
}: {
  as?: "span" | "h1" | "h2" | "p" | "em";
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) {
      el.innerText = value;
    }
  }, [value]);

  function commit() {
    const el = ref.current;
    if (!el) return;
    const next = el.innerText.trim();
    if (next !== value) onSave(next);
    else el.innerText = value; // discard whitespace-only churn
  }

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={`editable ${className}`.trim()}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={placeholder || undefined}
      spellCheck={false}
      data-placeholder={placeholder}
      onBlur={commit}
      onPaste={(e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
          if (ref.current) ref.current.innerText = value;
          e.currentTarget.blur();
        } else if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function totalPins(day: Day): number {
  return CATEGORIES.reduce((n, c) => n + day.pins[c.key].length, 0);
}

function DayCard({ day, onOpen }: { day: Day; onOpen: () => void }) {
  return (
    <button type="button" className="card" onClick={onOpen} aria-label={`Open Day ${day.num} details`}>
      <div className="card-art" style={{ background: gradientFor(day.artSeed) }}>
        <span className="day-tag">
          Day {day.num}
          {day.date ? ` · ${day.date}` : ""}
        </span>
      </div>
      <div className="card-body">
        {day.location && <div className="location">{day.location}</div>}
        <h2>{day.title}</h2>
        {day.caption && <p className="caption">{day.caption}</p>}
        <div className="pin-counts">
          {CATEGORIES.map((c) => {
            const n = day.pins[c.key].length;
            return (
              <span key={c.key} className={`pin-count ${c.key}${n ? " has" : ""}`}>
                {c.label.split(" ")[0]} {n}
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}

function DayOverlay({
  day,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onAddPin,
  onRemovePin,
  onUpdateDay,
  onDeleteDay,
  canDelete,
  note,
}: {
  day: Day;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAddPin: (
    dayId: string,
    category: Category,
    text: string,
    url: string,
    note: string,
    preview?: LinkPreview | null
  ) => void;
  onRemovePin: (dayId: string, category: Category, pinId: string) => void;
  onUpdateDay: (dayId: string, patch: Partial<Day>) => void;
  onDeleteDay: (dayId: string) => void;
  canDelete: boolean;
  note: { text: string; err: boolean } | null;
}) {
  return (
    <div className="overlay">
      <div className="overlay-art" style={{ background: gradientFor(day.artSeed) }}>
        {index > 0 && (
          <button type="button" className="overlay-nav prev" onClick={onPrev} aria-label="Previous day">
            ‹
          </button>
        )}
        {index < total - 1 && (
          <button type="button" className="overlay-nav next" onClick={onNext} aria-label="Next day">
            ›
          </button>
        )}
        <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="overlay-body">
        <div className="location">
          Day {day.num}
          {" · "}
          <EditableText
            value={day.date}
            placeholder="add date"
            onSave={(v) => onUpdateDay(day.dayId, { date: v })}
          />
          {" · "}
          <EditableText
            value={day.location}
            placeholder="add location"
            onSave={(v) => onUpdateDay(day.dayId, { location: v })}
          />
        </div>
        <EditableText
          as="h2"
          value={day.title}
          placeholder="Untitled day"
          onSave={(v) => onUpdateDay(day.dayId, { title: v })}
        />
        <EditableText
          as="p"
          className="caption"
          multiline
          value={day.caption}
          placeholder="Add a description for this day…"
          onSave={(v) => onUpdateDay(day.dayId, { caption: v })}
        />
        <div className="stay-box">
          <b>Plan notes:</b>{" "}
          <EditableText
            multiline
            value={day.stayNote}
            placeholder="hotels, budgets, logistics…"
            onSave={(v) => onUpdateDay(day.dayId, { stayNote: v })}
          />
        </div>
        {CATEGORIES.map((c) => (
          <PinSection
            key={c.key}
            day={day}
            category={c.key}
            label={c.label}
            hint={c.hint}
            onAddPin={onAddPin}
            onRemovePin={onRemovePin}
          />
        ))}
        <div className={`save-note${note?.err ? " err" : ""}`}>{note?.text ?? ""}</div>
        {canDelete && (
          <div className="day-delete-row">
            <button
              type="button"
              className="day-delete"
              onClick={() => {
                if (window.confirm(`Remove "${day.title}"? This can't be undone.`)) {
                  onDeleteDay(day.dayId);
                }
              }}
            >
              Remove this day
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function hasPreview(p?: LinkPreview | null): p is LinkPreview {
  return !!p && !!(p.title || p.image || p.description);
}

// Shared presentational preview card (WhatsApp-style). `href` makes it a link;
// omit it for the non-clickable live preview shown while typing in the form.
function PreviewView({
  preview,
  fallbackSite,
  href,
  loading,
}: {
  preview?: LinkPreview | null;
  fallbackSite?: string;
  href?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="pin-preview is-loading" aria-hidden="true">
        <div className="pin-preview-img skeleton" />
        <div className="pin-preview-text">
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      </div>
    );
  }
  if (!hasPreview(preview)) return null;

  const site = preview.siteName || fallbackSite || "";
  const inner = (
    <>
      {preview.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="pin-preview-img"
          src={preview.image}
          alt=""
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="pin-preview-text">
        {site && <span className="pin-preview-site">{site}</span>}
        {preview.title && <span className="pin-preview-title">{preview.title}</span>}
        {preview.description && <span className="pin-preview-desc">{preview.description}</span>}
      </div>
    </>
  );

  return href ? (
    <a className="pin-preview" href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <div className="pin-preview">{inner}</div>
  );
}

// Rich preview for a saved/optimistic pin. Skeleton while a temp pin has no
// preview yet; otherwise the card, or nothing if the link had no metadata.
function LinkPreviewCard({ pin }: { pin: Pin }) {
  const pending = pin.id.startsWith("temp-") && !hasPreview(pin.preview);
  return (
    <PreviewView
      preview={pin.preview}
      fallbackSite={pin.source}
      href={pin.url}
      loading={pending}
    />
  );
}

// One saved pin: title line (source badge + open link + remove), optional note,
// and the rich link-preview card. Shared by day sections and the general panel.
function PinItem({ pin, onRemove }: { pin: Pin; onRemove: () => void }) {
  return (
    <li className="pin-row">
      <div className="pin-line">
        <span className="pin-text">{pin.text}</span>
        {pin.url && isHttpUrl(pin.url) && (
          <>
            {pin.source && <span className="pin-src">{pin.source}</span>}
            <a className="pin-link" href={pin.url} target="_blank" rel="noopener noreferrer">
              open ↗
            </a>
          </>
        )}
        <button type="button" className="pin-remove" aria-label="Remove" onClick={onRemove}>
          ×
        </button>
      </div>
      {pin.note && <div className="pin-note">{pin.note}</div>}
      {pin.url && isHttpUrl(pin.url) && <LinkPreviewCard pin={pin} />}
    </li>
  );
}

// Title + link + notes inputs, with a debounced live link-preview. Calls onAdd
// with the fetched preview so the card can show instantly on save.
function AddPinForm({
  onAdd,
}: {
  onAdd: (text: string, url: string, note: string, preview: LinkPreview | null) => void;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const reqRef = useRef(0);

  // Fetch a preview as the link is pasted/typed (debounced). A request token
  // guards against stale responses landing out of order.
  useEffect(() => {
    const u = url.trim();
    if (!isHttpUrl(u)) {
      setPreview(null);
      setPreviewing(false);
      return;
    }
    const token = ++reqRef.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(u)}`);
        const data = (await res.json().catch(() => ({}))) as { preview?: LinkPreview | null };
        if (reqRef.current !== token) return;
        setPreview(data.preview ?? null);
      } catch {
        if (reqRef.current === token) setPreview(null);
      } finally {
        if (reqRef.current === token) setPreviewing(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [url]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text, url, noteText, isHttpUrl(url.trim()) ? preview : null);
    setText("");
    setUrl("");
    setNoteText("");
    setPreview(null);
    setPreviewing(false);
    reqRef.current++;
  }

  return (
    <>
      <form className="pin-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="pin-input-text"
          placeholder="What did you find?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          required
        />
        <input
          type="url"
          className="pin-input-url"
          placeholder="Link (optional) — Instagram, Maps…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
        />
        <input
          type="text"
          className="pin-input-note"
          placeholder="Notes (optional) — a reminder, price, who recommended it…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          maxLength={500}
        />
        <button type="submit">Add</button>
      </form>
      {isHttpUrl(url.trim()) && (previewing || hasPreview(preview)) && (
        <div className="pin-live-preview">
          <PreviewView
            preview={preview}
            fallbackSite={detectSource(url.trim())}
            loading={previewing && !hasPreview(preview)}
          />
        </div>
      )}
    </>
  );
}

function PinSection({
  day,
  category,
  label,
  hint,
  onAddPin,
  onRemovePin,
}: {
  day: Day;
  category: Category;
  label: string;
  hint: string;
  onAddPin: (
    dayId: string,
    category: Category,
    text: string,
    url: string,
    note: string,
    preview?: LinkPreview | null
  ) => void;
  onRemovePin: (dayId: string, category: Category, pinId: string) => void;
}) {
  const pins = day.pins[category];
  return (
    <div className="pin-section">
      <div className="pin-head">
        <span className={`pin-label ${category}`}>{label}</span>
        <span className="pin-hint">{hint}</span>
      </div>
      {pins.length > 0 ? (
        <ul className="pin-list">
          {pins.map((p) => (
            <PinItem key={escapeForKey(p.id)} pin={p} onRemove={() => onRemovePin(day.dayId, category, p.id)} />
          ))}
        </ul>
      ) : (
        <div className="pin-empty">Nothing pinned yet — add a place, a reel, or a note below.</div>
      )}
      <AddPinForm
        onAdd={(text, url, note, preview) => onAddPin(day.dayId, category, text, url, note, preview)}
      />
    </div>
  );
}

// Board-level "across the trip" links, not tied to any day.
function GeneralPinsPanel({
  pins,
  onAddPin,
  onRemovePin,
}: {
  pins: Pin[];
  onAddPin: (text: string, url: string, note: string, preview?: LinkPreview | null) => void;
  onRemovePin: (pinId: string) => void;
}) {
  return (
    <section className="general-panel">
      <div className="general-head">
        <h2>Across the trip</h2>
        <p>Links and ideas that aren&apos;t tied to a single day — hotels, packing lists, anything.</p>
      </div>
      {pins.length > 0 ? (
        <ul className="pin-list">
          {pins.map((p) => (
            <PinItem key={escapeForKey(p.id)} pin={p} onRemove={() => onRemovePin(p.id)} />
          ))}
        </ul>
      ) : (
        <div className="pin-empty">Nothing here yet — drop a link or note below.</div>
      )}
      <AddPinForm onAdd={(text, url, note, preview) => onAddPin(text, url, note, preview)} />
    </section>
  );
}
