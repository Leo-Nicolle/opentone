// Click wheel geometry: one source for the drawing, the touch test and the KiCad exports.
// Lengths in mm, angles in radians. Screen convention: y down, angle 0 at 3 o'clock,
// increasing clockwise. The UI shows angles from 12 o'clock (see toUiDeg).

export const D2R = Math.PI / 180;
export const TAU = Math.PI * 2;

export type Params = {
  od: number; // outer diameter, mm
  id: number; // inner diameter, mm
  pads: number;
  zig: number; // zigzags per pad border
  inter: number; // interleave, degrees
  round: number; // roundness, %
  rot: number; // rotation, degrees from 12 o'clock
  sq: number; // square outline side, mm
  gap: number; // copper gap, mm
  finger: number; // test finger diameter, mm
  overlay: number; // cover thickness over the pads, mm
};

export const DEFAULTS: Params = { od: 38, id: 19, pads: 4, zig: 8, inter: 7.5, round: 0, rot: 0, sq: 30, gap: 0.2, finger: 8, overlay: 1 };

export type FieldDef = {
  key: string; // a Params key, or a UI-only field like the finger position
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  hint?: string;
  stepper?: boolean;
  more?: string; // stepper aria-labels, e.g. "pads" → "Fewer pads" / "More pads"
};

export const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Size",
    fields: [
      { key: "od", label: "Outer diameter", unit: "mm", min: 10, max: 80, step: 0.5, decimals: 1 },
      { key: "id", label: "Inner diameter", unit: "mm", min: 0, max: 60, step: 0.5, decimals: 1, hint: "Hole for the centre button. 0 for none." },
    ],
  },
  {
    title: "Pattern",
    fields: [
      { key: "pads", label: "Pads", unit: "", min: 3, max: 12, step: 1, decimals: 0, stepper: true, more: "pads" },
      { key: "zig", label: "Zigzags", unit: "", min: 1, max: 24, step: 1, decimals: 0, stepper: true, more: "zigzags", hint: "Turns in each pad border between the inner and outer edge." },
      { key: "inter", label: "Interleave", unit: "°", min: -20, max: 45, step: 0.5, decimals: 1, hint: "How far each pad’s teeth reach into its neighbours. Below 0 leaves a plain border." },
      { key: "round", label: "Roundness", unit: "%", min: 0, max: 100, step: 5, decimals: 0, hint: "0 gives sharp zigzags, 100 smooth waves." },
      { key: "rot", label: "Rotation", unit: "°", min: -180, max: 180, step: 1, decimals: 0, hint: "Where pad 1 starts, clockwise from 12 o’clock." },
    ],
  },
  {
    title: "Board",
    fields: [
      { key: "sq", label: "Square outline", unit: "mm", min: 0, max: 80, step: 0.5, decimals: 1, hint: "Side of a square merged with the wheel outline. 0 keeps the board round." },
      { key: "gap", label: "Copper gap", unit: "mm", min: 0.1, max: 1, step: 0.05, decimals: 2, hint: "Clearance between pads. Check your fab’s minimum." },
    ],
  },
];

export const FINGER_FIELD: FieldDef = {
  key: "finger", label: "Finger diameter", unit: "mm", min: 3, max: 16, step: 0.5, decimals: 1, hint: "Contact patch of a fingertip, usually 7 to 10 mm.",
};

export const OVERLAY_FIELD: FieldDef = {
  key: "overlay", label: "Overlay", unit: "mm", min: 0, max: 5, step: 0.1, decimals: 1,
  hint: "Cover over the pads. The field spreads through it, blurring the finger’s edge by about half this thickness.",
};

const ALL_FIELDS = [...SECTIONS.flatMap((s) => s.fields), FINGER_FIELD, OVERLAY_FIELD];

export const mod = (a: number, m: number) => ((a % m) + m) % m;
export const wrapPI = (a: number) => mod(a + Math.PI, TAU) - Math.PI;
/** Screen angle (rad) → UI degrees, 0 at 12 o'clock, clockwise. */
export const toUiDeg = (a: number) => mod(a / D2R + 90, 360);

