<template>
  <div class="cd vp-raw" @dragover.prevent="dropping = true" @dragleave.self="dropping = false" @drop.prevent="onDrop">
    <header class="cd-head">
      <div class="brand">
        <div class="logo" aria-hidden="true"></div>
        <div class="title"><b>opentone</b> <span>Case designer</span></div>
      </div>
      <div class="sep" aria-hidden="true"></div>
      <div class="file">
        <span class="cd-mono">{{ s.project.name }}.case.json</span>
        <span class="state">{{ s.saveLabel.value }}</span>
      </div>
      <div class="grow"></div>
      <div class="actions">
        <button type="button" class="cd-btn" :disabled="!s.canUndo.value" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" @click="s.undo">↶</button>
        <button type="button" class="cd-btn" :disabled="!s.canRedo.value" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" @click="s.redo">↷</button>
        <button type="button" class="cd-btn" @click="s.toggleTheme">{{ s.isDark.value ? "Light mode" : "Dark mode" }}</button>
        <label class="cd-btn">
          <input type="file" accept=".json" class="hidden-input" @change="onOpen" />
          Open project
        </label>
        <button type="button" class="cd-btn" @click="s.save">Save project</button>
        <button type="button" class="cd-btn primary" @click="s.setStep('export')">Export STEP</button>
      </div>
    </header>

    <nav class="cd-steps" aria-label="Steps">
      <button v-for="(t, i) in tabs" :key="t.k" type="button" :aria-current="s.ui.step === t.k ? 'step' : undefined" :class="{ on: s.ui.step === t.k }" @click="s.setStep(t.k)">
        <span class="num">{{ i + 1 }}</span>{{ t.label }}<span class="count" :class="{ stale: t.stale }">{{ t.count }}</span>
      </button>
    </nav>

    <div v-if="s.ui.error || s.ui.note" class="cd-msgs">
      <div v-if="s.ui.error" class="cd-callout red" role="alert">
        <b>Error.</b> {{ s.ui.error }} <button type="button" class="x" aria-label="Dismiss" @click="s.ui.error = ''">×</button>
      </div>
      <div v-if="s.ui.note" class="cd-callout amber" role="status">
        {{ s.ui.note }} <button type="button" class="x" aria-label="Dismiss" @click="s.ui.note = ''">×</button>
      </div>
    </div>

    <div class="cd-body">
      <section class="cd-panel a-left" aria-label="Step settings">
        <StepStock v-if="s.ui.step === 'stock'" />
        <StepParts v-else-if="s.ui.step === 'parts'" />
        <StepCuts v-else-if="s.ui.step === 'cuts'" />
        <StepWheel v-else-if="s.ui.step === 'wheel'" />
        <StepFill v-else-if="s.ui.step === 'fill'" />
        <StepExport v-else />
      </section>
      <ViewPanel class="a-view" />
      <aside class="a-right" aria-label="Inspector and checks">
        <Inspector />
        <Checks />
      </aside>
    </div>
    <div v-if="dropping" class="cd-drop" aria-hidden="true"><div>Drop STEP, STL, GLB or 3MF files to import them</div></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from "vue";
import "./case-designer.css";
import { CASE, STEPS, createCaseDesigner } from "./state.ts";
import { fx } from "./model.ts";
import StepStock from "./StepStock.vue";
import StepParts from "./StepParts.vue";
import StepCuts from "./StepCuts.vue";
import StepWheel from "./StepWheel.vue";
import StepFill from "./StepFill.vue";
import StepExport from "./StepExport.vue";
import ViewPanel from "./ViewPanel.vue";
import Inspector from "./Inspector.vue";
import Checks from "./Checks.vue";

const s = createCaseDesigner();
provide(CASE, s);

const tabs = computed(() => {
  const D = s.D.value, fs = s.fillState.value;
  const counts: Record<string, string> = {
    stock: `${fx(D.w)} × ${fx(D.d)} × ${fx(D.t)}`,
    parts: String(s.project.parts.length + 3),
    cuts: String(s.project.cuts.length),
    wheel: "Ø" + fx(s.project.wheel.R * 2),
    fill: { idle: "not built", run: "building", done: "ready", stale: "out of date" }[fs],
    export: "",
  };
  return STEPS.map(([k, label]) => ({ k, label, count: counts[k], stale: k === "fill" && fs === "stale" }));
});

const dropping = ref(false);
function onDrop(e: DragEvent) {
  dropping.value = false;
  if (e.dataTransfer?.files.length) {
    s.setStep("parts");
    s.importFiles(e.dataTransfer.files);
  }
}
function onOpen(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.files?.[0]) s.open(el.files[0]);
  el.value = "";
}

// Undo and redo on the page, but not while typing in a field.
function onKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); s.undo(); }
  else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); s.redo(); }
}
onMounted(() => {
  s.init();
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<style scoped>
.cd {
  position: relative;
}
.cd-head {
  position: sticky;
  top: var(--vp-nav-height, 64px);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px 18px;
  flex-wrap: wrap;
  padding: 12px 32px;
  background: var(--chrome);
  border-bottom: 1px solid var(--line);
  border-radius: 12px 12px 0 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--grad);
}
.title {
  font-size: 15px;
}
.title b {
  font-weight: 700;
}
.title span {
  color: var(--muted);
}
.sep {
  width: 1px;
  height: 22px;
  background: var(--line);
}
.file {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}
.state {
  color: var(--muted);
}
.grow {
  flex: 1;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
label.cd-btn {
  position: relative;
  cursor: pointer;
}
.cd-steps {
  display: flex;
  gap: 6px 24px;
  flex-wrap: wrap;
  padding: 0 32px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
}
.cd-steps button {
  height: 44px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.cd-steps button.on {
  color: var(--text);
  box-shadow: inset 0 -2px 0 var(--brand);
}
.num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface2);
  color: var(--muted);
  display: grid;
  place-items: center;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
}
.on .num {
  background: var(--brandbtn);
  color: #fff;
}
.count {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
}
.count.stale {
  color: var(--amber);
}
.cd-msgs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 32px 0;
  max-width: 1720px;
  margin: 0 auto;
}
.cd-msgs .cd-callout {
  position: relative;
  padding-right: 36px;
}
.x {
  position: absolute;
  right: 8px;
  top: 6px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 16px;
}
.cd-body {
  display: grid;
  gap: 20px;
  padding: 20px 32px 56px;
  max-width: 1720px;
  margin: 0 auto;
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "view" "left" "right";
}
@container (min-width: 900px) {
  .cd-body {
    grid-template-columns: 320px minmax(0, 1fr);
    grid-template-areas: "left view" "right view";
  }
}
@container (min-width: 1280px) {
  .cd-body {
    grid-template-columns: 340px minmax(0, 1fr) 300px;
    grid-template-areas: "left view right";
  }
}
@container (max-width: 699px) {
  .cd-head,
  .cd-steps {
    padding-left: 16px;
    padding-right: 16px;
  }
  .cd-body,
  .cd-msgs {
    padding-left: 16px;
    padding-right: 16px;
  }
}
.a-left {
  grid-area: left;
}
.a-view {
  grid-area: view;
}
.a-right {
  grid-area: right;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.cd-drop {
  position: absolute;
  inset: 0;
  z-index: 20;
  border-radius: 12px;
  background: var(--brandsoft);
  border: 2px dashed var(--brand);
  display: grid;
  place-items: center;
  pointer-events: none;
  font-weight: 600;
  color: var(--brand);
}
</style>
