// The case designer's project model and everything derived from it: the stock, world bounds of
// every part, the wheel stack, the cutouts in face coordinates, and the live checks.
// Pure: no Vue, no DOM, so the fill worker and the exporters can use it too.
import STOCK_LIST from "./stock.json";

export const D2R = Math.PI / 180;

/** Material colours, 0..255, the same in both themes. */
export const MAT = {
  alu: [182, 187, 195],
  pcb: [52, 120, 74],
  conn: [168, 172, 180],
  tact: [88, 90, 98],
  screen: [48, 52, 66],
  batt: [212, 172, 92],
  plastic: [234, 226, 206],
  flex: [214, 138, 52],
  fill: [150, 221, 66],
} as const;
export type Mat = keyof typeof MAT;
export const MAT_NAMES: Record<Mat, string> = {
  alu: "Aluminium", pcb: "PCB", conn: "Connector", tact: "Tactile switch", screen: "Screen",
  batt: "Battery", plastic: "Printed plastic", flex: "Flex (polyimide)", fill: "Fill",
};

export type Face = "front" | "back" | "left" | "right" | "top" | "bottom";
export const FACES: Face[] = ["front", "back", "left", "right", "top", "bottom"];
export const FACEN: Record<Face, string> = {
  front: "front face", back: "back face", left: "left side", right: "right side", top: "top cap", bottom: "bottom cap",
};
export const FACE_TAB: Record<Face, string> = {
  front: "Front", back: "Back", left: "Left", right: "Right", top: "Top cap", bottom: "Bottom cap",
};

/** What a part is for. Cutouts and wheel bumps find their part by role. */
export type Role = "" | "usb" | "jack" | "sd" | "hold" | "menu" | "next" | "play" | "prev" | "select" | "screen" | "battery";
export const ROLES: [Role, string][] = [
  ["", "No role"], ["usb", "USB-C"], ["jack", "Headphone jack"], ["sd", "microSD"], ["hold", "Hold switch"],
  ["menu", "Menu switch"], ["next", "Next switch"], ["play", "Play switch"], ["prev", "Prev switch"],
  ["select", "Select switch"], ["screen", "Screen"], ["battery", "Battery"],
];
/** Bump angle (degrees, counter-clockwise from +X) of each wheel switch. */
export const BUMPS: [Role, string, number][] = [["menu", "Menu", 90], ["next", "Next", 0], ["play", "Play", 270], ["prev", "Prev", 180]];

export type StockDef = { id: string; kind: string; w?: number; d?: number; t?: number; r?: number; u?: boolean };
export const STOCK = STOCK_LIST as StockDef[];
export type Stock = { id: string; kind: string; w: number; d: number; t: number; r: number; u?: boolean };

export type Part = {
  id: string;
  name: string;
  /** Source file, or "" for a placeholder box. */
  file: string;
  ref?: string;
  /** Board this part belongs to: it follows the board and can't move on its own. */
  parent?: string;
  role: Role;
  mat: Mat;
  /** Centre: offset from the centre line, height from the bottom, depth below the front outer face. */
  cx: number;
  cy: number;
  cz: number;
  /** Size along X, Y, Z (after rotation). */
  sx: number;
  sy: number;
  sz: number;
  /** Quarter turns about Z, in degrees. */
  rot: number;
  /** Hash of the mesh in the mesh store; none for a placeholder box. */
  mesh?: string;
};

export type CutShape = "rect" | "slot" | "circle";
export type Cut = {
  id: string;
  name: string;
  face: Face;
  shape: CutShape;
  w: number;
  h: number;
  r: number;
  u: number;
  v: number;
  /** Part id or role it follows, or "wheel". */
  link: string | null;
  follow: boolean;
};

export type Wheel = {
  cx: number; cy: number; R: number; rIn: number; flexIn: number; ringT: number;
  clear: number; bumpH: number; bumpR: number; bumpPos: number; capR: number;
};

