// Exercise library for the MVP. Every exercise has a 3D motion pattern (see figure.ts)
// and a link to a real-person demo video of exactly the same exercise on Muscle & Strength.

export type Muscle =
  | "quads" | "glutes" | "hamstrings" | "calves" | "abs" | "chest" | "triceps" | "shoulders"
  | "lats" | "back" | "biceps" | "traps" | "lowback" | "forearms";

export type Equipment = "dumbbells" | "mat";

/** Slot = the role an exercise plays in a balanced muscle-building workout. */
export type Slot = "squat" | "push" | "pull" | "hinge" | "vpush" | "lunge" | "arms" | "glute" | "core";

export type Prop = "goblet" | "db" | "mat" | "none";

export interface Exercise {
  id: string;
  name: string;
  slot: Slot;
  /** Equipment that must be available. An empty list means bodyweight only. */
  needs: Equipment[];
  gearLabel: string;
  pattern: string;
  prop: Prop;
  primary: Muscle[];
  secondary: Muscle[];
  cues: string[];
  /** Seconds per repetition, used for pacing the 3D figure and the set timer. */
  tempo?: number;
  /** For static holds: seconds held per set. */
  hold?: number;
  /** Higher rank wins when several exercises fit the same slot. */
  rank: number;
  demoUrl: string;
}

const MS = "https://www.muscleandstrength.com/exercises/";

export const MUSCLE_NAMES: Record<Muscle, string> = {
  quads: "Quads", glutes: "Glutes", hamstrings: "Hamstrings", calves: "Calves", abs: "Abs", chest: "Chest",
  triceps: "Triceps", shoulders: "Shoulders", lats: "Lats", back: "Upper back", biceps: "Biceps",
  traps: "Traps", lowback: "Lower back", forearms: "Forearms",
};

export const EXERCISES: Exercise[] = [
  {
    id: "goblet-squat", name: "Goblet squat", slot: "squat", needs: ["dumbbells"], gearLabel: "1 dumbbell",
    pattern: "squat", prop: "goblet", primary: ["quads", "glutes"], secondary: ["hamstrings", "abs"], tempo: 3, rank: 2,
    cues: ["Feet shoulder-width, toes slightly out", "Sit hips back and down, chest up", "Knees follow your toes", "Push through the whole foot to stand"],
    demoUrl: MS + "dumbbell-goblet-squat",
  },
  {
    id: "prisoner-squat", name: "Prisoner squat", slot: "squat", needs: [], gearLabel: "No equipment",
    pattern: "prisonerSquat", prop: "none", primary: ["quads", "glutes"], secondary: ["hamstrings", "abs"], tempo: 3, rank: 1,
    cues: ["Hands behind your head, elbows wide", "Sit hips back and down", "Keep your chest up", "Stand up tall and squeeze glutes"],
    demoUrl: MS + "bodyweight-squat.html",
  },
  {
    id: "push-up", name: "Push-up", slot: "push", needs: [], gearLabel: "Mat",
    pattern: "pushup", prop: "mat", primary: ["chest", "triceps"], secondary: ["shoulders", "abs"], tempo: 2.8, rank: 1,
    cues: ["Hands under shoulders", "Body in one straight line", "Lower chest close to the floor", "Press the floor away"],
    demoUrl: MS + "push-up.html",
  },
  {
    id: "bent-over-row", name: "Bent-over dumbbell row", slot: "pull", needs: ["dumbbells"], gearLabel: "2 dumbbells",
    pattern: "row", prop: "db", primary: ["lats", "back"], secondary: ["biceps", "shoulders"], tempo: 3, rank: 2,
    cues: ["Hinge forward, flat back", "Pull elbows to your hips", "Squeeze shoulder blades", "Lower slowly"],
    demoUrl: MS + "bent-over-dumbbell-row.html",
  },
  {
    id: "shoulder-press", name: "Standing dumbbell shoulder press", slot: "vpush", needs: ["dumbbells"], gearLabel: "2 dumbbells",
    pattern: "press", prop: "db", primary: ["shoulders", "triceps"], secondary: ["traps", "abs"], tempo: 3, rank: 2,
    cues: ["Dumbbells at shoulder height", "Brace your stomach", "Press straight up", "Lower with control"],
    demoUrl: MS + "standing-dumbbell-press.html",
  },
  {
    id: "stiff-leg-deadlift", name: "Dumbbell stiff-leg deadlift", slot: "hinge", needs: ["dumbbells"], gearLabel: "2 dumbbells",
    pattern: "rdl", prop: "db", primary: ["hamstrings", "glutes"], secondary: ["lowback", "forearms"], tempo: 3.2, rank: 2,
    cues: ["Soft knees, weights close to legs", "Push hips back", "Feel the stretch in your hamstrings", "Squeeze glutes to stand"],
    demoUrl: MS + "dumbbell-stiff-leg-deadlift.html",
  },
  {
    id: "glute-bridge", name: "Bodyweight glute bridge", slot: "glute", needs: [], gearLabel: "Mat",
    pattern: "bridge", prop: "mat", primary: ["glutes", "hamstrings"], secondary: ["lowback", "abs"], tempo: 2.6, rank: 1,
    cues: ["Feet flat, close to your hips", "Push through your heels", "Lift hips into a straight line", "Squeeze glutes at the top"],
    demoUrl: MS + "bodyweight-glute-bridge",
  },
  {
    id: "dumbbell-lunge", name: "Dumbbell lunge", slot: "lunge", needs: ["dumbbells"], gearLabel: "2 dumbbells",
    pattern: "lunge", prop: "db", primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"], tempo: 3.2, rank: 2,
    cues: ["Long step, torso tall", "Back knee drops toward the floor", "Front knee over the ankle", "Drive through the front heel"],
    demoUrl: MS + "dumbbell-lunge.html",
  },
  {
    id: "dumbbell-curl", name: "Standing dumbbell curl", slot: "arms", needs: ["dumbbells"], gearLabel: "2 dumbbells",
    pattern: "curl", prop: "db", primary: ["biceps"], secondary: ["forearms"], tempo: 2.8, rank: 2,
    cues: ["Elbows tucked at your sides", "Curl the weights up", "Squeeze at the top", "Lower all the way down"],
    demoUrl: MS + "standing-dumbbell-curl.html",
  },
  {
    id: "plank", name: "Plank", slot: "core", needs: [], gearLabel: "Mat",
    pattern: "plank", prop: "mat", primary: ["abs"], secondary: ["shoulders", "glutes"], hold: 40, rank: 1,
    cues: ["Elbows under shoulders", "Squeeze glutes and stomach", "Do not let hips drop", "Breathe steadily"],
    demoUrl: MS + "hover.html",
  },
];

export const byId = (id: string): Exercise => {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error("Unknown exercise " + id);
  return e;
};
