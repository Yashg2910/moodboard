// Deterministic decorative gradients keyed by a day's artSeed, so no
// per-day artwork needs to be stored — any room, any trip, gets a
// consistent look derived purely from day order. The 11 entries here also
// happen to reproduce the original Vietnam mood board's per-day palette.
export const GRADIENTS = [
  "linear-gradient(135deg,#2b2f4a,#1f5c52 75%)",
  "linear-gradient(135deg,#123f38,#1f5c52 60%,#d3a24a)",
  "linear-gradient(135deg,#9a2f28,#c85a3a 70%)",
  "linear-gradient(135deg,#2b2f4a,#c85a3a 90%)",
  "linear-gradient(135deg,#1f5c52,#d3a24a 90%)",
  "linear-gradient(135deg,#123f38,#1f5c52 70%)",
  "linear-gradient(135deg,#2b2f4a,#d3a24a 90%)",
  "linear-gradient(135deg,#d3a24a,#c85a3a 90%)",
  "linear-gradient(135deg,#1f5c52,#d3a24a 90%)",
  "linear-gradient(135deg,#2b2f4a,#9a2f28 90%)",
  "linear-gradient(135deg,#d3a24a,#2b2f4a 90%)",
];

export function gradientFor(seed: number): string {
  return GRADIENTS[((seed % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length];
}
