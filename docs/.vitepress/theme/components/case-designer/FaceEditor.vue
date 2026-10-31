<template>
  <svg
    ref="svg"
    class="fe"
    viewBox="0 0 900 620"
    preserveAspectRatio="xMidYMid meet"
    role="application"
    tabindex="0"
    :aria-label="`Flat view of the ${FACEN[face]} with its cutouts. Arrow keys nudge the selected cutout, Shift for 1 mm.`"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @keydown="key"
  >
    <rect x="0" y="0" width="900" height="620" class="bg" @click="bgClick" />
    <path :d="base" class="base" />
    <path v-for="(g, i) in grid" :key="'g' + i" :d="g.d" class="grid" :style="{ stroke: g.c }" />
    <path v-for="(p, i) in shapes" :key="'s' + i" :d="p.d" class="shape" :style="{ fill: p.fill, stroke: p.stroke, strokeWidth: p.sw, strokeDasharray: p.dash }" />
    <path
      v-for="c in cuts"
      :key="c.id"
      :d="c.d"
      class="cut"
      :style="{ fill: c.fill, stroke: c.stroke, strokeWidth: c.sw }"
      @pointerdown="(e) => startMove(c.id, e)"
    />
    <path v-for="(g, i) in guides" :key="'u' + i" :d="g" class="guide" />
    <text v-for="(t, i) in texts" :key="'t' + i" :x="t.x" :y="t.y" class="txt" :style="{ fill: t.c, fontSize: t.s, textAnchor: t.a }">{{ t.t }}</text>
    <rect v-if="handle" :x="handle.x" :y="handle.y" width="12" height="12" rx="2" class="handle" @pointerdown="startSize" />
  </svg>
</template>

<script setup lang="ts">
// The Faces view: one face, flat and seen from outside, with the parts behind it as dashed
// footprints and the cutouts as holes you can drag and resize.
import { computed, inject, ref } from "vue";
import { CASE } from "./state.ts";
import { FACEN, MAT, circ, faceFrame, fx, r3, rectL, rgba, type P2 } from "./model.ts";

const s = inject(CASE)!;
const svg = ref<SVGSVGElement>();
const guides = ref<string[]>([]);
const face = computed(() => s.ui.face);

const frame = computed(() => {
  const D = s.D.value, fr = faceFrame(face.value, D.dims);
  const fs = Math.min(760 / fr.FW, 520 / fr.FH), fox = (900 - fr.FW * fs) / 2, foy = (620 - fr.FH * fs) / 2 + 10;
  const SP = (a: number, b: number): P2 => { const q = fr.toF(a, b); return [fox + q[0] * fs, foy + q[1] * fs]; };
  const fp = (pts: P2[], close = true) => "M" + pts.map(([a, b]) => SP(a, b).map((v) => v.toFixed(1)).join(" ")).join("L") + (close ? "Z" : "");
  return { ...fr, fs, fox, foy, SP, fp };
});

const base = computed(() => frame.value.fp(rectL(0, 0, frame.value.ext[0], frame.value.ext[1])));
const grid = computed(() => {
  const F = frame.value, out: { d: string; c: string }[] = [];
  for (let a = 5; a < F.ext[0]; a += 5) out.push({ d: F.fp([[a, 0], [a, F.ext[1]]], false), c: a % 10 ? "var(--grid)" : "var(--line2)" });
  for (let b = 5; b < F.ext[1]; b += 5) out.push({ d: F.fp([[0, b], [F.ext[0], b]], false), c: b % 10 ? "var(--grid)" : "var(--line2)" });
  return out;
});

