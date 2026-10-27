<template>
  <section class="cw-panel cw-params">
    <div class="cw-params-head">
      <div class="cw-h">Wheel</div>
      <button type="button" class="cw-btn" @click="cw.reset">Reset</button>
    </div>
    <div class="cw-opt">
      <div class="cw-opt-head">
        <div>
          <div class="cw-label">Optimize pattern</div>
          <p class="cw-sub">
            Searches zigzags, interleave and roundness for {{ fingers }} mm fingers through the overlay, read with the
            estimate chosen in the interpolation panel. Size, pads and gap stay fixed.
          </p>
        </div>
        <button v-if="cw.opt.running" type="button" class="cw-btn" @click="cw.stopOptimize()">Stop</button>
        <button v-else type="button" class="cw-btn primary" @click="cw.startOptimize">Optimize</button>
      </div>
      <Field :def="COPPER_COST_FIELD" :model="cw.copperCostField" />
      <template v-if="p">
        <div class="cw-opt-bar" role="progressbar" :aria-valuenow="p.done" aria-valuemin="0" :aria-valuemax="p.total">
          <i :style="{ width: ((p.done / p.total) * 100).toFixed(1) + '%' }" />
        </div>
        <div class="cw-sub">
          {{ cw.opt.running ? (p.stage === "grid" ? "Scanning the grid" : "Refining") : "Applied" }} · {{ p.done }}/{{ p.total }}
        </div>
        <div class="cw-opt-best cw-mono">
          <div>{{ p.best.zig }} zigzags · {{ p.best.inter.toFixed(1) }}° · {{ p.best.round.toFixed(0) }}%</div>
          <div>loss {{ p.bestLoss.toFixed(2) }} <span>from {{ p.startLoss.toFixed(2) }}</span></div>
          <div>around ±{{ p.metrics.worst.toFixed(1) }}° <span>rms {{ p.metrics.rms.toFixed(1) }}°</span></div>
          <div>across {{ p.metrics.worstDrift.toFixed(1) }}° <span>rms {{ p.metrics.rmsDrift.toFixed(1) }}°</span></div>
          <div>copper lost {{ (p.metrics.lost * 100).toFixed(0) }}% <span>border {{ p.metrics.border.toFixed(0) }} mm</span></div>
        </div>
      </template>
    </div>
    <div v-for="w in warnings" :key="w.title" class="cw-warn" :class="w.kind">
      <b>{{ w.title }}</b> {{ w.text }}
    </div>
    <div v-for="s in SECTIONS" :key="s.title" class="cw-section">
      <div class="cw-label">{{ s.title }}</div>
      <Field v-for="f in s.fields" :key="f.key" :def="f" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Field from "./Field.vue";
import { SECTIONS, toothThickness } from "./geometry.ts";
import { COPPER_COST_FIELD, TEST_FINGERS } from "./optimize.ts";
import { useClickwheel } from "./state.ts";

const cw = useClickwheel();
const p = computed(() => cw.opt.progress);
const fingers = TEST_FINGERS.join(", ");

const warnings = computed(() => {
  const g = cw.model.value.g, finger = cw.params.finger, ring = g.R - g.r;
  const out: { kind: string; title: string; text: string }[] = [];
  if (ring < finger)
    out.push({
      kind: "amber",
      title: "Narrow ring.",
      text: `The copper ring is ${ring.toFixed(1)} mm wide, less than the ${finger.toFixed(1)} mm test finger, so every track also touches the edges.`,
    });
  const tooth = toothThickness(g);
  if (tooth < 2 * g.gap)
    out.push({
      kind: "red",
      title: "Teeth too thin.",
      text: `Each tooth is about ${tooth.toFixed(2)} mm thick, close to the ${g.gap.toFixed(2)} mm gap. Use fewer zigzags or a wider ring.`,
    });
  return out;
});
</script>

<style scoped>
.cw-params {
  padding: 6px 20px 8px;
}
.cw-params-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 12px;
}
.cw-params-head .cw-btn {
  height: 32px;
  font-size: 13px;
}
.cw-opt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--cw-line);
  border-radius: 10px;
}
.cw-opt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.cw-opt-head .cw-sub {
  margin-top: 2px;
  text-wrap: pretty;
}
.cw-opt-head .cw-btn {
  flex: none;
  height: 32px;
  font-size: 13px;
}
.cw-opt-bar {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--cw-line);
}
.cw-opt-bar i {
  display: block;
  height: 100%;
  background: var(--cw-brand);
  transition: width 0.2s;
}
.cw-opt-best {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.cw-opt-best span {
  margin-left: 6px;
  color: var(--cw-muted);
}
.cw-warn {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  text-wrap: pretty;
}
.cw-warn b {
  font-weight: 600;
}
.cw-warn.amber {
  background: var(--cw-ambersoft);
}
.cw-warn.amber b {
  color: var(--cw-amber);
}
.cw-warn.red {
  background: var(--cw-redsoft);
}
.cw-warn.red b {
  color: var(--cw-red);
}
.cw-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 18px;
  border-top: 1px solid var(--cw-line);
}
</style>
