<template>
  <section class="vpanel" aria-label="3D view">
    <div class="bar">
      <Seg v-model="s.ui.view" label="View" tight class="strong" :options="[['3d', '3D view'], ['face', 'Faces']]" />
      <template v-if="s.ui.view === 'face'">
        <div class="cd-seg tight wrap" role="group" aria-label="Face">
          <button v-for="f in FACES" :key="f" type="button" :aria-pressed="s.ui.face === f" @click="s.ui.face = f">
            {{ FACE_TAB[f] }}<span class="n cd-mono">{{ count(f) || "" }}</span>
          </button>
        </div>
        <button type="button" class="cd-btn sm push" @click="s.addCut(s.ui.face)">Add cutout here</button>
      </template>
      <div v-else class="tools">
        <div class="cd-seg tight" role="group" aria-label="View preset">
          <button v-for="[id, label, yw, pt] in VIEWS" :key="id" type="button" :aria-pressed="Math.abs(s.ui.yaw - yw) < 0.5 && Math.abs(s.ui.pitch - pt) < 0.5" @click="setView(yw, pt)">{{ label }}</button>
        </div>
        <div class="case">
          <span class="cd-note">Case</span>
          <Seg v-model="s.ui.caseMode" label="Case" tight :options="[['solid', 'Solid'], ['ghost', 'Ghost'], ['hidden', 'Hidden']]" />
        </div>
        <div class="chips">
          <button type="button" class="cd-chip" :aria-pressed="s.ui.showFill" @click="s.ui.showFill = !s.ui.showFill">Fill</button>
          <button type="button" class="cd-chip" :aria-pressed="s.ui.exploded" @click="s.ui.exploded = !s.ui.exploded">Exploded</button>
        </div>
        <div class="grow"></div>
        <div class="zoom">
          <button type="button" class="cd-btn sq" aria-label="Zoom out" @click="s.ui.zoom = Math.max(0.4, Math.round((s.ui.zoom / 1.25) * 100) / 100)">−</button>
          <button type="button" class="cd-btn sm cd-mono" aria-label="Zoom to fit" @click="s.ui.zoom = 1">{{ Math.round(s.ui.zoom * 100) }}%</button>
          <button type="button" class="cd-btn sq" aria-label="Zoom in" @click="s.ui.zoom = Math.min(4, Math.round(s.ui.zoom * 1.25 * 100) / 100)">+</button>
        </div>
      </div>
    </div>
    <div class="vp">
      <ClientOnly>
        <View3D v-if="s.ui.view === '3d'" ref="v3" />
        <FaceEditor v-else />
      </ClientOnly>
      <div v-if="s.ui.dragInfo" class="readout cd-mono">{{ s.ui.dragInfo }}</div>
      <div v-if="selLabel && s.ui.view === '3d'" class="chip"><span class="cd-dot"></span><b>{{ selLabel.name }}</b><span class="cd-mono">{{ selLabel.dims }}</span></div>
      <div class="hint">{{ hint }}</div>
    </div>
    <div class="foot">
      <span class="cd-note">Outside <span class="cd-mono v">{{ fx(D.w) }} × {{ fx(D.L) }} × {{ fx(D.d) }} mm</span></span>
      <span class="cd-note">Inside <span class="cd-mono v">{{ fx(D.w - 2 * D.t) }} × {{ fx(D.L - 2 * D.capIn) }} × {{ fx(D.d - 2 * D.t) }} mm</span></span>
      <div class="grow"></div>
      <div class="badges">
        <span class="cd-badge" :class="{ err: D.errs.length }">{{ D.errs.length }} clash{{ D.errs.length === 1 ? "" : "es" }}</span>
        <span class="cd-badge" :class="{ warn: D.warns.length }">{{ D.warns.length }} warning{{ D.warns.length === 1 ? "" : "s" }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { CASE } from "./state.ts";
import { FACES, FACE_TAB, dimsOf, fx, type Face } from "./model.ts";
import Seg from "./Seg.vue";
import View3D from "./View3D.vue";
import FaceEditor from "./FaceEditor.vue";

const VIEWS: [string, string, number, number][] = [["iso", "Iso", -35, 22], ["front", "Front", 0, 0], ["left", "Left", 90, 0], ["top", "Top", 0, 89.9], ["bottom", "Bottom", 0, -89.9]];

const s = inject(CASE)!;
const D = computed(() => s.D.value);
const v3 = ref<{ hasHandles: boolean } | null>(null);
const count = (f: Face) => s.project.cuts.filter((c) => c.face === f).length;
const setView = (yaw: number, pitch: number) => { s.ui.yaw = yaw; s.ui.pitch = pitch; };

const selLabel = computed(() => {
  const sel = s.ui.sel;
  if (sel === "case") return { name: "Case", dims: `${fx(D.value.w)} × ${fx(D.value.L)} × ${fx(D.value.d)} mm` };
  const c = D.value.cutsW.find((x) => "cut:" + x.id === sel);
  if (c) return { name: c.name, dims: c.shape === "circle" ? `Ø${fx(c.w)} mm` : `${fx(c.w)} × ${fx(c.h)} mm` };
  const b = D.value.B.find((x) => x.id === sel);
  return b ? { name: b.name, dims: dimsOf(b) + " mm" } : null;
});
const hint = computed(() =>
  s.ui.view === "face"
    ? "Drag a cutout to move it · drag its square to resize · Shift for coarser steps"
    : v3.value?.hasHandles
      ? "Drag an arrow to move · snaps when touching · Shift for 1 mm steps"
      : "Drag to orbit · click a part to select it",
);
</script>

<style scoped>
.vpanel {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px 14px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.strong :deep(button) {
  font-weight: 600;
  padding: 0 12px;
}
.wrap {
  flex-wrap: wrap;
}
.wrap button {
  display: flex;
  align-items: center;
  gap: 6px;
}
.n {
  font-size: 11px;
  color: var(--muted);
}
.push {
  margin-left: auto;
}
.tools {
  display: flex;
  align-items: center;
  gap: 10px 14px;
  flex-wrap: wrap;
  flex: 1;
}
.case {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chips,
.zoom {
  display: flex;
  gap: 6px;
}
.zoom {
  gap: 4px;
}
.sq {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 15px;
}
.grow {
  flex: 1;
}
.vp {
  position: relative;
  height: 640px;
  background: var(--vp);
  overflow: hidden;
}
@container (max-width: 899px) {
  .vp {
    height: 440px;
  }
}
.readout {
  position: absolute;
  left: 50%;
  top: 14px;
  transform: translateX(-50%);
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--text);
  color: var(--bg);
  font-size: 12px;
  display: flex;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
}
.chip {
  position: absolute;
  left: 14px;
  top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 12px;
  pointer-events: none;
  max-width: calc(100% - 28px);
  white-space: nowrap;
  overflow: hidden;
}
.chip .cd-dot {
  background: var(--brand);
}
.chip .cd-mono {
  color: var(--muted);
}
.hint {
  position: absolute;
  right: 14px;
  bottom: 12px;
  left: 120px;
  text-align: right;
  font-size: 12px;
  color: var(--muted);
  pointer-events: none;
}
.foot {
  display: flex;
  align-items: center;
  gap: 8px 18px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  font-size: 12px;
}
.v {
  color: var(--text);
}
.badges {
  display: flex;
  gap: 6px;
}
</style>
