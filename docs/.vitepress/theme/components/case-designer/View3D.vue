<template>
  <div ref="host" class="v3" :class="{ grabbing: orbiting }" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
    <canvas ref="cv"></canvas>
    <svg class="ov" :viewBox="`0 0 ${size.w} ${size.h}`" aria-hidden="true">
      <g v-for="a in gizmo" :key="a.n">
        <line :x1="70" :y1="size.h - 60" :x2="a.x" :y2="a.y" :style="{ stroke: a.c }" class="gz" />
        <text :x="a.lx" :y="a.ly" :style="{ fill: a.c }" class="gzt">{{ a.n }}</text>
      </g>
      <g v-for="h in handles" :key="h.n">
        <path :d="h.d" :style="{ fill: h.c, stroke: h.c }" class="arrow" />
        <path :d="h.hit" class="hit" @pointerdown="(e) => startAxis(h, e)" />
        <text :x="h.lx" :y="h.ly" :style="{ fill: h.c }" class="hl">{{ h.n }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
// The 3D view: three.js with an orthographic camera turned by yaw and pitch, the case built
// face by face so cutouts are real holes, the parts, the fill, and an SVG layer on top for the
// axis gizmo and the move arrows.
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import {
  AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, EdgesGeometry, Euler,
  ExtrudeGeometry, Group, Line, LineBasicMaterial, LineDashedMaterial, LineLoop, LineSegments, Mesh, MeshLambertMaterial,
  Object3D, OrthographicCamera, Path, Raycaster, Scene, Shape, ShapeGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Material,
} from "three";
import { CASE } from "./state.ts";
import { D2R, MAT, fx, r3, rectL, type Body, type Face, type P2 } from "./model.ts";
import { getMesh, peekMesh } from "./meshes.ts";

const s = inject(CASE)!;
const host = ref<HTMLDivElement>();
const cv = ref<HTMLCanvasElement>();
const size = reactive({ w: 900, h: 620 });
const orbiting = ref(false);

let renderer: WebGLRenderer | null = null;
const scene = new Scene();
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
const world = new Group();
scene.add(world, camera);
// Flat look of the mock-up: 0.5 + 0.56·max(0, n·l), light from the upper left of the view.
// Lighting runs in linear space, hence the squared-ish intensities.
scene.add(new AmbientLight(0xffffff, 0.22 * Math.PI));
const sun = new DirectionalLight(0xffffff, 0.92 * Math.PI);
sun.position.set(-0.35, 0.6, 0.72);
camera.add(sun, sun.target);

// --- Projection, shared with the SVG overlay -----------------------------------------------
const view = computed(() => {
  const D = s.D.value, ex = s.ui.exploded;
  const yaw = s.ui.yaw * D2R, pit = s.ui.pitch * D2R;
  const S = s.ui.zoom * (ex ? 3.0 : 4.5) * Math.min(1.25, 112 / Math.max(80, D.L));
  const k = Math.min(size.w / 900, size.h / 620);
  return { C: [D.w / 2, D.L / 2, ex ? -15 : D.d / 2] as const, yaw, pit, px: S * k, cyw: Math.cos(yaw), syw: Math.sin(yaw), cp: Math.cos(pit), sp: Math.sin(pit) };
});
/** World direction → view (x right, y up, z toward the viewer). */
const rot = (x: number, y: number, z: number) => {
  const v = view.value;
  const x1 = x * v.cyw + z * v.syw, z1 = -x * v.syw + z * v.cyw;
  return [x1, y * v.cp - z1 * v.sp, y * v.sp + z1 * v.cp];
};
/** World point → overlay pixels. */
const P = (p: number[]) => {
  const v = view.value, r = rot(p[0] - v.C[0], p[1] - v.C[1], p[2] - v.C[2]);
  return [size.w / 2 + r[0] * v.px, size.h / 2 - r[1] * v.px];
};

function placeCamera() {
  const v = view.value;
  camera.left = -size.w / 2 / v.px;
  camera.right = size.w / 2 / v.px;
  camera.top = size.h / 2 / v.px;
  camera.bottom = -size.h / 2 / v.px;
  camera.quaternion.setFromEuler(new Euler(-v.pit, -v.yaw, 0, "YXZ"));
  const back = new Vector3(0, 0, 1500).applyQuaternion(camera.quaternion);
  camera.position.set(v.C[0] + back.x, v.C[1] + back.y, v.C[2] + back.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// --- Colours -------------------------------------------------------------------------------
const css = reactive({ vp: "#151517", grid: "#26262b", brand: "#cb5297", red: "#e8857b", green: "#96dd42" });
function readColours() {
  const root = host.value?.closest(".cd");
  if (!root) return;
  const cs = getComputedStyle(root);
  for (const k of Object.keys(css) as (keyof typeof css)[]) css[k] = cs.getPropertyValue("--" + k).trim() || css[k];
}
const rgb = (c: readonly number[], k = 1) => new Color().setRGB(Math.min(1, (c[0] * k) / 255), Math.min(1, (c[1] * k) / 255), Math.min(1, (c[2] * k) / 255), SRGBColorSpace);

// --- Scene building ------------------------------------------------------------------------
const meshGeo = new Map<string, BufferGeometry>();
const disposables: (BufferGeometry | Material)[] = [];
const keep = <T extends BufferGeometry | Material>(x: T) => (disposables.push(x), x);
const fillEdges = shallowRef<{ key: unknown; geos: BufferGeometry[] } | null>(null);

function geoOfMesh(key: string) {
  let g = meshGeo.get(key);
  if (g) return g;
  const m = peekMesh(key);
  if (!m) {
    getMesh(key).then((x) => x && schedule());
    return null;
  }
  g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(m.positions, 3));
  if (m.indices) g.setIndex(new BufferAttribute(m.indices, 1));
  g.computeVertexNormals();
  meshGeo.set(key, g);
  return g;
}

function lambert(col: readonly number[], o: { k?: number; alpha?: number; side?: boolean } = {}) {
  const m = keep(new MeshLambertMaterial({ color: rgb(col, o.k ?? 1), side: o.side ? DoubleSide : undefined }));
  if (o.alpha != null && o.alpha < 1) {
    m.transparent = true;
    m.opacity = o.alpha;
    m.depthWrite = false;
  }
  return m;
}
const lineMat = (color: string, dashed = false, opacity = 1) =>
  keep(dashed ? new LineDashedMaterial({ color, dashSize: 1.6, gapSize: 1.2, transparent: opacity < 1, opacity }) : new LineBasicMaterial({ color, transparent: opacity < 1, opacity }));

/** Planar face with holes: loops in local (a, b), placed at o + u·a + v·b. */
function planar(loops: P2[][], o: number[], u: number[], v: number[]) {
  const sh = new Shape(loops[0].map(([a, b]) => new Vector2(a, b)));
  for (const h of loops.slice(1)) sh.holes.push(new Path(h.map(([a, b]) => new Vector2(a, b))));
  const g = new ShapeGeometry(sh, 8);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i), b = p.getY(i);
    p.setXYZ(i, o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b);
  }
  g.computeVertexNormals();
  return keep(g);
}
/** Walls of a hole: the loop swept from the outer plane by `depth` along `n`. */
function holeWall(loop: P2[], o: number[], u: number[], v: number[], n: number[], depth: number) {
  const pos: number[] = [];
  const at = (a: number, b: number, t: number) => [o[0] + u[0] * a + v[0] * b + n[0] * t, o[1] + u[1] * a + v[1] * b + n[1] * t, o[2] + u[2] * a + v[2] * b + n[2] * t];
  for (let i = 0; i < loop.length; i++) {
    const [a0, b0] = loop[i], [a1, b1] = loop[(i + 1) % loop.length];
    const p0 = at(a0, b0, 0), p1 = at(a1, b1, 0), q0 = at(a0, b0, depth), q1 = at(a1, b1, depth);
    pos.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return keep(g);
}
function boxEdges(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, dashed = false, opacity = 1) {
  const g = keep(new EdgesGeometry(keep(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0))));
  const l = new LineSegments(g, lineMat(color, dashed, opacity));
  l.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (dashed) l.computeLineDistances();
  return l;
}