/** Footprints behind the face, plus the snap targets they give. */
const behind = computed(() => {
  const D = s.D.value, F = frame.value, f = face.value, { w, d, L } = D;
  const shapes: { d: string; fill: string; stroke: string; sw: number; dash: string }[] = [];
  const labels: { x: string; y: string; t: string; c: string; s: string; a: string }[] = [];
  const snapA = F.side ? [{ v: L / 2, n: "middle" }] : [{ v: w / 2, n: "centre line" }];
  const snapB = F.side || F.cap ? [{ v: d / 2, n: "middle" }] : [];
  if (!(F.cap && s.project.caps === "open")) shapes.push({ d: F.fp(rectL(F.reg[0], F.reg[2], F.reg[1], F.reg[3])), fill: "none", stroke: "var(--muted)", sw: 1, dash: "4 4" });
  const near = (b: (typeof D.B)[number]) =>
    f === "left" ? b.X0 < w * 0.3 : f === "right" ? b.X1 > w * 0.7 : f === "bottom" ? b.Y0 < 22 : f === "top" ? b.Y1 > L - 22 : true;
  for (const b of D.B) {
    if (b.sub || s.project.hidden[b.key] || !near(b)) continue;
    const Zc = (b.Z0 + b.Z1) / 2;
    let pts: P2[];
    if (!F.side && !F.cap && b.cyl) pts = circ(b.Xc, b.Yc, b.R, 40);
    else {
      const r = F.side ? [b.Y0, b.Y1, b.Z0, b.Z1] : F.cap ? [b.X0, b.X1, b.Z0, b.Z1] : [b.X0, b.X1, b.Y0, b.Y1];
      pts = rectL(r[0], r[2], r[1], r[3]);
    }
    const on = b.key === s.ui.sel;
    shapes.push({ d: F.fp(pts), fill: rgba(MAT[b.mat], 1, 0.14), stroke: on ? "var(--brand)" : rgba(MAT[b.mat], 1, 0.75), sw: on ? 1.6 : 1, dash: "3 3" });
    if (b.gen && b.id !== "ring") continue;
    const nm = b.id === "ring" ? "Click wheel" : b.name;
    snapA.push({ v: F.side ? b.Yc : b.Xc, n: nm });
    snapB.push({ v: F.side || F.cap ? Zc : b.Yc, n: nm });
    const qs = pts.map(([a, bb]) => F.SP(a, bb)), xs = qs.map((q) => q[0]), ys = qs.map((q) => q[1]);
    if (Math.max(...xs) - Math.min(...xs) > 80 && Math.max(...ys) - Math.min(...ys) > 20)
      labels.push({ x: ((Math.max(...xs) + Math.min(...xs)) / 2).toFixed(1), y: (Math.min(...ys) + 11).toFixed(1), t: nm, c: "var(--muted)", s: "11px", a: "middle" });
  }
  return { shapes, labels, snapA, snapB };
});
const shapes = computed(() => behind.value.shapes);

const cuts = computed(() => {
  const D = s.D.value, F = frame.value;
  return D.cutsW.filter((c) => c.face === face.value).map((c) => {
    const on = s.ui.sel === "cut:" + c.id, st = D.cutStat[c.id].st;
    return {
      id: c.id, d: F.fp(c.loop), sw: on ? 2 : 1.4,
      fill: on ? "var(--brandsoft)" : "var(--vp)",
      stroke: on ? "var(--brand)" : st === "err" ? "var(--red)" : st === "warn" ? "var(--amber)" : "var(--text)",
    };
  });
});
const selCut = computed(() => s.D.value.cutsW.find((c) => "cut:" + c.id === s.ui.sel && c.face === face.value));
const handle = computed(() => {
  const c = selCut.value;
  if (!c) return null;
  const hp = c.shape === "circle" ? frame.value.SP(c.ca + (c.w / 2) * 0.7071, c.cb + (c.w / 2) * 0.7071) : frame.value.SP(c.ca + c.w / 2, c.cb - c.h / 2);
  return { x: (hp[0] - 6).toFixed(1), y: (hp[1] - 6).toFixed(1) };
});