export type Geo = {
  R: number;
  r: number;
  N: number;
  pitch: number;
  lo: number;
  hi: number;
  a0: number;
  zig: number;
  q: number;
  gap: number;
  s: number;
  blur: number; // finger edge softness, mm (σ)
};

export function geo(p: Params): Geo {
  const R = p.od / 2, r = Math.max(0, Math.min(p.id / 2, R - 1)), N = Math.round(p.pads), pitch = TAU / N, il = p.inter * D2R;
  return { R, r, N, pitch, lo: -il, hi: pitch + il, a0: (p.rot - 90) * D2R, zig: Math.max(1, Math.round(p.zig)), q: p.round / 100, gap: p.gap, s: p.sq / 2, blur: p.overlay / 2 };
}

/** Angular offset of a pad border at radius rho, and its derivative d/drho. */
export function zf(g: Geo, rho: number): [number, number] {
  const W = g.R - g.r;
  const t = Math.max(0, Math.min(1, (rho - g.r) / W));
  const ph = t * g.zig;
  const k = Math.min(Math.floor(ph), g.zig - 1);
  const f = ph - k, up = k % 2 === 0, tri = up ? f : 1 - f;
  const sh = (1 - g.q) * tri + g.q * (0.5 - 0.5 * Math.cos(Math.PI * tri));
  const ds = 1 - g.q + g.q * 0.5 * Math.PI * Math.sin(Math.PI * tri);
  const A = g.hi - g.lo;
  return [g.lo + A * sh, ((A * ds * (up ? 1 : -1)) * g.zig) / W];
}

/** Pad index under (x, y), or -1 off the copper or inside the clearance. */
export function padAt(g: Geo, x: number, y: number): number {
  const rho = Math.hypot(x, y);
  if (rho < g.r || rho > g.R) return -1;
  const z = zf(g, rho), u = mod(Math.atan2(y, x) - g.a0 - z[0], TAU) / g.pitch;
  const k = Math.floor(u), fr = u - k, dphi = Math.min(fr, 1 - fr) * g.pitch;
  if ((rho * dphi) / Math.sqrt(1 + (rho * z[1]) ** 2) < g.gap / 2) return -1;
  return k % g.N;
}

/**
 * Share of a finger (centre cx, cy, radius fr) on each pad, last entry = no copper.
 * Through an overlay the finger's edge is soft: a disc blurred by g.blur (σ, mm),
 * drawn with a logistic falloff. Sampled on an n × n grid across the disc, kept as fine past its edge.
 */
export function cover(g: Geo, cx: number, cy: number, fr: number, n: number): number[] {
  const c = new Array(g.N + 1).fill(0);
  const sb = g.blur, ext = fr + 2 * sb, cnt = Math.round((n * ext) / fr), st = (2 * ext) / cnt;
  let tot = 0;
  for (let i = 0; i < cnt; i++)
    for (let j = 0; j < cnt; j++) {
      const dx = -ext + (i + 0.5) * st, dy = -ext + (j + 0.5) * st, d = Math.hypot(dx, dy);
      const w = sb > 0 ? 1 / (1 + Math.exp((1.7 * (d - fr)) / sb)) : d <= fr ? 1 : 0;
      if (w < 0.01) continue;
      tot += w;
      const k = padAt(g, cx + dx, cy + dy);
      c[k < 0 ? g.N : k] += w;
    }
  return c.map((v) => v / Math.max(1e-9, tot));
}

/**
 * How the reported angle is computed from the pads.
 * - "pair": the firmware's getWheelAngle() (software/src/ClickWheel.hpp). Takes the two
 *   strongest pads and blends their centres linearly by delta; snaps to the strongest
 *   pad's centre when the second one is weak.
 * - "mean": circular mean of all pad centres weighted by delta (parked firmware change,
 *   plans/clickwheel-vector-angle.md).
 * `full` is the delta, in counts, of a pad with the finger entirely on it: deltas are
 * whole counts, and the firmware's thresholds are counts too.
 */
export type Estimator = { kind: "pair" | "mean"; full: number };
export const ESTIMATOR_DEFAULT: Estimator = { kind: "pair", full: 30 };

