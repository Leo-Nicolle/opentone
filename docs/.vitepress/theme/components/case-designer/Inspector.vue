<template>
  <div class="cd-panel insp">
    <div class="head"><div class="cd-label">Inspector</div><span class="cd-badge">{{ kind }}</span></div>

    <p v-if="kind === 'nothing'" class="cd-note none">Click a part in the view or the parts list to move it and see how close it sits to each wall.</p>

    <template v-else-if="kind === 'stock'">
      <div><div class="title">{{ stockLabel }} {{ D.st.kind.toLowerCase() }}</div><div class="sub cd-mono">cut to {{ D.L }} mm · outer r {{ fx(D.st.r) }}</div></div>
      <div class="note">Inside: {{ fx(D.w - 2 * D.t) }} × {{ fx(D.d - 2 * D.t) }} mm. Ends: {{ ends }}.</div>
      <div class="acts"><button type="button" class="cd-btn md" @click="s.setStep('stock')">Change stock</button></div>
    </template>

    <template v-else-if="kind === 'cutout' && cut && raw">
      <div><div class="title">{{ cut.name }}</div><div class="sub cd-mono">{{ FACEN[cut.face] }} · {{ cutDims }} mm</div></div>
      <div v-if="!cut.link" class="faces">
        <button v-for="f in FACES" :key="f" type="button" class="face-chip" :aria-pressed="cut.face === f" @click="raw.face = f">{{ FACEN[f] }}</button>
      </div>
      <div v-if="cutFields" class="cd-group">
        <template v-if="!lockSize">
          <Field v-if="cut.shape === 'circle'" id="ciD" narrow label="Diameter" :model-value="raw.w" :min="0.5" @update:model-value="(v) => setSize({ w: v, h: v })" />
          <template v-else>
            <Field id="ciW" narrow label="Width" :model-value="raw.w" :min="0.5" @update:model-value="(v) => setSize({ w: v })" />
            <Field id="ciH" narrow label="Height" :model-value="raw.h" :min="0.5" @update:model-value="(v) => setSize({ h: v })" />
          </template>
          <Field v-if="cut.shape === 'rect'" id="ciR" v-model="raw.r" narrow label="Corner radius" :step="0.25" :min="0" />
        </template>
        <template v-if="!cut.follow">
          <Field id="ciU" v-model="raw.u" narrow :label="isSide(cut.face) ? 'Y from bottom' : 'X from centre line'" :step="0.5" />
          <Field id="ciV" v-model="raw.v" narrow :label="isSide(cut.face) || isCap(cut.face) ? 'Depth below front' : 'Y from bottom'" :step="0.5" />
        </template>
      </div>
      <CheckBox v-if="cut.link" :model-value="cut.follow" @update:model-value="(v) => s.setFollow(cut!.id, v)">Follow {{ linkName }}</CheckBox>
      <div class="note">{{ cutNote }}</div>
      <div v-if="!cut.link" class="acts"><button type="button" class="cd-btn md danger" @click="s.deleteCut(cut.id)">Delete cutout</button></div>
    </template>

    <template v-else-if="body">
      <div><div class="title">{{ body.name }}</div><div class="sub cd-mono">{{ sub }}</div></div>
      <div v-if="note" class="note">{{ note }}</div>
      <div v-if="body.gen" class="cd-group">
        <Field id="gX" v-model="s.project.wheel.cx" narrow label="X · from centre line" :step="0.5" />
        <Field id="gY" v-model="s.project.wheel.cy" narrow label="Y · from bottom" :step="0.5" />
      </div>
      <div v-else-if="part && !part.parent" class="cd-group">
        <Field id="pX" narrow label="X · from centre line" :model-value="part.cx" @update:model-value="(v) => s.setPart(part!.id, 'cx', v)" />
        <Field id="pY" narrow label="Y · from bottom" :model-value="part.cy" @update:model-value="(v) => s.setPart(part!.id, 'cy', v)" />
        <Field id="pZ" narrow label="Z · below front face" :model-value="part.cz" @update:model-value="(v) => s.setPart(part!.id, 'cz', v)" />
      </div>
      <div class="cd-group clear">
        <div class="cd-note">Clearance to the inside walls</div>
        <div class="grid">
          <div v-for="c in clear" :key="c.n"><span class="n">{{ c.n }}</span><span class="v cd-mono" :style="{ color: c.fg }">{{ c.v }}</span></div>
        </div>
      </div>
      <div v-if="part && !part.parent" class="cd-group">
        <label class="mat"><span class="cd-note">Material</span>
          <select v-model="part.mat"><option v-for="(n, k) in MAT_NAMES" :key="k" :value="k">{{ n }}</option></select>
        </label>
      </div>
      <div class="acts">
        <template v-if="body.gen"><button type="button" class="cd-btn md" @click="s.setStep('wheel')">Edit in Wheel</button></template>
        <template v-else-if="part && !part.parent">
          <button type="button" class="cd-btn md" @click="s.rotatePart(part.id)">Rotate 90°</button>
          <button type="button" class="cd-btn md" @click="s.toggleHidden(part.id)">{{ s.project.hidden[part.id] ? "Show" : "Hide" }}</button>
          <button type="button" class="cd-btn md danger" @click="s.removePart(part.id)">Remove</button>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { FACEN, FACES, MAT_NAMES, dimsOf, fx, isCap, isSide, type Body, type Cut } from "./model.ts";
