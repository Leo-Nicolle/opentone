<template>
  <div class="cd-stack">
    <div>
      <h2 class="cd-h2">Fill</h2>
      <p class="cd-desc">The printed insert that holds everything in place: the inside of the tube, minus every part grown by the clearance. It slides in from one end.</p>
    </div>
    <div class="cd-group">
      <div class="cd-label">Method</div>
      <Seg v-model="f.method" label="Method" :options="[['voxel', 'Boolean (voxels)'], ['sdf', 'Smooth (SDF blend)']]" />
      <div class="cd-note">{{ f.method === "sdf" ? "Signed-distance field, blended like metaballs: pockets get rounded edges, so the print has no knife-thin ribs." : "Straight voxel subtraction. Pockets follow each part exactly, with stepped edges at the voxel size." }}</div>
    </div>
    <div class="cd-group">
      <Field id="fC" v-model="f.clear" label="Clearance around parts" :step="0.05" :min="0" :max="2" />
      <Field id="fW" v-model="f.minWall" label="Thinnest printable wall" :step="0.1" :min="0.2" :max="4" />
      <Field id="fR" v-model="f.res" label="Voxel size" :step="0.05" :min="0.1" :max="2" />
      <Field v-if="f.method === 'sdf'" id="fS" v-model="f.smooth" label="Blend radius" :step="0.25" :min="0" :max="5" />
      <Field v-if="f.split === 'z'" id="fZ" v-model="f.splitZ" label="Split height from back" :step="0.1" :min="0" :max="s.D.value.d" />
    </div>
    <div class="cd-group">
      <div class="cd-label">Split for assembly</div>
      <Seg v-model="f.split" label="Split for assembly" :options="[['none', 'One piece'], ['pcb', 'At the PCB'], ['z', 'Custom']]" />
      <div class="cd-note">{{ splitNote }}</div>
    </div>
    <CheckBox v-model="f.channel">Cable channel from battery to board</CheckBox>
    <div class="cd-group build">
      <button type="button" class="cd-btn big" :class="st === 'run' || st === 'done' ? 'quiet' : 'primary'" :disabled="st === 'run'" @click="s.buildFill">{{ label }}</button>
      <div v-if="st === 'run'" class="cd-group prog">
        <div class="cd-bar"><div :style="{ width: pct }"></div></div>
        <div class="between cd-note"><span>{{ s.fillStages.value[s.fillRun.stage] }}</span><span class="cd-mono">{{ pct }}</span></div>
      </div>
      <div v-if="s.fillRun.error" class="cd-callout red"><b>The fill failed.</b> {{ s.fillRun.error }}</div>
    </div>
    <div v-if="st === 'done' || st === 'stale'" class="cd-box">
      <div class="between"><b>Result</b><span class="cd-badge" :class="st === 'stale' ? 'warn' : 'ok'">{{ st === "stale" ? "out of date" : "ready" }}</span></div>
      <div class="two">
        <div><div class="cd-note">Volume</div><div class="big-num cd-mono">{{ fx(vol / 1000) }}<span>cm³</span></div></div>
        <div><div class="cd-note">PLA, solid</div><div class="big-num cd-mono">{{ Math.round((vol / 1000) * 1.24) }}<span>g</span></div></div>
      </div>
      <div class="cd-note">{{ resultNote }}</div>
      <div v-if="D.thin.length" class="thin">
        <div class="tt">{{ D.thin.length }} gap{{ D.thin.length > 1 ? "s" : "" }} under {{ fx(D.need) }} mm stay open (clearance ×2 + thinnest wall)</div>
        <div v-for="(g, i) in D.thin.slice(0, 6)" :key="i" class="gap"><span>{{ g.pair }}</span><span class="cd-mono">{{ fx(g.g) }} mm</span></div>
      </div>
    </div>
    <div v-else class="cd-note">Estimated before building: {{ fx(D.fillV / 1000) }} cm³, {{ Math.round((D.fillV / 1000) * 1.24) }} g of PLA. {{ D.thin.length ? `${D.thin.length} gap${D.thin.length > 1 ? "s" : ""} under ${fx(D.need)} mm will stay open.` : "" }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { fx } from "./model.ts";
import Field from "./Field.vue";
import Seg from "./Seg.vue";
import CheckBox from "./CheckBox.vue";

const s = inject(CASE)!;
const f = s.project.fill;
const D = computed(() => s.D.value);
const st = computed(() => s.fillState.value);
const pct = computed(() => Math.round(s.fillRun.pct * 100) + "%");
const vol = computed(() => s.fillVolume.value);
const label = computed(() => ({ run: "Building…", idle: "Build the fill", stale: "Rebuild: parts have moved", done: "Rebuild the fill" })[st.value]);
const splitNote = computed(() => {
  const z = D.value.splitZ;
  if (f.split === "none") return "One body. Parts drop in from the front before the stack slides into the tube.";
  if (f.split === "pcb") return `Two halves meeting at the back of the PCB (${fx(z ?? 0)} mm from the back). The board sits between them.`;
  return `Two halves split ${fx(f.splitZ)} mm from the back of the case.`;
});
const resultNote = computed(() => {
  const z = D.value.splitZ, m = s.fillMesh.value;
  return (z != null ? `Two halves, split ${fx(z)} mm from the back. ` : "One piece. ") +
    (s.project.caps === "printed" ? "Includes both end caps. " : "") +
    (m ? `Built at ${fx(m.res)} mm voxels. ` : "") +
    "Mass assumes PLA at 1.24 g/cm³ and 100 % infill.";
});
</script>

<style scoped>
.between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.build {
  gap: 10px;
  padding-top: 4px;
}
.prog {
  gap: 6px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.big-num {
  font-size: 20px;
  font-weight: 500;
}
.big-num span {
  font-size: 12px;
  color: var(--muted);
  margin-left: 4px;
}
.thin {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.tt {
  font-size: 13px;
  font-weight: 600;
}
.gap {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.gap span:first-child {
  color: var(--muted);
  min-width: 0;
}
.gap .cd-mono {
  white-space: nowrap;
}
</style>
