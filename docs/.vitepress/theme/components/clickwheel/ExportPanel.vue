<template>
  <section class="cw-panel cw-export">
    <div class="cw-h">Export to KiCad</div>

    <div class="cw-step">
      <span class="n">1</span>
      <div class="body">
        <div>Download one image per layer</div>
        <button type="button" class="cw-btn primary" @click="png('copper')">
          {{ flash === "copper" ? "Downloaded F.Cu.png" : "Download copper (F.Cu)" }}
        </button>
        <button type="button" class="cw-btn" @click="png('edge')">
          {{ flash === "edge" ? "Downloaded Edge.Cuts.png" : "Download outline (Edge.Cuts)" }}
        </button>
      </div>
    </div>

    <div class="cw-step">
      <span class="n">2</span>
      <div class="body">
        <div>In KiCad's Image Converter, load each PNG and set its width to</div>
        <div class="cw-code">
          <span>{{ width }} mm</span>
          <button type="button" @click="copyWidth">{{ copied ? "Copied" : "Copy" }}</button>
        </div>
        <div class="cw-sub">The board plus a 1 mm margin on each side.</div>
      </div>
    </div>

    <div class="cw-step">
      <span class="n">3</span>
      <div class="body">
        <div>
          Copy to clipboard, paste in the PCB editor, then press <kbd>E</kbd> and set the layer to
          <span class="cw-mono layer">F.Cu</span> or <span class="cw-mono layer">Edge.Cuts</span>.
        </div>
      </div>
    </div>

    <div class="cw-project">
      <div class="cw-label">Project file</div>
      <div class="row">
        <button type="button" class="cw-btn" @click="saveJson">{{ flash === "json" ? "Saved" : "Save JSON" }}</button>
        <button type="button" class="cw-btn" @click="openJson">Open JSON…</button>
        <button type="button" class="cw-btn" @click="saveSvg">{{ flash === "svg" ? "Saved" : "SVG" }}</button>
      </div>
      <div v-if="openError" class="cw-sub error">{{ openError }}</div>
      <div class="cw-sub">Keep the JSON to reopen and tweak this wheel later. The SVG holds both layers.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { bothLayersSvg, exportWidth, layerSvg, parseProject, type Layer } from "./geometry.ts";
import { useClickwheel } from "./state.ts";

// Rasterising resolution, capped so large boards stay a reasonable size.
const PX_PER_MM = 40, MAX_PX = 4096;

const cw = useClickwheel();
const width = computed(() => exportWidth(cw.model.value).toFixed(1));
const flash = ref<string | null>(null);
const copied = ref(false);
const openError = ref("");
let flashTimer: ReturnType<typeof setTimeout> | undefined;

function flashOn(k: string) {
  flash.value = k;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 1400);
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function png(layer: Layer) {
  const m = cw.model.value, px = Math.min(MAX_PX, Math.round(exportWidth(m) * PX_PER_MM));
  const url = URL.createObjectURL(new Blob([layerSvg(m, layer)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    canvas.getContext("2d")!.drawImage(img, 0, 0, px, px);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    download(blob, layer === "copper" ? "clickwheel-F.Cu.png" : "clickwheel-Edge.Cuts.png");
    flashOn(layer);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveSvg() {
  download(new Blob([bothLayersSvg(cw.model.value)], { type: "image/svg+xml" }), "clickwheel.svg");
  flashOn("svg");
}

function saveJson() {
  download(new Blob([JSON.stringify({ ...cw.params }, null, 2)], { type: "application/json" }), "clickwheel.json");
  flashOn("json");
}

function openJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      cw.load(parseProject(JSON.parse(await file.text())));
      openError.value = "";
    } catch {
      openError.value = `Couldn't read ${file.name}: it isn't a click wheel JSON file.`;
    }
  };
  input.click();
}

async function copyWidth() {
  await navigator.clipboard?.writeText(width.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1400);
}
</script>

<style scoped>
.cw-export {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cw-step {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  text-wrap: pretty;
}
.cw-step .n {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--cw-surface2);
  font-family: var(--cw-mono);
  font-size: 12px;
}
.cw-step .body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.cw-code {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-radius: 8px;
  background: var(--cw-surface2);
}
.cw-code span {
  flex: 1;
  font-family: var(--cw-mono);
  font-size: 16px;
  font-weight: 500;
}
.cw-code button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--cw-line2);
  border-radius: 6px;
  background: transparent;
  color: var(--cw-text);
  font-size: 12px;
  cursor: pointer;
}
kbd {
  padding: 1px 5px;
  border: 1px solid var(--cw-line2);
  border-radius: 4px;
  font-family: var(--cw-mono);
  font-size: 12px;
}
.layer {
  font-size: 12px;
}
.cw-project {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--cw-line);
}
.cw-project .row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cw-project .cw-btn {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
}
.cw-sub.error {
  color: var(--cw-red);
}
</style>
