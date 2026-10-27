<template>
  <section class="cw-panel cw-lin">
    <div class="cw-lin-head">
      <div class="cw-lin-title">
        <div class="cw-h">Does it interpolate evenly?</div>
        <p v-if="mode === 'around'" class="cw-intro">
          Error between the reported angle and the real one, as the finger travels a full turn on three tracks. A flat
          line near zero makes a good wheel.
        </p>
        <p v-else class="cw-intro">
          How much the reported angle moves as the finger slides straight across the ring, from the inner edge to the
          outer one. Along one radius it shouldn't move at all: a thin band near zero makes a good wheel.
        </p>
      </div>
      <Seg v-model="mode" :options="modeOpts" label="Finger movement" />
    </div>

    <div class="cw-est">
      <div class="cw-est-pick">
        <span class="cw-label">Estimate</span>
        <Seg v-model="cw.est.kind" :options="estOpts" label="How the angle is computed" size="sm" />
      </div>
      <Field v-if="cw.est.kind === 'pair'" :def="FULL_DELTA_FIELD" :model="cw.fullDeltaField" class="cw-est-full" />
    </div>

    <div class="cw-kpis">
      <div v-for="k in kpis" :key="k.label">
        <div class="cw-sub">{{ k.label }}</div>
        <div class="val">{{ k.val }}<span>{{ k.unit }}</span></div>
        <div class="cw-sub">{{ k.sub }}</div>
      </div>
    </div>

    <div class="cw-tracks">
      <template v-if="mode === 'around'">
        <div v-for="(t, i) in s.tracks" :key="i">
          <i :style="{ background: TRACK_COLORS[i] }" />
          <span class="name">{{ TRACK_NAMES[i] }} · r {{ t.toFixed(1) }} mm</span>
          <span class="cw-mono">±{{ s.tw[i].toFixed(1) }}°</span>
        </div>
      </template>
      <div v-else>
        <i class="band" />
        <span class="name">
          Range of the error along each radius · r {{ a.radii[0].toFixed(1) }} → {{ a.radii[a.radii.length - 1].toFixed(1) }} mm,
          {{ a.radii.length }} steps
        </span>
      </div>
    </div>

    <div class="cw-chart">
      <template v-for="t in yTicks" :key="t.top">
        <div class="tick-line" :style="{ top: t.top, borderColor: t.line }" />
        <div class="tick-label" :style="{ top: t.top }">{{ t.label }}</div>
      </template>
      <div
        ref="plot"
        class="plot"
        @pointermove="cw.point(onTrack($event))"
        @pointerleave="cw.point(null)"
        @pointercancel="cw.point(null)"
        @click="cw.pinAt(onTrack($event))"
      >
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <template v-if="mode === 'around'">
            <path :d="line(s.errs[2])" :style="{ stroke: TRACK_COLORS[2] }" />
            <path :d="line(s.errs[0])" :style="{ stroke: TRACK_COLORS[0] }" />
            <path :d="line(s.errs[1])" :style="{ stroke: TRACK_COLORS[1] }" class="mid" />
          </template>
          <template v-else>
            <path :d="band" class="band" />
            <path :d="line(a.hi)" class="band-edge" />
            <path :d="line(a.lo)" class="band-edge" />
          </template>
        </svg>
        <div class="cursor" :style="{ left: cursorX }" />
        <div class="cursor-tag" :style="{ left: cursorX }">{{ cursorTag }}</div>
      </div>
    </div>
    <div class="cw-xaxis"><span v-for="x in [0, 90, 180, 270, 360]" :key="x">{{ x }}°</span></div>

    <p class="cw-sub">
      <template v-if="cw.est.kind === 'pair'">
        Reported angle as the firmware computes it (getWheelAngle): the two pads with the largest deltas, their centres
        blended by delta; the strongest pad's centre alone when the second reads under 3 counts, no touch under 6.
        Deltas are the finger's share on each pad times the full-touch delta, in whole counts.
      </template>
      <template v-else>
        Reported angle = circular mean of all pad centres weighted by the share each pad gets (the parked firmware
        change).
      </template>
      One constant offset is calibrated out. Hover the chart to move the finger around the wheel at its current distance from the centre.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import Seg from "../bench/Seg.vue";
import Field from "./Field.vue";
import { FULL_DELTA_FIELD, SWEEP_STEPS, niceMax, toUiDeg } from "./geometry.ts";
import { TRACK_COLORS, useClickwheel, type Pt } from "./state.ts";

const TRACK_NAMES = ["Inner track", "Middle track", "Outer track"];
const W = 720, H = 230;

const cw = useClickwheel();
const plot = useTemplateRef<HTMLDivElement>("plot");
const mode = ref<"around" | "across">("around");
const modeOpts = [
  { value: "around" as const, label: "Around" },
  { value: "across" as const, label: "Across" },
];

const estOpts = [
  { value: "pair" as const, label: "Firmware" },
  { value: "mean" as const, label: "Average" },
];

const s = computed(() => cw.sweep.value);
const a = computed(() => s.value.across);
const ymax = computed(() => niceMax(mode.value === "around" ? s.value.worst : a.value.worst));