export type FillParams = {
  method: "voxel" | "sdf";
  clear: number;
  minWall: number;
  res: number;
  smooth: number;
  split: "none" | "pcb" | "z";
  splitZ: number;
  channel: boolean;
  builtHash: string | null;
};

export type ExportKey = "case" | "caps" | "wheel" | "button" | "fill" | "sheet" | "project";
export type ExportSettings = {
  on: Record<ExportKey, boolean>;
  fmt: {
    wheel: { step: boolean; stl: boolean };
    button: { step: boolean; stl: boolean };
    fill: { "3mf": boolean; stl: boolean; step: boolean };
  };
};

export type Caps = "alu" | "printed" | "open";
export type Project = {
  version: 1;
  name: string;
  stock: { id: string; custom: { w: number; d: number; t: number; r: number } };
  L: number;
  caps: Caps;
  capT: number;
  parts: Part[];
  hidden: Record<string, boolean>;
  cuts: Cut[];
  toolD: number;
  wheel: Wheel;
  fill: FillParams;
  export: ExportSettings;
  nCut: number;
};

// --- Sample project (placeholders until the real models are imported) ------------------
const box = (p: Partial<Part> & Pick<Part, "id" | "name" | "mat" | "cx" | "cy" | "cz" | "sx" | "sy" | "sz">): Part =>
  ({ file: "", role: "", rot: 0, ...p });

export const SAMPLE_PARTS: Part[] = [
  box({ id: "pcb", name: "Main PCB", file: "opentone-main.step", mat: "pcb", cx: 0, cy: 55, cz: 6.8, sx: 54, sy: 104, sz: 1.6 }),
  box({ id: "usb", name: "USB-C receptacle", ref: "J1", parent: "pcb", role: "usb", mat: "conn", cx: 0, cy: 5.3, cz: 4.4, sx: 9, sy: 7.4, sz: 3.2 }),
  box({ id: "jack", name: "Jack 3.5 mm", ref: "J2", parent: "pcb", role: "jack", mat: "conn", cx: 15, cy: 7.6, cz: 3.55, sx: 6, sy: 12, sz: 4.9 }),
  box({ id: "sd", name: "microSD socket", ref: "J3", parent: "pcb", role: "sd", mat: "conn", cx: -23.4, cy: 77.5, cz: 8.5, sx: 14, sy: 15, sz: 1.8 }),
  box({ id: "hold", name: "Hold switch", ref: "SW1", parent: "pcb", role: "hold", mat: "conn", cx: -18, cy: 107.2, cz: 5.2, sx: 8, sy: 6.4, sz: 1.6 }),
  box({ id: "sw2", name: "Menu switch", ref: "SW2", parent: "pcb", role: "menu", mat: "tact", cx: 0, cy: 43, cz: 5.25, sx: 3.5, sy: 3.5, sz: 1.5 }),
  box({ id: "sw3", name: "Next switch", ref: "SW3", parent: "pcb", role: "next", mat: "tact", cx: 14, cy: 29, cz: 5.25, sx: 3.5, sy: 3.5, sz: 1.5 }),
  box({ id: "sw4", name: "Play switch", ref: "SW4", parent: "pcb", role: "play", mat: "tact", cx: 0, cy: 15, cz: 5.25, sx: 3.5, sy: 3.5, sz: 1.5 }),
  box({ id: "sw5", name: "Prev switch", ref: "SW5", parent: "pcb", role: "prev", mat: "tact", cx: -14, cy: 29, cz: 5.25, sx: 3.5, sy: 3.5, sz: 1.5 }),
  box({ id: "sw6", name: "Select switch", ref: "SW6", parent: "pcb", role: "select", mat: "tact", cx: 0, cy: 29, cz: 5.25, sx: 3.5, sy: 3.5, sz: 1.5 }),
  box({ id: "screen", name: "Screen module", file: "screen-2in4.step", role: "screen", mat: "screen", cx: 0, cy: 80, cz: 2.85, sx: 44, sy: 52, sz: 2.7 }),
  box({ id: "batt", name: "LiPo 503450", file: "lipo-503450.stl", role: "battery", mat: "batt", cx: 4, cy: 75, cz: 11.1, sx: 34, sy: 50, sz: 5 }),
];

