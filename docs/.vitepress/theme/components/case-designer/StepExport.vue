<template>
  <div class="cd-stack">
    <div>
      <h2 class="cd-h2">Export</h2>
      <p class="cd-desc">The case, caps and wheel parts are exact solids built from the profile and the cutouts, so CAM sees true arcs, not triangles.</p>
    </div>
    <div class="rows">
      <div v-for="r in s.exportRows.value" :key="r.k" class="row" :style="{ opacity: r.dis ? 0.55 : 1 }">
        <CheckBox :model-value="on[r.k] && !r.dis" :aria="`Include ${r.name}`" @update:model-value="!r.dis && (on[r.k] = !on[r.k])" />
        <div class="body">
          <div><div class="name">{{ r.name }}</div><div class="cd-note">{{ r.sub }}</div></div>
          <div class="fmts">
            <button v-for="f in r.fmts" :key="f.label" type="button" class="fmt" :class="{ fixed: f.fixed }" :aria-pressed="f.on" :disabled="f.fixed" @click="f.toggle?.()">{{ f.label }}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="cd-callout amber"><b>The fill is a mesh.</b> Its STEP is faceted, one face per triangle. Print from 3MF or STL; export STEP only if your CAM insists.</div>
    <button type="button" class="cd-btn big" :class="n && !s.exp.running ? 'primary' : 'off'" :disabled="!n || s.exp.running" @click="s.runExport">{{ label }}</button>
    <div v-if="s.exp.running" class="cd-group">
      <div class="cd-bar"><div :style="{ width: Math.round(s.exp.pct * 100) + '%' }"></div></div>
      <div class="cd-note">{{ s.exp.text }}{{ s.exp.text.startsWith("Loading") ? " (about 20 MB, once)" : "" }}</div>
    </div>
    <div v-if="s.exp.error" class="cd-callout red"><b>Export failed.</b> {{ s.exp.error }}</div>
    <div v-if="s.exp.done" class="done">
      <div class="t">opentone-case.zip · {{ s.exp.files.length }} files</div>
      <div v-for="f in s.exp.files" :key="f" class="cd-mono f">{{ f }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import CheckBox from "./CheckBox.vue";

const s = inject(CASE)!;
const on = s.project.export.on;
const n = computed(() => s.exportFiles.value.length);
const label = computed(() => (s.exp.running ? "Exporting…" : n.value ? `Export ${n.value} file${n.value > 1 ? "s" : ""} as .zip` : "Pick something to export"));
</script>

<style scoped>
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg);
}
.row :deep(.cd-checkbox) {
  margin-top: 1px;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.name {
  font-weight: 600;
  font-size: 13px;
}
.fmts {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.fmt {
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px !important;
  font-weight: 500;
}
.fmt[aria-pressed="true"]:not(.fixed) {
  border-color: var(--brand);
  background: var(--brandsoft);
  color: var(--brand);
}
.done {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 10px;
  background: var(--greensoft);
}
.done .t {
  font-weight: 600;
  color: var(--green);
}
.f {
  font-size: 12px;
  word-break: break-all;
}
</style>