const kpis = computed(() => {
  const g = cw.model.value.g, mid = (g.r + g.R) / 2;
  if (mode.value === "across")
    return [
      { label: "Worst drift", val: a.value.worstDrift.toFixed(1), unit: "°", sub: "along one radius, edge to edge" },
      { label: "Typical drift", val: a.value.rmsDrift.toFixed(1), unit: "°", sub: "RMS, from each radius’ mean" },
      { label: "Worst error", val: "±" + a.value.worst.toFixed(1), unit: "°", sub: "anywhere across the ring" },
      { label: "Pad pitch", val: (360 / g.N).toFixed(1), unit: "°", sub: `${(mid * g.pitch).toFixed(1)} mm on the middle track` },
    ];
  return [
    { label: "Worst error", val: "±" + s.value.worst.toFixed(1), unit: "°", sub: "over all three tracks" },
    { label: "Typical error", val: s.value.rms.toFixed(1), unit: "°", sub: "root mean square" },
    { label: "Single-pad spots", val: (s.value.single * 100).toFixed(0), unit: "%", sub: "finger ≥ 95% on one pad" },
    { label: "Pad pitch", val: (360 / g.N).toFixed(1), unit: "°", sub: `${(mid * g.pitch).toFixed(1)} mm on the middle track` },
  ];
});

const fy = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));
const yTicks = computed(() => [
  { label: "+" + fy(ymax.value) + "°", top: "0%", line: "var(--cw-line)" },
  { label: "0°", top: "50%", line: "var(--cw-line2)" },
  { label: "−" + fy(ymax.value) + "°", top: "100%", line: "var(--cw-line)" },
]);

const px = (i: number, n: number) => ((i / (n - 1)) * W).toFixed(1);
const py = (v: number) => (H / 2 - (v / ymax.value) * (H / 2)).toFixed(1);

/** Error row → path, lifting the pen where there's no estimate. */
function line(row: (number | null)[]) {
  let d = "", pen = false;
  row.forEach((v, i) => {
    if (v == null) return (pen = false);
    d += (pen ? "L" : "M") + px(i, row.length) + "," + py(v) + " ";
    pen = true;
  });
  return d;
}

/** Filled band between lo and hi, one closed shape per run without gaps. */
const band = computed(() => {
  const { lo, hi } = a.value, n = lo.length;
  let d = "", run: number[] = [];
  const flush = () => {
    if (run.length) {
      d += "M" + run.map((i) => px(i, n) + "," + py(hi[i]!)).join(" L");
      d += " L" + run.reverse().map((i) => px(i, n) + "," + py(lo[i]!)).join(" L") + " Z ";
    }
    run = [];
  };
  for (let i = 0; i < n; i++) {
    if (lo[i] == null) flush();
    else run.push(i);
  }
  flush();
  return d;
});

const deg = computed(() => toUiDeg(cw.reading.value.act));
const cursorX = computed(() => ((deg.value / 360) * 100).toFixed(2) + "%");
const cursorTag = computed(() => {
  if (mode.value === "around") return deg.value.toFixed(1) + "°";
  const i = Math.round((deg.value / 360) * SWEEP_STEPS) % SWEEP_STEPS, lo = a.value.lo[i], hi = a.value.hi[i];
  return deg.value.toFixed(1) + "° · drift " + (lo == null || hi == null ? "—" : (hi - lo).toFixed(1) + "°");
});

function onTrack(e: PointerEvent | MouseEvent): Pt {
  const b = plot.value!.getBoundingClientRect();
  return cw.atPinRadius(Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)));
}
</script>

<style scoped>
.cw-lin {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px 16px;
}
.cw-lin-head {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.cw-lin-title {
  flex: 1;
  min-width: 240px;
}
.cw-intro {
  margin-top: 2px;
  font-size: 13px;
  color: var(--cw-muted);
  text-wrap: pretty;
}
.cw-est {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 24px;
}
.cw-est-pick {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cw-est-full {
  flex: 1 1 260px;
  max-width: 380px;
}
.cw-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  overflow: hidden;
  background: var(--cw-line);
  border: 1px solid var(--cw-line);
  border-radius: 10px;
}
.cw-kpis > div {
  display: flex;
  flex: 1 1 150px;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  background: var(--cw-surface);
}
.cw-kpis .val {
  font-family: var(--cw-mono);
  font-size: 24px;
  font-weight: 500;
  line-height: 1.2;
}
.cw-kpis .val span {
  margin-left: 3px;
  font-size: 13px;
  color: var(--cw-muted);
}
.cw-tracks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}
.cw-tracks > div {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}
.cw-tracks i {
  flex: none;
  width: 14px;
  height: 3px;
  border-radius: 2px;
}
.cw-tracks i.band {
  height: 10px;
  box-sizing: border-box;
  background: var(--cw-brandsoft);
  border: 1px solid var(--cw-brand);
}
.cw-tracks .name {
  color: var(--cw-muted);
}
.cw-chart {
  position: relative;
  height: 230px;
  margin-top: 4px;
}
.tick-line {
  position: absolute;
  left: 52px;
  right: 0;
  border-top: 1px solid;
}
.tick-label {
  position: absolute;
  left: 0;
  width: 44px;
  transform: translateY(-50%);
  font-family: var(--cw-mono);
  font-size: 11px;
  text-align: right;
  color: var(--cw-muted);
}
.plot {
  position: absolute;
  inset: 0 0 0 52px;
  cursor: crosshair;
  touch-action: none;
}
.plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.plot path {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.plot path.mid {
  stroke-width: 2;
}
.plot path.band {
  fill: var(--cw-brandsoft);
  stroke: none;
}
.plot path.band-edge {
  stroke: var(--cw-brand);
  stroke-width: 1.25;
}
.cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--cw-text);
  pointer-events: none;
}
.cursor-tag {
  position: absolute;
  top: -2px;
  transform: translate(-50%, -100%);
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--cw-text);
  color: var(--cw-bg);
  font-family: var(--cw-mono);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
}
.cw-xaxis {
  display: flex;
  justify-content: space-between;
  padding-left: 52px;
  font-family: var(--cw-mono);
  font-size: 11px;
  color: var(--cw-muted);
}
</style>
