import "./styles.css";
import { byId, MUSCLE_NAMES, Equipment } from "./exercises";
import { buildPlan, Level, Plan, PlanOptions, totalSeconds } from "./planner";
import { fmt, Session } from "./engine";
import { repCurve } from "./figure";
import { muscleMapSVG } from "./musclemap";
import { Palette, Scene3D, webglAvailable } from "./scene3d";
import { loadLast, loadOptions, saveLast, saveOptions, LastWorkout } from "./storage";
import { Beeper } from "./sound";

const app = document.getElementById("app")!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ICON = {
  close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>',
  prev: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  skip: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
  soundOn: '<path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.5 6a8.5 8.5 0 0 1 0 12l-1.4-1.4a6.5 6.5 0 0 0 0-9.2z"/>',
  soundOff: '<path d="M4 9h4l5-4v14l-5-4H4zM16 9.4l1.4-1.4L19.5 10l2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2.1 2.1L16 13.6l2.1-2.1z"/>',
};
const svg = (p: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

/* ---------------- plan screen ---------------- */
function showHome(): void {
  stopWorkout();
  const opts = loadOptions();
  const render = () => {
    const plan = buildPlan(opts);
    const last = loadLast();
    app.innerHTML = `
    <main class="home">
      <h1 class="brand"><span class="mk" aria-hidden="true">F</span>FITKING</h1>
      <p class="tag">Your personal trainer. Pick your time and equipment, then follow the screen.</p>
      <section class="panel" aria-label="Workout settings">
        <div class="field"><span class="lbl">Goal</span><span class="goal">Build muscle</span></div>
        <div class="field"><span class="lbl">Workout length</span>
          <div class="seg" role="group" aria-label="Workout length">${([30, 45, 60] as const).map((m) => `<button type="button" data-min="${m}" aria-pressed="${opts.minutes === m}">${m} min</button>`).join("")}</div></div>
        <div class="field"><span class="lbl">Level</span>
          <div class="seg" role="group" aria-label="Level">${(["beginner", "intermediate", "advanced"] as Level[]).map((l) => `<button type="button" data-level="${l}" aria-pressed="${opts.level === l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join("")}</div></div>
        <div class="field"><span class="lbl">Equipment</span>
          <label class="toggle"><input type="checkbox" id="eq-db" ${opts.equipment.includes("dumbbells") ? "checked" : ""}> I have dumbbells</label></div>
      </section>
      <div class="plan-head"><h2>Today's plan</h2><span class="sum">${plan.items.length} exercises · about ${Math.round(totalSeconds(plan) / 60)} min</span></div>
      ${plan.items.length < 5 && !opts.equipment.includes("dumbbells") ? `<p class="last">Without dumbbells FITKING has ${plan.items.length} exercises so far, so the workout is shorter than ${opts.minutes} minutes.</p>` : ""}
      <ol class="plan">${plan.items.map((it, i) => {
        const ex = byId(it.exerciseId);
        return `<li class="row"><span class="no">${i + 1}</span>
          <span class="nm">${esc(ex.name)}</span>
          <span class="sr">${it.sets} × ${it.reps === null ? it.work + " s" : it.reps}</span>
          <span class="dt"><span class="ms">${ex.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</span> · ${esc(ex.gearLabel)} · rest ${it.rest} s</span>
          <a href="${ex.demoUrl}" target="_blank" rel="noopener noreferrer">Real video ↗</a></li>`;
      }).join("")}</ol>
      <button class="start" type="button" id="start">Start workout</button>
      ${last ? `<p class="last">Last workout: ${new Date(last.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${fmt(last.seconds)}, ${last.exercisesDone} of ${last.exercisesTotal} exercises done.</p>` : ""}
      <p class="foot">Demo videos open on Muscle &amp; Strength. FITKING is not affiliated with that site.</p>
    </main>`;
    app.querySelectorAll<HTMLButtonElement>("[data-min]").forEach((b) => b.onclick = () => { opts.minutes = Number(b.dataset.min) as PlanOptions["minutes"]; saveOptions(opts); render(); });
    app.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((b) => b.onclick = () => { opts.level = b.dataset.level as Level; saveOptions(opts); render(); });
    (app.querySelector("#eq-db") as HTMLInputElement).onchange = (e) => {
      const on = (e.target as HTMLInputElement).checked;
      opts.equipment = on ? ["dumbbells"] : ([] as Equipment[]);
      saveOptions(opts); render();
      (app.querySelector("#eq-db") as HTMLElement | null)?.focus();
    };
    (app.querySelector("#start") as HTMLButtonElement).onclick = () => startWorkout(plan);
  };
  render();
  window.scrollTo(0, 0);
}

/* ---------------- workout screen ---------------- */
let raf = 0;
let scene: Scene3D | null = null;
let wakeLock: { release(): Promise<void> } | null = null;
let onResize: (() => void) | null = null;
const beeper = new Beeper();

function palette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => cs.getPropertyValue("--" + k).trim() || "#888888";
  return { skin: v("skin"), shirt: v("shirt"), shorts: v("shorts"), shoe: v("shoe"), hair: v("hair"), muscle: v("muscle"), floor: v("floor"), stage: v("stage") };
}

function stopWorkout(): void {
  cancelAnimationFrame(raf); raf = 0;
  if (onResize) { window.removeEventListener("resize", onResize); onResize = null; }
  wakeLock?.release().catch(() => {}); wakeLock = null;
}

async function keepAwake(): Promise<void> {
  try { wakeLock = await (navigator as any).wakeLock?.request("screen"); } catch { wakeLock = null; }
}

function startWorkout(plan: Plan): void {
  stopWorkout();
  beeper.unlock();
  keepAwake();
  const S = new Session(plan);
  const startedAt = Date.now();
  app.innerHTML = `
  <div class="screen"><div class="scr">
    <div class="s-top">
      <div class="l">
        <button class="iconbtn" type="button" data-a="exit" aria-label="End workout">${svg(ICON.close)}</button>
        <div><div class="eyebrow" data-f="exno"></div><h2 class="ex-name" data-f="name"></h2><div class="ex-gear" data-f="gear"></div></div>
      </div>
      <div class="chips"><span class="chip set" data-f="set"></span><span class="chip" data-f="target"></span>
        <button class="iconbtn" type="button" data-a="sound" aria-label="Sound" data-f="sound"></button></div>
    </div>
    <div class="stage" data-f="stage">
      <div class="phase" data-f="phase"></div>
      <div class="mmap"><div data-f="map"></div><div class="cap" data-f="mcap"></div></div>
      <div class="rest-over" data-f="restover" hidden><div data-f="restlbl"></div></div>
      <div class="cue" data-f="cue"></div>
      <a class="demo-link" data-f="demo" target="_blank" rel="noopener noreferrer" href="#">${svg(ICON.play)}Watch real video</a>
    </div>
    <div class="s-bot">
      <div class="timer" data-f="timerbox"><div class="k" data-f="tlbl"></div><div class="t-val" data-f="time"></div><div class="t-bar"><i data-f="tbar"></i></div></div>
      <div class="reps"><div class="k" data-f="rlbl"></div><div class="r-val" data-f="reps"></div></div>
      <div class="next"><div class="k">Next</div><div data-f="next"></div></div>
      <div class="ctrls">
        <button type="button" data-a="prev" aria-label="Back">${svg(ICON.prev)}</button>
        <button type="button" class="main" data-a="play" aria-label="Pause" data-f="play">${svg(ICON.pause)}</button>
        <button type="button" data-a="skip" aria-label="Skip">${svg(ICON.skip)}</button>
      </div>
    </div>
    <div class="prog">
      <div class="cnt"><div class="k">Workout progress</div><div class="pv" data-f="cnt"></div></div>
      <div class="segs">${plan.items.map(() => "<span><i></i></span>").join("")}</div>
      <div class="tot"><div class="k">Workout time left</div><div class="pv" data-f="tot"></div></div>
    </div>
  </div></div>
  <div class="dlg" data-f="dlg" hidden><div class="box" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <h3 id="dlg-t">End workout?</h3><p>You'll see a summary of what you've done so far.</p>
    <div class="acts"><button class="btn" type="button" data-a="keep">Keep going</button><button class="btn pri" type="button" data-a="end">End workout</button></div>
  </div></div>`;
  const f: Record<string, HTMLElement> = {};
  app.querySelectorAll<HTMLElement>("[data-f]").forEach((n) => (f[n.dataset.f!] = n));
  const bars = [...app.querySelectorAll<HTMLElement>(".segs i")];

  // 3D stage, with a fallback message when WebGL is not available.
  if (!scene && webglAvailable()) { try { scene = new Scene3D(palette()); } catch { scene = null; } }
  if (scene) { f.stage.prepend(scene.canvas); scene.setPalette(palette()); }
  else f.stage.insertAdjacentHTML("afterbegin", '<p style="position:absolute;inset:auto 0 45%;text-align:center;color:var(--muted)">3D view needs WebGL. Use “Watch real video” to see the move.</p>');
  const size = () => { if (!scene) return; const r = f.stage.getBoundingClientRect(); scene.resize(Math.max(1, r.width), Math.max(1, r.height)); };
  onResize = size; window.addEventListener("resize", size); size();
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => scene?.setPalette(palette())); } catch { /* old browsers */ }

  const finish = (completed: boolean) => {
    const done: LastWorkout = {
      date: startedAt, seconds: (Date.now() - startedAt) / 1000, completed,
      exercisesDone: S.exercisesDone, exercisesTotal: plan.items.length,
      items: plan.items.map((it, i) => ({ id: it.exerciseId, setsDone: S.setsDone[i], sets: it.sets, seconds: S.spent[i] })),
    };
    saveLast(done);
    showSummary(done);
  };
  const act = (a: string) => {
    if (a === "play") { S.paused = !S.paused; beeper.unlock(); }
    else if (a === "skip") S.skip();
    else if (a === "prev") S.back();
    else if (a === "sound") { beeper.enabled = !beeper.enabled; beeper.unlock(); }
    else if (a === "exit") { S.paused = true; f.dlg.hidden = false; (f.dlg.querySelector('[data-a="keep"]') as HTMLElement).focus(); }
    else if (a === "keep") { f.dlg.hidden = true; S.paused = false; }
    else if (a === "end") { f.dlg.hidden = true; finish(false); }
  };
  app.querySelectorAll<HTMLButtonElement>("[data-a]").forEach((b) => (b.onclick = () => act(b.dataset.a!)));
  S.onStep = (st) => { beeper.beep(st.kind === "work" ? 880 : 520); };

  let lastKey = "", lastBeep = -1, last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    S.tick(dt);
    if (S.finished) { finish(true); return; }
    const st = S.step, it = plan.items[st.item], ex = byId(it.exerciseId);
    const left = S.left;
    const sec = Math.ceil(left);
    if (!S.paused && sec <= 3 && sec >= 1 && sec !== lastBeep) { lastBeep = sec; beeper.beep(660, 0.08); }
    if (sec > 3) lastBeep = -1;
    const key = it.exerciseId + st.kind;
    if (key !== lastKey) {
      lastKey = key;
      f.exno.textContent = `Exercise ${st.item + 1} of ${plan.items.length}`;
      f.name.textContent = ex.name; f.gear.textContent = ex.gearLabel;
      f.target.textContent = it.reps === null ? `${it.work} s hold` : `${it.reps} reps`;
      f.map.innerHTML = muscleMapSVG(ex.primary, ex.secondary);
      f.mcap.innerHTML = "<b>" + ex.primary.map((m) => MUSCLE_NAMES[m]).join(", ") + "</b><br>" + ex.secondary.map((m) => MUSCLE_NAMES[m]).join(", ");
      (f.demo as HTMLAnchorElement).href = ex.demoUrl;
      f.demo.setAttribute("aria-label", `Watch a real video of ${ex.name} on Muscle & Strength (opens in a new tab)`);
    }
    const setNo = st.kind === "work" ? st.set + 1 : st.kind === "rest" && !st.transition ? st.set + 2 : 1;
    f.set.textContent = `Set ${setNo} / ${it.sets}`;
    f.phase.textContent = st.kind === "work" ? "WORK" : st.kind === "rest" ? "REST" : "GET READY";
    f.phase.className = "phase" + (st.kind === "rest" ? " rest" : st.kind !== "work" ? " ready" : "");
    f.timerbox.className = "timer" + (st.kind === "rest" ? " rest" : "");
    f.tlbl.textContent = st.kind === "rest" ? "Rest left" : st.kind === "ready" ? "Starting in" : "Time left";
    f.time.textContent = fmt(left);
    f.tbar.style.width = (st.dur ? Math.min(100, (S.elapsed / st.dur) * 100) : 100) + "%";
    if (it.reps === null) { f.rlbl.textContent = "Hold"; f.reps.innerHTML = `${st.kind === "work" ? Math.min(it.work, Math.floor(S.elapsed)) : 0}<small>/${it.work} s</small>`; }
    else { f.rlbl.textContent = "Repeats"; f.reps.innerHTML = `${S.rep}<small>/${it.reps}</small>`; }
    const nx = S.steps[S.idx + 1];
    let next = "Finish";
    if (nx && nx.kind === "rest") next = `<b>Rest</b> ${fmt(nx.dur)}${nx.transition ? ` then <b>${esc(byId(plan.items[nx.item].exerciseId).name)}</b>` : ""}`;
    else if (nx && nx.kind === "work") {
      const ni = plan.items[nx.item], nn = byId(ni.exerciseId);
      const what = ni.reps === null ? `${ni.work} s hold` : `${ni.reps} reps`;
      next = nx.item !== st.item || st.kind === "ready" || st.transition ? `<b>${esc(nn.name)}</b> · ${what}` : `<b>Set ${nx.set + 1}</b> · ${what}`;
    }
    if (f.next.innerHTML !== next) f.next.innerHTML = next;
    const isRest = st.kind !== "work";
    f.restover.hidden = !isRest;
    f.restlbl.textContent = st.kind === "ready" ? "Get into position" : st.transition ? "Up next" : "Breathe · next set soon";
    const cueI = st.kind === "work" ? Math.floor(S.elapsed / (it.reps === null ? 10 : ((it.work - 2) / it.reps) * 2.5)) % ex.cues.length : 0;
    if (f.cue.textContent !== ex.cues[cueI]) f.cue.textContent = ex.cues[cueI];
    const playLbl = S.paused ? "Resume" : "Pause";
    if (f.play.getAttribute("aria-label") !== playLbl) { f.play.setAttribute("aria-label", playLbl); f.play.innerHTML = svg(S.paused ? ICON.play : ICON.pause); }
    const snd = beeper.enabled ? "Sound on" : "Sound off";
    if (f.sound.getAttribute("aria-label") !== snd) { f.sound.setAttribute("aria-label", snd); f.sound.innerHTML = svg(beeper.enabled ? ICON.soundOn : ICON.soundOff); }
    plan.items.forEach((pi, i) => {
      const p = Math.min(1, (S.setsDone[i] + (st.kind === "work" && st.item === i ? S.elapsed / st.dur : 0)) / pi.sets);
      bars[i].style.width = p * 100 + "%";
    });
    f.cnt.innerHTML = `${S.exercisesDone}<small> of ${plan.items.length} exercises done</small>`;
    f.tot.innerHTML = `${fmt(S.remaining)}<small> of ${fmt(S.total)}</small>`;
    if (scene) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      let fr = 0;
      if (st.kind === "work") fr = it.reps === null ? 0.5 + 0.5 * Math.sin(now / 900) : repCurve(S.repPhase);
      else fr = (0.5 + 0.5 * Math.sin(now / 1400)) * 0.08;
      scene.render(ex, fr, st.kind === "work" ? pulse : 0.25, isRest, now);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && raf) keepAwake(); });
}

/* ---------------- summary ---------------- */
function showSummary(w: LastWorkout): void {
  stopWorkout();
  app.innerHTML = `
  <main class="home summary">
    <div class="brand"><span class="mk" aria-hidden="true">F</span>FITKING</div>
    <h1>${w.completed ? "Workout complete" : "Workout ended"}</h1>
    <p class="tag">${w.completed ? "Great work. Here's what you did." : "Here's what you did before stopping."}</p>
    <div class="stats">
      <div class="stat"><span class="lbl">Total time</span><b>${fmt(w.seconds)}</b></div>
      <div class="stat"><span class="lbl">Exercises done</span><b>${w.exercisesDone} / ${w.exercisesTotal}</b></div>
      <div class="stat"><span class="lbl">Sets done</span><b>${w.items.reduce((a, i) => a + i.setsDone, 0)} / ${w.items.reduce((a, i) => a + i.sets, 0)}</b></div>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Exercise</th><th class="n">Sets</th><th class="n">Time</th></tr></thead><tbody>
      ${w.items.map((i) => `<tr><td>${esc(byId(i.id).name)}</td><td class="n">${i.setsDone} / ${i.sets}</td><td class="n">${fmt(i.seconds)}</td></tr>`).join("")}
    </tbody></table></div>
    <button class="start" type="button" id="home">Back to plan</button>
  </main>`;
  (app.querySelector("#home") as HTMLButtonElement).onclick = showHome;
}

showHome();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
