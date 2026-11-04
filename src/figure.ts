// Side-view skeleton poses. Each exercise pattern has a start pose (A) and an end pose (B);
// the figure moves A -> B -> A once per repetition. Angles are in degrees:
//   t  = torso, measured from straight up, positive = leaning forward
//   th/sh = near thigh/shin, measured from straight down, positive = forward (th2/sh2 = far leg)
//   ua/fa = near upper arm/forearm, from straight down (ua2/fa2 = far arm)
//   n  = extra head tilt
// Coordinates: x forward, y DOWN (screen convention), floor at y = 0.

export type Pose = Record<string, number>;
export type Vec = [number, number];

export interface Pattern {
  anchor: "ank" | "toe";
  A: Pose;
  B: Pose;
}

export const L = { shin: 0.25, thigh: 0.25, torso: 0.3, neck: 0.04, head: 0.062, ua: 0.16, fa: 0.15, foot: 0.085 };
export const R = Math.PI / 180;

export const PATTERNS: Record<string, Pattern> = {
  squat: { anchor: "ank", A: { t: 6, th: 0, sh: 0, ua: 18, fa: 140 }, B: { t: 40, th: 88, sh: -30, ua: 38, fa: 152 } },
  prisonerSquat: { anchor: "ank", A: { t: 4, th: 0, sh: 0, ua: 150, fa: -110 }, B: { t: 36, th: 88, sh: -30, ua: 150, fa: -110 } },
  pushup: { anchor: "toe", A: { t: 68, th: -68, sh: -68, ua: 0, fa: 0 }, B: { t: 82, th: -82, sh: -82, ua: -60, fa: 78 } },
  row: { anchor: "ank", A: { t: 64, th: 18, sh: -6, ua: 0, fa: 0 }, B: { t: 64, th: 18, sh: -6, ua: -92, fa: -6 } },
  press: { anchor: "ank", A: { t: 0, th: 0, sh: 0, ua: 16, fa: 178 }, B: { t: 0, th: 0, sh: 0, ua: 176, fa: 180 } },
  rdl: { anchor: "ank", A: { t: 4, th: 0, sh: 0, ua: 0, fa: 0 }, B: { t: 78, th: 18, sh: -7, ua: 2, fa: 2 } },
  plank: { anchor: "toe", A: { t: 75, th: -75, sh: -75, ua: 0, fa: 90, n: -8 }, B: { t: 73.5, th: -73.5, sh: -73.5, ua: 0, fa: 90, n: -10 } },
  curl: { anchor: "ank", A: { t: 0, th: 0, sh: 0, ua: 4, fa: 6 }, B: { t: 0, th: 0, sh: 0, ua: 10, fa: 150 } },
  lunge: {
    anchor: "ank",
    A: { t: 2, th: 15, sh: -5, th2: -15, sh2: -15, ua: 0, fa: 0 },
    B: { t: 5, th: 85, sh: -5, th2: -22, sh2: -90, ua: 0, fa: 0 },
  },
  // Lying on the back, head toward +x, knees bent; hips lift in B.
  bridge: {
    anchor: "ank",
    A: { t: 90, th: -140, sh: 28, ua: -95, fa: -92, n: -10 },
    B: { t: 122, th: -104, sh: 0, ua: -110, fa: -95, n: -35 },
  },
};

const dDown = (a: number): Vec => [Math.sin(a * R), Math.cos(a * R)];
const dUp = (a: number): Vec => [Math.sin(a * R), -Math.cos(a * R)];
const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Leg { knee: Vec; ank: Vec; toe: Vec }
export interface Arm { elb: Vec; hand: Vec }
export interface Joints { hip: Vec; sh: Vec; head: Vec; headAng: number; l1: Leg; l2: Leg; a1: Arm; a2: Arm }

export function joints(p: Pose): Joints {
  const g = (k: string, d: number) => (p[k] !== undefined ? p[k] : d);
  const hip: Vec = [0, 0];
  const sh = add(hip, dUp(p.t), L.torso);
  const head = add(sh, dUp(p.t + g("n", 0)), L.neck + L.head);
  const leg = (th: number, shn: number): Leg => {
    const knee = add(hip, dDown(th), L.thigh);
    const ank = add(knee, dDown(shn), L.shin);
    return { knee, ank, toe: add(ank, dDown(shn + 90), L.foot) };
  };
  const arm = (ua: number, fa: number): Arm => {
    const elb = add(sh, dDown(ua), L.ua);
    return { elb, hand: add(elb, dDown(fa), L.fa) };
  };
  return {
    hip, sh, head, headAng: p.t + g("n", 0),
    l1: leg(p.th, p.sh), l2: leg(g("th2", p.th), g("sh2", p.sh)),
    a1: arm(p.ua, p.fa), a2: arm(g("ua2", p.ua), g("fa2", p.fa)),
  };
}

export function lerpPose(A: Pose, B: Pose, t: number): Pose {
  const o: Pose = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k] ?? B[k], b = B[k] ?? A[k];
    o[k] = lerp(a, b, t);
  }
  return o;
}

/** Joints for a pose, shifted so the anchor (ankle or toe) rests on the floor. */
export function anchored(pat: Pattern, p: Pose): Joints {
  const j = joints(p);
  const ref = pat.anchor === "toe" ? j.l1.toe : j.l1.ank;
  const off: Vec = [-ref[0], -ref[1] - (pat.anchor === "toe" ? 0.012 : 0.035)];
  const s = (v: Vec): Vec => [v[0] + off[0], v[1] + off[1]];
  return {
    hip: s(j.hip), sh: s(j.sh), head: s(j.head), headAng: j.headAng,
    l1: { knee: s(j.l1.knee), ank: s(j.l1.ank), toe: s(j.l1.toe) },
    l2: { knee: s(j.l2.knee), ank: s(j.l2.ank), toe: s(j.l2.toe) },
    a1: { elb: s(j.a1.elb), hand: s(j.a1.hand) },
    a2: { elb: s(j.a2.elb), hand: s(j.a2.hand) },
  };
}

export interface Box { x0: number; x1: number; y0: number; y1: number }
const boxCache: Record<string, Box> = {};

/** Bounding box of a pattern over its whole movement, for framing the camera. */
export function patternBox(name: string): Box {
  if (boxCache[name]) return boxCache[name];
  const pat = PATTERNS[name];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = 0.05;
  for (let i = 0; i <= 10; i++) {
    const j = anchored(pat, lerpPose(pat.A, pat.B, i / 10));
    for (const q of [j.hip, j.sh, j.head, j.l1.knee, j.l1.ank, j.l1.toe, j.l2.toe, j.a1.elb, j.a1.hand]) {
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
  }
  return (boxCache[name] = { x0: x0 - 0.08, x1: x1 + 0.08, y0: y0 - L.head - 0.02, y1 });
}

/** Smooth 0 -> 1 -> 0 curve over one repetition. */
export function repCurve(phase: number): number {
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return tri < 0.5 ? 2 * tri * tri : 1 - Math.pow(-2 * tri + 2, 2) / 2;
}
