// The case designer's shared state: the project (saved as *.case.json), the UI state (not
// saved), and the actions the panels call. Made once per <CaseDesigner> and handed to its
// panels with provide/inject.
import { computed, reactive, ref, shallowRef, watch, nextTick, type InjectionKey } from "vue";
import { useData } from "vitepress";
import {
  BUMPS, D2R, derive, fx, isCap, isSide, r3, sampleProject, type Cut, type Face, type Part, type Project,
} from "./model.ts";
import { bounds, centred, getMesh, mergeMeshes, putMesh, worldTriangles, type MeshData } from "./meshes.ts";
import { guessRole, readModel, readWheelJson, refOf, type Imported } from "./importers.ts";
import { signedVolume, type FillInput, type FillOutput, type Solid } from "./fill.ts";
import { cadInput, cutSheet, download, facetedStep, runCad, stlBinary, threeMF, zip } from "./exporters.ts";

export type Step = "stock" | "parts" | "cuts" | "wheel" | "fill" | "export";
export const STEPS: [Step, string][] = [["stock", "Stock"], ["parts", "Parts"], ["cuts", "Cutouts"], ["wheel", "Wheel"], ["fill", "Fill"], ["export", "Export"]];
export type FillHalfMesh = { name: string; positions: Float32Array; indices: Uint32Array; volume: number };
export type FillResult = { hash: string; halves: FillHalfMesh[]; res: number };

const LOCAL_KEY = "opentone-case-designer:project";
const FILL_KEY = "fill";

