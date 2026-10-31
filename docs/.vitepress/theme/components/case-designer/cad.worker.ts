// Exact solids for the mill and the printer, built with OpenCascade (replicad) off the main
// thread: the case tube with its cutouts, the end caps, the wheel exoskeleton and the centre
// button. STEP keeps true arcs; STL is tessellated from the same solids.
import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import { Plane, drawCircle, drawRoundedRectangle, exportSTEP, makeBox, makeCylinder, setOC, type EdgeFinder, type Shape3D } from "replicad";
import type { Caps, CutShape, Face } from "./model.ts";

export type CadCut = { face: Face; shape: CutShape; ca: number; cb: number; w: number; h: number; r: number };
export type CadInput = {
  w: number; d: number; t: number; r: number; L: number; u: boolean;
  caps: Caps; capT: number;
  cuts: CadCut[];
  wheel: {
    WX: number; WY: number; R: number; rIn: number; ringB: number; ringF: number; bumpB: number;
    bumpR: number; bumps: [number, number][]; capR: number; d: number;
  };
  want: { case: boolean; caps: boolean; ringStep: boolean; ringStl: boolean; buttonStep: boolean; buttonStl: boolean };
};
export type CadFile = { name: string; data: ArrayBuffer };

let ready: Promise<void> | null = null;
const init = () =>
  (ready ??= (opencascade as unknown as (o: object) => Promise<unknown>)({ locateFile: () => wasmUrl }).then((oc) => {
    setOC(oc as Parameters<typeof setOC>[0]);
  }));

/** A cutout as a prism through its wall: [origin, x direction, normal, depth]. */
function prism(c: CadCut, p: CadInput): Shape3D {
  const { w, d, t, L, capT } = p;
  const e = 0.5;
  const frame: Record<Face, [[number, number, number], [number, number, number], [number, number, number], number]> = {
    front: [[c.ca, c.cb, d - t - e], [1, 0, 0], [0, 0, 1], t + 2 * e],
    back: [[c.ca, c.cb, -e], [1, 0, 0], [0, 0, 1], t + 2 * e],
    left: [[-e, c.ca, c.cb], [0, 1, 0], [1, 0, 0], t + 2 * e],
    right: [[w - t - e, c.ca, c.cb], [0, 1, 0], [1, 0, 0], t + 2 * e],
    bottom: [[c.ca, capT + e, c.cb], [1, 0, 0], [0, -1, 0], capT + 2 * e],
    top: [[c.ca, L + e, c.cb], [1, 0, 0], [0, -1, 0], capT + 2 * e],
  };
  const [o, x, n, depth] = frame[c.face];
  const rr = c.shape === "slot" ? Math.min(c.w, c.h) / 2 - 1e-3 : Math.min(c.r, c.w / 2 - 1e-3, c.h / 2 - 1e-3);
  const drawing = c.shape === "circle" ? drawCircle(c.w / 2) : drawRoundedRectangle(c.w, c.h, rr > 0.01 ? rr : 0);
  return drawing.sketchOnPlane(new Plane(o, x, n)).extrude(depth) as Shape3D;
}

const cutAll = (s: Shape3D, tools: Shape3D[]) => tools.reduce((acc, tool) => acc.cut(tool), s);
/** The four long edges, for the profile's corner radius. */
const alongY = (e: EdgeFinder) => e.inDirection("Y");

