// The printed fill: the inside of the case minus every part grown by the clearance, as a voxel
// grid turned into a mesh. Runs in fill.worker.ts.
//
// 1. Voxelise the parts (real meshes by ray parity along Z, wheel pieces as cylinders).
// 2. Euclidean distance transform → remove everything within `clear` of a part. The smooth
//    method closes that pocket set by the blend radius, so pockets get rounded and no knife-thin
//    ribs are left between neighbours.
// 3. Cut the insertion paths: each pocket is swept straight toward the split plane (or the front
//    for one piece), so its part can drop in.
// 4. Morphological opening by half the thinnest wall, then drop islands.
// 5. Marching cubes on a signed distance (smooth) or the raw occupancy (Boolean).
import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";

export type Solid =
  | { kind: "box"; X0: number; X1: number; Y0: number; Y1: number; Z0: number; Z1: number }
  | { kind: "cyl"; Xc: number; Yc: number; R: number; rIn: number; Z0: number; Z1: number }
  | { kind: "tris"; tris: Float32Array }
  /** Rounded rectangle in X/Z, straight through Y: a cutout in a printed cap. */
  | { kind: "prismY"; cx: number; cz: number; w: number; h: number; r: number; Y0: number; Y1: number };

export type FillInput = {
  box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
  res: number;
  method: "voxel" | "sdf";
  clear: number;
  minWall: number;
  smooth: number;
  splitZ: number | null;
  /** Grown by the clearance. */
  solids: Solid[];
  /** Removed as they are: the cable channel and printed-cap cutouts. */
  holes: Solid[];
  stages: string[];
};
export type FillHalf = { name: string; positions: Float32Array; indices: Uint32Array; volume: number };
export type FillOutput = { halves: FillHalf[]; res: number; voxels: number };

/** Most voxels the worker takes on; a finer setting is coarsened to fit. */
export const MAX_VOXELS = 14e6;

