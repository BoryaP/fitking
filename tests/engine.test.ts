import { describe, expect, it } from "vitest";
import { buildSteps, fmt, Session } from "../src/engine";
import type { Plan } from "../src/planner";

const plan: Plan = {
  ready: 10,
  transition: 40,
  options: { minutes: 30, level: "intermediate", equipment: [] },
  items: [
    { exerciseId: "prisoner-squat", sets: 2, reps: 10, work: 32, rest: 60 },
    { exerciseId: "plank", sets: 2, reps: null, work: 40, rest: 45 },
  ],
};

describe("buildSteps", () => {
  it("lays out ready, sets, rests and transitions in order", () => {
    const kinds = buildSteps(plan).map((s) => s.kind + (s.transition ? "*" : ""));
    expect(kinds).toEqual(["ready", "work", "rest", "work", "rest*", "work", "rest", "work", "done"]);
  });
});

describe("Session", () => {
  it("counts down the whole workout and finishes", () => {
    const s = new Session(plan);
    expect(s.total).toBe(10 + 32 + 60 + 32 + 40 + 40 + 45 + 40);
    expect(s.remaining).toBe(s.total);
    s.tick(5);
    expect(s.remaining).toBe(s.total - 5);
    for (let i = 0; i < 400; i++) s.tick(1);
    expect(s.finished).toBe(true);
    expect(s.exercisesDone).toBe(2);
    expect(s.setsDone).toEqual([2, 2]);
  });

  it("tracks repetitions during a set", () => {
    const s = new Session(plan);
    s.tick(10); // past the countdown
    expect(s.step.kind).toBe("work");
    expect(s.rep).toBe(1);
    s.tick(3.1);
    expect(s.rep).toBe(2);
  });

  it("counts an exercise as done only after its last set", () => {
    const s = new Session(plan);
    s.tick(10 + 32 + 60);
    expect(s.exercisesDone).toBe(0);
    s.tick(32);
    expect(s.exercisesDone).toBe(1);
  });

  it("skips, goes back and pauses", () => {
    const s = new Session(plan);
    s.skip();
    expect(s.step.kind).toBe("work");
    s.skip();
    expect(s.setsDone[0]).toBe(1);
    s.back();
    expect(s.step.kind).toBe("work");
    expect(s.setsDone[0]).toBe(0);
    s.paused = true;
    s.tick(5);
    expect(s.elapsed).toBe(0);
  });
});

describe("fmt", () => {
  it("formats minutes and seconds", () => {
    expect(fmt(0)).toBe("0:00");
    expect(fmt(65)).toBe("1:05");
    expect(fmt(9.2)).toBe("0:10");
  });
});
