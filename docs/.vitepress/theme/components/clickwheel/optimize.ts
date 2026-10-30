// Pattern optimizer: searches zigzags, interleave and roundness for the smallest
// interpolation error, around and across, over a few finger sizes. Size, pads and
// gap stay fixed; rotation and the board outline don't change the error.
// Coarse grid over the integer zigzag count, then Nelder–Mead on (interleave, roundness).
import { SECTIONS, SWEEP_STEPS, buildSweep, copperLost, geo, toothThickness, type Estimator, type FieldDef, type Params } from "./geometry.ts";

/** Finger diameters every candidate is tested with, mm. */
export const TEST_FINGERS = [7, 8.5, 10];

export type Free = Pick<Params, "zig" | "inter" | "round">;

/** Finger-averaged error stats (degrees), tooth thickness and pad border length (mm), copper lost to gaps (0..1). */
export type Metrics = { worst: number; rms: number; worstDrift: number; rmsDrift: number; tooth: number; border: number; lost: number };

/** How much the copper the gaps remove costs: degrees of error per 10% of the ring. */
export const COPPER_COST_FIELD: FieldDef = {
  key: "copperCost", label: "Copper cost", unit: "°/10%", min: 0, max: 10, step: 0.5, decimals: 1,
  hint: "Error worth trading for 10% of the copper lost to gaps. Long borders cost signal and add coupling between pads.",
};
export const COPPER_COST_DEFAULT = 2;

export type Progress = {
  stage: "grid" | "refine";
  done: number;
  total: number;
  best: Free;
  bestLoss: number;
  startLoss: number;
  metrics: Metrics;
  final?: boolean;
};

const FIELDS = Object.fromEntries(SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f])) as Record<string, FieldDef>;
const ZIG = FIELDS.zig, INTER = FIELDS.inter, ROUND = FIELDS.round;

const GRID_INTER = [-15, -5, 5, 15, 25, 35];
const GRID_ROUND = [0, 50, 100];
const REFINE_STARTS = 4; // best grid points refined, plus the user's current values
const NM_BUDGET = 50; // evaluations per Nelder–Mead run