import Field from "./Field.vue";
import CheckBox from "./CheckBox.vue";

const s = inject(CASE)!;
const D = computed(() => s.D.value);
const sel = computed(() => s.ui.sel);
const stockLabel = computed(() => `${fx(D.value.w)} × ${fx(D.value.d)} × ${fx(D.value.t)}`);

const cut = computed(() => (sel.value.startsWith("cut:") ? D.value.cutsW.find((c) => "cut:" + c.id === sel.value) : undefined));
const raw = computed(() => (cut.value ? s.project.cuts.find((c) => c.id === cut.value!.id) : undefined));
const body = computed<Body | undefined>(() => D.value.B.find((b) => b.id === sel.value));
const part = computed(() => body.value?.part);

const kind = computed(() => {
  if (sel.value === "case") return "stock";
  if (cut.value) return "cutout";
  if (body.value) return body.value.gen ? "generated" : body.value.part?.parent ? "on PCB" : "part";
  return "nothing";
});
const ends = computed(() => ({ alu: `aluminium caps, ${fx(s.project.capT)} mm`, printed: `printed caps, ${fx(s.project.capT)} mm`, open: "open" })[s.project.caps]);

// Cutout.
const lockSize = computed(() => cut.value?.link === "wheel" && cut.value.follow);
const cutFields = computed(() => !lockSize.value || !cut.value?.follow);
const cutDims = computed(() => (cut.value ? (cut.value.shape === "circle" ? "Ø" + fx(cut.value.w) : `${fx(cut.value.w)} × ${fx(cut.value.h)}`) : ""));
const linkName = computed(() => {
  const c = cut.value;
  if (!c?.link) return "";
  return c.link === "wheel" ? "the click wheel" : c.target ? c.target.name : `${c.link} (not imported)`;
});
const cutNote = computed(() => {
  const c = cut.value!, cs = D.value.cutStat[c.id];
  const follow = c.follow && c.target ? `Centred on ${linkName.value}${lockSize.value ? `, sized from the wheel radius plus ${fx(s.project.wheel.clear)} mm clearance` : ""}. ` : "";
  const mill = cs.milled ? (cs.st === "warn" ? `Needs a smaller cutter than Ø${s.project.toolD}.` : `Millable with a Ø${s.project.toolD} end mill.`) : "Printed with the cap, no milling.";
  return follow + mill;
});
/** Editing a linked cutout's size lets go of its part. */
function setSize(patch: Partial<Cut>) {
  const c = cut.value!;
  if (c.follow) s.unlink(c.id);
  s.setCut(c.id, patch);
}

// Part.
const sub = computed(() => {
  const b = body.value!;
  if (b.gen) return `Ø${fx(b.R * 2)}${b.rIn ? " / Ø" + fx(b.rIn * 2) : ""} × ${fx(b.Z1 - b.Z0)} mm`;
  const p = b.part!;
  return [p.ref, p.file || "placeholder box", dimsOf(b) + " mm"].filter(Boolean).join(" · ");
});
const note = computed(() => {
  const b = body.value!;
  if (b.gen) return "Generated from the wheel settings. Move the whole wheel here or tune its shape in step 4.";
  if (b.part?.parent) return "Placed by the KiCad board. Move the Main PCB, or move the footprint in KiCad and re-import.";
  if (s.children(b.id).length) return "Its connectors and switches move with it.";
  return "";
});
const clear = computed(() => {
  const b = body.value!, inn = D.value.inner;
  const rows: [string, number | null][] = [
    ["Left", b.X0 - inn.x0], ["Right", inn.x1 - b.X1], ["Front", b.through ? null : inn.z1 - b.Z1],
    ["Back", b.Z0 - inn.z0], ["Bottom", b.Y0 - inn.y0], ["Top", inn.y1 - b.Y1],
  ];
  return rows.map(([n, v]) => ({
    n, v: v == null ? "through" : fx(v) + " mm",
    fg: v == null ? "var(--muted)" : v < -0.005 ? "var(--red)" : v < s.project.fill.clear ? "var(--amber)" : "var(--text)",
  }));
});
</script>

<style scoped>
.insp {
  padding: 20px;
  gap: 16px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.none {
  margin: 0;
  font-size: 13px;
}
.title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sub {
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
}
.note {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface2);
  font-size: 12px;
  text-wrap: pretty;
}
.faces {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.face-chip {
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}
.face-chip[aria-pressed="true"] {
  border-color: var(--brand);
  background: var(--brandsoft);
  color: var(--brand);
}
.clear {
  gap: 6px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.grid > div {
  background: var(--surface);
  padding: 7px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.n {
  font-size: 11px;
  color: var(--muted);
}
.v {
  font-size: 12px;
}
.mat {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px;
  gap: 10px;
  align-items: center;
}
.mat select {
  height: 32px;
  border: 1px solid var(--line2);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px !important;
  padding: 0 6px;
}
.acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
