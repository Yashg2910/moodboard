// Plain client-side mirrors of the Mongoose shapes — API responses are JSON,
// not Mongoose documents, so these are what components actually work with.
export type Category = "eat" | "see" | "do" | "stay";

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface Pin {
  id: string;
  text: string;
  url: string;
  note: string;
  source: string;
  preview?: LinkPreview;
  createdAt: string;
}

export interface Day {
  dayId: string;
  num: number;
  date: string;
  location: string;
  title: string;
  caption: string;
  artSeed: number;
  stayNote: string;
  pins: Record<Category, Pin[]>;
}

export interface RoomData {
  _id: string;
  title: string;
  createdAt: string;
  days: Day[];
  generalPins: Pin[];
}

export const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: "eat", label: "Eat & Drink", hint: "restaurants, cafés, street stalls" },
  { key: "see", label: "Places to See", hint: "sights, viewpoints, neighborhoods" },
  { key: "do", label: "Things to Do", hint: "activities, experiences, tours" },
  { key: "stay", label: "Stay Ideas", hint: "alternatives worth a look" },
];