function build(p: CadInput) {
  const { w, d, t, r, L, capT } = p;
  const out: { name: string; shape: Shape3D; step: boolean; stl: boolean }[] = [];
  const onWall = p.cuts.filter((c) => c.face !== "top" && c.face !== "bottom");
  if (p.want.case) {
    let outer: Shape3D = makeBox([0, 0, 0], [w, L, d]);
    if (r > 0.05) outer = outer.fillet(r, alongY);
    let inner: Shape3D = makeBox([t, -1, t], [w - t, L + 1, d - t]);
    if (r - t > 0.05) inner = inner.fillet(r - t, alongY);
    let tube = outer.cut(inner);
    if (p.u) {
      // U-channel: the front wall is a separate flat lid.
      const lidBox = makeBox([-1, -1, d - t], [w + 1, L + 1, d + 1]);
      const lid = cutAll(makeBox([0, 0, d - t], [w, L, d]), onWall.filter((c) => c.face === "front").map((c) => prism(c, p)));
      tube = cutAll(tube.cut(lidBox), onWall.filter((c) => c.face !== "front").map((c) => prism(c, p)));
      out.push({ name: "case", shape: tube, step: true, stl: false });
      out.push({ name: "case-lid", shape: lid, step: true, stl: false });
    } else out.push({ name: "case", shape: cutAll(tube, onWall.map((c) => prism(c, p))), step: true, stl: false });
  }
  if (p.want.caps && p.caps === "alu") {
    const ri = r - t;
    for (const [face, y0, y1] of [["top", L - capT, L], ["bottom", 0, capT]] as const) {
      let plate: Shape3D = makeBox([t, y0, t], [w - t, y1, d - t]);
      if (ri > 0.05) plate = plate.fillet(ri, alongY);
      out.push({ name: "cap-" + face, shape: cutAll(plate, p.cuts.filter((c) => c.face === face).map((c) => prism(c, p))), step: true, stl: false });
    }
  }
  const wh = p.wheel;
  if (p.want.ringStep || p.want.ringStl) {
    let ring: Shape3D = makeCylinder(wh.R, wh.ringF - wh.ringB, [wh.WX, wh.WY, wh.ringB], [0, 0, 1]);
    ring = ring.cut(makeCylinder(wh.rIn, wh.ringF - wh.ringB + 2, [wh.WX, wh.WY, wh.ringB - 1], [0, 0, 1]));
    for (const [x, y] of wh.bumps) ring = ring.fuse(makeCylinder(wh.bumpR, wh.ringB - wh.bumpB + 0.01, [x, y, wh.bumpB], [0, 0, 1]));
    out.push({ name: "wheel-ring", shape: ring, step: p.want.ringStep, stl: p.want.ringStl });
  }
  if (p.want.buttonStep || p.want.buttonStl) {
    const cap = makeCylinder(wh.capR, wh.d - wh.ringB, [wh.WX, wh.WY, wh.ringB], [0, 0, 1]);
    const plunger = makeCylinder(2, wh.ringB - wh.bumpB + 0.01, [wh.WX, wh.WY, wh.bumpB], [0, 0, 1]);
    out.push({ name: "centre-button", shape: cap.fuse(plunger), step: p.want.buttonStep, stl: p.want.buttonStl });
  }
  return out;
}

self.onmessage = async (e: MessageEvent<CadInput>) => {
  try {
    self.postMessage({ type: "progress", text: "Loading OpenCascade" });
    await init();
    self.postMessage({ type: "progress", text: "Building solids" });
    const solids = build(e.data);
    const files: CadFile[] = [];
    for (const s of solids) {
      // The U-channel lid goes in the same STEP as the channel.
      if (s.name === "case-lid") continue;
      if (s.step) {
        const group = s.name === "case" ? solids.filter((x) => x.name === "case" || x.name === "case-lid") : [s];
        const blob = exportSTEP(group.map((x) => ({ shape: x.shape, name: "opentone-" + x.name })), { unit: "MM", modelUnit: "MM" });
        files.push({ name: `opentone-${s.name}.step`, data: await blob.arrayBuffer() });
      }
      if (s.stl) files.push({ name: `opentone-${s.name}.stl`, data: await s.shape.blobSTL({ binary: true, tolerance: 0.01, angularTolerance: 0.1 }).arrayBuffer() });
    }
    (self as unknown as Worker).postMessage({ type: "done", files }, files.map((f) => f.data));
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
