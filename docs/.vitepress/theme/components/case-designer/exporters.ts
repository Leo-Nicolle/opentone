// File writers for the export step: STL, 3MF and faceted STEP for the fill mesh, the PDF cut
// sheet, and the zip they all go in. The exact solids come from cad.worker.ts.
import { zipSync } from "fflate";
import type { CadFile, CadInput } from "./cad.worker.ts";
import { FACEN, faceFrame, fx, isCap, type Derived, type Face, type Project } from "./model.ts";

export type MeshOut = { positions: Float32Array; indices: Uint32Array };

export function stlBinary(m: MeshOut): ArrayBuffer {
  const nt = m.indices.length / 3;
  const buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
  new TextEncoder().encodeInto("opentone case designer", new Uint8Array(buf, 0, 80));
  dv.setUint32(80, nt, true);
  const p = m.positions;
  let o = 84;
  for (let t = 0; t < nt; t++) {
    const a = m.indices[t * 3] * 3, b = m.indices[t * 3 + 1] * 3, c = m.indices[t * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const v of [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) { dv.setFloat32(o, v, true); o += 4; }
    o += 2;
  }
  return buf;
}

const f4 = (v: number) => (Math.round(v * 1e4) / 1e4).toString();

export function threeMF(m: MeshOut, name: string): Uint8Array {
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${name}</metadata><resources><object id="1" type="model" name="${name}"><mesh><vertices>`);
  const p = m.positions;
  for (let i = 0; i < p.length; i += 3) parts.push(`<vertex x="${f4(p[i])}" y="${f4(p[i + 1])}" z="${f4(p[i + 2])}"/>`);
  parts.push("</vertices><triangles>");
  for (let i = 0; i < m.indices.length; i += 3) parts.push(`<triangle v1="${m.indices[i]}" v2="${m.indices[i + 1]}" v3="${m.indices[i + 2]}"/>`);
  parts.push('</triangles></mesh></object></resources><build><item objectid="1"/></build></model>');
  const enc = new TextEncoder();
  return zipSync({
    "[Content_Types].xml": enc.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    "_rels/.rels": enc.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    "3D/3dmodel.model": enc.encode(parts.join("")),
  });
}

/** STEP AP214 with one planar face per triangle (FACETED_BREP). Large, but any CAM opens it. */
export function facetedStep(m: MeshOut, name: string): string {
  const L: string[] = [];
  let n = 0;
  const e = (s: string) => { L.push(`#${++n}=${s};`); return n; };
  const num = (v: number) => { const s = f4(v); return s.includes(".") || s.includes("e") ? s : s + "."; };
  const ctx = e("APPLICATION_CONTEXT('automotive design')");
  e(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${ctx})`);
  const pc = e(`PRODUCT_CONTEXT('',#${ctx},'mechanical')`);
  const prod = e(`PRODUCT('${name}','${name}','',(#${pc}))`);
  const pdf = e(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
  const pdc = e(`PRODUCT_DEFINITION_CONTEXT('part definition',#${ctx},'design')`);
  const pd = e(`PRODUCT_DEFINITION('design','',#${pdf},#${pdc})`);
  const pds = e(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  e(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#${prod}))`);
  const lu = e("(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))");
  const au = e("(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))");
  const su = e("(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())");
  const unc = e(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${lu},'distance_accuracy_value','')`);
  const gctx = e(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lu},#${au},#${su}))REPRESENTATION_CONTEXT('',''))`);
  const o = e("CARTESIAN_POINT('',(0.,0.,0.))");
  const dz = e("DIRECTION('',(0.,0.,1.))");
  const dx = e("DIRECTION('',(1.,0.,0.))");
  const ax = e(`AXIS2_PLACEMENT_3D('',#${o},#${dz},#${dx})`);
  const p = m.positions, pts: number[] = [];
  for (let i = 0; i < p.length; i += 3) pts.push(e(`CARTESIAN_POINT('',(${num(p[i])},${num(p[i + 1])},${num(p[i + 2])}))`));
  const faces: number[] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const loop = e(`POLY_LOOP('',(#${pts[m.indices[i]]},#${pts[m.indices[i + 1]]},#${pts[m.indices[i + 2]]}))`);
    const bound = e(`FACE_OUTER_BOUND('',#${loop},.T.)`);
    faces.push(e(`FACE('',(#${bound}))`));
  }
  const shell = e(`CLOSED_SHELL('',(${faces.map((f) => "#" + f).join(",")}))`);
  const brep = e(`FACETED_BREP('${name}',#${shell})`);
  const rep = e(`FACETED_BREP_SHAPE_REPRESENTATION('${name}',(#${ax},#${brep}),#${gctx})`);
  e(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
  const now = new Date().toISOString().slice(0, 19);
  return [
    "ISO-10303-21;", "HEADER;", `FILE_DESCRIPTION(('${name}, faceted'),'2;1');`,
    `FILE_NAME('${name}.step','${now}',(''),(''),'opentone case designer','','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", "ENDSEC;", "DATA;", ...L, "ENDSEC;", "END-ISO-10303-21;", "",
  ].join("\n");
}

/** The exact solids, from the OpenCascade worker. */
export function runCad(input: CadInput, onProgress: (text: string) => void): Promise<CadFile[]> {
  const w = new Worker(new URL("./cad.worker.ts", import.meta.url), { type: "module" });
  return new Promise((res, rej) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") onProgress(m.text);
      else {
        w.terminate();
        if (m.type === "done") res(m.files);
        else rej(new Error(m.message));
      }
    };
    w.onerror = (e) => { w.terminate(); rej(new Error(e.message || "The CAD worker failed to start.")); };
    w.postMessage(input);
  });
}

export function cadInput(p: Project, D: Derived, want: CadInput["want"]): CadInput {
  const wh = p.wheel;
  return {
    w: D.w, d: D.d, t: D.t, r: D.st.r, L: D.L, u: !!D.st.u, caps: p.caps, capT: p.capT,
    cuts: D.cutsW.map((c) => ({ face: c.face, shape: c.shape, ca: c.ca, cb: c.cb, w: c.w, h: c.h, r: c.r })),
    wheel: {
      WX: D.WX, WY: D.WY, R: wh.R, rIn: wh.rIn, ringB: D.ringB, ringF: D.ringF, bumpB: D.bumpB, bumpR: wh.bumpR, capR: wh.capR, d: D.d,
      bumps: D.B.filter((b) => b.id.startsWith("bump-")).map((b) => [b.Xc, b.Yc] as [number, number]),
    },
    want,
  };
}

/** One A4 page per face that gets milled, drawn 1:1 as seen from outside, with a table of cutouts. */
export async function cutSheet(p: Project, D: Derived): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const faces: Face[] = ["front", "back", "left", "right"];
  if (p.caps === "alu") faces.push("top", "bottom");
  const PW = 210;
  let first = true;
  for (const f of faces) {
    const cuts = D.cutsW.filter((c) => c.face === f);
    if (!cuts.length && f !== "front") continue;
    if (!first) doc.addPage();
    first = false;
    const fr = faceFrame(f, D.dims);
    const ox = (PW - fr.FW) / 2, oy = 40;
    const S = (a: number, b: number) => { const q = fr.toF(a, b); return [ox + q[0], oy + q[1]] as [number, number]; };
    doc.setFont("helvetica", "bold").setFontSize(13).text(`opentone case · ${FACEN[f]}`, 15, 16);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
    doc.text(
      `${fx(D.w)} × ${fx(D.d)} × ${fx(D.t)} ${D.st.kind.toLowerCase()}, ${fx(D.L)} mm long · seen from outside · scale 1:1 · smallest end mill Ø${p.toolD}`,
      15, 22,
    );
    doc.text(`Positions are cutout centres, from the left and top edges of this view, in mm.`, 15, 27);
    doc.setTextColor(0);
    // Face and cuttable region.
    doc.setLineWidth(0.3).setDrawColor(0).rect(ox, oy, fr.FW, fr.FH);
    const [ra, rb] = [S(fr.reg[0], fr.reg[2]), S(fr.reg[1], fr.reg[3])];
    doc.setLineDashPattern([1.5, 1.5], 0).setDrawColor(150);
    doc.rect(Math.min(ra[0], rb[0]), Math.min(ra[1], rb[1]), Math.abs(rb[0] - ra[0]), Math.abs(rb[1] - ra[1]));
    doc.setLineDashPattern([], 0).setDrawColor(0);
    doc.setFontSize(7).setTextColor(110);
    if (!isCap(f)) doc.text("top", ox + fr.FW / 2, oy - 2, { align: "center" });
    else doc.text("front", ox + fr.FW / 2, oy + fr.FH + 4, { align: "center" });
    doc.setTextColor(0);
    // Cutouts.
    const rows: string[][] = [];
    for (const c of cuts) {
      const q = c.loop.map(([a, b]) => S(a, b));
      const xs = q.map((v) => v[0]), ys = q.map((v) => v[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const [scx, scy] = S(c.ca, c.cb);
      doc.setLineWidth(0.35);
      if (c.shape === "circle") doc.circle(scx, scy, c.w / 2);
      else {
        const r = c.shape === "slot" ? Math.min(c.w, c.h) / 2 : Math.min(c.r, c.w / 2, c.h / 2);
        doc.roundedRect(x0, y0, x1 - x0, y1 - y0, r, r);
      }
      doc.setLineWidth(0.15).line(scx - 1.5, scy, scx + 1.5, scy).line(scx, scy - 1.5, scx, scy + 1.5);
      const size = c.shape === "circle" ? `Ø${fx(c.w)}` : `${fx(x1 - x0)} × ${fx(y1 - y0)}`;
      const r = c.shape === "circle" ? "—" : c.shape === "slot" ? `${fx(Math.min(c.w, c.h) / 2)} (slot)` : fx(c.r);
      rows.push([c.name, size, r, fx(scx - ox), fx(scy - oy)]);
    }
    // Table.
    let ty = Math.max(oy + fr.FH + 14, 60);
    if (ty > 260) { doc.addPage(); ty = 20; }
    const cols = [15, 75, 115, 145, 172];
    doc.setFontSize(8).setFont("helvetica", "bold");
    ["Cutout", "Size (w × h)", "Corner r", "From left", "From top"].forEach((h, i) => doc.text(h, cols[i], ty));
    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      ty += 5;
      r.forEach((v, i) => doc.text(v, cols[i], ty));
    });
    if (!rows.length) doc.text("No cutouts on this face.", 15, ty + 5);
  }
  return doc.output("arraybuffer");
}

export function zip(files: { name: string; data: ArrayBuffer | Uint8Array | string }[]): Uint8Array {
  const enc = new TextEncoder();
  const o: Record<string, Uint8Array> = {};
  for (const f of files) o[f.name] = typeof f.data === "string" ? enc.encode(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
  return zipSync(o);
}

export function download(data: BlobPart, name: string, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