export const SAMPLE_CUTS: Cut[] = [
  { id: "cScreen", name: "Screen window", face: "front", shape: "rect", w: 38, h: 47, r: 1.5, link: "screen", follow: true, u: 0, v: 80 },
  { id: "cWheel", name: "Click wheel", face: "front", shape: "circle", w: 38.6, h: 38.6, r: 0, link: "wheel", follow: true, u: 0, v: 29 },
  { id: "cUsb", name: "USB-C", face: "bottom", shape: "slot", w: 9.4, h: 3.6, r: 0, link: "usb", follow: true, u: 0, v: 4.4 },
  { id: "cJack", name: "Headphone jack", face: "bottom", shape: "circle", w: 6.2, h: 6.2, r: 0, link: "jack", follow: true, u: 15, v: 3.55 },
  { id: "cSd", name: "microSD slot", face: "left", shape: "slot", w: 12, h: 2, r: 0, link: "sd", follow: true, u: 77.5, v: 8.5 },
  { id: "cHold", name: "Hold switch", face: "top", shape: "slot", w: 7, h: 2.6, r: 0, link: "hold", follow: true, u: -18, v: 5.2 },
];

export const DEFAULT_WHEEL: Wheel = { cx: 0, cy: 29, R: 19, rIn: 10, flexIn: 9.5, ringT: 2.7, clear: 0.3, bumpH: 1.2, bumpR: 1.5, bumpPos: 14, capR: 9.25 };

export function sampleProject(): Project {
  return structuredClone({
    version: 1,
    name: "player-v2",
    stock: { id: "r6020a", custom: { w: 60, d: 18, t: 1.5, r: 1 } },
    L: 112,
    caps: "alu",
    capT: 1.5,
    parts: SAMPLE_PARTS,
    hidden: {},
    cuts: SAMPLE_CUTS,
    toolD: 3,
    wheel: DEFAULT_WHEEL,
    fill: { method: "sdf", clear: 0.2, minWall: 0.8, res: 0.4, smooth: 1.5, split: "pcb", splitZ: 12, channel: true, builtHash: null },
    export: {
      on: { case: true, caps: true, wheel: true, button: true, fill: true, sheet: true, project: true },
      fmt: { wheel: { step: true, stl: true }, button: { step: true, stl: true }, fill: { "3mf": true, stl: false, step: false } },
    },
    nCut: 0,
  } satisfies Project);
}

// --- Helpers -------------------------------------------------------------------------------
/** Number for display: at most two decimals, no "-0". */
export const fx = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toString();
};
export const r3 = (v: number) => Math.round(v * 1000) / 1000;
export const rgba = (c: readonly number[], k = 1, a = 1) =>
  `rgba(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))},${a})`;

export type P2 = [number, number];
/** Rounded rectangle outline, counter-clockwise, `seg` segments per corner. */
export function rrect(cx: number, cy: number, w: number, h: number, r: number, seg = 6): P2[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts: P2[] = [];
  const cs: [number, number, number][] = [
    [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, 90],
    [cx - w / 2 + r, cy - h / 2 + r, 180], [cx + w / 2 - r, cy - h / 2 + r, 270],
  ];
  for (const [x, y, a0] of cs) {
    if (r < 0.01) { pts.push([x, y]); continue; }
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + (90 * i) / seg) * D2R;
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  }
  return pts;
}
export function circ(cx: number, cy: number, r: number, n = 40): P2[] {
  const p: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}
export const rectL = (a0: number, b0: number, a1: number, b1: number): P2[] => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];

