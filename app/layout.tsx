import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinboard",
  description: "A shareable, day-by-day trip moodboard — pin restaurants, sights, and ideas as you find them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