const exDZ = (b: Body) => {
  if (!s.ui.exploded) return 0;
  if (b.part?.role === "battery") return 6;
  if (b.part && (b.part.parent || s.children(b.id).length)) return 18;
  if (b.part?.role === "screen") return 30;
  if (b.id === "flex") return 60;
  if (b.id === "cap" || b.id === "plunger") return 50;
  if (b.group === "wheel") return 42;
  return 24;
};

function build() {
  for (const c of [...world.children]) world.remove(c);
  for (const d of disposables.splice(0)) d.dispose();
  const D = s.D.value, ui = s.ui, { w, d, t, L, capIn } = D;
  const ex = ui.exploded;

  // Floor grid, 10 mm, just under the case.
  {
    const pos: number[] = [], gy = -0.3, z0 = ex ? -100 : -30, z1 = ex ? 90 : d + 30;
    for (let x = -40; x <= w + 40; x += 10) pos.push(x, gy, z0, x, gy, z1);
    for (let z = Math.ceil(z0 / 10) * 10; z <= z1; z += 10) pos.push(-40, gy, z, w + 40, gy, z);
    const g = keep(new BufferGeometry());
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    world.add(new LineSegments(g, lineMat(css.grid)));
  }

  // Parts.
  for (const b of D.B) {
    if (s.project.hidden[b.key]) continue;
    const dz = exDZ(b);
    const mat = lambert(MAT[b.mat]);
    let obj: Object3D;
    const geo = b.part?.mesh ? geoOfMesh(b.part.mesh) : null;
    if (geo) {
      obj = new Mesh(geo, mat);
      obj.rotation.z = (b.part!.rot * Math.PI) / 180;
      obj.position.set(b.Xc, b.Yc, b.Zc + dz);
    } else if (b.cyl) {
      const sh = new Shape().absarc(0, 0, b.R, 0, Math.PI * 2, false);
      if (b.rIn) sh.holes.push(new Path().absarc(0, 0, b.rIn, 0, Math.PI * 2, true));
      obj = new Mesh(keep(new ExtrudeGeometry(sh, { depth: b.Z1 - b.Z0, bevelEnabled: false, curveSegments: 48 })), mat);
      obj.position.set(b.Xc, b.Yc, b.Z0 + dz);
    } else {
      obj = new Mesh(keep(new BoxGeometry(b.X1 - b.X0, b.Y1 - b.Y0, b.Z1 - b.Z0)), mat);
      obj.position.set(b.Xc, b.Yc, b.Zc + dz);
    }
    obj.userData.pick = b.key;
    world.add(obj);
    const on = ui.sel === b.key, bad = D.clash[b.key];
    if ((on || bad) && !b.sub) world.add(boxEdges(b.X0, b.X1, b.Y0, b.Y1, b.Z0 + dz, b.Z1 + dz, on ? css.brand : css.red));
  }

  // Case: every face built flat, with its cutouts as holes.
  if (ui.caseMode !== "hidden") {
    const ghost = ui.caseMode === "ghost", dzC = ex ? -70 : 0;
    const g = new Group();
    g.position.z = dzC;
    const out = lambert(MAT.alu, { alpha: ghost ? 0.13 : 1, side: true });
    const inn = lambert(MAT.alu, { k: 0.66, side: true });
    const capCol = s.project.caps === "printed" ? MAT.fill : MAT.alu;
    const capOut = lambert(capCol, { k: s.project.caps === "printed" ? 0.85 : 0.95, alpha: ghost ? 0.13 : 1, side: true });
    const capIn = lambert(capCol, { k: 0.66, side: true });
    const holes = (f: Face) => D.cutsW.filter((c) => c.face === f).map((c) => c.loop);
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    const add = (geo: BufferGeometry, m: Material, inner = false) => {
      if (inner && ghost) return;
      const me = new Mesh(geo, m);
      me.userData.pick = "case";
      g.add(me);
    };
    const wallFaces: [Face, number[], number[], number[], number[], P2[], P2[]][] = [
      ["front", [0, 0, d], X, Y, [0, 0, -1], rectL(0, 0, w, L), rectL(t, capIn, w - t, L - capIn)],
      ["back", [0, 0, 0], X, Y, [0, 0, 1], rectL(0, 0, w, L), rectL(t, capIn, w - t, L - capIn)],
      ["left", [0, 0, 0], Y, Z, [1, 0, 0], rectL(0, 0, L, d), rectL(capIn, t, L - capIn, d - t)],
      ["right", [w, 0, 0], Y, Z, [-1, 0, 0], rectL(0, 0, L, d), rectL(capIn, t, L - capIn, d - t)],
    ];
    for (const [f, o, u, v, n, outer, inner] of wallFaces) {
      const hs = holes(f);
      add(planar([outer, ...hs], o, u, v), out);
      add(planar([inner, ...hs], [o[0] + n[0] * t, o[1] + n[1] * t, o[2] + n[2] * t], u, v), inn, true);
      for (const h of hs) add(holeWall(h, o, u, v, n, t), inn, true);
    }
    // Tube ends.
    for (const y of [0, L]) add(planar([rectL(0, 0, w, d), rectL(t, t, w - t, d - t).reverse()], [0, y, 0], X, Z), out);
    if (s.project.caps !== "open") {
      const ct = s.project.capT;
      for (const [f, y, n] of [["bottom", 0, 1], ["top", L, -1]] as const) {
        const hs = holes(f);
        add(planar([rectL(t, t, w - t, d - t), ...hs], [0, y, 0], X, Z), capOut);
        add(planar([rectL(t, t, w - t, d - t), ...hs], [0, y + n * ct, 0], X, Z), capIn, true);
        for (const h of hs) add(holeWall(h, [0, y, 0], X, Z, [0, n, 0], ct), capIn, true);
      }
    }
    if (ui.sel === "case") g.add(boxEdges(0, w, 0, L, 0, d, css.brand));
    world.add(g);
  }

  // Fill: a dashed preview of the inside in step 5, the real mesh once built.
  const fs = s.fillState.value, built = fs === "done" || fs === "stale";
  if (ui.showFill && (built || ui.step === "fill")) {
    const dzF = ex ? -36 : 0, inr = D.inner;
    const fg = new Group();
    fg.position.z = dzF;
    const fm = s.fillMesh.value;
    if (built && fm) {
      if (fillEdges.value?.key !== fm) fillEdges.value = { key: fm, geos: fm.halves.map((h) => edgesOf(h)) };
      fm.halves.forEach((h, i) => {
        const geo = keep(new BufferGeometry());
        geo.setAttribute("position", new BufferAttribute(h.positions, 3));
        geo.setIndex(new BufferAttribute(h.indices, 1));
        geo.computeVertexNormals();
        fg.add(new Mesh(geo, lambert(MAT.fill, { alpha: 0.2, side: true })));
        fg.add(new LineSegments(fillEdges.value!.geos[i], lineMat("#96dd42", false, 0.75)));
      });
    } else {
      const geo = keep(new BoxGeometry(inr.x1 - inr.x0, inr.y1 - inr.y0, inr.z1 - inr.z0));
      const me = new Mesh(geo, lambert(MAT.fill, { alpha: 0.07 }));
      me.position.set((inr.x0 + inr.x1) / 2, (inr.y0 + inr.y1) / 2, (inr.z0 + inr.z1) / 2);
      fg.add(me, boxEdges(inr.x0, inr.x1, inr.y0, inr.y1, inr.z0, inr.z1, "#96dd42", true, 0.55));
    }
    if (D.splitZ != null) {
      const z = D.splitZ;
      const geo = keep(new BufferGeometry().setFromPoints([new Vector3(inr.x0, inr.y0, z), new Vector3(inr.x1, inr.y0, z), new Vector3(inr.x1, inr.y1, z), new Vector3(inr.x0, inr.y1, z)]));
      const l = new LineLoop(geo, keep(new LineDashedMaterial({ color: css.green, dashSize: 2.4, gapSize: 1.6 })));
      l.computeLineDistances();
      fg.add(l);
    }
    world.add(fg);
  }

  // The selected cutout, outlined on its face.
  if (ui.sel.startsWith("cut:")) {
    const c = D.cutsW.find((x) => "cut:" + x.id === ui.sel);
    if (c) {
      const F: Record<Face, [number[], number[], number[]]> = {
        front: [[0, 0, d + 0.05], [1, 0, 0], [0, 1, 0]], back: [[0, 0, -0.05], [1, 0, 0], [0, 1, 0]],
        left: [[-0.05, 0, 0], [0, 1, 0], [0, 0, 1]], right: [[w + 0.05, 0, 0], [0, 1, 0], [0, 0, 1]],
        bottom: [[0, -0.05, 0], [1, 0, 0], [0, 0, 1]], top: [[0, L + 0.05, 0], [1, 0, 0], [0, 0, 1]],
      };
      const [o, u, v] = F[c.face], dzC = ex ? -70 : 0;
      const pts = c.loop.map(([a, b]) => new Vector3(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b + dzC));
      world.add(new LineLoop(keep(new BufferGeometry().setFromPoints(pts)), lineMat(css.brand)));
    }
  }
  render();
}