export function buildFill(inp: FillInput, progress: (stage: number, pct: number) => void): FillOutput {
  const { box } = inp;
  let res = inp.res;
  const ext = [box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0];
  while (ext.reduce((a, e) => a * Math.max(1, Math.round(e / res)), 1) > MAX_VOXELS) res *= 1.15;
  const nx = Math.max(1, Math.round(ext[0] / res)), ny = Math.max(1, Math.round(ext[1] / res)), nz = Math.max(1, Math.round(ext[2] / res));
  const hx = ext[0] / nx, hy = ext[1] / ny, hz = ext[2] / nz, hmin = Math.min(hx, hy, hz);
  const N = nx * ny * nz;
  const cx = (i: number) => box.x0 + (i + 0.5) * hx, cy = (j: number) => box.y0 + (j + 0.5) * hy, cz = (k: number) => box.z0 + (k + 0.5) * hz;
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const lo = (v: number, o: number, h: number, _n: number) => Math.max(0, Math.ceil((v - o) / h - 0.5));
  const hi = (v: number, o: number, h: number, n: number) => Math.min(n - 1, Math.floor((v - o) / h - 0.5));

  function raster(list: Solid[], out: Uint8Array) {
    for (const s of list) {
      if (s.kind === "box") {
        for (let k = lo(s.Z0, box.z0, hz, nz); k <= hi(s.Z1, box.z0, hz, nz); k++)
          for (let j = lo(s.Y0, box.y0, hy, ny); j <= hi(s.Y1, box.y0, hy, ny); j++)
            for (let i = lo(s.X0, box.x0, hx, nx); i <= hi(s.X1, box.x0, hx, nx); i++) out[at(i, j, k)] = 1;
      } else if (s.kind === "cyl") {
        const R2 = s.R * s.R, r2 = s.rIn * s.rIn;
        for (let j = lo(s.Yc - s.R, box.y0, hy, ny); j <= hi(s.Yc + s.R, box.y0, hy, ny); j++)
          for (let i = lo(s.Xc - s.R, box.x0, hx, nx); i <= hi(s.Xc + s.R, box.x0, hx, nx); i++) {
            const q = (cx(i) - s.Xc) ** 2 + (cy(j) - s.Yc) ** 2;
            if (q > R2 || q < r2) continue;
            for (let k = lo(s.Z0, box.z0, hz, nz); k <= hi(s.Z1, box.z0, hz, nz); k++) out[at(i, j, k)] = 1;
          }
      } else if (s.kind === "prismY") {
        const r = Math.min(s.r, s.w / 2, s.h / 2);
        for (let k = lo(s.cz - s.h / 2, box.z0, hz, nz); k <= hi(s.cz + s.h / 2, box.z0, hz, nz); k++)
          for (let i = lo(s.cx - s.w / 2, box.x0, hx, nx); i <= hi(s.cx + s.w / 2, box.x0, hx, nx); i++) {
            // Rounded-rectangle test: distance to the inner rectangle ≤ r.
            const dx = Math.max(0, Math.abs(cx(i) - s.cx) - (s.w / 2 - r)), dz = Math.max(0, Math.abs(cz(k) - s.cz) - (s.h / 2 - r));
            if (dx * dx + dz * dz > r * r + 1e-9) continue;
            for (let j = lo(s.Y0, box.y0, hy, ny); j <= hi(s.Y1, box.y0, hy, ny); j++) out[at(i, j, k)] = 1;
          }
      } else rasterTris(s.tris, out);
    }
  }

  // Solid voxelisation by ray parity: every column (i, j) collects where it crosses the surface.
  function rasterTris(t: Float32Array, out: Uint8Array) {
    const hits: (number[] | undefined)[] = new Array(nx * ny);
    const jx = 1e-4 * hx, jy = 1.3e-4 * hy; // nudge rays off shared edges
    for (let o = 0; o < t.length; o += 9) {
      const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5], qx = t[o + 6], qy = t[o + 7], qz = t[o + 8];
      const det = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy);
      if (Math.abs(det) < 1e-12) continue;
      const i0 = lo(Math.min(ax, bx, qx), box.x0, hx, nx), i1 = hi(Math.max(ax, bx, qx), box.x0, hx, nx);
      const j0 = lo(Math.min(ay, by, qy), box.y0, hy, ny), j1 = hi(Math.max(ay, by, qy), box.y0, hy, ny);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const px = cx(i) + jx, py = cy(j) + jy;
          const l1 = ((by - qy) * (px - qx) + (qx - bx) * (py - qy)) / det;
          const l2 = ((qy - ay) * (px - qx) + (ax - qx) * (py - qy)) / det;
          const l3 = 1 - l1 - l2;
          if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          const z = l1 * az + l2 * bz + l3 * qz, c = i + nx * j;
          (hits[c] ??= []).push(z);
        }
    }
    for (let c = 0; c < hits.length; c++) {
      const h = hits[c];
      if (!h) continue;
      h.sort((a, b) => a - b);
      const i = c % nx, j = (c - i) / nx;
      const span = (z0: number, z1: number) => {
        for (let k = lo(z0, box.z0, hz, nz); k <= hi(z1, box.z0, hz, nz); k++) out[at(i, j, k)] = 1;
      };
      if (h.length % 2) span(h[0], h[h.length - 1]);
      else for (let q = 0; q < h.length; q += 2) span(h[q], h[q + 1]);
    }
  }

  // Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), in mm, to the nearest
  // voxel where `seed` is true. The grid's edge is not a seed: past it is the case wall.
  function edt(seed: (n: number) => boolean): Float32Array {
    const INF = 1e20;
    const f = new Float32Array(N);
    for (let n = 0; n < N; n++) f[n] = seed(n) ? 0 : INF;
    const m = Math.max(nx, ny, nz);
    const g = new Float64Array(m), dd = new Float64Array(m), v = new Int32Array(m), zz = new Float64Array(m + 1);
    const pass = (len: number, h: number, stride: number, starts: number[]) => {
      for (const s0 of starts) {
        let first = -1;
        for (let q = 0; q < len; q++) {
          g[q] = f[s0 + q * stride];
          if (first < 0 && g[q] < INF) first = q;
        }
        if (first < 0) continue;
        // Lower envelope of the parabolas rooted at the finite samples, in mm.
        let kk = 0;
        v[0] = first; zz[0] = -INF; zz[1] = INF;
        for (let q = first + 1; q < len; q++) {
          if (g[q] >= INF) continue;
          const xq = q * h;
          let s: number;
          for (;;) {
            const xp = v[kk] * h;
            s = (g[q] + xq * xq - (g[v[kk]] + xp * xp)) / (2 * (xq - xp));
            if (s <= zz[kk] && kk > 0) kk--;
            else break;
          }
          kk++;
          v[kk] = q; zz[kk] = s; zz[kk + 1] = INF;
        }
        kk = 0;
        for (let q = 0; q < len; q++) {
          const xq = q * h;
          while (zz[kk + 1] < xq) kk++;
          const dx = xq - v[kk] * h;
          dd[q] = dx * dx + g[v[kk]];
        }
        for (let q = 0; q < len; q++) f[s0 + q * stride] = dd[q];
      }
    };
    const sx: number[] = [], sy: number[] = [], sz: number[] = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) sx.push(at(0, j, k));
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) sy.push(at(i, 0, k));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sz.push(at(i, j, 0));
    pass(nx, hx, 1, sx);
    pass(ny, hy, nx, sy);
    pass(nz, hz, nx * ny, sz);
    for (let n = 0; n < N; n++) f[n] = Math.sqrt(f[n]);
    return f;
  }

  progress(0, 0.02);
  const occ = new Uint8Array(N);
  raster(inp.solids, occ);
  progress(1, 0.2);

  // Pockets: within the clearance of a part. Voxel centres sit half a voxel inside the
  // surface they stand for, hence the half-voxel corrections.
  const half = hmin / 2;
  const D = edt((n) => occ[n] === 1);
  const removed = new Uint8Array(N);
  for (let n = 0; n < N; n++) removed[n] = D[n] <= inp.clear + half ? 1 : 0;
  progress(1, 0.35);
  if (inp.method === "sdf" && inp.smooth > 0) {
    const k = inp.smooth;
    const E = edt((n) => !(D[n] <= inp.clear + k + half));
    for (let n = 0; n < N; n++) if (D[n] <= inp.clear + k + half && E[n] > k + half) removed[n] = 1;
  }
  progress(2, 0.5);
  if (inp.holes.length) raster(inp.holes, removed);

  // Insertion paths: sweep each pocket straight toward the split plane (or the front).
  const ks = inp.splitZ == null ? nz : Math.max(0, Math.min(nz, Math.round((inp.splitZ - box.z0) / hz)));
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let on = 0;
      for (let k = 0; k < ks; k++) { const n = at(i, j, k); if (removed[n]) on = 1; else if (on) removed[n] = 1; }
      on = 0;
      for (let k = nz - 1; k >= ks; k--) { const n = at(i, j, k); if (removed[n]) on = 1; else if (on) removed[n] = 1; }
    }

  // Thinnest wall: opening by half of it (erode, then grow back).
  const mat = new Uint8Array(N);
  for (let n = 0; n < N; n++) mat[n] = removed[n] ? 0 : 1;
  const rw = inp.minWall / 2;
  if (rw > half) {
    const Ein = edt((n) => mat[n] === 0);
    const core = new Uint8Array(N);
    for (let n = 0; n < N; n++) core[n] = mat[n] && Ein[n] - half >= rw - 1e-6 ? 1 : 0;
    const Eout = edt((n) => core[n] === 1);
    for (let n = 0; n < N; n++) if (mat[n] && Eout[n] > rw + half) mat[n] = 0;
  }
  progress(3, 0.7);

  // Halves, islands, mesh.
  const halves: { name: string; k0: number; k1: number }[] =
    inp.splitZ == null ? [{ name: "fill", k0: 0, k1: nz }] : [{ name: "back", k0: 0, k1: ks }, { name: "front", k0: ks, k1: nz }];
  const out: FillHalf[] = [];
  halves.forEach((hf, hi_) => {
    const m = new Uint8Array(N);
    for (let k = hf.k0; k < hf.k1; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const n = at(i, j, k); m[n] = mat[n]; }
    dropIslands(m);
    progress(4, 0.75 + (0.25 * hi_) / halves.length);
    let field: Float32Array;
    if (inp.method === "sdf") {
      const a = edt((n) => m[n] === 0), b = edt((n) => m[n] === 1);
      field = new Float32Array(N);
      for (let n = 0; n < N; n++) field[n] = m[n] ? a[n] - half : -(b[n] - half);
    } else {
      field = new Float32Array(N);
      for (let n = 0; n < N; n++) field[n] = m[n] ? 0.5 : -0.5;
    }
    const mesh = march(field);
    if (mesh.indices.length) out.push({ name: hf.name, ...mesh });
  });
  progress(4, 1);
  return { halves: out, res: hmin, voxels: N };

  function dropIslands(m: Uint8Array) {
    const label = new Int32Array(N), sizes: number[] = [0];
    const queue = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!m[s] || label[s]) continue;
      const id = sizes.length;
      let head = 0, tail = 0;
      queue[tail++] = s;
      label[s] = id;
      while (head < tail) {
        const n = queue[head++];
        const i = n % nx, j = ((n - i) / nx) % ny, k = (n - i - nx * j) / (nx * ny);
        const nb = [i > 0 ? n - 1 : -1, i < nx - 1 ? n + 1 : -1, j > 0 ? n - nx : -1, j < ny - 1 ? n + nx : -1, k > 0 ? n - nx * ny : -1, k < nz - 1 ? n + nx * ny : -1];
        for (const q of nb) if (q >= 0 && m[q] && !label[q]) { label[q] = id; queue[tail++] = q; }
      }
      sizes.push(tail);
    }
    const big = Math.max(...sizes);
    for (let n = 0; n < N; n++) if (m[n] && sizes[label[n]] < big * 0.01) m[n] = 0;
  }

  // Marching cubes over the field padded by one empty voxel on every side, so it closes.
  function march(f: Float32Array) {
    const px = nx + 2, py = ny + 2, pz = nz + 2;
    const val = (i: number, j: number, k: number) =>
      i < 1 || j < 1 || k < 1 || i > nx || j > ny || k > nz ? -1 : f[(i - 1) + nx * ((j - 1) + ny * (k - 1))];
    const pos: number[] = [], idx: number[] = [];
    const vmap = new Map<number, number>();
    const C = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    // Each edge: start corner and axis.
    const E: [number, number][] = [[0, 0], [1, 1], [3, 0], [0, 1], [4, 0], [5, 1], [7, 0], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2]];
    const fv = new Float64Array(8), ev = new Int32Array(12);
    for (let k = 0; k < pz - 1; k++)
      for (let j = 0; j < py - 1; j++)
        for (let i = 0; i < px - 1; i++) {
          let ci = 0;
          for (let c = 0; c < 8; c++) {
            fv[c] = val(i + C[c][0], j + C[c][1], k + C[c][2]);
            if (fv[c] < 0) ci |= 1 << c;
          }
          const bits = edgeTable[ci];
          if (!bits) continue;
          for (let e = 0; e < 12; e++) {
            if (!(bits & (1 << e))) continue;
            const [c0, ax] = E[e];
            const gi = i + C[c0][0], gj = j + C[c0][1], gk = k + C[c0][2];
            const key = (gi + px * (gj + py * gk)) * 3 + ax;
            let vi = vmap.get(key);
            if (vi === undefined) {
              const c1 = ax === 0 ? [gi + 1, gj, gk] : ax === 1 ? [gi, gj + 1, gk] : [gi, gj, gk + 1];
              const a = val(gi, gj, gk), b = val(c1[0], c1[1], c1[2]);
              const tt = a === b ? 0.5 : a / (a - b);
              const g = [gi + (c1[0] - gi) * tt, gj + (c1[1] - gj) * tt, gk + (c1[2] - gk) * tt];
              vi = pos.length / 3;
              pos.push(box.x0 + (g[0] - 0.5) * hx, box.y0 + (g[1] - 0.5) * hy, box.z0 + (g[2] - 0.5) * hz);
              vmap.set(key, vi);
            }
            ev[e] = vi;
          }
          const o = ci * 16;
          for (let q = 0; triTable[o + q] !== -1; q += 3) idx.push(ev[triTable[o + q]], ev[triTable[o + q + 1]], ev[triTable[o + q + 2]]);
        }
    const positions = new Float32Array(pos), indices = new Uint32Array(idx);
    let volume = signedVolume(positions, indices);
    if (volume < 0) {
      for (let q = 0; q < indices.length; q += 3) { const t = indices[q + 1]; indices[q + 1] = indices[q + 2]; indices[q + 2] = t; }
      volume = -volume;
    }
    return { positions, indices, volume };
  }
}

export function signedVolume(p: Float32Array, idx: Uint32Array) {
  let v = 0;
  for (let q = 0; q < idx.length; q += 3) {
    const a = idx[q] * 3, b = idx[q + 1] * 3, c = idx[q + 2] * 3;
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}