/** Thresholds of getWheelAngle(), in counts. */
const FW_TOUCH_THRESHOLD = 6;
const FW_SECOND_PAD_THRESHOLD = 3;

export const FULL_DELTA_FIELD: FieldDef = {
  key: "full", label: "Full-touch delta", unit: "", min: 5, max: 200, step: 1, decimals: 0,
  hint: "What one pad reads with a finger fully on it (debug screen). Sets where the firmware’s thresholds fall.",
};

/** Reported angle from the pad coverage, or null when it reports no touch. */
export function estimate(g: Geo, c: number[], est: Estimator = ESTIMATOR_DEFAULT): number | null {
  return est.kind === "pair" ? estimatePair(g, c, est.full) : estimateMean(g, c);
}

const padCentre = (g: Geo, k: number) => g.a0 + (k + 1) * g.pitch;

function estimatePair(g: Geo, c: number[], full: number): number | null {
  let i1 = -1, i2 = -1, v1 = 0, v2 = 0;
  for (let k = 0; k < g.N; k++) {
    const d = Math.round(c[k] * full);
    if (d > v1) [i2, v2, i1, v1] = [i1, v1, k, d];
    else if (d > v2) [i2, v2] = [k, d];
  }
  if (v1 < FW_TOUCH_THRESHOLD) return null;
  const a1 = padCentre(g, i1);
  if (v2 < FW_SECOND_PAD_THRESHOLD || i2 < 0) return a1;
  return a1 + (v2 / (v1 + v2)) * wrapPI(padCentre(g, i2) - a1);
}

function estimateMean(g: Geo, c: number[]): number | null {
  let sx = 0, sy = 0, cu = 0;
  for (let k = 0; k < g.N; k++) {
    const a = padCentre(g, k);
    sx += c[k] * Math.cos(a);
    sy += c[k] * Math.sin(a);
    cu += c[k];
  }
  return cu > 0.03 && Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : null;
}