function edgesOf(h: { positions: Float32Array; indices: Uint32Array }) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(h.positions, 3));
  g.setIndex(new BufferAttribute(h.indices, 1));
  return new EdgesGeometry(g, 35);
}

let raf = 0;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    build();
  });
}
function render() {
  if (!renderer) return;
  placeCamera();
  renderer.setClearColor(new Color(css.vp), 1);
  renderer.render(scene, camera);
}

// --- Overlay: axis gizmo and move arrows ---------------------------------------------------
const gizmo = computed(() =>
  ([[[1, 0, 0], "X", css.brand], [[0, 1, 0], "Y", css.green], [[0, 0, 1], "Z", "var(--amber)"]] as const).map(([v, n, c]) => {
    const r = rot(v[0], v[1], v[2]), oy = size.h - 60;
    return { n, c, x: (70 + r[0] * 30).toFixed(1), y: (oy - r[1] * 30).toFixed(1), lx: (70 + r[0] * 42).toFixed(1), ly: (oy - r[1] * 42).toFixed(1) };
  }),
);

type Handle = { n: string; c: string; d: string; hit: string; lx: string; ly: string; vx: number; vy: number; cands: { d: number; n: string }[]; apply: (dv: number) => void };
const handles = computed<Handle[]>(() => {
  const D = s.D.value, ui = s.ui;
  const selPart = s.project.parts.find((p) => p.id === ui.sel && !p.parent);
  const wheelSel = ui.sel === "ring" || ui.sel === "flex" || ui.sel === "cap";
  if ((!selPart && !wheelSel) || s.project.hidden[ui.sel]) return [];
  const gid = selPart ? selPart.id : "wheel";
  const GB = D.B.filter((b) => (gid === "wheel" ? b.group === "wheel" : b.group === gid));
  const G = {
    X0: Math.min(...GB.map((b) => b.X0)), X1: Math.max(...GB.map((b) => b.X1)), Y0: Math.min(...GB.map((b) => b.Y0)),
    Y1: Math.max(...GB.map((b) => b.Y1)), Z0: Math.min(...GB.map((b) => b.Z0)), Z1: Math.max(...GB.map((b) => b.Z1)),
  };
  const dz0 = exDZ(selPart ? D.B.find((b) => b.id === selPart.id)! : D.B.find((b) => b.id === "ring")!);
  const cen = P([(G.X0 + G.X1) / 2, (G.Y0 + G.Y1) / 2, (G.Z0 + G.Z1) / 2 + dz0]);
  const inn = D.inner, px = view.value.px;
  const IX = { X: ["X0", "X1"], Y: ["Y0", "Y1"], Z: ["Z0", "Z1"] } as const;
  const WN = {
    X: ["left wall", "right wall", inn.x0, inn.x1], Y: [D.WALLN.y0, D.WALLN.y1, inn.y0, inn.y1], Z: ["back wall", "front wall", inn.z0, inn.z1],
  } as const;
  const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
  const out: Handle[] = [];
  for (const [n, v, col] of [["X", [1, 0, 0], css.brand], ["Y", [0, 1, 0], css.green], ["Z", [0, 0, 1], "var(--amber)"]] as const) {
    if (gid === "wheel" && n === "Z") continue;
    const r = rot(v[0], v[1], v[2]), vx = r[0] * px, vy = -r[1] * px, len = Math.hypot(vx, vy);
    if (len < px * 0.25) continue;
    const ux = vx / len, uy = vy / len, qx = -uy, qy = ux;
    const pt = (m: number) => `${(cen[0] + ux * m).toFixed(1)} ${(cen[1] + uy * m).toFixed(1)}`;
    const tip = [cen[0] + ux * 74, cen[1] + uy * 74], bs = [cen[0] + ux * 60, cen[1] + uy * 60];
    const [lo, hi] = IX[n];
    const oth = (["X", "Y", "Z"] as const).filter((q) => q !== n);
    const cands = [{ d: (WN[n][2] as number) - G[lo], n: WN[n][0] as string }, { d: (WN[n][3] as number) - G[hi], n: WN[n][1] as string }];
    for (const o of D.B) {
      if (gid === "wheel" ? o.group === "wheel" : o.group === gid) continue;
      if (oth.every((q) => ov(o[IX[q][0]], o[IX[q][1]], G[IX[q][0]], G[IX[q][1]]) > 0.01)) {
        cands.push({ d: o[hi] - G[lo], n: o.name }, { d: o[lo] - G[hi], n: o.name });
      }
    }
    const field = gid === "wheel" ? (n === "X" ? "cx" : "cy") : n === "X" ? "cx" : n === "Y" ? "cy" : "cz";
    const start = gid === "wheel" ? s.project.wheel[field as "cx" | "cy"] : selPart![field as "cx" | "cy" | "cz"];
    const sgn = n === "Z" ? -1 : 1;
    const apply = gid === "wheel"
      ? (dv: number) => { s.project.wheel[field as "cx" | "cy"] = r3(start + dv); }
      : (dv: number) => s.setPart(gid, field as "cx" | "cy" | "cz", r3(start + sgn * dv));
    out.push({
      n, c: col, vx, vy, cands, apply,
      d: `M${pt(8)}L${pt(60)}M${tip[0].toFixed(1)} ${tip[1].toFixed(1)}L${(bs[0] + qx * 6).toFixed(1)} ${(bs[1] + qy * 6).toFixed(1)}L${(bs[0] - qx * 6).toFixed(1)} ${(bs[1] - qy * 6).toFixed(1)}Z`,
      hit: `M${pt(10)}L${pt(76)}`, lx: (cen[0] + ux * 90).toFixed(1), ly: (cen[1] + uy * 90).toFixed(1),
    });
  }
  return out;
});
defineExpose({ hasHandles: computed(() => handles.value.length > 0) });

