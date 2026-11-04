import type { PlanOptions } from "./planner";

export interface LastWorkout {
  date: number;
  seconds: number;
  completed: boolean;
  exercisesDone: number;
  exercisesTotal: number;
  items: { id: string; setsDone: number; sets: number; seconds: number }[];
}

const OPT_KEY = "fitking.options.v1";
const LAST_KEY = "fitking.last.v1";
const DEFAULTS: PlanOptions = { minutes: 45, level: "intermediate", equipment: ["dumbbells"] };

function read<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: settings just aren't remembered */ }
}

export function loadOptions(): PlanOptions {
  const o = read<PlanOptions>(OPT_KEY);
  if (!o || ![30, 45, 60].includes(o.minutes) || !["beginner", "intermediate", "advanced"].includes(o.level) || !Array.isArray(o.equipment)) return { ...DEFAULTS, equipment: [...DEFAULTS.equipment] };
  return o;
}
export const saveOptions = (o: PlanOptions) => write(OPT_KEY, o);
export const loadLast = () => read<LastWorkout>(LAST_KEY);
export const saveLast = (w: LastWorkout) => write(LAST_KEY, w);
