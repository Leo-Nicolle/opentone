<template>
  <section class="cw-panel cw-fp">
    <div class="cw-fp-head">
      <div class="cw-fp-title">
        <div class="cw-h">Footprint</div>
        <div class="cw-mono cw-sub">{{ meta }}</div>
      </div>
      <Seg v-model="cw.paint.value" :options="paintOpts" label="Colour" />
      <div class="cw-chips">
        <button
          v-for="c in chips"
          :key="c.key"
          type="button"
          :aria-pressed="cw.layers[c.key]"
          :class="{ on: cw.layers[c.key] }"
          @click="cw.layers[c.key] = !cw.layers[c.key]"
        >
          {{ c.label }}
        </button>
      </div>
    </div>

    <div
      ref="wheel"
      class="cw-wheel"
      role="img"
      :aria-label="aria"
      @pointermove="cw.point(toMM($event))"
      @pointerleave="cw.point(null)"
      @pointercancel="cw.point(null)"
      @click="cw.pinAt(toMM($event))"
    >
      <svg :viewBox="vb" aria-hidden="true">
        <path :d="m.gMin" class="grid-min" />
        <path :d="m.gMaj" class="grid-maj" />
        <path :d="m.board" class="board" />
        <path v-for="(d, k) in m.pads" :key="k" :d="d" :style="{ fill: byPad ? cw.colors.value[k] : 'var(--cw-copper)' }" />
        <path :d="m.sepD" class="seps" :stroke-width="m.g.gap" />
        <path v-if="cw.layers.edge" :d="m.board" class="edge" />
        <path v-if="cw.layers.dims" :d="m.dim" class="dims" />
        <template v-if="cw.layers.tracks">
          <path v-for="(r, i) in cw.sweep.value.tracks" :key="i" :d="ring(r)" class="track" :style="{ stroke: TRACK_COLORS[i] }" />
        </template>
        <path :d="ray(r.act)" class="ray-act" />
        <path v-if="r.reported != null" :d="ray(r.reported)" class="ray-est" />
        <circle :cx="f.x" :cy="f.y" :r="cw.params.finger / 2" class="finger" />
        <circle :cx="f.x" :cy="f.y" :r="m.V * 0.008" class="finger-dot" />
      </svg>
      <template v-if="byPad">
        <div v-for="t in padTags" :key="t.n" class="cw-tag" :style="t.style">{{ t.n }}</div>
      </template>
      <template v-if="cw.layers.dims">
        <div v-for="l in m.labels" :key="l.text" class="cw-dim" :style="{ left: pct(l.x), top: pct(l.y) }">{{ l.text }}</div>
      </template>
    </div>

    <div class="cw-legend">
      <span><i class="solid" />Finger angle</span>
      <span><i class="dashed" />Angle the pads report</span>
      <span><i class="box" />Grid 1 mm, bold every 5 mm</span>
      <span class="grow" />
      <span class="tip">Hover the ring to slide a finger over the pads. Click to pin it.</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import Seg from "../bench/Seg.vue";
import { toUiDeg } from "./geometry.ts";
import { TRACK_COLORS, useClickwheel, type Pt } from "./state.ts";

const cw = useClickwheel();
const wheel = useTemplateRef<HTMLDivElement>("wheel");

const paintOpts = [
  { value: "pads" as const, label: "By pad" },
  { value: "copper" as const, label: "Copper" },
];
const chips = [
  { key: "edge" as const, label: "Edge cuts" },
  { key: "dims" as const, label: "Dimensions" },
  { key: "tracks" as const, label: "Test tracks" },
];

const m = computed(() => cw.model.value);
const r = computed(() => cw.reading.value);
const f = computed(() => cw.finger.value);
const byPad = computed(() => cw.paint.value === "pads");
const vb = computed(() => `${-m.value.V} ${-m.value.V} ${2 * m.value.V} ${2 * m.value.V}`);

const meta = computed(() => {
  const g = m.value.g;
  return `${g.N} pads · ${(360 / g.N).toFixed(1)}° pitch · ring ${(g.R - g.r).toFixed(1)} mm wide`;
});
const aria = computed(
  () => `Click wheel footprint, ${m.value.g.N} pads, outer diameter ${cw.params.od} mm. Finger at ${toUiDeg(r.value.act).toFixed(0)} degrees.`,
);

