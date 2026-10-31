<template>
  <div class="cd-stack">
    <div>
      <h2 class="cd-h2">Click wheel</h2>
      <p class="cd-desc">A printed exoskeleton holds the flex PCB. Bumps behind it press the four switches on the main board; the centre button has its own plunger.</p>
    </div>
    <label class="cd-btn imp">
      <input type="file" accept=".json" class="hidden-input" @change="onFile" />
      Import from Click Wheel designer (JSON)
    </label>
    <div class="section">
      <div class="sec-head"><span>Section through the wheel centre</span><span class="cd-mono">depth ×2</span></div>
      <svg viewBox="0 0 300 132" role="img" aria-label="Cross-section of the wheel stack: case front wall, flex PCB, exoskeleton, bumps, switches and main PCB">
        <rect v-for="(r, i) in sec" :key="i" :x="r.x" :y="r.y" :width="r.w" :height="r.h" :style="{ fill: r.fill }" />
      </svg>
      <div class="legend">
        <span v-for="l in legend" :key="l.n"><span class="sw" :style="{ background: l.c }"></span>{{ l.n }}</span>
      </div>
    </div>
    <div class="cd-group">
      <Field id="wR" v-model="w.R" label="Outer radius" :step="0.5" :min="8" :max="28" />
      <Field id="wRi" v-model="w.rIn" label="Ring inner radius" :step="0.25" :min="3" :max="20" />
      <Field id="wT" v-model="w.ringT" label="Exoskeleton thickness" :step="0.1" :min="0.8" :max="6" />
      <Field id="wBH" v-model="w.bumpH" label="Bump height" :step="0.1" :min="0.2" :max="4" />
      <Field id="wBR" v-model="w.bumpR" label="Bump radius" :step="0.25" :min="0.5" :max="4" />
      <Field id="wBP" v-model="w.bumpPos" label="Bump distance from centre" :step="0.5" :min="2" :max="26" />
      <Field id="wCR" v-model="w.capR" label="Centre button radius" :step="0.25" :min="3" :max="18" />
      <Field id="wCl" v-model="w.clear" label="Cutout clearance" :step="0.05" :min="0" :max="1.5" />
      <Field id="wX" v-model="w.cx" label="X from centre line" :step="0.5" />
      <Field id="wY" v-model="w.cy" label="Y from bottom" :step="0.5" />
    </div>
    <div class="table">
      <div class="tr th"><span>Button</span><span>Offset</span><span>Pre-travel</span></div>
      <div v-for="b in bumps" :key="b.name" class="tr">
        <span class="nm"><span class="cd-dot" :style="{ background: b.dot, width: '7px', height: '7px' }"></span>{{ b.name }}<span class="ref cd-mono">{{ b.ref }}</span></span>
        <span class="cd-mono" :style="{ color: b.offFg }">{{ b.off }}</span>
        <span class="cd-mono" :style="{ color: b.preFg }">{{ b.pre }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { MAT, fx, rgba } from "./model.ts";
import Field from "./Field.vue";

const s = inject(CASE)!;
const w = s.project.wheel;

// Horizontal cut at the wheel's Y, ±24 mm around its centre, depth drawn ×2.
const sec = computed(() => {
  const D = s.D.value, d = D.d, t = D.t, WX = D.WX, WY = D.WY;
  const x0 = WX - 24, SX = 6.25, SZ = 12, zTop = d + 0.5, zBot = zTop - 10.3;
  const out: { x: string; y: string; w: string; h: string; fill: string }[] = [];
  const rect = (a0: number, a1: number, z0: number, z1: number, fill: string) => {
    const a = Math.max(a0, x0), b = Math.min(a1, x0 + 48), zz0 = Math.max(z0, zBot), zz1 = Math.min(z1, zTop);
    if (b <= a || zz1 <= zz0) return;
    out.push({ x: ((a - x0) * SX).toFixed(1), y: ((zTop - zz1) * SZ + 4).toFixed(1), w: ((b - a) * SX).toFixed(1), h: Math.max(0.8, (zz1 - zz0) * SZ).toFixed(1), fill });
  };
  const cw = D.cutsW.find((c) => c.link === "wheel" && c.face === "front");
  const hw = cw ? cw.w / 2 : 0;
  rect(0, WX - hw, d - t, d, rgba(MAT.alu, 0.85));
  rect(WX + hw, D.w, d - t, d, rgba(MAT.alu, 0.85));
  for (const b of D.B) {
    if (b.Y0 > WY || b.Y1 < WY) continue;
    const col = rgba(MAT[b.mat], 0.95);
    if (b.cyl) {
      const dy = WY - b.Yc;
      if (Math.abs(dy) >= b.R) continue;
      const hc = Math.sqrt(b.R * b.R - dy * dy);
      if (b.rIn && Math.abs(dy) < b.rIn) {
        const hi = Math.sqrt(b.rIn * b.rIn - dy * dy);
        rect(b.Xc - hc, b.Xc - hi, b.Z0, b.Z1, col);
        rect(b.Xc + hi, b.Xc + hc, b.Z0, b.Z1, col);
      } else rect(b.Xc - hc, b.Xc + hc, b.Z0, b.Z1, col);
    } else rect(b.X0, b.X1, b.Z0, b.Z1, col);
  }
  return out;
});
const legend = ([["Case", "alu"], ["Flex PCB", "flex"], ["Exoskeleton", "plastic"], ["Switches", "tact"], ["Main PCB", "pcb"]] as const).map(([n, m]) => ({ n, c: rgba(MAT[m], 0.95) }));

const bumps = computed(() =>
  s.D.value.bumpRows.map((r) => {
    const offBad = r.off != null && r.off > 0.5, preBad = r.pre != null && (r.pre < 0 || r.pre > 0.6), neg = r.pre != null && r.pre < 0;
    return {
      name: r.name, ref: r.ref,
      off: r.off == null ? "—" : fx(r.off) + " mm", pre: r.pre == null ? "—" : fx(r.pre) + " mm",
      offFg: offBad ? "var(--amber)" : "var(--text)", preFg: neg ? "var(--red)" : preBad ? "var(--amber)" : "var(--text)",
      dot: neg ? "var(--red)" : offBad || preBad ? "var(--amber)" : "var(--green)",
    };
  }),
);
function onFile(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.files?.[0]) s.importWheel(el.files[0]);
  el.value = "";
}
</script>

<style scoped>
.imp {
  position: relative;
  height: 36px;
  cursor: pointer;
}
.imp:focus-within {
  background: var(--surface2);
}
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  background: var(--vp);
  border: 1px solid var(--line);
}
.sec-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}
svg {
  width: 100%;
  height: auto;
  display: block;
}
rect {
  stroke: var(--vp);
  stroke-width: 0.6;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.legend > span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.table {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
}
.tr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 72px;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid var(--line);
  font-size: 13px;
  align-items: center;
}
.tr > span:not(.nm) {
  font-size: 12px;
  text-align: right;
}
.th {
  border-top: 0;
  padding: 10px 0 6px;
  color: var(--muted);
}
.th > span {
  font-size: 12px;
}
.th > span:first-child {
  text-align: left !important;
}
.nm {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ref {
  font-size: 11px;
  color: var(--muted);
}
</style>
