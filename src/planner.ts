import { EXERCISES, Equipment, Exercise, Slot } from "./exercises";

export type Level = "beginner" | "intermediate" | "advanced";

export interface PlanOptions {
  minutes: 30 | 45 | 60;
  level: Level;
  equipment: Equipment[];
}

export interface PlanItem {
  exerciseId: string;
  sets: number;
  /** Target repetitions per set, or null for a timed hold. */
  reps: number | null;
  /** Seconds of work per set. */
  work: number;
  /** Seconds of rest between sets of this exercise. */
  rest: number;
}

export interface Plan {
  items: PlanItem[];
  /** Rest between two different exercises, in seconds. */
  transition: number;
  /** Countdown before the first set, in seconds. */
  ready: number;
  options: PlanOptions;
}

// Muscle-building order: big compound moves first, then accessories, core last.
const SLOT_ORDER: Slot[] = ["squat", "push", "pull", "hinge", "vpush", "lunge", "arms", "glute", "core"];
const COUNT: Record<PlanOptions["minutes"], number> = { 30: 5, 45: 7, 60: 9 };

// Hypertrophy settings: moderate reps, 60 to 90 seconds rest.
const LEVEL: Record<Level, { sets: number; reps: number; rest: number; hold: number }> = {
  beginner: { sets: 2, reps: 10, rest: 75, hold: 30 },
  intermediate: { sets: 3, reps: 10, rest: 75, hold: 40 },
  advanced: { sets: 4, reps: 12, rest: 90, hold: 50 },
};

export const TRANSITION = 40;
export const READY = 10;

export function fits(ex: Exercise, equipment: Equipment[]): boolean {
  return ex.needs.every((n) => equipment.includes(n));
}

/** Seconds a set takes: repetitions at the exercise's tempo plus a short setup. */
export function setSeconds(ex: Exercise, reps: number | null, hold: number): number {
  if (ex.hold !== undefined) return hold;
  return Math.round((reps ?? 10) * (ex.tempo ?? 3) + 2);
}

export function pickFor(slot: Slot, equipment: Equipment[], exclude: string[] = []): Exercise | undefined {
  return EXERCISES.filter((e) => e.slot === slot && fits(e, equipment) && !exclude.includes(e.id))
    .sort((a, b) => b.rank - a.rank)[0];
}

export function buildPlan(options: PlanOptions): Plan {
  const L = LEVEL[options.level];
  const chosen: Exercise[] = [];
  for (const slot of SLOT_ORDER) {
    if (chosen.length >= COUNT[options.minutes]) break;
    const ex = pickFor(slot, options.equipment, chosen.map((c) => c.id));
    if (ex) chosen.push(ex);
  }
  const items: PlanItem[] = chosen.map((ex) => {
    const reps = ex.hold !== undefined ? null : L.reps;
    return {
      exerciseId: ex.id,
      sets: L.sets,
      reps,
      work: setSeconds(ex, reps, L.hold),
      rest: ex.slot === "core" ? 45 : L.rest,
    };
  });
  const plan: Plan = { items, transition: TRANSITION, ready: READY, options };
  const target = options.minutes * 60;
  // Fill: add sets (at most one extra per exercise) to the earliest, biggest moves while there is time left.
  const maxSets = L.sets + 1;
  for (let guard = 0; guard < 40; guard++) {
    const cand = plan.items.filter((i) => i.sets < maxSets).sort((a, b) => a.sets - b.sets)[0];
    if (!cand || totalSeconds(plan) + cand.work + cand.rest > target) break;
    cand.sets++;
  }
  // Trim sets (never below 2) until the plan fits the chosen time.
  while (totalSeconds(plan) > target * 1.05) {
    const most = [...plan.items].sort((a, b) => b.sets - a.sets)[0];
    if (!most || most.sets <= 2) break;
    most.sets--;
  }
  return plan;
}

export function totalSeconds(plan: Plan): number {
  let t = plan.ready;
  plan.items.forEach((it, i) => {
    t += it.sets * it.work + (it.sets - 1) * it.rest;
    if (i < plan.items.length - 1) t += plan.transition;
  });
  return t;
}
