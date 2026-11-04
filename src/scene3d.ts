import * as THREE from "three";
import { anchored, lerpPose, patternBox, PATTERNS, R, Vec } from "./figure";
import type { Exercise, Muscle } from "./exercises";

export interface Palette {
  skin: string; shirt: string; shorts: string; shoe: string; hair: string; muscle: string; floor: string; stage: string;
}

type Limb = { set(a: THREE.Vector3, b: THREE.Vector3): void; mat(m: THREE.Material): void };

/**
 * A lit 3D mannequin in a small gym studio. The skeleton comes from the side-view poses in
 * figure.ts; the body is built from shaded primitives, and trained muscles glow.
 */
export class Scene3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(28, 1, 0.05, 60);
  private mats: Record<string, THREE.MeshStandardMaterial> = {};
  private B: Record<string, Limb> = {};
  private M: Record<string, THREE.Mesh> = {};
  private patches: Partial<Record<Muscle, THREE.Mesh[]>> = {};
  private head = new THREE.Group();
  private dbN: THREE.Group; private dbF: THREE.Group; private dbG: THREE.Group;
  private matMesh: THREE.Mesh;
  private floorTex: THREE.CanvasTexture;
  private tileCanvas = document.createElement("canvas");
  private camState: { x: number; y: number; d: number } | null = null;

  constructor(palette: Palette) {
    THREE.ColorManagement.legacyMode = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.canvas = this.renderer.domElement;
    const r = this.renderer;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.92;
    r.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffffff, 0x3a3f46, 0.65));
    const key = new THREE.DirectionalLight(0xfff3e6, 2.1);
    key.position.set(1.6, 3.4, 2.6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.8, bottom: -1.2, near: 0.5, far: 9 });
    key.shadow.bias = -0.0008; key.shadow.radius = 4;
    s.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xa9c8ff, 1.1); rim.position.set(-2.4, 2.2, -2.2); s.add(rim);
    const fill = new THREE.PointLight(0xffd9a8, 0.5, 6); fill.position.set(1.8, 1, -1); s.add(fill);

    this.tileCanvas.width = this.tileCanvas.height = 256;
    this.floorTex = new THREE.CanvasTexture(this.tileCanvas);
    this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping; this.floorTex.repeat.set(10, 10);
    this.floorTex.encoding = THREE.sRGBEncoding;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);

    const M = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
    const m = this.mats = {
      skin: M({ roughness: 0.5 }), skinFar: M({ roughness: 0.5 }), shirt: M({ roughness: 0.85 }), shirtFar: M({ roughness: 0.85 }),
      shorts: M({ roughness: 0.9 }), shortsFar: M({ roughness: 0.9 }), shoe: M({ roughness: 0.7 }), hair: M({ roughness: 0.95 }),
      eye: M({ color: 0x111111, roughness: 0.3 }), iron: M({ metalness: 0.55, roughness: 0.35 }),
      chrome: M({ metalness: 0.9, roughness: 0.2, color: 0xcfd5db }), mat: M({ roughness: 0.9 }), rack: M({ metalness: 0.4, roughness: 0.5 }),
      gPri: M({ transparent: true, opacity: 0.88, depthWrite: false }), gSec: M({ transparent: true, opacity: 0.55, depthWrite: false }),
      skinPri: M({ roughness: 0.5 }), skinSec: M({ roughness: 0.5 }),
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const add = <T extends THREE.Object3D>(o: T): T => { o.castShadow = true; s.add(o); return o; };
    const limb = (r1: number, r2: number, mat: THREE.Material, zs = 1): Limb => {
      const cyl = add(new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, 1, 24, 1, true), mat));
      const s1 = add(new THREE.Mesh(new THREE.SphereGeometry(r1, 24, 16), mat));
      const s2 = add(new THREE.Mesh(new THREE.SphereGeometry(r2, 24, 16), mat));
      s1.scale.z = s2.scale.z = zs;
      const d = new THREE.Vector3();
      return {
        set(a, b) {
          d.subVectors(b, a); const len = Math.max(d.length(), 1e-5);
          cyl.position.copy(a).addScaledVector(d, 0.5); cyl.scale.set(1, len, zs);
          cyl.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
          s1.position.copy(a); s2.position.copy(b);
        },
        mat(mm) { cyl.material = s1.material = s2.material = mm; },
      };
    };
    const blob = (mat: THREE.Material, sx: number, sy: number, sz: number) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat); b.scale.set(sx, sy, sz); s.add(b); return b;
    };
    const B = this.B;
    B.abd = limb(0.085, 0.09, m.shirt, 1.45); B.chest = limb(0.092, 0.1, m.shirt, 1.6);
    this.M.pelvis = add(blob(m.shorts, 0.095, 0.08, 0.15));
    B.neck = limb(0.032, 0.03, m.skin);
    for (const side of ["n", "f"]) {
      const far = side === "f";
      B["thigh" + side] = limb(0.064, 0.046, far ? m.skinFar : m.skin);
      B["short" + side] = limb(0.071, 0.064, far ? m.shortsFar : m.shorts);
      B["shin" + side] = limb(0.046, 0.03, far ? m.skinFar : m.skin);
      B["shoe" + side] = limb(0.036, 0.032, m.shoe, 1.15);
      B["ua" + side] = limb(0.042, 0.033, far ? m.skinFar : m.skin);
      B["sleeve" + side] = limb(0.05, 0.046, far ? m.shirtFar : m.shirt);
      B["fa" + side] = limb(0.033, 0.024, far ? m.skinFar : m.skin);
      const hand = add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), far ? m.skinFar : m.skin));
      hand.scale.set(1, 1.15, 0.8); this.M["hand" + side] = hand;
      this.M["delt" + side] = add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), far ? m.shirtFar : m.shirt));
    }
    const head = this.head; s.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), m.skin); skull.scale.set(1.08, 1.17, 0.92); skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), m.skin); jaw.position.set(0.025, -0.045, 0); jaw.scale.set(1, 0.8, 1.1); head.add(jaw);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.081, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), m.hair);
    hair.scale.set(1.08, 1.12, 0.95); hair.rotation.z = 0.45; hair.position.set(-0.006, 0.006, 0); head.add(hair);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), m.skin); nose.position.set(0.08, -0.005, 0); nose.scale.set(1, 1.3, 0.8); head.add(nose);
    for (const z of [-0.03, 0.03]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), m.eye); e.position.set(0.071, 0.018, z); head.add(e);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), m.skin); ear.position.set(-0.005, 0, z > 0 ? 0.07 : -0.07); ear.scale.set(0.8, 1.2, 0.5); head.add(ear);
    }
    const two = (sx: number, sy: number, sz: number) => [blob(m.gPri, sx, sy, sz), blob(m.gPri, sx, sy, sz)];
    this.patches = {
      chest: two(0.032, 0.06, 0.065), abs: [blob(m.gPri, 0.026, 0.085, 0.07)], lats: two(0.03, 0.085, 0.06),
      back: [blob(m.gPri, 0.03, 0.05, 0.12)], lowback: [blob(m.gPri, 0.026, 0.05, 0.08)], traps: [blob(m.gPri, 0.03, 0.035, 0.1)],
      glutes: two(0.045, 0.055, 0.06),
    };
    const dumbbell = () => {
      const g = new THREE.Group();
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 12), m.chrome); h.rotation.x = Math.PI / 2; g.add(h);
      for (const z of [-0.06, 0.06]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 6), m.iron);
        p.rotation.x = Math.PI / 2; p.position.z = z; p.castShadow = true; g.add(p);
      }
      s.add(g); return g;
    };
    this.dbN = dumbbell(); this.dbF = dumbbell(); this.dbG = dumbbell();
    this.matMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.012, 0.62), m.mat); this.matMesh.receiveShadow = true; s.add(this.matMesh);
    // Background gym: a power rack, a bench and a row of dumbbells, softened by fog.
    const bg = new THREE.Group(); s.add(bg);
    const post = (x: number, z: number, h: number) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), m.rack); p.position.set(x, h / 2, z); p.castShadow = true; bg.add(p); };
    ([[-1.4, -2.2], [-0.4, -2.2], [-1.4, -3], [-0.4, -3]] as Vec[]).forEach(([x, z]) => post(x, z, 2.2));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 10), m.chrome); bar.rotation.z = Math.PI / 2; bar.position.set(-0.9, 1.35, -2.15); bg.add(bar);
    for (const x of [-1.62, -0.18]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 28), m.iron); pl.rotation.z = Math.PI / 2; pl.position.set(x, 1.35, -2.15); bg.add(pl); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 0.06), m.rack); top.position.set(-0.9, 2.2, -2.2); bg.add(top);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.3), m.shirt); bench.position.set(1.5, 0.45, -2.4); bench.rotation.y = 0.5; bg.add(bench);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.24), m.rack); bl.position.set(1.5, 0.21, -2.4); bl.rotation.y = 0.5; bg.add(bl);
    for (let i = 0; i < 5; i++) { const d = dumbbell(); d.position.set(2.1 + i * 0.02, 0.06, -1.6 + i * 0.2); d.rotation.y = Math.PI / 2; bg.add(d); }
    this.setPalette(palette);
  }

  setPalette(p: Palette): void {
    const m = this.mats, c = (h: string) => new THREE.Color(h);
    m.skin.color = c(p.skin); m.skinFar.color = c(p.skin).multiplyScalar(0.82);
    m.shirt.color = c(p.shirt); m.shirtFar.color = c(p.shirt).multiplyScalar(0.75);
    m.shorts.color = c(p.shorts); m.shortsFar.color = c(p.shorts).multiplyScalar(0.75);
    m.shoe.color = c(p.shoe); m.hair.color = c(p.hair); m.iron.color = c("#2b2f35");
    m.mat.color = c(p.shirt).lerp(c("#000000"), 0.25); m.rack.color = c("#3a4048");
    for (const k of ["gPri", "gSec"]) { m[k].color = c(p.muscle); m[k].emissive = c(p.muscle); }
    m.skinPri.color = c(p.skin).lerp(c(p.muscle), 0.5); m.skinPri.emissive = c(p.muscle);
    m.skinSec.color = c(p.skin).lerp(c(p.muscle), 0.22); m.skinSec.emissive = c(p.muscle);
    const bgc = c(p.stage); this.scene.background = bgc; this.scene.fog = new THREE.Fog(bgc, 3.2, 8.5);
    const x = this.tileCanvas.getContext("2d")!;
    x.fillStyle = p.floor; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.08)"; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = 2; x.strokeRect(1, 1, 254, 254);
    this.floorTex.needsUpdate = true;
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / Math.max(1, h); this.cam.updateProjectionMatrix();
  }

  /** Pose the figure for exercise `ex` at movement fraction `f` (0..1) and draw a frame. */
  render(ex: Exercise, f: number, glow: number, dim: boolean, now: number): void {
    this.pose(ex, f, glow);
    const bx = patternBox(ex.pattern);
    const cx = (bx.x0 + bx.x1) / 2, cy = -(bx.y0 + bx.y1) / 2, bw = bx.x1 - bx.x0, bh = bx.y1 - bx.y0;
    const fov = this.cam.fov * R, th = 0.62 + 0.22 * Math.sin(now / 6500);
    const effW = bw * Math.cos(th) + 0.35 * Math.sin(th);
    // Leave room for the overlays at the top and bottom of the stage.
    const dist = Math.max((bh * 1.35) / 2 / Math.tan(fov / 2), (effW * 1.25) / 2 / Math.tan(fov / 2) / this.cam.aspect) + 0.35;
    const st = this.camState ?? (this.camState = { x: cx, y: cy, d: dist });
    st.x += (cx - st.x) * 0.08; st.y += (cy - st.y) * 0.08; st.d += (dist - st.d) * 0.08;
    this.cam.position.set(st.x + Math.sin(th) * st.d, st.y + 0.063 * st.d + 0.08, Math.cos(th) * st.d);
    this.cam.lookAt(st.x, st.y, 0);
    this.renderer.toneMappingExposure = dim ? 0.55 : 0.92;
    this.renderer.render(this.scene, this.cam);
  }

  private pose(ex: Exercise, f: number, level: number): void {
    const pat = PATTERNS[ex.pattern], j = anchored(pat, lerpPose(pat.A, pat.B, f)), B = this.B, m = this.mats;
    const V = (p: Vec, z: number) => new THREE.Vector3(p[0], -p[1], z);
    const HW = 0.095, SW = 0.175;
    const hip = V(j.hip, 0), sh = V(j.sh, 0);
    const td = new THREE.Vector3().subVectors(sh, hip).normalize();
    const mid = hip.clone().lerp(sh, 0.48);
    B.abd.set(hip, mid); B.chest.set(mid, sh.clone().addScaledVector(td, -0.02));
    this.M.pelvis.position.copy(hip); this.M.pelvis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), td);
    const headP = V(j.head, 0);
    B.neck.set(sh, sh.clone().lerp(headP, 0.55));
    this.head.position.copy(headP); this.head.rotation.set(0, 0, -j.headAng * R);
    const goblet = ex.prop === "goblet";
    for (const [s, l, z] of [["n", j.l1, HW], ["f", j.l2, -HW]] as const) {
      const h = V(j.hip, z * 0.9), k = V(l.knee, z), a = V(l.ank, z), t = V(l.toe, z);
      B["thigh" + s].set(h, k); B["short" + s].set(h, h.clone().lerp(k, 0.42)); B["shin" + s].set(k, a); B["shoe" + s].set(a.clone().lerp(t, -0.15), t);
    }
    for (const [s, a, z] of [["n", j.a1, SW], ["f", j.a2, -SW]] as const) {
      const sp = V(j.sh, z * 0.92), e = V(a.elb, goblet ? z * 0.8 : z), h = V(a.hand, goblet ? Math.sign(z) * 0.045 : z);
      sp.y -= 0.02;
      B["ua" + s].set(sp, e); B["sleeve" + s].set(sp, sp.clone().lerp(e, 0.38)); B["fa" + s].set(e, h);
      this.M["hand" + s].position.copy(h); this.M["delt" + s].position.copy(sp).add(new THREE.Vector3(0, 0.01, 0));
      const db = s === "n" ? this.dbN : this.dbF; db.visible = ex.prop === "db"; db.position.copy(h);
    }
    this.dbG.visible = goblet;
    if (goblet) { this.dbG.position.copy(V(j.a1.hand, 0)).add(new THREE.Vector3(0.03, -0.02, 0)); this.dbG.rotation.set(Math.PI / 2, 0, 0); }
    this.matMesh.visible = ex.prop === "mat";
    if (ex.prop === "mat") this.matMesh.position.set((j.hip[0] + j.l1.toe[0]) / 2 + 0.15, 0.006, 0);

    // Trained muscles: limbs turn a glowing red, torso and hip areas get glowing patches.
    const lv = (k: Muscle) => (ex.primary.includes(k) ? 2 : ex.secondary.includes(k) ? 1 : 0);
    m.gPri.emissiveIntensity = 0.35 + 0.75 * level; m.gSec.emissiveIntensity = 0.12 + 0.25 * level;
    m.skinPri.emissiveIntensity = 0.3 + 0.8 * level; m.skinSec.emissiveIntensity = 0.08 + 0.2 * level;
    const limbMat = (keys: Muscle[], far: boolean) => {
      const v = Math.max(...keys.map(lv));
      return v === 2 ? m.skinPri : v === 1 ? m.skinSec : far ? m.skinFar : m.skin;
    };
    for (const s of ["n", "f"]) {
      const far = s === "f";
      B["thigh" + s].mat(limbMat(["quads", "hamstrings"], far)); B["shin" + s].mat(limbMat(["calves"], far));
      B["ua" + s].mat(limbMat(["biceps", "triceps"], far)); B["fa" + s].mat(limbMat(["forearms"], far));
      const dl = lv("shoulders");
      this.M["delt" + s].material = dl === 2 ? m.gPri : dl === 1 ? m.gSec : far ? m.shirtFar : m.shirt;
    }
    const fr = new THREE.Vector3(td.y, -td.x, 0);
    const at = (t: number, off: number, z: number) => hip.clone().lerp(sh, t).addScaledVector(fr, off).setZ(z);
    const place = (key: Muscle, pts: THREE.Vector3[]) => {
      const v = lv(key);
      (this.patches[key] ?? []).forEach((mesh, i) => {
        mesh.visible = v > 0; if (!v) return;
        mesh.material = v === 2 ? m.gPri : m.gSec; mesh.position.copy(pts[i]);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), td);
      });
    };
    place("chest", [at(0.74, 0.072, 0.068), at(0.74, 0.072, -0.068)]);
    place("abs", [at(0.32, 0.066, 0)]);
    place("lats", [at(0.6, -0.06, 0.085), at(0.6, -0.06, -0.085)]);
    place("back", [at(0.86, -0.07, 0)]);
    place("lowback", [at(0.2, -0.07, 0)]);
    place("traps", [at(0.98, -0.045, 0)]);
    place("glutes", [at(-0.08, -0.06, 0.055), at(-0.08, -0.06, -0.055)]);
  }

  dispose(): void { this.renderer.dispose(); }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