/** Cross-section icon (44 × 30): outer minus inner, evenodd; the U-channel draws its lid apart. */
export function profIcon(sw: number, sd: number, stt: number, u?: boolean) {
  const k = Math.min(40 / sw, 26 / sd), W = sw * k, H = sd * k, T = Math.max(1.3, stt * k), x0 = (44 - W) / 2, y0 = (30 - H) / 2;
  const R = (x: number, y: number, w: number, h: number) => `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}Z`;
  if (u) return R(x0, y0, W, T) + R(x0, y0 + T + 1, W, H - T - 1) + R(x0 + T, y0 + T + 1, W - 2 * T, H - 2 * T - 1);
  return R(x0, y0, W, H) + R(x0 + T, y0 + T, W - 2 * T, H - 2 * T);
}

export function stockOf(p: Project): Stock {
  if (p.stock.id === "custom") return { id: "custom", kind: "Custom profile", ...p.stock.custom };
  return (STOCK.find((x) => x.id === p.stock.id) ?? STOCK[0]) as Stock;
}

// --- Face coordinates ----------------------------------------------------------------------
export type Dims = { w: number; d: number; t: number; L: number; capIn: number };
export const isSide = (f: Face) => f === "left" || f === "right";
export const isCap = (f: Face) => f === "top" || f === "bottom";

/** One face, seen from outside: local (a, b) ↔ screen (x, y down), and its extents. */
export function faceFrame(f: Face, { w, d, t, L, capIn }: Dims) {
  const side = isSide(f), cap = isCap(f);
  const ext: P2 = side ? [L, d] : cap ? [w, d] : [w, L];
  const FW = side ? d : w, FH = cap ? d : L;
  const toF = (a: number, b: number): P2 => {
    switch (f) {
      case "front": return [a, L - b];
      case "back": return [w - a, L - b];
      case "left": return [b, L - a];
      case "right": return [d - b, L - a];
      case "top": return [a, b];
      default: return [w - a, b];
    }
  };
  const fromF = (x: number, y: number): P2 => {
    switch (f) {
      case "front": return [x, L - y];
      case "back": return [w - x, L - y];
      case "left": return [L - y, x];
      case "right": return [L - y, d - x];
      case "top": return [x, y];
      default: return [w - x, y];
    }
  };
  /** Screen delta → local (a, b) delta. */
  const dAB = (dX: number, dY: number): P2 =>
    ({ front: [dX, -dY], back: [-dX, -dY], left: [-dY, dX], right: [-dY, -dX], top: [dX, dY], bottom: [-dX, dY] } as Record<Face, P2>)[f];
  /** Cuttable region [a0, a1, b0, b1]: between the walls and the caps. */
  const reg = side ? [capIn, L - capIn, t, d - t] : cap ? [t, w - t, t, d - t] : [t, w - t, capIn, L - capIn];
  return { side, cap, ext, FW, FH, toF, fromF, dAB, reg };
}

/** World point of local (a, b) on a face, on its outer plane. */
export function faceToWorld(f: Face, a: number, b: number, { w, d, L }: Dims): [number, number, number] {
  switch (f) {
    case "front": return [a, b, d];
    case "back": return [a, b, 0];
    case "left": return [0, a, b];
    case "right": return [w, a, b];
    case "top": return [a, L, b];
    default: return [a, 0, b];
  }
}

// --- Derived model -------------------------------------------------------------------------
export type Body = {
  /** Selection key: a part id, or "ring" / "flex" / "cap" for the wheel. */
  key: string;
  id: string;
  name: string;
  mat: Mat;
  group: string;
  part?: Part;
  cyl?: boolean;
  gen?: boolean;
  /** Passes through the front cutout, so it may poke past the front wall. */
  through?: boolean;
  /** Selected as part of another body (bumps → ring, plunger → cap). */
  sub?: boolean;
  R: number;
  rIn: number;
  ang?: number;
  short?: string;
  Xc: number; Yc: number; Zc: number;
  X0: number; X1: number; Y0: number; Y1: number; Z0: number; Z1: number;
};
export type CutW = Cut & { ca: number; cb: number; loop: P2[]; target?: Body | null };
export type Issue = { id: string; text: string };
export type CutStat = { st: "ok" | "warn" | "err"; milled: boolean };
export type BumpRow = { name: string; ref: string; off: number | null; pre: number | null };
export type Gap = { pair: string; g: number };
export type Inner = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

