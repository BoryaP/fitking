import { describe, expect, it } from "vitest";
import { buildPlan, totalSeconds } from "../src/planner";
import { byId, EXERCISES } from "../src/exercises";
import { PATTERNS } from "../src/figure";

describe("exercise library", () => {
  it("has a 3D pattern and a demo link for every exercise", () => {
    for (const e of EXERCISES) {
      expect(PATTERNS[e.pattern], e.id).toBeDefined();
      expect(e.demoUrl).toMatch(/^https:\/\/www\.muscleandstrength\.com\/exercises\//);
      expect(e.cues.length).toBeGreaterThan(0);
    }
  });
});

describe("buildPlan", () => {
  it("only uses bodyweight exercises when there are no dumbbells", () => {
    const plan = buildPlan({ minutes: 60, level: "intermediate", equipment: [] });
    expect(plan.items.length).toBeGreaterThan(0);
    for (const it of plan.items) expect(byId(it.exerciseId).needs).toEqual([]);
  });

  it("prefers dumbbell exercises when dumbbells are available", () => {
    const plan = buildPlan({ minutes: 45, level: "intermediate", equipment: ["dumbbells"] });
    expect(plan.items[0].exerciseId).toBe("goblet-squat");
    expect(new Set(plan.items.map((i) => i.exerciseId)).size).toBe(plan.items.length);
  });

  it("gives more exercises for longer workouts", () => {
    const eq = ["dumbbells"] as const;
    const n = (m: 30 | 45 | 60) => buildPlan({ minutes: m, level: "intermediate", equipment: [...eq] }).items.length;
    expect(n(30)).toBeLessThan(n(45));
    expect(n(45)).toBeLessThan(n(60));
  });

  it("uses muscle-building sets and reps per level", () => {
    const b = buildPlan({ minutes: 45, level: "beginner", equipment: ["dumbbells"] });
    const a = buildPlan({ minutes: 60, level: "advanced", equipment: ["dumbbells"] });
    const i = buildPlan({ minutes: 45, level: "intermediate", equipment: ["dumbbells"] });
    expect(b.items[0].sets).toBeLessThanOrEqual(i.items[0].sets);
    expect(b.items[0].reps).toBe(10);
    expect(a.items[0].reps).toBe(12);
  });

  it("keeps the plan close to the chosen length", () => {
    for (const minutes of [30, 45, 60] as const) {
      for (const level of ["beginner", "intermediate", "advanced"] as const) {
        const plan = buildPlan({ minutes, level, equipment: ["dumbbells"] });
        expect(totalSeconds(plan)).toBeLessThanOrEqual(minutes * 60 * 1.15);
        if (level !== "beginner") expect(totalSeconds(plan)).toBeGreaterThanOrEqual(minutes * 60 * 0.8);
      }
    }
  });

  it("times the plank as a hold instead of reps", () => {
    const plan = buildPlan({ minutes: 60, level: "intermediate", equipment: [] });
    const plank = plan.items.find((i) => i.exerciseId === "plank")!;
    expect(plank.reps).toBeNull();
    expect(plank.work).toBe(40);
  });
});
