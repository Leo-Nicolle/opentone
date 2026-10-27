<template>
  <section class="cw-panel cw-touch">
    <div class="cw-touch-head">
      <div class="cw-h">Touch test</div>
      <span class="cw-badge" :class="{ on: cw.status.value !== 'pinned' }">{{ cw.status.value }}</span>
    </div>

    <div class="cw-finger">
      <Field :def="FINGER_FIELD" />
      <Field :def="cw.distanceDef.value" :model="cw.distanceField" />
      <Field :def="cw.angleDef" :model="cw.angleField" />
    </div>

    <div class="cw-tiles">
      <div>
        <div class="cw-sub">Finger at</div>
        <div class="cw-big">{{ toUiDeg(r.act).toFixed(1) }}<span>°</span></div>
        <div class="cw-mono cw-sub">r {{ r.rho.toFixed(1) }} mm</div>
      </div>
      <div>
        <div class="cw-sub">Pads report</div>
        <div class="cw-big brand">{{ r.reported == null ? "—" : toUiDeg(r.reported).toFixed(1) }}<span>°</span></div>
        <div class="cw-mono cw-sub" :class="{ text: r.err != null }">error {{ errText }}</div>
      </div>
    </div>

    <div class="cw-shares">
      <div class="cw-shares-head cw-sub">
        <span>Share of the finger on each pad</span>
        <span class="cw-mono">{{ touched }} of {{ rows.length }} touched</span>
      </div>
      <div v-for="row in rows" :key="row.n" class="cw-share" :class="{ top: row.top, off: !row.on }">
        <span class="name"><i :style="{ background: row.color }" />Pad {{ row.n }}</span>
        <div class="bar"><div :style="{ width: row.w, background: row.color }" /></div>
        <span class="cw-mono pct">{{ row.pct }}</span>
      </div>
      <div class="cw-share off">
        <span class="name">Gaps</span>
        <div class="bar"><div class="gaps" :style="{ width: gaps.w }" /></div>
        <span class="cw-mono pct">{{ gaps.pct }}</span>
      </div>
    </div>

    <div class="cw-sweep">
      <button type="button" class="cw-btn" :disabled="cw.sweeping.value" @click="cw.startSweep">
        {{ cw.sweeping.value ? "Sweeping…" : "Sweep a full turn" }}
      </button>
      <div class="cw-sub">Moves the pinned finger once around the wheel at its current radius.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Field from "./Field.vue";
import { D2R, FINGER_FIELD, toUiDeg } from "./geometry.ts";
import { useClickwheel } from "./state.ts";

const cw = useClickwheel();
const r = computed(() => cw.reading.value);

const errText = computed(() => {
  const { err, onWheel } = r.value;
  if (err == null) return onWheel ? "—" : "off the wheel";
  return (err >= 0 ? "+" : "−") + Math.abs(err / D2R).toFixed(1) + "°";
});

const rows = computed(() => {
  const cu = r.value.cov.slice(0, -1), max = Math.max(...cu);
  return cu.map((c, k) => ({
    n: k + 1,
    color: cw.colors.value[k],
    w: (c * 100).toFixed(1) + "%",
    pct: (c * 100).toFixed(0) + "%",
    top: c === max && c > 0,
    on: c > 0.005,
  }));
});
const touched = computed(() => rows.value.filter((row) => row.on).length);
const gaps = computed(() => {
  const c = r.value.cov[r.value.cov.length - 1];
  return { w: (c * 100).toFixed(1) + "%", pct: (c * 100).toFixed(0) + "%" };
});
</script>

<style scoped>
.cw-touch {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cw-touch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cw-badge {
  display: flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--cw-surface2);
  color: var(--cw-muted);
  font-family: var(--cw-mono);
  font-size: 11px;
  font-weight: 500;
}
.cw-badge.on {
  background: var(--cw-brandsoft);
  color: var(--cw-brand);
}
.cw-finger {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cw-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background: var(--cw-line);
  border: 1px solid var(--cw-line);
  border-radius: 10px;
}
.cw-tiles > div {
  padding: 10px 12px;
  background: var(--cw-surface);
}
.cw-big {
  font-family: var(--cw-mono);
  font-size: 20px;
  font-weight: 500;
}
.cw-big.brand {
  color: var(--cw-brand);
}
.cw-big span {
  margin-left: 3px;
  font-size: 12px;
  color: var(--cw-muted);
}
.cw-sub.text {
  color: var(--cw-text);
}
.cw-shares {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cw-shares-head {
  display: flex;
  justify-content: space-between;
}
.cw-share {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.cw-share.top {
  font-weight: 600;
}
.cw-share.off {
  color: var(--cw-muted);
}
.cw-share .name {
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.cw-share .name i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.cw-share .bar {
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--cw-surface2);
}
.cw-share .bar div {
  height: 100%;
  border-radius: 4px;
  transition: width 0.12s ease-out;
}
.cw-share .bar .gaps {
  background: var(--cw-line2);
}
.cw-share .pct {
  font-size: 12px;
  text-align: right;
}
.cw-sweep {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--cw-line);
}
</style>