export const FLEX_T = 0.3;

/** Group of a body for the clash tests: a board with its children, or the wheel pieces. */
export function derive(p: Project) {
  const st = stockOf(p), w = st.w, d = st.d, t = st.t, L = p.L, wh = p.wheel, fl = p.fill;
  const capIn = p.caps === "open" ? 0 : p.capT;
  const dims: Dims = { w, d, t, L, capIn };
  const inner: Inner = { x0: t, x1: w - t, y0: capIn, y1: L - capIn, z0: t, z1: d - t };

  // World bodies.
  const B: Body[] = [];
  for (const q of p.parts) {
    const Xc = w / 2 + q.cx, Zc = d - q.cz;
    B.push({
      key: q.id, id: q.id, name: q.name, mat: q.mat, group: q.parent || q.id, part: q, R: 0, rIn: 0,
      X0: Xc - q.sx / 2, X1: Xc + q.sx / 2, Y0: q.cy - q.sy / 2, Y1: q.cy + q.sy / 2, Z0: Zc - q.sz / 2, Z1: Zc + q.sz / 2,
      Xc, Yc: q.cy, Zc,
    });
  }
  const WX = w / 2 + wh.cx, WY = wh.cy;
  const ringF = d - FLEX_T, ringB = ringF - wh.ringT, bumpB = ringB - wh.bumpH;
  const cyl = (key: string, id: string, name: string, mat: Mat, Xc: number, Yc: number, R: number, rIn: number, Z0: number, Z1: number, extra: Partial<Body> = {}): Body => ({
    key, id, name, mat, group: "wheel", cyl: true, gen: true, Xc, Yc, R, rIn,
    X0: Xc - R, X1: Xc + R, Y0: Yc - R, Y1: Yc + R, Z0, Z1, Zc: (Z0 + Z1) / 2, ...extra,
  });
  B.push(cyl("flex", "flex", "Click wheel flex PCB", "flex", WX, WY, wh.R, wh.flexIn, ringF, d, { through: true }));
  B.push(cyl("ring", "ring", "Wheel exoskeleton", "plastic", WX, WY, wh.R, wh.rIn, ringB, ringF, { through: true }));
  const bumps: Body[] = BUMPS.map(([role, nm, a]) => {
    const b = cyl("ring", "bump-" + role, nm + " bump", "plastic", WX + wh.bumpPos * Math.cos(a * D2R), WY + wh.bumpPos * Math.sin(a * D2R), wh.bumpR, 0, bumpB, ringB, { sub: true, ang: a, short: nm });
    B.push(b);
    return b;
  });
  B.push(cyl("cap", "cap", "Centre button", "plastic", WX, WY, wh.capR, 0, ringB, d, { through: true }));
  const plunger = cyl("cap", "plunger", "Centre plunger", "plastic", WX, WY, 2, 0, bumpB, ringB, { sub: true });
  B.push(plunger);
  const byId = (id: string) => B.find((b) => b.id === id);
  /** A cutout's link: a part id, else the first part with that role. */
  const target = (link: string | null): Body | null => {
    if (!link) return null;
    if (link === "wheel") return byId("ring") ?? null;
    return byId(link) ?? B.find((b) => b.part?.role === link) ?? null;
  };

  // Cutouts, in face coordinates.
  const cutsW: CutW[] = p.cuts.map((c) => {
    let u = c.u, v = c.v, cw = c.w, ch = c.h;
    const tb = target(c.link);
    if (tb && c.follow) {
      const Zc = c.link === "wheel" ? d : tb.Zc;
      if (c.face === "front" || c.face === "back") { u = tb.Xc - w / 2; v = tb.Yc; }
      else if (isSide(c.face)) { u = tb.Yc; v = d - Zc; }
      else { u = tb.Xc - w / 2; v = d - Zc; }
    }
    if (c.link === "wheel" && c.follow) cw = ch = Math.round(2 * (wh.R + wh.clear) * 100) / 100;
    if (c.shape === "circle") ch = cw;
    const ca = isSide(c.face) ? u : w / 2 + u;
    const cb = c.face === "front" || c.face === "back" ? v : d - v;
    const loop = c.shape === "circle" ? circ(ca, cb, cw / 2, 40) : rrect(ca, cb, cw, ch, c.shape === "slot" ? Math.min(cw, ch) / 2 : c.r, 6);
    return { ...c, u, v, w: cw, h: ch, ca, cb, loop, target: tb };
  });

  // Checks.
  const errs: Issue[] = [], warns: Issue[] = [], clash: Record<string, boolean> = {};
  const WALLN = {
    x0: "left wall", x1: "right wall",
    y0: p.caps === "open" ? "bottom end" : "bottom cap", y1: p.caps === "open" ? "top end" : "top cap",
    z0: "back wall", z1: "front wall",
  };
  for (const b of B) {
    const ex: Record<string, number> = { x0: inner.x0 - b.X0, x1: b.X1 - inner.x1, y0: inner.y0 - b.Y0, y1: b.Y1 - inner.y1, z0: inner.z0 - b.Z0, z1: b.Z1 - inner.z1 };
    if (b.through) delete ex.z1;
    let k: string | null = null, m = 0.01;
    for (const kk in ex) if (ex[kk] > m) { m = ex[kk]; k = kk; }
    if (k) { errs.push({ id: b.key, text: `${b.name} runs ${fx(m)} mm into the ${WALLN[k as keyof typeof WALLN]}.` }); clash[b.key] = true; }
  }
  const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    if (a.group === b.group) continue;
    const oz = ov(a.Z0, a.Z1, b.Z0, b.Z1);
    if (oz <= 0.01) continue;
    let dep: number;
    if (a.cyl && b.cyl) {
      const dd = Math.hypot(a.Xc - b.Xc, a.Yc - b.Yc);
      dep = a.R + b.R - dd;
      if ((b.rIn && dd + a.R < b.rIn) || (a.rIn && dd + b.R < a.rIn)) dep = -1;
    } else if (a.cyl || b.cyl) {
      const c = a.cyl ? a : b, r = a.cyl ? b : a;
      const px = Math.max(r.X0, Math.min(c.Xc, r.X1)), py = Math.max(r.Y0, Math.min(c.Yc, r.Y1));
      dep = c.R - Math.hypot(px - c.Xc, py - c.Yc);
      if (c.rIn) {
        const far = Math.max(
          Math.hypot(r.X0 - c.Xc, r.Y0 - c.Yc), Math.hypot(r.X1 - c.Xc, r.Y0 - c.Yc),
          Math.hypot(r.X0 - c.Xc, r.Y1 - c.Yc), Math.hypot(r.X1 - c.Xc, r.Y1 - c.Yc),
        );
        if (far < c.rIn) dep = -1;
      }
    } else dep = Math.min(ov(a.X0, a.X1, b.X0, b.X1), ov(a.Y0, a.Y1, b.Y0, b.Y1));
    if (dep > 0.01) {
      errs.push({ id: a.key, text: `${a.name} and ${b.name} overlap by ${fx(Math.min(dep, oz))} mm.` });
      clash[a.key] = true;
      clash[b.key] = true;
    }
  }
  if (wh.capR > wh.rIn - 0.2) errs.push({ id: "cap", text: `Centre button needs at least 0.2 mm of play inside the ring (now ${fx(wh.rIn - wh.capR)} mm).` });
  if (wh.bumpPos + wh.bumpR > wh.R || wh.bumpPos - wh.bumpR < wh.rIn)
    warns.push({ id: "ring", text: `Bumps hang off the exoskeleton ring. Keep them between ${fx(wh.rIn + wh.bumpR)} and ${fx(wh.R - wh.bumpR)} mm from the centre.` });
  const switchOf = (role: Role) => B.find((b) => b.part?.role === role);
  const bumpRows: BumpRow[] = bumps.map((b, i) => {
    const tc = switchOf(BUMPS[i][0]);
    const off = tc ? Math.hypot(tc.Xc - b.Xc, tc.Yc - b.Yc) : null, pre = tc ? b.Z0 - tc.Z1 : null;
    const ref = tc ? tc.part!.ref || tc.name : "—";
    if (off != null && off > 0.5) warns.push({ id: "ring", text: `${b.short} bump misses ${ref} by ${fx(off)} mm.` });
    return { name: b.short!, ref, off, pre };
  });
  const ctc = switchOf("select");
  bumpRows.push({
    name: "Select", ref: ctc ? ctc.part!.ref || ctc.name : "—",
    off: ctc ? Math.hypot(ctc.Xc - WX, ctc.Yc - WY) : null, pre: ctc ? plunger.Z0 - ctc.Z1 : null,
  });
  for (const r of bumpRows) if (r.pre != null && r.pre > 0.6) warns.push({ id: "ring", text: `${r.name} has ${fx(r.pre)} mm of dead travel before it reaches ${r.ref}.` });

  const toolR = p.toolD / 2;
  const cutStat: Record<string, CutStat> = {};
  for (const c of cutsW) {
    const cap = isCap(c.face);
    const milled = !cap || p.caps === "alu";
    const reg = faceFrame(c.face, dims).reg;
    const as = c.loop.map((q) => q[0]), bs = c.loop.map((q) => q[1]);
    const over = Math.max(reg[0] - Math.min(...as), Math.max(...as) - reg[1], reg[2] - Math.min(...bs), Math.max(...bs) - reg[3]);
    let s: CutStat["st"] = "ok";
    if (cap && p.caps === "open") { errs.push({ id: "cut:" + c.id, text: `${c.name} sits on an end cap, but the ends are open.` }); s = "err"; }
    else if (over > 0.01) { errs.push({ id: "cut:" + c.id, text: `${c.name} cutout runs ${fx(over)} mm past the edge of the ${FACEN[c.face]}.` }); s = "err"; }
    if (milled) {
      let msg: string | null = null;
      if (c.shape === "rect" && c.r < toolR - 1e-6)
        msg = c.r < 0.01 ? `${c.name} has sharp inside corners; no end mill can cut them.` : `${c.name}: ${fx(c.r)} mm corners are tighter than the Ø${p.toolD} end mill.`;
      if (c.shape === "slot" && Math.min(c.w, c.h) < p.toolD - 1e-6) msg = `${c.name}: the ${fx(Math.min(c.w, c.h))} mm slot is narrower than the Ø${p.toolD} end mill.`;
      if (c.shape === "circle" && c.w < p.toolD - 1e-6) msg = `${c.name}: Ø${fx(c.w)} hole is smaller than the Ø${p.toolD} end mill.`;
      if (msg) { warns.push({ id: "cut:" + c.id, text: msg }); if (s === "ok") s = "warn"; }
    }
    cutStat[c.id] = { st: s, milled };
  }

  // Fill analysis: thin gaps between pairs that the fill can't bridge.
  const need = 2 * fl.clear + fl.minWall;
  const BIG = 1e4;
  type Box = { name: string; group: string; wall?: boolean; X0: number; X1: number; Y0: number; Y1: number; Z0: number; Z1: number };
  const walls: Box[] = [
    { name: "back wall", X0: -BIG, X1: BIG, Y0: -BIG, Y1: BIG, Z0: -BIG, Z1: inner.z0 },
    { name: "front wall", X0: -BIG, X1: BIG, Y0: -BIG, Y1: BIG, Z0: inner.z1, Z1: BIG },
    { name: "left wall", X0: -BIG, X1: inner.x0, Y0: -BIG, Y1: BIG, Z0: -BIG, Z1: BIG },
    { name: "right wall", X0: inner.x1, X1: BIG, Y0: -BIG, Y1: BIG, Z0: -BIG, Z1: BIG },
    { name: WALLN.y0, X0: -BIG, X1: BIG, Y0: -BIG, Y1: inner.y0, Z0: -BIG, Z1: BIG },
    { name: WALLN.y1, X0: -BIG, X1: BIG, Y0: inner.y1, Y1: BIG, Z0: -BIG, Z1: BIG },
  ].map((x) => ({ ...x, wall: true, group: "w-" + x.name }));
  const thin: Gap[] = [];
  const objs: Box[] = (B.filter((b) => !b.sub) as Box[]).concat(walls);
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
    const a = objs[i], b = objs[j];
    if (a.group === b.group || (a.wall && b.wall)) continue;
    const o = [ov(a.X0, a.X1, b.X0, b.X1), ov(a.Y0, a.Y1, b.Y0, b.Y1), ov(a.Z0, a.Z1, b.Z0, b.Z1)];
    for (let ax = 0; ax < 3; ax++) {
      const others = o.filter((_, k) => k !== ax);
      if (others[0] > 0.5 && others[1] > 0.5 && o[ax] < -0.01 && -o[ax] < need) thin.push({ pair: `${a.name} ↔ ${b.name}`, g: -o[ax] });
    }
  }
  thin.sort((x, y) => x.g - y.g);

  // Fill volume estimate (mm³), before the real mesh exists.
  const vIn = Math.max(0, (inner.x1 - inner.x0) * (inner.y1 - inner.y0) * (inner.z1 - inner.z0));
  let vParts = 0;
  for (const b of B) {
    const c = fl.clear;
    const zh = Math.max(0, Math.min(b.Z1 + c, inner.z1) - Math.max(b.Z0 - c, inner.z0));
    if (b.cyl) { const R = b.R + c, r = b.rIn ? Math.max(0, b.rIn - c) : 0; vParts += Math.PI * (R * R - r * r) * zh; }
    else vParts += (b.X1 - b.X0 + 2 * c) * (b.Y1 - b.Y0 + 2 * c) * zh;
  }
  const capsV = p.caps === "printed" ? 2 * (w - 2 * t) * (d - 2 * t) * p.capT : 0;
  const fillV = Math.max(0, vIn - vParts) + capsV;
  const pcbB = B.find((b) => b.part && !b.part.parent && B.some((c) => c.part?.parent === b.id)) ?? byId("pcb");
  const splitZ = fl.split === "pcb" ? (pcbB ? pcbB.Z0 : d / 2) : fl.split === "z" ? fl.splitZ : null;

  // Every geometry input, for the fill's staleness check.
  const sig = JSON.stringify([
    w, d, t, st.r, L, p.caps, p.capT,
    p.parts.map((q) => [q.id, q.cx, q.cy, q.cz, q.sx, q.sy, q.sz, q.rot, q.mesh ?? ""]),
    wh, fl.method, fl.clear, fl.minWall, fl.res, fl.smooth, fl.split, fl.splitZ, fl.channel,
  ]);

  return { st, w, d, t, L, capIn, dims, inner, B, byId, target, WX, WY, ringF, ringB, bumpB, cutsW, errs, warns, clash, bumpRows, cutStat, thin, need, fillV, splitZ, pcbB, sig, WALLN };
}
export type Derived = ReturnType<typeof derive>;

/** "W × H × D" of a body. */
export const dimsOf = (b: Body) => `${fx(b.X1 - b.X0)} × ${fx(b.Y1 - b.Y0)} × ${fx(b.Z1 - b.Z0)}`;
