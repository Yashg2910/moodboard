import { Schema, model, models, type Model } from "mongoose";
import { nanoid } from "nanoid";

export const CATEGORIES = ["eat", "see", "do", "stay"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface Pin {
  id: string;
  text: string; // the title / what you found
  url: string;
  note: string; // free-text description / notes
  source: string; // e.g. "Instagram", "YouTube", "Maps", or the bare hostname — detected at write time
  preview?: LinkPreview; // Open Graph card fetched at write time; absent if none found
  createdAt: Date;
}

export interface Day {
  dayId: string; // "d1", "d2", ...
  num: number;
  date: string; // display label, e.g. "Mon 21 Dec"
  location: string;
  title: string;
  caption: string;
  artSeed: number; // 0..n, used client-side to pick a gradient/pattern — no per-day art stored
  stayNote: string;
  pins: Record<Category, Pin[]>;
}

export interface RoomDoc {
  _id: string; // short nanoid slug — this IS the shareable id in the URL
  title: string;
  createdAt: Date;
  days: Day[];
  generalPins: Pin[]; // links not tied to any day — "across the trip"
}

const emptyPins = (): Record<Category, Pin[]> => ({
  eat: [],
  see: [],
  do: [],
  stay: [],
});

const PreviewSchema = new Schema<LinkPreview>(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    siteName: { type: String, default: "" },
  },
  { _id: false }
);

const PinSchema = new Schema<Pin>(
  {
    id: { type: String, default: () => nanoid(10) },
    text: { type: String, required: true, trim: true, maxlength: 140 },
    url: { type: String, default: "", trim: true, maxlength: 500 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    source: { type: String, default: "" },
    preview: { type: PreviewSchema, default: undefined },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const DaySchema = new Schema<Day>(
  {
    dayId: { type: String, required: true },
    num: { type: Number, required: true },
    date: { type: String, default: "" },
    location: { type: String, default: "" },
    title: { type: String, required: true },
    caption: { type: String, default: "" },
    artSeed: { type: Number, required: true },
    stayNote: { type: String, default: "" },
    pins: {
      type: {
        eat: { type: [PinSchema], default: [] },
        see: { type: [PinSchema], default: [] },
        do: { type: [PinSchema], default: [] },
        stay: { type: [PinSchema], default: [] },
      },
      default: emptyPins,
    },
  },
  { _id: false }
);

const RoomSchema = new Schema<RoomDoc>({
  _id: { type: String, default: () => nanoid(8) },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  createdAt: { type: Date, default: () => new Date() },
  days: { type: [DaySchema], default: [] },
  generalPins: { type: [PinSchema], default: [] },
});

// `models.Room` guard avoids Mongoose's "OverwriteModelError" on hot reload in dev.
export const Room: Model<RoomDoc> = models.Room || model<RoomDoc>("Room", RoomSchema);
