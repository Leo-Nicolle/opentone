<template>
  <div class="cd-stack">
    <div>
      <h2 class="cd-h2">Cutouts</h2>
      <p class="cd-desc">Holes milled through the tube and the end caps. A linked cutout follows its part, so moving the board moves the USB-C slot with it.</p>
    </div>
    <div class="cd-group">
      <div class="cd-label">Smallest end mill</div>
      <Seg v-model="s.project.toolD" label="Smallest end mill" mono :options="[[1, 'Ø1'], [2, 'Ø2'], [3, 'Ø3'], [4, 'Ø4']]" />
      <div class="cd-note">Inside corners can't be tighter than the cutter's radius. Slots narrower than the cutter need a smaller one.</div>
    </div>
    <div class="rows">
      <button v-for="c in rows" :key="c.id" type="button" class="cd-card cut" :aria-pressed="c.on" @click="pick(c.id, c.face)">
        <span class="top"><span class="name">{{ c.name }}</span><span class="face">{{ c.faceName }}</span></span>
        <span class="bot">
          <span class="dims cd-mono">{{ c.dims }}</span>
          <span v-if="c.link" class="cd-badge brand">{{ c.link }}</span>
          <span class="cd-badge" :class="c.cls">{{ c.st }}</span>
        </span>
      </button>
    </div>
    <button type="button" class="cd-btn start" @click="s.addCut(s.ui.view === 'face' ? s.ui.face : 'back')">Add a cutout</button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { FACEN, fx, type Face } from "./model.ts";
import Seg from "./Seg.vue";

const s = inject(CASE)!;

const rows = computed(() => {
  const D = s.D.value;
  return D.cutsW.map((c) => {
    const cs = D.cutStat[c.id];
    const dims = c.shape === "circle" ? "Ø" + fx(c.w) : `${fx(c.w)} × ${fx(c.h)}` + (c.shape === "rect" ? " r" + fx(c.r) : " slot");
    const t = c.target;
    const tn = c.link === "wheel" ? "wheel" : t ? t.part?.ref || t.name : c.link;
    const [st, cls] = cs.st === "ok" ? [cs.milled ? "mill ok" : "printed", "ok"] : cs.st === "warn" ? ["tool", "warn"] : ["error", "err"];
    return {
      id: c.id, face: c.face, name: c.name, faceName: FACEN[c.face], dims, st, cls,
      link: c.link ? (c.follow && t ? "→ " : "⨯ ") + tn : "", on: s.ui.sel === "cut:" + c.id,
    };
  });
});
function pick(id: string, face: Face) {
  s.ui.sel = "cut:" + id;
  s.ui.face = face;
  s.ui.view = "face";
}
</script>

<style scoped>
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cut {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.top,
.bot {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.bot {
  gap: 6px;
  flex-wrap: wrap;
}
.name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 13px;
}
.face {
  font-size: 12px;
  color: var(--muted);
}
.dims {
  font-size: 12px;
  color: var(--muted);
  flex: 1;
}
.start {
  align-self: flex-start;
  height: 36px;
}
</style>