/** Short, stable hash of a string (FNV-1a), for the fill's staleness check. */
export function hashStr(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function loadLocal(): Project | null {
  try {
    const s = localStorage.getItem(LOCAL_KEY);
    return s ? normalise(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

/** A project from a file, with any missing settings taken from the sample. */
function normalise(j: Partial<Project>): Project {
  if (!j || j.version !== 1 || !Array.isArray(j.parts)) throw new Error("This isn't a case designer project (version 1).");
  const base = sampleProject();
  return {
    ...base, ...j,
    stock: { ...base.stock, ...j.stock, custom: { ...base.stock.custom, ...j.stock?.custom } },
    wheel: { ...base.wheel, ...j.wheel },
    fill: { ...base.fill, ...j.fill },
    export: { on: { ...base.export.on, ...j.export?.on }, fmt: { ...base.export.fmt, ...j.export?.fmt } },
    parts: j.parts.map((p) => ({ ...p, role: p.role ?? "", rot: p.rot ?? 0, file: p.file ?? "" })),
    hidden: j.hidden ?? {},
    cuts: j.cuts ?? [],
  } as Project;
}

export function createCaseDesigner() {
  const { isDark } = useData();
  const project = reactive<Project>(sampleProject());
  const ui = reactive({
    step: "stock" as Step,
    view: "3d" as "3d" | "face",
    face: "front" as Face,
    sel: "jack",
    yaw: -35,
    pitch: 22,
    zoom: 1,
    caseMode: "solid" as "solid" | "ghost" | "hidden",
    exploded: false,
    showFill: true,
    dragInfo: "",
    dragging: false,
    note: "",
    error: "",
  });
  const D = computed(() => derive(project));
  /** Bumped whenever a mesh arrives, so the views and the fill pick it up. */
  const meshVersion = ref(0);

  // --- Saving, undo/redo ---------------------------------------------------------------------
  const savedAt = ref("");
  const savedJson = ref("");
  const json = () => JSON.stringify(project);
  const history: string[] = [];
  let hIndex = -1, applying = false, hTimer: ReturnType<typeof setTimeout> | undefined, lsTimer: ReturnType<typeof setTimeout> | undefined;
  const canUndo = ref(false), canRedo = ref(false);
  const syncFlags = () => { canUndo.value = hIndex > 0; canRedo.value = hIndex < history.length - 1; };
  function push(s = json()) {
    if (s === history[hIndex]) return;
    history.splice(hIndex + 1);
    history.push(s);
    if (history.length > 120) history.shift();
    hIndex = history.length - 1;
    syncFlags();
  }
  function replace(p: Project) {
    for (const k of Object.keys(project) as (keyof Project)[]) delete (project as Partial<Project>)[k];
    Object.assign(project, p);
  }
  function applyHistory(i: number) {
    hIndex = i;
    applying = true;
    replace(JSON.parse(history[i]));
    nextTick(() => (applying = false));
    syncFlags();
  }
  const undo = () => { if (hIndex > 0) applyHistory(hIndex - 1); };
  const redo = () => { if (hIndex < history.length - 1) applyHistory(hIndex + 1); };
  watch(json, (s) => {
    clearTimeout(lsTimer);
    lsTimer = setTimeout(() => { try { localStorage.setItem(LOCAL_KEY, s); } catch { /* full or blocked */ } }, 400);
    if (applying || ui.dragging) return;
    clearTimeout(hTimer);
    hTimer = setTimeout(() => push(s), 250);
  });
  /** One undo entry per drag: call when it starts and when it ends. */
  function dragStart() { clearTimeout(hTimer); push(); ui.dragging = true; }
  function dragEnd() { ui.dragging = false; ui.dragInfo = ""; push(); }

  const saveLabel = computed(() => (savedAt.value && savedJson.value === json() ? `saved ${savedAt.value}` : "not saved"));
  function save() {
    const s = JSON.stringify(project, null, 2);
    download(s, `${project.name}.case.json`, "application/json");
    savedJson.value = json();
    savedAt.value = new Date().toTimeString().slice(0, 5);
  }
  async function open(file: File) {
    try {
      const p = normalise(JSON.parse(await file.text()));
      p.name = file.name.replace(/\.case\.json$|\.json$/i, "") || p.name;
      replace(p);
      ui.sel = "";
      savedJson.value = json();
      savedAt.value = new Date().toTimeString().slice(0, 5);
      await loadMeshes();
      push();
    } catch (e) {
      ui.error = `Couldn't open ${file.name}: ${(e as Error).message}`;
    }
  }
  async function loadMeshes() {
    const missing: string[] = [];
    await Promise.all(project.parts.filter((p) => p.mesh).map(async (p) => {
      if (!(await getMesh(p.mesh!))) missing.push(p.name);
    }));
    meshVersion.value++;
    if (missing.length) ui.note = `No mesh stored in this browser for ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}: they show as boxes. Import their files again to see them.`;
    const h = project.fill.builtHash;
    if (h && !fillMesh.value) {
      const names = project.fill.split === "none" ? ["fill"] : ["back", "front"];
      const ms = await Promise.all(names.map((n) => getMesh(`${FILL_KEY}:${h}:${n}`)));
      if (ms.every(Boolean)) fillMesh.value = { hash: h, res: project.fill.res, halves: ms.map((m, i) => ({ name: names[i], positions: m!.positions, indices: m!.indices!, volume: Math.abs(signedVolume(m!.positions, m!.indices!)) })) };
    }
  }
  function init() {
    const p = loadLocal();
    if (p) replace(p);
    push();
    loadMeshes();
  }

  // --- Selection and steps -------------------------------------------------------------------
  function setStep(s: Step) {
    ui.step = s;
    ui.view = s === "cuts" ? "face" : "3d";
  }
  function select(k: string) { ui.sel = k; }
  /** A check's culprit: cutouts open the Faces view on their face. */
  function goTo(id: string) {
    if (id.startsWith("cut:")) {
      const c = project.cuts.find((x) => "cut:" + x.id === id);
      ui.sel = id;
      ui.view = "face";
      if (c) ui.face = c.face;
    } else {
      ui.sel = id;
      ui.view = "3d";
    }
  }
  const part = (id: string) => project.parts.find((p) => p.id === id);
  const children = (id: string) => project.parts.filter((p) => p.parent === id);

  // --- Parts ---------------------------------------------------------------------------------
  /** Moves a part; a board's children move with it. */
  function setPart(id: string, k: "cx" | "cy" | "cz", v: number) {
    const p = part(id);
    if (!p) return;
    const dv = v - p[k];
    p[k] = r3(v);
    for (const c of children(id)) c[k] = r3(c[k] + dv);
  }
  /** Quarter turn about Z, in the front plane; a board turns its children around its centre. */
  function rotatePart(id: string) {
    const p = part(id);
    if (!p) return;
    const turn = (q: Part) => { q.rot = (q.rot + 90) % 360; [q.sx, q.sy] = [q.sy, q.sx]; };
    for (const c of children(id)) {
      const dx = c.cx - p.cx, dy = c.cy - p.cy;
      c.cx = r3(p.cx - dy);
      c.cy = r3(p.cy + dx);
      turn(c);
    }
    turn(p);
  }
  function toggleHidden(k: string) { project.hidden[k] = !project.hidden[k]; }
  function removePart(id: string) {
    const gone = new Set([id, ...children(id).map((c) => c.id)]);
    project.parts = project.parts.filter((p) => !gone.has(p.id));
    for (const k of gone) delete project.hidden[k];
    if (gone.has(ui.sel)) ui.sel = "";
  }
  function removePlaceholders() {
    for (const p of project.parts.filter((q) => !q.parent && !q.mesh)) removePart(p.id);
  }
  const hasPlaceholders = computed(() => project.parts.some((p) => !p.mesh));

  let pid = 0;
  const newId = (base: string) => {
    let id: string;
    do id = `${base}${++pid}`; while (project.parts.some((p) => p.id === id));
    return id;
  };

  async function importFiles(files: FileList | File[]) {
    ui.error = "";
    for (const f of Array.from(files)) {
      if (/\.json$/i.test(f.name)) { await open(f); continue; }
      ui.note = `Reading ${f.name}…`;
      try {
        addImported(await readModel(f));
        ui.note = "";
      } catch (e) {
        ui.note = "";
        ui.error = `Couldn't import ${f.name}: ${(e as Error).message}`;
      }
    }
    meshVersion.value++;
  }

  /** Stores a mesh centred on its bounds; returns its key and size. */
  function storeItem(key: string, m: MeshData) {
    const b = bounds(m.positions);
    putMesh(key, { positions: centred(m.positions, b.centre), indices: m.indices });
    return b;
  }

  function addImported(im: Imported) {
    const { d } = D.value;
    if (im.board < 0) {
      im.items.forEach((it, i) => {
        const key = `${im.hash}:${i}`;
        const b = storeItem(key, it.mesh);
        const g = guessRole(`${it.name} ${im.file}`);
        // A placeholder with the same role is replaced in place.
        const ph = g.role ? project.parts.find((p) => !p.mesh && !p.parent && p.role === g.role) : undefined;
        const np: Part = {
          id: newId("p"), name: it.name, file: im.file, role: g.role, mat: g.mat,
          cx: ph?.cx ?? 0, cy: ph?.cy ?? r3(project.L / 2), cz: ph?.cz ?? r3(d / 2),
          sx: r3(b.size[0]), sy: r3(b.size[1]), sz: r3(b.size[2]), rot: 0, mesh: key,
        };
        if (ph) removePart(ph.id);
        project.parts.push(np);
        ui.sel = np.id;
      });
      return;
    }
    // A KiCad board: the board, its tall components one by one, the small ones merged.
    const bi = im.items[im.board];
    const bb = storeItem(`${im.hash}:${im.board}`, bi.mesh);
    const ph = project.parts.find((p) => !p.mesh && !p.parent && project.parts.some((c) => c.parent === p.id));
    const board: Part = {
      id: newId("board"), name: "Main PCB", file: im.file, role: "", mat: "pcb",
      cx: ph?.cx ?? 0, cy: ph?.cy ?? r3(project.L / 2), cz: ph?.cz ?? r3(d / 2),
      sx: r3(bb.size[0]), sy: r3(bb.size[1]), sz: r3(bb.size[2]), rot: 0, mesh: `${im.hash}:${im.board}`,
    };
    if (ph) removePart(ph.id);
    project.parts.push(board);
    const small: MeshData[] = [];
    const place = (c: number[]) => ({
      cx: r3(board.cx + (c[0] - bb.centre[0])), cy: r3(board.cy + (c[1] - bb.centre[1])), cz: r3(board.cz - (c[2] - bb.centre[2])),
    });
    im.items.forEach((it, i) => {
      if (i === im.board) return;
      const b = bounds(it.mesh.positions);
      if (Math.max(b.size[0], b.size[1]) < 4 && b.size[2] < 1.5) { small.push(it.mesh); return; }
      const key = `${im.hash}:${i}`;
      storeItem(key, it.mesh);
      const g = guessRole(it.name);
      project.parts.push({
        id: newId("c"), name: it.name, ref: refOf(it.name), parent: board.id, file: im.file, role: g.role, mat: g.mat,
        ...place(b.centre), sx: r3(b.size[0]), sy: r3(b.size[1]), sz: r3(b.size[2]), rot: 0, mesh: key,
      });
    });
    if (small.length) {
      const m = mergeMeshes(small), key = `${im.hash}:small`, b = storeItem(key, m);
      project.parts.push({
        id: newId("c"), name: `Small parts (${small.length})`, parent: board.id, file: im.file, role: "", mat: "conn",
        ...place(b.centre), sx: r3(b.size[0]), sy: r3(b.size[1]), sz: r3(b.size[2]), rot: 0, mesh: key,
      });
    }
    matchSwitches(board.id);
    ui.sel = board.id;
  }

  /** Gives the board's unassigned tactile switches the wheel role whose bump is right above. */
  function matchSwitches(boardId: string) {
    const { WX, WY } = D.value;
    const wh = project.wheel;
    const spots: [Part["role"], number, number][] = [
      ...BUMPS.map(([role, , a]) => [role, WX + wh.bumpPos * Math.cos(a * D2R), WY + wh.bumpPos * Math.sin(a * D2R)] as [Part["role"], number, number]),
      ["select", WX, WY],
    ];
    const w = D.value.w;
    for (const [role, x, y] of spots) {
      if (project.parts.some((p) => p.role === role && p.mesh)) continue;
      const cand = children(boardId)
        .filter((p) => p.mat === "tact" && !p.role)
        .map((p) => ({ p, dist: Math.hypot(w / 2 + p.cx - x, p.cy - y) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (cand && cand.dist < 4) {
        for (const ph of project.parts.filter((q) => q.role === role && !q.mesh)) ph.role = "";
        cand.p.role = role;
      }
    }
  }

  // --- Cutouts -------------------------------------------------------------------------------
  const cut = (id: string) => project.cuts.find((c) => c.id === id);
  function setCut(id: string, patch: Partial<Cut>) {
    const c = cut(id);
    if (c) Object.assign(c, patch);
  }
  /** Before a drag or resize: a linked cutout lets go, keeping where and how big it is now. */
  function unlink(id: string) {
    const c = D.value.cutsW.find((x) => x.id === id);
    if (c && c.follow) setCut(id, { follow: false, u: r3(c.u), v: r3(c.v), w: r3(c.w), h: r3(c.h) });
  }
  function setFollow(id: string, on: boolean) {
    const c = D.value.cutsW.find((x) => x.id === id);
    if (c) setCut(id, { follow: on, u: r3(c.u), v: r3(c.v), w: r3(c.w), h: r3(c.h) });
  }
  function addCut(f: Face) {
    const n = ++project.nCut, id = "cx" + n, side = isSide(f), cap = isCap(f);
    const { d, L } = D.value;
    project.cuts.push({
      id, name: "Cutout " + n, face: f, shape: "rect", w: cap ? 8 : 10, h: side || cap ? 3 : 6, r: 1.5, link: null, follow: false,
      u: side ? Math.round(L / 2) : 0, v: side || cap ? Math.round(d / 2) : Math.round(L / 2),
    });
    ui.sel = "cut:" + id;
    ui.face = f;
    ui.view = "face";
  }
  function deleteCut(id: string) {
    project.cuts = project.cuts.filter((c) => c.id !== id);
    ui.sel = "case";
  }

  // --- Wheel ---------------------------------------------------------------------------------
  async function importWheel(file: File) {
    try {
      const { R, flexIn } = await readWheelJson(file);
      if (R == null) throw new Error("no radius in it");
      project.wheel.R = r3(R);
      if (flexIn != null) project.wheel.flexIn = r3(flexIn);
      ui.note = `Wheel: outer radius ${fx(R)} mm${flexIn != null ? `, flex inner radius ${fx(flexIn)} mm` : ""}, from ${file.name}.`;
    } catch (e) {
      ui.error = `Couldn't read ${file.name}: ${(e as Error).message}`;
    }
  }

  // --- Fill ----------------------------------------------------------------------------------
  const fillRun = reactive({ running: false, pct: 0, stage: 0, error: "" });
  const fillMesh = shallowRef<FillResult | null>(null);
  const sigHash = computed(() => hashStr(D.value.sig));
  const fillState = computed<"idle" | "run" | "done" | "stale">(() =>
    fillRun.running ? "run" : fillMesh.value ? (fillMesh.value.hash === sigHash.value ? "done" : "stale") : "idle");
  const fillStages = computed(() => {
    const fl = project.fill, sz = D.value.splitZ;
    return [
      "Voxelising the inside of the tube",
      `Subtracting ${D.value.B.length} parts + ${fx(fl.clear)} mm`,
      fl.method === "sdf" ? `Blending pockets, r ${fx(fl.smooth)} mm` : "Removing islands",
      sz != null ? `Splitting at ${fx(sz)} mm` : "Checking walls",
      "Meshing",
    ];
  });
  const fillVolume = computed(() => (fillMesh.value ? fillMesh.value.halves.reduce((a, h) => a + h.volume, 0) : D.value.fillV));

  function fillInput(): FillInput {
    const Dv = D.value, fl = project.fill, inner = Dv.inner;
    const printed = project.caps === "printed";
    const box = { ...inner, y0: printed ? 0 : inner.y0, y1: printed ? Dv.L : inner.y1 };
    const solids: Solid[] = [];
    for (const b of Dv.B) {
      if (b.cyl) { solids.push({ kind: "cyl", Xc: b.Xc, Yc: b.Yc, R: b.R, rIn: b.rIn, Z0: b.Z0, Z1: b.Z1 }); continue; }
      const m = b.part?.mesh ? peek(b.part.mesh) : undefined;
      if (m) solids.push({ kind: "tris", tris: worldTriangles(m, b.part!.rot, [b.Xc, b.Yc, b.Zc]) });
      else solids.push({ kind: "box", X0: b.X0, X1: b.X1, Y0: b.Y0, Y1: b.Y1, Z0: b.Z0, Z1: b.Z1 });
    }
    const holes: Solid[] = [];
    if (printed)
      for (const c of Dv.cutsW.filter((x) => isCap(x.face))) {
        const r = c.shape === "slot" ? Math.min(c.w, c.h) / 2 : c.shape === "circle" ? c.w / 2 : c.r;
        const [Y0, Y1] = c.face === "bottom" ? [-1, project.capT + 0.01] : [Dv.L - project.capT - 0.01, Dv.L + 1];
        holes.push({ kind: "prismY", cx: c.ca, cz: c.cb, w: c.w, h: c.h, r, Y0, Y1 });
      }
    const batt = Dv.B.find((b) => b.part?.role === "battery"), pcb = Dv.pcbB;
    if (fl.channel && batt && pcb) {
      // 4 × 2 mm, from the battery's top edge to the board.
      const z0 = Math.min(batt.Zc, pcb.Z0), z1 = Math.max(batt.Zc, pcb.Z0);
      holes.push({ kind: "box", X0: batt.Xc - 2, X1: batt.Xc + 2, Y0: batt.Y1 - 1, Y1: batt.Y1 + 1, Z0: z0, Z1: z1 + 0.5 });
    }
    return {
      box, res: fl.res, method: fl.method, clear: fl.clear, minWall: fl.minWall, smooth: fl.smooth,
      splitZ: Dv.splitZ, solids, holes, stages: fillStages.value,
    };
  }
  const peek = (k: string) => meshCache.get(k);
  const meshCache = new Map<string, MeshData>();
  async function cacheMeshes() {
    await Promise.all(project.parts.filter((p) => p.mesh).map(async (p) => {
      const m = await getMesh(p.mesh!);
      if (m) meshCache.set(p.mesh!, m);
    }));
  }

  let fillWorker: Worker | null = null;
  async function buildFill() {
    if (fillRun.running) return;
    fillRun.running = true;
    fillRun.pct = 0;
    fillRun.stage = 0;
    fillRun.error = "";
    await cacheMeshes();
    const hash = sigHash.value, input = fillInput();
    fillWorker?.terminate();
    const w = (fillWorker = new Worker(new URL("./fill.worker.ts", import.meta.url), { type: "module" }));
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") { fillRun.stage = m.stage; fillRun.pct = m.pct; return; }
      fillRun.running = false;
      w.terminate();
      fillWorker = null;
      if (m.type === "error") { fillRun.error = m.message; return; }
      const out = m.out as FillOutput;
      fillMesh.value = { hash, res: out.res, halves: out.halves };
      project.fill.builtHash = hash;
      ui.showFill = true;
      if (out.res > project.fill.res + 1e-6) ui.note = `The fill was built at ${fx(out.res)} mm voxels: ${fx(project.fill.res)} mm would take too much memory.`;
      for (const h of out.halves) putMesh(`${FILL_KEY}:${hash}:${h.name}`, { positions: h.positions, indices: h.indices });
    };
    w.onerror = (e) => { fillRun.running = false; fillRun.error = e.message || "The fill worker failed."; };
    w.postMessage(input, input.solids.flatMap((s) => (s.kind === "tris" ? [s.tris.buffer] : [])));
  }

  // --- Export --------------------------------------------------------------------------------
  type FmtChip = { label: string; on: boolean; fixed?: boolean; toggle?: () => void };
  type ExportRow = { k: keyof Project["export"]["on"]; name: string; sub: string; fmts: FmtChip[]; files: string[]; dis?: boolean };
  const exportRows = computed<ExportRow[]>(() => {
    const Dv = D.value, fmt = project.export.fmt, fs = fillState.value;
    const halves = Dv.splitZ != null;
    const ready = fs === "done" || fs === "stale";
    const stockLabel = `${fx(Dv.w)} × ${fx(Dv.d)} × ${fx(Dv.t)}`;
    const chip = <K extends "wheel" | "button" | "fill">(rk: K, f: keyof Project["export"]["fmt"][K], label: string): FmtChip => ({
      label, on: !!project.export.fmt[rk][f], toggle: () => { (project.export.fmt[rk] as Record<string, boolean>)[f as string] = !project.export.fmt[rk][f]; },
    });
    const fixed = (label: string): FmtChip[] => [{ label, on: true, fixed: true }];
    const rows: (ExportRow | null)[] = [
      { k: "case", name: "Case tube", sub: `${stockLabel} ${Dv.st.kind.toLowerCase()}, ${fx(Dv.L)} mm long, ${Dv.cutsW.filter((c) => !isCap(c.face)).length} cutouts`, fmts: fixed("STEP AP214"), files: ["opentone-case.step"] },
      project.caps === "alu"
        ? { k: "caps", name: "End caps ×2", sub: `${fx(Dv.w - 2 * Dv.t)} × ${fx(Dv.d - 2 * Dv.t)} × ${fx(project.capT)} mm plate, with their cutouts`, fmts: fixed("STEP AP214"), files: ["opentone-cap-top.step", "opentone-cap-bottom.step"] }
        : null,
      { k: "wheel", name: "Wheel exoskeleton", sub: "Ring with 4 bumps · print in a stiff resin or mill from POM", fmts: [chip("wheel", "step", "STEP"), chip("wheel", "stl", "STL")], files: [] },
      { k: "button", name: "Centre button", sub: "Cap and plunger, one body", fmts: [chip("button", "step", "STEP"), chip("button", "stl", "STL")], files: [] },
      {
        k: "fill", name: halves ? "Fill, front and back halves" : "Fill",
        sub: ready ? (fs === "stale" ? "Out of date: rebuild it in step 5 first" : `Built · ${fx(fillVolume.value / 1000)} cm³`) + (project.caps === "printed" ? ", caps included" : "") : "Not built yet: build it in step 5",
        fmts: [chip("fill", "3mf", "3MF"), chip("fill", "stl", "STL"), chip("fill", "step", "STEP, faceted")], files: [], dis: !ready,
      },
      { k: "sheet", name: "Cut sheet", sub: "Dimensioned drawing of every face, to set up the mill", fmts: fixed("PDF"), files: ["opentone-cut-sheet.pdf"] },
      { k: "project", name: "Project file", sub: "Stock, placements, cutouts and settings, to reopen here", fmts: fixed("JSON"), files: [`${project.name}.case.json`] },
    ];
    const out = rows.filter(Boolean) as ExportRow[];
    for (const r of out) {
      if (r.k === "wheel" || r.k === "button") {
        const base = r.k === "wheel" ? "opentone-wheel-ring" : "opentone-centre-button";
        if (fmt[r.k].step) r.files.push(base + ".step");
        if (fmt[r.k].stl) r.files.push(base + ".stl");
      }
      if (r.k === "fill") {
        const names = halves ? ["opentone-fill-front", "opentone-fill-back"] : ["opentone-fill"];
        for (const [f, ext] of [["3mf", "3mf"], ["stl", "stl"], ["step", "step"]] as const) if (fmt.fill[f]) for (const n of names) r.files.push(`${n}.${ext}`);
      }
    }
    return out;
  });
  const exportFiles = computed(() => exportRows.value.filter((r) => project.export.on[r.k] && !r.dis).flatMap((r) => r.files));
  const exp = reactive({ running: false, pct: 0, text: "", done: false, files: [] as string[], error: "" });

  async function runExport() {
    if (exp.running || !exportFiles.value.length) return;
    Object.assign(exp, { running: true, pct: 0.02, text: "Starting", done: false, files: [], error: "" });
    try {
      const on = project.export.on, fmt = project.export.fmt, Dv = D.value;
      const files: { name: string; data: ArrayBuffer | Uint8Array | string }[] = [];
      const want = {
        case: on.case, caps: on.caps && project.caps === "alu",
        ringStep: on.wheel && fmt.wheel.step, ringStl: on.wheel && fmt.wheel.stl,
        buttonStep: on.button && fmt.button.step, buttonStl: on.button && fmt.button.stl,
      };
      if (Object.values(want).some(Boolean)) {
        exp.pct = 0.1;
        files.push(...(await runCad(cadInput(project, Dv, want), (t) => { exp.text = t; exp.pct = Math.min(0.6, exp.pct + 0.15); })));
      }
      exp.pct = 0.65;
      const fm = fillMesh.value;
      if (on.fill && fm && fillState.value !== "idle") {
        exp.text = "Writing the fill";
        for (const h of fm.halves) {
          const base = fm.halves.length > 1 ? `opentone-fill-${h.name}` : "opentone-fill";
          if (fmt.fill["3mf"]) files.push({ name: base + ".3mf", data: threeMF(h, base) });
          if (fmt.fill.stl) files.push({ name: base + ".stl", data: stlBinary(h) });
          if (fmt.fill.step) files.push({ name: base + ".step", data: facetedStep(h, base) });
        }
      }
      exp.pct = 0.8;
      if (on.sheet) { exp.text = "Drawing the cut sheet"; files.push({ name: "opentone-cut-sheet.pdf", data: await cutSheet(project, Dv) }); }
      if (on.project) files.push({ name: `${project.name}.case.json`, data: JSON.stringify(project, null, 2) });
      exp.pct = 0.95;
      download(zip(files), "opentone-case.zip", "application/zip");
      Object.assign(exp, { running: false, pct: 1, done: true, files: files.map((f) => f.name) });
    } catch (e) {
      Object.assign(exp, { running: false, error: (e as Error).message });
    }
  }

  // --- Theme ---------------------------------------------------------------------------------
  const toggleTheme = () => { isDark.value = !isDark.value; };

  return {
    project, ui, D, meshVersion, isDark, toggleTheme,
    saveLabel, save, open, init, undo, redo, canUndo, canRedo, dragStart, dragEnd,
    setStep, select, goTo, part, children,
    setPart, rotatePart, toggleHidden, removePart, removePlaceholders, hasPlaceholders, importFiles,
    setCut, unlink, setFollow, addCut, deleteCut,
    importWheel,
    fillRun, fillMesh, fillState, fillStages, fillVolume, buildFill,
    exportRows, exportFiles, exp, runExport,
  };
}

export type CaseDesigner = ReturnType<typeof createCaseDesigner>;
export const CASE: InjectionKey<CaseDesigner> = Symbol("case-designer");
