<template>
  <section class="cw-panel cw-params">
    <div class="cw-params-head">
      <div class="cw-h">Wheel</div>
      <button type="button" class="cw-btn" @click="cw.reset">Reset</button>
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
import { SECTIONS } from "./geometry.ts";
import { useClickwheel } from "./state.ts";

const cw = useClickwheel();

const warnings = computed(() => {
  const g = cw.model.value.g, finger = cw.params.finger, ring = g.R - g.r;
  const out: { kind: string; title: string; text: string }[] = [];
  if (ring < finger)
    out.push({
      kind: "amber",
      title: "Narrow ring.",
      text: `The copper ring is ${ring.toFixed(1)} mm wide, less than the ${finger.toFixed(1)} mm test finger, so every track also touches the edges.`,
    });
  const tooth = ((ring / g.zig) * g.pitch) / Math.max(1e-3, g.hi - g.lo);
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