export function niceMax(v: number) {
  v = Math.max(v * 1.15, 1);
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export type Model = {
  g: Geo;
  pads: string[];
  sepD: string;
  board: string;
  E: number; // half extent of the board
  V: number; // half extent of the view
  gMin: string;
  gMaj: string;
  dim: string;
  labels: { text: string; x: number; y: number }[];
  zR: number;
};

const circle = (r: number) => `M${r},0 A${r},${r} 0 1 1 ${-r},0 A${r},${r} 0 1 1 ${r},0 Z`;

export function buildGeo(p: Params): Model {
  const g = geo(p), S = g.zig * 24, sep: [number, number][] = [];
  for (let j = 0; j <= S; j++) {
    const rho = g.r + ((g.R - g.r) * j) / S;
    sep.push([rho, zf(g, rho)[0]]);
  }
  const P = (rho: number, a: number) => (rho * Math.cos(a)).toFixed(3) + "," + (rho * Math.sin(a)).toFixed(3);
  const arc = (rho: number, a1: number, a2: number) => {
    let d = "";
    for (let i = 1; i <= 32; i++) d += " L" + P(rho, a1 + ((a2 - a1) * i) / 32);
    return d;
  };
  const pads: string[] = [], seps: string[] = [];
  const zR = sep[S][1], z0 = sep[0][1];
  for (let k = 0; k < g.N; k++) {
    const b = g.a0 + k * g.pitch;
    let d = "M" + sep.map((q) => P(q[0], b + q[1])).join(" L");
    d += arc(g.R, b + zR, b + zR + g.pitch);
    d += " L" + sep.slice().reverse().map((q) => P(q[0], b + g.pitch + q[1])).join(" L");
    d += arc(g.r, b + g.pitch + z0, b + z0) + " Z";
    pads.push(d);
    seps.push("M" + sep.map((q) => P(q[0], b + q[1])).join(" L"));
  }

  // Board outline: circle R, square, or their union.
  const R = g.R, s = g.s;
  let board: string;
  if (s <= R / Math.SQRT2 + 1e-6) board = circle(R);
  else if (s >= R) board = `M${-s},${-s} H${s} V${s} H${-s} Z`;
  else {
    const c = Math.sqrt(R * R - s * s).toFixed(3);
    board =
      `M${s},${-c} L${s},${-s} L${c},${-s} A${R},${R} 0 0 0 ${-c},${-s} L${-s},${-s} L${-s},${-c} ` +
      `A${R},${R} 0 0 0 ${-s},${c} L${-s},${s} L${-c},${s} A${R},${R} 0 0 0 ${c},${s} L${s},${s} L${s},${c} ` +
      `A${R},${R} 0 0 0 ${s},${-c} Z`;
  }
  if (g.r > 0.05) board += " " + circle(g.r);

  const E = Math.max(R, s), V = E + 3.6, H = Math.floor(V);
  let gMin = "", gMaj = "";
  for (let i = -H; i <= H; i++) {
    const l = `M${i},${-V} V${V} M${-V},${i} H${V} `;
    if (i % 5 === 0) gMaj += l;
    else gMin += l;
  }

  // Dimension lines; their labels are HTML overlays.
  const yb = E + 1.8, yt = -(E + 1.8);
  let dim =
    `M${-R},0.6 V${yb + 0.6} M${R},0.6 V${yb + 0.6} M${-R},${yb} H${R} ` +
    `M${-R + 0.8},${yb - 0.5} L${-R},${yb} L${-R + 0.8},${yb + 0.5} M${R - 0.8},${yb - 0.5} L${R},${yb} L${R - 0.8},${yb + 0.5} `;
  const labels = [{ text: "Ø " + p.od.toFixed(1) + " mm", x: 0, y: yb }];
  if (g.r >= 4) {
    dim += `M${-g.r},0 H${g.r} M${-g.r + 0.8},-0.5 L${-g.r},0 L${-g.r + 0.8},0.5 M${g.r - 0.8},-0.5 L${g.r},0 L${g.r - 0.8},0.5 `;
    labels.push({ text: "Ø " + (g.r * 2).toFixed(1), x: 0, y: -1.2 });
  }
  if (s > R / Math.SQRT2) {
    dim += `M${-s},${-s - 0.4} V${yt - 0.6} M${s},${-s - 0.4} V${yt - 0.6} M${-s},${yt} H${s} `;
    labels.push({ text: "□ " + p.sq.toFixed(1) + " mm", x: 0, y: yt });
  }
  return { g, pads, sepD: seps.join(" "), board, E, V, gMin, gMaj, dim, labels, zR };
}

export type Sweep = {
  tracks: number[]; // inner, middle, outer radius
  errs: (number | null)[][]; // degrees, per track, SWEEP_STEPS positions
  offset: number; // rad, calibrated out
  worst: number; // over the three tracks
  rms: number;
  single: number; // share of track positions with one pad holding ≥ 95% of the copper
  tw: number[]; // worst error per track
  dead: number; // share of track positions with no estimate
  across: Across;
};

/** The finger slid straight across the ring, inner to outer edge, at each angle. */
export type Across = {
  radii: number[];
  lo: (number | null)[]; // lowest and highest error along each radius, degrees
  hi: (number | null)[];
  worstDrift: number; // largest hi − lo
  rmsDrift: number; // RMS deviation from each radius' own mean
  worst: number; // largest |error| anywhere on the grid
};

export const SWEEP_STEPS = 180; // 2° apart
const ACROSS_STEPS = 7; // finger centre from the inner edge to the outer one

/** Sampling of a sweep: `steps` angles over `span` rad, finger disc sampled on a `disc`² grid, read with `est`. */
export type SweepOpts = { steps?: number; span?: number; disc?: number; est?: Estimator };

/** Thickness of one zigzag tooth, mm (rough: ring width per zigzag over the border's angular swing). */
export const toothThickness = (g: Geo) => ((g.R - g.r) / g.zig) * g.pitch / Math.max(1e-3, g.hi - g.lo);

/**
 * Length of one pad border (mm) and the share of the ring's copper its gaps remove,
 * all borders together. Long borders also add pad-to-pad and pad-to-ground capacitance.
 */
export function copperLost(g: Geo) {
  const S = g.zig * 24;
  let border = 0, prev = [g.r, zf(g, g.r)[0]];
  for (let j = 1; j <= S; j++) {
    const rho = g.r + ((g.R - g.r) * j) / S, phi = zf(g, rho)[0];
    border += Math.hypot(rho - prev[0], ((rho + prev[0]) / 2) * (phi - prev[1]));
    prev = [rho, phi];
  }
  const ring = Math.PI * (g.R * g.R - g.r * g.r);
  return { border, lost: Math.min(1, (g.N * border * g.gap) / Math.max(1e-9, ring)) };
}

/**
 * Error of the reported angle at SWEEP_STEPS angles: around the wheel on three
 * tracks, and across the ring along each radius, from edge to edge.
 * The pattern repeats every pad, so a span of one pitch gives the same stats, N× faster.
 */
export function buildSweep(g: Geo, finger: number, { steps = SWEEP_STEPS, span = TAU, disc = 15, est = ESTIMATOR_DEFAULT }: SweepOpts = {}): Sweep {
  const fr = finger / 2;
  let tin = g.r + fr, tout = g.R - fr;
  if (tin > tout) tin = tout = (g.r + g.R) / 2;
  const tracks = [tin, (g.r + g.R) / 2, tout];
  const radii = Array.from({ length: ACROSS_STEPS }, (_, j) => g.r + ((g.R - g.r) * j) / (ACROSS_STEPS - 1));

  // Raw errors in rad, before calibration. The offset is calibrated on the tracks.
  let ss = 0, sc = 0, single = 0, n = 0;
  const row = (rho: number, onTrack: boolean) =>
    Array.from({ length: steps }, (_, i) => {
      const a = (i * span) / steps - 90 * D2R;
      const c = cover(g, rho * Math.cos(a), rho * Math.sin(a), fr, disc), e = estimate(g, c, est);
      if (!onTrack) return e == null ? null : wrapPI(e - a);
      n++;
      if (e == null) return null;
      const cu = c.slice(0, g.N).reduce((x, y) => x + y, 0), mx = Math.max(...c.slice(0, g.N));
      if (mx / cu >= 0.95) single++;
      const er = wrapPI(e - a);
      ss += Math.sin(er);
      sc += Math.cos(er);
      return er;
    });
  const rawTracks = tracks.map((rho) => row(rho, true));
  const rawAcross = radii.map((rho) => row(rho, false));
  const offset = Math.atan2(ss, sc);
  const calibrate = (rows: (number | null)[][]) => rows.map((r) => r.map((v) => (v == null ? null : wrapPI(v - offset) / D2R)));
  const errs = calibrate(rawTracks), grid = calibrate(rawAcross);

  // Around: the three tracks.
  let worst = 0, sq = 0, cnt = 0;
  for (const row of errs)
    for (const d of row) {
      if (d == null) continue;
      worst = Math.max(worst, Math.abs(d));
      sq += d * d;
      cnt++;
    }
  const tw = errs.map((row) => row.reduce<number>((m, v) => (v == null ? m : Math.max(m, Math.abs(v))), 0));

  // Across: per angle, how far the error moves along the radius.
  const lo: (number | null)[] = [], hi: (number | null)[] = [];
  let worstDrift = 0, dsq = 0, dcnt = 0, aworst = 0;
  for (let i = 0; i < steps; i++) {
    const col = grid.map((row) => row[i]).filter((v): v is number => v != null);
    if (!col.length) {
      lo.push(null);
      hi.push(null);
      continue;
    }
    const mn = Math.min(...col), mx = Math.max(...col), mean = col.reduce((x, y) => x + y, 0) / col.length;
    lo.push(mn);
    hi.push(mx);
    worstDrift = Math.max(worstDrift, mx - mn);
    aworst = Math.max(aworst, Math.abs(mn), Math.abs(mx));
    for (const v of col) dsq += (v - mean) ** 2;
    dcnt += col.length;
  }

  return {
    tracks,
    errs,
    offset,
    worst,
    rms: cnt ? Math.sqrt(sq / cnt) : 0,
    single: single / n,
    tw,
    dead: n ? 1 - cnt / n : 0,
    across: { radii, lo, hi, worstDrift, rmsDrift: dcnt ? Math.sqrt(dsq / dcnt) : 0, worst: aworst },
  };
}

export function padColors(N: number, dark: boolean) {
  return Array.from({ length: N }, (_, k) => {
    const h = mod(322 + (k * 360) / N, 360).toFixed(0);
    return dark ? `hsl(${h},62%,64%)` : `hsl(${h},52%,47%)`;
  });
}

// --- Exports -----------------------------------------------------------------

/** Width of the exported images: the board plus a 1 mm margin on each side. */
export const exportWidth = (m: Model) => 2 * (m.E + 1);

export type Layer = "copper" | "edge";

/** One layer, black on white, at the export extent. Copper = pads minus gaps minus hole. */
export function layerSvg(m: Model, layer: Layer) {
  const W = exportWidth(m), h = W / 2;
  const body =
    layer === "copper"
      ? `<g id="F.Cu"><path d="${m.pads.join(" ")}" fill="#000"/>` +
        `<path d="${m.sepD}" fill="none" stroke="#fff" stroke-width="${m.g.gap}" stroke-linejoin="round"/></g>`
      : `<g id="Edge.Cuts"><path d="${m.board}" fill="#000" fill-rule="evenodd"/></g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${W}mm" height="${W}mm" viewBox="${-h} ${-h} ${W} ${W}">` +
    `<rect x="${-h}" y="${-h}" width="${W}" height="${W}" fill="#fff"/>${body}</svg>`
  );
}

