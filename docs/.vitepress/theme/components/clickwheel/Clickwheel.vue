<template>
  <div class="cw vp-raw">
    <div class="cw-grid">
      <ParamsPanel class="a-params" />
      <FootprintPanel class="a-canvas" />
      <TouchPanel class="a-touch" />
      <InterpPanel class="a-lin" />
      <ExportPanel class="a-export" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide } from "vue";
import "./clickwheel.css";
import ParamsPanel from "./ParamsPanel.vue";
import FootprintPanel from "./FootprintPanel.vue";
import TouchPanel from "./TouchPanel.vue";
import InterpPanel from "./InterpPanel.vue";
import ExportPanel from "./ExportPanel.vue";
import { CLICKWHEEL, createClickwheel } from "./state.ts";

provide(CLICKWHEEL, createClickwheel());
</script>

<style scoped>
/* Columns follow the component's own width (container queries), not the viewport. */
.cw-grid {
  display: grid;
  gap: 20px;
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "canvas" "touch" "params" "lin" "export";
}
@container (min-width: 880px) {
  .cw-grid {
    grid-template-columns: 300px minmax(0, 1fr);
    grid-template-areas: "params canvas" "params touch" "export lin";
  }
}
@container (min-width: 1240px) {
  .cw-grid {
    grid-template-columns: 300px minmax(0, 1fr) 300px;
    grid-template-areas: "params canvas touch" "export lin lin";
  }
}
/* Very wide (ToolLayout on a large screen): everything side by side. */
@container (min-width: 1640px) {
  .cw-grid {
    grid-template-columns: 300px minmax(0, 1.25fr) 320px minmax(0, 1fr);
    grid-template-areas: "params canvas touch lin" "params canvas touch export";
  }
}
.a-params {
  grid-area: params;
}
.a-canvas {
  grid-area: canvas;
}
.a-touch {
  grid-area: touch;
}
.a-lin {
  grid-area: lin;
}
.a-export {
  grid-area: export;
}
</style>