// --- Pointer: orbit, pick, axis drags ------------------------------------------------------
let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
let axis: { x0: number; y0: number; h: Handle; last: number } | null = null;
const ray = new Raycaster();

function startAxis(h: Handle, e: PointerEvent) {
  e.stopPropagation();
  host.value?.setPointerCapture(e.pointerId);
  // The handle's closure holds the start position; keep it for the whole drag.
  axis = { x0: e.clientX, y0: e.clientY, h, last: 0 };
  s.dragStart();
}
function down(e: PointerEvent) {
  if (axis || e.button !== 0) return;
  host.value?.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, yaw: s.ui.yaw, pitch: s.ui.pitch, moved: false };
}
function move(e: PointerEvent) {
  if (axis) {
    const { h } = axis, dx = e.clientX - axis.x0, dy = e.clientY - axis.y0;
    const raw = (dx * h.vx + dy * h.vy) / (h.vx * h.vx + h.vy * h.vy);
    let hit: { d: number; n: string } | null = null;
    for (const c of h.cands) {
      const dd = Math.abs(raw - c.d);
      if (dd < 0.75 && (!hit || dd < Math.abs(raw - hit.d))) hit = c;
    }
    const step = e.shiftKey ? 1 : 0.1;
    const val = r3(hit ? hit.d : Math.round(raw / step) * step);
    if (val !== axis.last) { axis.last = val; h.apply(val); }
    s.ui.dragInfo = `${h.n} ${val >= 0 ? "+" : "−"}${fx(Math.abs(val))} mm${hit ? " · touching " + hit.n : ""}`;
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved) {
    orbiting.value = true;
    s.ui.yaw = drag.yaw - dx * 0.4;
    s.ui.pitch = Math.max(-89.9, Math.min(89.9, drag.pitch + dy * 0.4));
  }
}
function up(e: PointerEvent) {
  if (axis) {
    axis = null;
    s.dragEnd();
    return;
  }
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  orbiting.value = false;
  if (!moved && e.type === "pointerup") pick(e);
}
function pick(e: PointerEvent) {
  const r = cv.value!.getBoundingClientRect();
  ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(world.children, true).filter((h) => h.object.userData.pick);
  // Through a ghost case, a part behind it wins.
  const first = s.ui.caseMode === "ghost" ? hits.find((h) => h.object.userData.pick !== "case") ?? hits[0] : hits[0];
  s.select(first ? first.object.userData.pick : "");
}