/** Both layers in one file, each in its own group, without a background. */
export function bothLayersSvg(m: Model) {
  const W = exportWidth(m), h = W / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${W}mm" height="${W}mm" viewBox="${-h} ${-h} ${W} ${W}">` +
    `<defs><mask id="gaps" maskUnits="userSpaceOnUse" x="${-h}" y="${-h}" width="${W}" height="${W}">` +
    `<rect x="${-h}" y="${-h}" width="${W}" height="${W}" fill="#fff"/>` +
    `<path d="${m.sepD}" fill="none" stroke="#000" stroke-width="${m.g.gap}" stroke-linejoin="round"/></mask></defs>` +
    `<g id="Edge.Cuts"><path d="${m.board}" fill="#0c0" fill-rule="evenodd"/></g>` +
    `<g id="F.Cu"><path d="${m.pads.join(" ")}" fill="#cd4c33" mask="url(#gaps)"/></g></svg>`
  );
}

// --- Project file --------------------------------------------------------------

const clampField = (f: FieldDef, v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? +Math.max(f.min, Math.min(f.max, n)).toFixed(4) : fallback;
};

/**
 * Reads a saved wheel. Accepts the current keys and the old designer's
 * (outR/inR or radius/innerRadius, numPads, numCurves, gap and offset/startAngle
 * in radians, strokeWidth, W2/squareHalfWidth). Old roundness has no equivalent.
 */
export function parseProject(data: Record<string, unknown>): Params {
  const old = ["outR", "radius", "numPads", "numCurves"].some((k) => k in data);
  const src: Record<string, unknown> = old
    ? {
        od: 2 * Number(data.outR ?? data.radius),
        id: 2 * Number(data.inR ?? data.innerRadius),
        pads: data.numPads,
        zig: data.numCurves,
        inter: data.gap != null ? -Number(data.gap) / D2R : undefined,
        round: 0,
        rot: data.offset != null || data.startAngle != null ? wrapPI(Number(data.offset ?? data.startAngle)) / D2R : undefined,
        sq: 2 * Number(data.W2 ?? data.squareHalfWidth),
        gap: data.strokeWidth,
      }
    : data;
  const p = { ...DEFAULTS };
  for (const f of ALL_FIELDS) {
    const k = f.key as keyof Params;
    p[k] = clampField(f, src[k], DEFAULTS[k]);
  }
  if (p.id > p.od - 2) p.id = Math.max(0, p.od - 2);
  return p;
}