/** Loss of one pattern: the lower, the more even the interpolation. */
export function loss(p: Params, copperCost: number, est: Estimator): { loss: number; metrics: Metrics } {
  // One pad pitch at the chart's 2° spacing: the same stats the Interpolation panel shows.
  const g = geo(p), opts = { steps: Math.round(SWEEP_STEPS / g.N), span: g.pitch, est };
  const m: Metrics = { worst: 0, rms: 0, worstDrift: 0, rmsDrift: 0, tooth: toothThickness(g), ...copperLost(g) };
  let dead = 0;
  for (const f of TEST_FINGERS) {
    const s = buildSweep(g, f, opts);
    m.worst += s.worst / TEST_FINGERS.length;
    m.rms += s.rms / TEST_FINGERS.length;
    m.worstDrift += s.across.worstDrift / TEST_FINGERS.length;
    m.rmsDrift += s.across.rmsDrift / TEST_FINGERS.length;
    dead += s.dead / TEST_FINGERS.length;
  }
  // RMS keeps the landscape smooth; half the worst case stops one bad spot hiding behind a good average.
  const around = m.rms + 0.5 * m.worst, across = m.rmsDrift + 0.5 * m.worstDrift;
  // Same check as the "Teeth too thin" warning, so the winner is manufacturable.
  const thin = Math.max(0, 2 * g.gap - m.tooth) / g.gap;
  return { loss: around + across + 10 * copperCost * m.lost + 100 * dead + 100 * thin * thin, metrics: m };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Nelder–Mead on a box [0, 1]^n, within an evaluation budget. Returns the best point. */
function nelderMead(f: (x: number[]) => number, x0: number[], step: number, budget: number): number[] {
  const n = x0.length, box = (x: number[]) => x.map((v) => clamp(v, 0, 1));
  let evals = 0;
  const F = (x: number[]) => (evals++, f(x));
  const pts = [box(x0), ...x0.map((_, i) => box(x0.map((v, j) => (i === j ? v + (v + step > 1 ? -step : step) : v))))];
  const simplex = pts.map((x) => ({ x, y: F(x) }));
  const at = (c: number[], w: number[], t: number) => box(c.map((v, i) => v + t * (w[i] - v)));
  while (evals < budget) {
    simplex.sort((a, b) => a.y - b.y);
    const worst = simplex[n], c = x0.map((_, i) => simplex.slice(0, n).reduce((s, p) => s + p.x[i], 0) / n);
    const r = at(c, worst.x, -1), yr = F(r);
    if (yr < simplex[0].y) {
      const e = at(c, worst.x, -2), ye = F(e);
      simplex[n] = ye < yr ? { x: e, y: ye } : { x: r, y: yr };
    } else if (yr < simplex[n - 1].y) simplex[n] = { x: r, y: yr };
    else {
      const k = at(c, worst.x, yr < worst.y ? -0.5 : 0.5), yk = F(k);
      if (yk < Math.min(yr, worst.y)) simplex[n] = { x: k, y: yk };
      else
        for (let i = 1; i <= n && evals < budget; i++) {
          const x = at(simplex[0].x, simplex[i].x, 0.5);
          simplex[i] = { x, y: F(x) };
        }
    }
  }
  simplex.sort((a, b) => a.y - b.y);
  return simplex[0].x;
}

/** Runs the whole search on `base`, reporting each evaluation. Synchronous: run it in a worker. */
export function optimize(base: Params, copperCost: number, est: Estimator, report: (p: Progress) => void) {
  // Evaluate at the values the fields can show, so the applied pattern is the one scored.
  const snap = (x: Free): Free => ({
    zig: Math.round(clamp(x.zig, ZIG.min, ZIG.max)),
    inter: +clamp(x.inter, INTER.min, INTER.max).toFixed(INTER.decimals),
    round: +clamp(x.round, ROUND.min, ROUND.max).toFixed(ROUND.decimals),
  });
  const zigs = Array.from({ length: ZIG.max - ZIG.min + 1 }, (_, i) => ZIG.min + i);
  const total = 1 + zigs.length * GRID_INTER.length * GRID_ROUND.length + (REFINE_STARTS + 1 + 2) * NM_BUDGET;
  const cache = new Map<string, number>();
  let stage: Progress["stage"] = "grid", done = 0, startLoss = 0;
  let best = snap(base), bestLoss = Infinity, bestMetrics: Metrics | undefined;

  const evaluate = (x: Free) => {
    const s = snap(x), key = `${s.zig}/${s.inter}/${s.round}`;
    let l = cache.get(key);
    if (l == null) {
      const r = loss({ ...base, ...s }, copperCost, est);
      cache.set(key, (l = r.loss));
      if (l < bestLoss) [best, bestLoss, bestMetrics] = [s, l, r.metrics];
    }
    done = Math.min(done + 1, total);
    report({ stage, done, total, best, bestLoss, startLoss, metrics: bestMetrics! });
    return l;
  };

  startLoss = evaluate(base);
  const grid: { x: Free; l: number }[] = [];
  for (const zig of zigs)
    for (const inter of GRID_INTER)
      for (const round of GRID_ROUND) grid.push({ x: { zig, inter, round }, l: evaluate({ zig, inter, round }) });

  // Refine (interleave, roundness) at a fixed zigzag count, in unit coordinates.
  stage = "refine";
  const toUnit = (x: Free) => [(x.inter - INTER.min) / (INTER.max - INTER.min), (x.round - ROUND.min) / (ROUND.max - ROUND.min)];
  const fromUnit = (zig: number, u: number[]): Free => ({
    zig,
    inter: INTER.min + u[0] * (INTER.max - INTER.min),
    round: ROUND.min + u[1] * (ROUND.max - ROUND.min),
  });
  const refine = (x: Free) => nelderMead((u) => evaluate(fromUnit(x.zig, u)), toUnit(x), 0.08, NM_BUDGET);

  grid.sort((a, b) => a.l - b.l);
  for (const g of grid.slice(0, REFINE_STARTS)) refine(g.x);
  refine(snap(base));
  // The zigzag count next to the winner, starting from its refined shape.
  const top = best;
  for (const zig of [top.zig - 1, top.zig + 1]) if (zig >= ZIG.min && zig <= ZIG.max) refine({ ...top, zig });

  report({ stage, done: total, total, best, bestLoss, startLoss, metrics: bestMetrics!, final: true });
}