const texts = computed(() => {
  const D = s.D.value, F = frame.value, out = [...behind.value.labels];
  for (const c of D.cutsW.filter((x) => x.face === face.value)) {
    const on = s.ui.sel === "cut:" + c.id;
    const qs = c.loop.map(([a, b]) => F.SP(a, b)), xs = qs.map((q) => q[0]), ys = qs.map((q) => q[1]);
    const dims = c.shape === "circle" ? "Ø" + fx(c.w) : `${fx(c.w)} × ${fx(c.h)}`;
    out.push({ x: ((Math.max(...xs) + Math.min(...xs)) / 2).toFixed(1), y: (Math.max(...ys) + 12).toFixed(1), t: on ? `${c.name} · ${dims}` : c.name, c: on ? "var(--brand)" : "var(--text)", s: "11px", a: "middle" });
  }
  out.push({ x: F.fox.toFixed(1), y: (F.foy - 16).toFixed(1), t: `${FACEN[face.value]} · ${fx(F.FW)} × ${fx(F.FH)} mm`, c: "var(--muted)", s: "12px", a: "start" });
  const edge = (a: number, b: number, t: string) => {
    const p = F.SP(a, b), cx = F.fox + (F.FW * F.fs) / 2, cy = F.foy + (F.FH * F.fs) / 2, dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    out.push({ x: (p[0] + (dx / l) * 16).toFixed(1), y: (p[1] + (dy / l) * 16).toFixed(1), t, c: "var(--muted)", s: "11px", a: "middle" });
  };
  const { w, d, L } = D;
  if (F.side) { edge(L, d / 2, "top"); edge(L / 2, d, "front"); }
  else if (F.cap) edge(w / 2, d, "front");
  else edge(w / 2, 0, "bottom");
  if (F.cap && s.project.caps === "open") out.push({ x: (F.fox + (F.FW * F.fs) / 2).toFixed(1), y: (F.foy + (F.FH * F.fs) / 2).toFixed(1), t: "Open end: no cap to cut", c: "var(--muted)", s: "13px", a: "middle" });
  return out;
});

// --- Dragging ------------------------------------------------------------------------------
type Drag = { move: (e: PointerEvent) => void };
let fdrag: Drag | null = null;
let movedFlag = false;

/** Pointer → viewBox units, and viewBox units per screen pixel. */
function vb(e: PointerEvent) {
  const m = svg.value!.getScreenCTM()!;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y, k: 1 / m.a };
}
const offA = () => (frame.value.side ? 0 : s.D.value.w / 2);

