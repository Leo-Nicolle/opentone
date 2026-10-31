<template>
  <div class="cd-panel checks">
    <div class="head"><div class="cd-label">Checks</div><span class="cd-mono live">live</span></div>
    <button v-for="(c, i) in list" :key="i" type="button" class="row" :class="c.kind" @click="s.goTo(c.id)">
      <span class="cd-dot"></span><span class="t">{{ c.text }}</span>
    </button>
    <div v-if="!list.length" class="cd-callout green"><b>All clear.</b> No clashes, and every cutout can be milled with the selected cutter.</div>
  </div>
</template>

<script setup lang="ts">
// Live errors (red) and warnings (amber). Clicking one selects its culprit.
import { computed, inject } from "vue";
import { CASE } from "./state.ts";

const s = inject(CASE)!;
const list = computed(() => [
  ...s.D.value.errs.map((e) => ({ ...e, kind: "err" })),
  ...s.D.value.warns.map((e) => ({ ...e, kind: "warn" })),
]);
</script>

<style scoped>
.checks {
  padding: 20px;
  gap: 10px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.live {
  font-size: 11px;
  color: var(--muted);
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border-radius: 10px;
  border: 0;
  color: var(--text);
  text-align: left;
  font-size: 13px;
  line-height: 1.4;
}
.row .cd-dot {
  margin-top: 6px;
}
.row.err {
  background: var(--redsoft);
}
.row.err .cd-dot {
  background: var(--red);
}
.row.warn {
  background: var(--ambersoft);
}
.row.warn .cd-dot {
  background: var(--amber);
}
.t {
  text-wrap: pretty;
}
</style>
