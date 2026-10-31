<template>
  <div class="cd-stack gap18">
    <div>
      <h2 class="cd-h2">Aluminium stock</h2>
      <p class="cd-desc">Pick a standard profile and a cut length. Parts keep their distance from the front face and the centre line when you switch.</p>
    </div>
    <div class="rows">
      <button v-for="r in rows" :key="r.id" type="button" class="cd-card stock" :aria-pressed="r.on" @click="p.stock.id = r.id">
        <svg viewBox="0 0 44 30" width="44" height="30" aria-hidden="true"><path :d="r.icon" /></svg>
        <span class="lbl"><span class="cd-mono">{{ r.label }}</span><span class="kind">{{ r.kind }}</span></span>
        <span class="inner cd-mono">{{ r.inner }}</span>
      </button>
    </div>
    <div v-if="p.stock.id === 'custom'" class="cd-box custom">
      <Field id="cw" v-model="p.stock.custom.w" label="Width" :step="1" :min="20" :max="120" />
      <Field id="cd" v-model="p.stock.custom.d" label="Depth" :step="0.5" :min="8" :max="50" />
      <Field id="ct" v-model="p.stock.custom.t" label="Wall" :step="0.1" :min="0.8" :max="5" />
      <Field id="cr" v-model="p.stock.custom.r" label="Outer corner radius" :step="0.5" :min="0" :max="10" />
    </div>
    <div class="cd-group">
      <div class="between">
        <label for="len-range" class="cd-label">Cut length</label>
        <span class="cd-mono len">{{ p.L }} mm</span>
      </div>
      <input id="len-range" v-model.number="p.L" type="range" min="70" max="160" step="1" />
    </div>
    <div class="cd-group">
      <div class="cd-label">End caps</div>
      <Seg v-model="p.caps" label="End caps" :options="[['alu', 'Aluminium'], ['printed', 'Printed'], ['open', 'Open']]" />
      <div class="cd-note">{{ capNote }}</div>
      <Field v-if="p.caps !== 'open'" id="capT" v-model="p.capT" label="Cap thickness" :step="0.5" :min="0.5" :max="6" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { STOCK, fx, profIcon } from "./model.ts";
import Field from "./Field.vue";
import Seg from "./Seg.vue";

const s = inject(CASE)!;
const p = s.project;

const rows = computed(() =>
  STOCK.map((x) => {
    const g = x.id === "custom" ? { ...x, ...p.stock.custom } : (x as Required<typeof x>);
    return {
      id: x.id,
      on: x.id === p.stock.id,
      label: x.id === "custom" ? "Custom" : `${fx(g.w!)} × ${fx(g.d!)} × ${fx(g.t!)}`,
      kind: x.kind + (x.id === "custom" ? "" : ` · r ${fx(g.r!)}`),
      inner: `in ${fx(g.w! - 2 * g.t!)} × ${fx(g.d! - 2 * g.t!)}`,
      icon: profIcon(g.w!, g.d!, g.t!, x.u),
    };
  }),
);
const capNote = computed(() => ({
  alu: "Plates pressed into both ends, milled with their cutouts and exported with the case.",
  printed: "Caps are printed as part of the fill. Their cutouts don’t need milling.",
  open: "No caps. Use this for a sleeve that closes another way.",
})[p.caps]);
</script>

<style scoped>
.gap18 {
  gap: 18px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stock {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 9px 12px;
}
.stock path {
  fill: var(--muted);
  fill-rule: evenodd;
}
.stock[aria-pressed="true"] path {
  fill: var(--brand);
}
.lbl {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.lbl .cd-mono {
  font-size: 13px;
  font-weight: 500;
}
.kind {
  font-size: 12px;
  color: var(--muted);
}
.inner {
  font-size: 11px;
  color: var(--muted);
  text-align: right;
}
.custom {
  gap: 8px;
}
.between {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.len {
  font-size: 13px;
}
input[type="range"] {
  width: 100%;
  accent-color: var(--brandbtn);
}
</style>