// --- Lifecycle -----------------------------------------------------------------------------
let ro: ResizeObserver | null = null;
onMounted(() => {
  renderer = new WebGLRenderer({ canvas: cv.value!, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  readColours();
  ro = new ResizeObserver(() => {
    const r = host.value!.getBoundingClientRect();
    size.w = Math.max(1, r.width);
    size.h = Math.max(1, r.height);
    renderer!.setSize(size.w, size.h, false);
    render();
  });
  ro.observe(host.value!);
  build();
});
onBeforeUnmount(() => {
  ro?.disconnect();
  cancelAnimationFrame(raf);
  for (const d of disposables.splice(0)) d.dispose();
  for (const g of meshGeo.values()) g.dispose();
  fillEdges.value?.geos.forEach((g) => g.dispose());
  renderer?.dispose();
  renderer = null;
});

watch(
  () => [s.D.value, s.ui.sel, s.ui.caseMode, s.ui.exploded, s.ui.showFill, s.ui.step, s.fillState.value, s.fillMesh.value, s.meshVersion.value, s.project.hidden],
  schedule,
  { deep: false },
);
watch(() => s.project.hidden, schedule, { deep: true });
watch(() => [s.ui.yaw, s.ui.pitch, s.ui.zoom], render);
watch(s.isDark, () => requestAnimationFrame(() => { readColours(); build(); }));
</script>

<style scoped>
.v3 {
  position: absolute;
  inset: 0;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.v3.grabbing {
  cursor: grabbing;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.ov {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.gz {
  stroke-width: 2;
  stroke-linecap: round;
}
.gzt,
.hl {
  font-family: var(--mono);
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
}
.gzt {
  font-size: 12px;
}
.hl {
  font-size: 13px;
}
.arrow {
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.hit {
  fill: none;
  stroke: transparent;
  stroke-width: 18;
  stroke-linecap: round;
  cursor: grab;
  pointer-events: stroke;
}
</style>