// Overlays sit in % of the drawing, from mm.
const pct = (v: number) => (((v + m.value.V) / (2 * m.value.V)) * 100).toFixed(3) + "%";
const padTags = computed(() => {
  const g = m.value.g, rr = g.R + 1.3;
  return cw.colors.value.map((c, k) => {
    const a = g.a0 + k * g.pitch + m.value.zR + g.pitch / 2;
    return { n: k + 1, style: { left: pct(rr * Math.cos(a)), top: pct(rr * Math.sin(a)), background: c } };
  });
});

const ring = (r: number) => `M${r},0 A${r},${r} 0 1 1 ${-r},0 A${r},${r} 0 1 1 ${r},0`;
const ray = (a: number) => {
  const e = m.value.g.R + 1.2;
  return `M0,0 L${(e * Math.cos(a)).toFixed(3)},${(e * Math.sin(a)).toFixed(3)}`;
};

function toMM(e: PointerEvent | MouseEvent): Pt {
  const b = wheel.value!.getBoundingClientRect(), V = m.value.V;
  return { x: ((e.clientX - b.left) / b.width) * 2 * V - V, y: ((e.clientY - b.top) / b.height) * 2 * V - V };
}
</script>

<style scoped>
.cw-fp {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
}
.cw-fp-head {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.cw-fp-title {
  flex: 1;
  min-width: 200px;
}
.cw-fp-title .cw-sub {
  margin-top: 2px;
}
.cw-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cw-chips button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--cw-line2);
  border-radius: 999px;
  background: transparent;
  color: var(--cw-muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.cw-chips button.on {
  border-color: var(--cw-text);
  background: var(--cw-text);
  color: var(--cw-bg);
}

.cw-wheel {
  position: relative;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  aspect-ratio: 1;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}
.cw-wheel svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.cw-wheel path,
.cw-wheel circle {
  vector-effect: non-scaling-stroke;
}
.grid-min {
  fill: none;
  stroke: var(--cw-line);
  stroke-width: 1;
  opacity: 0.55;
}
.grid-maj {
  fill: none;
  stroke: var(--cw-line2);
  stroke-width: 1;
  opacity: 0.7;
}
.board {
  fill: var(--cw-board);
  fill-rule: evenodd;
}
/* The real clearance: stroke width in mm, so it scales with the drawing. */
.cw-wheel path.seps {
  fill: none;
  stroke: var(--cw-board);
  stroke-linejoin: round;
  vector-effect: none;
}
.edge {
  fill: none;
  stroke: var(--cw-amber);
  stroke-width: 1.5;
}
.dims {
  fill: none;
  stroke: var(--cw-muted);
  stroke-width: 1;
}
.track {
  fill: none;
  stroke-width: 1.25;
  stroke-dasharray: 5 4;
}
.ray-act {
  fill: none;
  stroke: var(--cw-text);
  stroke-width: 1.25;
}
.ray-est {
  fill: none;
  stroke: var(--cw-brand);
  stroke-width: 2;
  stroke-dasharray: 6 4;
}
.finger {
  fill: var(--cw-text);
  fill-opacity: 0.14;
  stroke: var(--cw-text);
  stroke-width: 1.5;
}
.finger-dot {
  fill: var(--cw-text);
}
.cw-tag,
.cw-dim {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--cw-mono);
  pointer-events: none;
}
.cw-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 20px;
  box-sizing: border-box;
  padding: 0 5px;
  border-radius: 4px;
  color: #16120f;
  font-size: 11px;
  font-weight: 600;
}
.cw-dim {
  padding: 0 5px;
  border-radius: 4px;
  background: var(--cw-surface);
  font-size: 12px;
  white-space: nowrap;
}

.cw-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 12px;
  color: var(--cw-muted);
}
.cw-legend span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.cw-legend i {
  display: inline-block;
  width: 14px;
}
.cw-legend i.solid {
  border-top: 1.5px solid var(--cw-text);
}
.cw-legend i.dashed {
  border-top: 2px dashed var(--cw-brand);
}
.cw-legend i.box {
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 1px solid var(--cw-line2);
  border-radius: 3px;
}
.cw-legend .grow {
  flex: 1;
}
.cw-legend .tip {
  color: var(--cw-text);
}
</style>
