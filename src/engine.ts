import type { Plan } from "./planner";

export type StepKind = "ready" | "work" | "rest" | "done";

export interface Step {
  kind: StepKind;
  /** Index of the plan item this step belongs to (for a transition rest: the next item). */
  item: number;
  /** Set index within the item, 0-based. -1 for transitions and ready. */
  set: number;
  dur: number;
  transition?: boolean;
}

export function buildSteps(plan: Plan): Step[] {
  const steps: Step[] = [{ kind: "ready", item: 0, set: -1, dur: plan.ready }];
  plan.items.forEach((it, i) => {
    for (let s = 0; s < it.sets; s++) {
      steps.push({ kind: "work", item: i, set: s, dur: it.work });
      if (s < it.sets - 1) steps.push({ kind: "rest", item: i, set: s, dur: it.rest });
      else if (i < plan.items.length - 1) steps.push({ kind: "rest", item: i + 1, set: -1, dur: plan.transition, transition: true });
    }
  });
  steps.push({ kind: "done", item: Math.max(0, plan.items.length - 1), set: -1, dur: 0 });
  return steps;
}

/** Workout timer state machine. Time is advanced explicitly, so it is easy to test. */
export class Session {
  readonly steps: Step[];
  readonly total: number;
  idx = 0;
  elapsed = 0;
  paused = false;
  /** Seconds actually spent per plan item (work and the rests that follow its sets). */
  spent: number[];
  setsDone: number[];
  onStep?: (step: Step) => void;

  constructor(readonly plan: Plan) {
    this.steps = buildSteps(plan);
    this.total = this.steps.reduce((a, s) => a + s.dur, 0);
    this.spent = plan.items.map(() => 0);
    this.setsDone = plan.items.map(() => 0);
  }

  get step(): Step { return this.steps[this.idx]; }
  get finished(): boolean { return this.step.kind === "done"; }
  get left(): number { return Math.max(0, this.step.dur - this.elapsed); }

  /** Seconds of the planned workout still ahead, counting the current step's remainder. */
  get remaining(): number {
    let t = this.left;
    for (let i = this.idx + 1; i < this.steps.length; i++) t += this.steps[i].dur;
    return t;
  }

  /** Number of plan items whose last set is finished. */
  get exercisesDone(): number {
    let n = 0;
    this.plan.items.forEach((_, i) => {
      let last = -1;
      this.steps.forEach((s, k) => { if (s.item === i && s.kind === "work") last = k; });
      if (this.idx > last) n++;
    });
    return n;
  }

  /** Current repetition (1-based) during a rep-based work step, otherwise 0. */
  get rep(): number {
    const s = this.step, it = this.plan.items[s.item];
    if (s.kind !== "work" || it.reps === null) return 0;
    const tempo = (it.work - 2) / it.reps;
    return Math.min(it.reps, Math.floor(this.elapsed / tempo) + 1);
  }

  /** Fraction (0..1) through the current repetition, for animating the figure. */
  get repPhase(): number {
    const s = this.step, it = this.plan.items[s.item];
    if (s.kind !== "work" || it.reps === null) return 0;
    const tempo = (it.work - 2) / it.reps;
    return (this.elapsed / tempo) % 1;
  }

  tick(dt: number): void {
    if (this.paused || this.finished) return;
    const cur = this.step;
    if (cur.kind !== "ready") this.spent[cur.transition ? Math.max(0, cur.item - 1) : cur.item] += dt;
    this.elapsed += dt;
    while (!this.finished && this.elapsed >= this.step.dur) {
      this.elapsed -= this.step.dur;
      this.advance();
    }
    if (this.finished) this.elapsed = 0;
  }

  private advance(): void {
    const s = this.step;
    if (s.kind === "work") this.setsDone[s.item]++;
    this.idx++;
    this.onStep?.(this.step);
  }

  skip(): void {
    if (this.finished) return;
    this.elapsed = 0;
    this.advance();
  }

  back(): void {
    if (this.elapsed > 2 || this.idx === 0) { this.elapsed = 0; return; }
    this.idx--;
    const s = this.step;
    if (s.kind === "work" && this.setsDone[s.item] > 0) this.setsDone[s.item]--;
    this.elapsed = 0;
    this.onStep?.(this.step);
  }

  addRest(sec: number): void {
    if (this.step.kind === "rest") this.elapsed = Math.max(0, this.elapsed - sec);
  }
}

export const fmt = (s: number): string => {
  const v = Math.max(0, Math.ceil(s));
  return Math.floor(v / 60) + ":" + String(v % 60).padStart(2, "0");
};