function startMove(id: string, e: PointerEvent) {
  e.stopPropagation();
  svg.value!.setPointerCapture(e.pointerId);
  movedFlag = false;
  s.dragStart();
  s.unlink(id);
  s.select("cut:" + id);
  const c0 = s.D.value.cutsW.find((c) => c.id === id)!;
  const x0 = e.clientX, y0 = e.clientY, ca0 = c0.ca, cb0 = c0.cb;
  const near1 = (list: { v: number; n: string }[], val: number) => {
    let h: { v: number; n: string } | null = null;
    for (const o of list) { const dd = Math.abs(o.v - val); if (dd < 0.8 && (!h || dd < Math.abs(h.v - val))) h = o; }
    return h;
  };
  fdrag = {
    move: (ev) => {
      const F = frame.value, { k } = vb(ev), d = s.D.value.d;
      const dX = ((ev.clientX - x0) * k) / F.fs, dY = ((ev.clientY - y0) * k) / F.fs;
      if (Math.abs(dX) + Math.abs(dY) > 0.3) movedFlag = true;
      const dd = F.dAB(dX, dY), step = ev.shiftKey ? 1 : 0.1;
      let a = ca0 + dd[0], b = cb0 + dd[1];
      const ha = near1(behind.value.snapA, a), hb = near1(behind.value.snapB, b), gs: string[] = [], info: string[] = [];
      if (ha) { a = ha.v; gs.push(F.fp([[a, 0], [a, F.ext[1]]], false)); info.push(ha.n); }
      if (hb) { b = hb.v; gs.push(F.fp([[0, b], [F.ext[0], b]], false)); info.push(hb.n); }
      let u = a - offA(), v = F.side || F.cap ? d - b : b;
      if (!ha) u = Math.round(u / step) * step;
      if (!hb) v = Math.round(v / step) * step;
      s.setCut(id, { u: r3(u), v: r3(v), follow: false });
      guides.value = gs;
      s.ui.dragInfo = `${F.side ? "Y " : "X "}${fx(u)} · ${F.side || F.cap ? "depth " : "Y "}${fx(v)} mm${info.length ? " · on " + info.join(", ") : ""}`;
    },
  };
}
function startSize(e: PointerEvent) {
  const c0 = selCut.value;
  if (!c0) return;
  e.stopPropagation();
  svg.value!.setPointerCapture(e.pointerId);
  s.dragStart();
  s.unlink(c0.id);
  const { id, shape, ca, cb } = c0;
  fdrag = {
    move: (ev) => {
      movedFlag = true;
      const F = frame.value, p = vb(ev), ab = F.fromF((p.x - F.fox) / F.fs, (p.y - F.foy) / F.fs), step = ev.shiftKey ? 0.5 : 0.1;
      const q = (v: number) => Math.max(0.5, Math.round(v / step) * step);
      if (shape === "circle") {
        const D = r3(q(2 * Math.hypot(ab[0] - ca, ab[1] - cb)));
        s.setCut(id, { w: D, h: D });
        s.ui.dragInfo = `Ø${fx(D)} mm`;
      } else {
        const nw = r3(q(2 * Math.abs(ab[0] - ca))), nh = r3(q(2 * Math.abs(ab[1] - cb)));
        s.setCut(id, { w: nw, h: nh });
        s.ui.dragInfo = `${fx(nw)} × ${fx(nh)} mm`;
      }
    },
  };
}
function move(e: PointerEvent) { fdrag?.move(e); }
function up() {
  if (!fdrag) return;
  fdrag = null;
  guides.value = [];
  s.dragEnd();
}
function bgClick() {
  if (!movedFlag) s.select("");
  movedFlag = false;
}

/** Arrow keys nudge the selected cutout: 0.1 mm, Shift for 1 mm. */
function key(e: KeyboardEvent) {
  const c = selCut.value;
  const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!c || !dirs[e.key]) return;
  e.preventDefault();
  const step = e.shiftKey ? 1 : 0.1, F = frame.value;
  const [da, db] = F.dAB(dirs[e.key][0] * step, dirs[e.key][1] * step);
  s.unlink(c.id);
  const raw = s.project.cuts.find((x) => x.id === c.id)!;
  s.setCut(c.id, { u: r3(raw.u + da), v: r3(raw.v + (F.side || F.cap ? -db : db)) });
}
</script>

<style scoped>
.fe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  outline: none;
  touch-action: none;
  user-select: none;
}
.fe:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}
.bg {
  fill: transparent;
}
.base {
  fill: var(--surface2);
  stroke: var(--line2);
  stroke-width: 1.5;
  pointer-events: none;
}
.grid {
  fill: none;
  stroke-width: 1;
  pointer-events: none;
}
.shape {
  fill-rule: evenodd;
  pointer-events: none;
}
.cut {
  stroke-linejoin: round;
  cursor: move;
}
.guide {
  fill: none;
  stroke: var(--brand);
  stroke-width: 1;
  stroke-dasharray: 5 4;
  pointer-events: none;
}
.txt {
  font-family: var(--mono);
  dominant-baseline: middle;
  pointer-events: none;
}
.handle {
  fill: var(--surface);
  stroke: var(--brand);
  stroke-width: 2;
  cursor: nwse-resize;
}
</style>
