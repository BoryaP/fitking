# FITKING

A personal trainer app that guides you step by step through a gym workout. It plans a muscle-building session, shows a 3D person doing each move with the trained muscles highlighted, and times every set, rest and the whole workout.

It is an installable web app (PWA), so the same code runs on phones, tablets, PCs and Macs. After the first visit it also works offline.

## What the MVP does

- **Plan:** pick 30, 45 or 60 minutes, a level (beginner, intermediate, advanced) and whether you have dumbbells. FITKING builds a balanced muscle-building workout (8 to 12 reps, 60 to 90 s rest).
- **Workout screen:** the main area shows a lit 3D person doing the exercise at the right pace, with trained muscles glowing and a front/back muscle map. Above it: exercise name, equipment, set and target reps. Below it: time left for the set or rest, repetition counter, what comes next, and back, pause and skip buttons.
- **Workout progress:** exercises done out of the total, and time left for the whole workout.
- **Real video:** every exercise has a "Watch real video" button that opens the same exercise on [Muscle & Strength](https://www.muscleandstrength.com/exercises). FITKING only links there and doesn't copy their videos.
- **Summary:** total time, exercises and sets done, and time per exercise. The last workout is remembered on the device.
- Beeps for the last 3 seconds and each phase change (can be muted), and the screen stays awake during a workout where the browser allows it.

Not in the MVP yet: photo-based equipment detection, group/TV mode, more equipment types, workout history beyond the last session.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # planner and timer tests
npm run build    # production build in dist/
```

## Publish it

`.github/workflows/deploy.yml` tests and builds every push. On `main` it also deploys to GitHub Pages. To turn that on once, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app is then at `https://<owner>.github.io/fitking/`. To install it, open that address on a phone and choose "Add to Home screen", or click the install icon in Chrome or Edge on a PC or Mac.

## Code map

| File | What it does |
| --- | --- |
| `src/exercises.ts` | Exercise library: muscles, cues, equipment, 3D pattern, demo link |
| `src/planner.ts` | Builds the muscle-building plan for the chosen time, level and equipment |
| `src/engine.ts` | Workout timer: steps, sets, rests, reps, time left, progress |
| `src/figure.ts` | Skeleton poses for each movement pattern |
| `src/scene3d.ts` | three.js scene: the 3D person, glowing muscles, gym backdrop, camera |
| `src/main.ts` | Screens: plan, workout, summary |
| `public/sw.js` | Offline cache |

To add an exercise, add an entry in `src/exercises.ts`, using an existing `pattern` or a new one in `src/figure.ts` (start pose A and end pose B).
