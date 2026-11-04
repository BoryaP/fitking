import type { Muscle } from "./exercises";

/** Small front/back body map with the trained muscles filled in. */
export function muscleMapSVG(primary: Muscle[], secondary: Muscle[]): string {
  const c = (m: Muscle) => (primary.includes(m) ? "var(--muscle)" : secondary.includes(m) ? "var(--muscle-soft)" : "var(--body-off)");
  const e = (m: Muscle, x: number, y: number, rx: number, ry: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c(m)}"/>`;
  const fig = (x: number) => `<g fill="var(--stage)" stroke="var(--line)" stroke-width="1"><circle cx="${x}" cy="13" r="9"/><rect x="${x - 17}" y="25" width="34" height="58" rx="12"/><rect x="${x - 27}" y="30" width="10" height="54" rx="5"/><rect x="${x + 17}" y="30" width="10" height="54" rx="5"/><rect x="${x - 16}" y="80" width="14" height="86" rx="7"/><rect x="${x + 2}" y="80" width="14" height="86" rx="7"/></g>`;
  const F = 40, B = 120;
  return `<svg viewBox="0 0 160 172" role="img" aria-label="Muscle map, front and back">
  ${fig(F)}${fig(B)}
  ${e("shoulders", F - 19, 35, 7, 6)}${e("shoulders", F + 19, 35, 7, 6)}
  ${e("chest", F - 8, 41, 8, 6)}${e("chest", F + 8, 41, 8, 6)}
  ${e("biceps", F - 22, 51, 4, 8)}${e("biceps", F + 22, 51, 4, 8)}
  ${e("forearms", F - 22, 72, 3.6, 9)}${e("forearms", F + 22, 72, 3.6, 9)}
  <rect x="${F - 7}" y="50" width="14" height="27" rx="4" fill="${c("abs")}"/>
  ${e("quads", F - 9, 104, 6, 17)}${e("quads", F + 9, 104, 6, 17)}
  ${e("calves", F - 9, 142, 4.5, 12)}${e("calves", F + 9, 142, 4.5, 12)}
  ${e("traps", B, 30, 11, 5)}
  ${e("shoulders", B - 19, 35, 7, 6)}${e("shoulders", B + 19, 35, 7, 6)}
  ${e("back", B, 42, 10, 6)}
  ${e("lats", B - 10, 56, 6, 11)}${e("lats", B + 10, 56, 6, 11)}
  ${e("triceps", B - 22, 51, 4, 8)}${e("triceps", B + 22, 51, 4, 8)}
  ${e("forearms", B - 22, 72, 3.6, 9)}${e("forearms", B + 22, 72, 3.6, 9)}
  ${e("lowback", B, 70, 7, 6)}
  ${e("glutes", B - 8, 86, 8, 8)}${e("glutes", B + 8, 86, 8, 8)}
  ${e("hamstrings", B - 9, 111, 6, 15)}${e("hamstrings", B + 9, 111, 6, 15)}
  ${e("calves", B - 9, 142, 5, 12)}${e("calves", B + 9, 142, 5, 12)}
  <text x="${F}" y="171" text-anchor="middle" font-size="9" fill="var(--muted)">FRONT</text>
  <text x="${B}" y="171" text-anchor="middle" font-size="9" fill="var(--muted)">BACK</text></svg>`;
}
