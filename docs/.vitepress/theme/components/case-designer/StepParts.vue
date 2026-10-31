<template>
  <div class="cd-stack">
    <div>
      <h2 class="cd-h2">Parts</h2>
      <p class="cd-desc">Import the board and every module, then place them. Connectors and switches come with the KiCad board and move with it.</p>
    </div>
    <label class="drop">
      <input type="file" :accept="ACCEPT" multiple class="hidden-input" @change="onFiles" />
      <span class="t">Add 3D models</span>
      <span class="cd-note">STEP, STL, GLB or 3MF. From KiCad: File › Export › STEP, with 3D models.</span>
    </label>
    <div class="tree">
      <div class="cd-label head">Imported</div>
      <div v-for="r in imported" :key="r.key" class="row" :class="{ on: s.ui.sel === r.key }">
        <button type="button" class="sel" :style="{ paddingLeft: r.child ? '26px' : '8px' }" @click="s.select(r.key)">
          <span class="sw" :style="{ background: r.sw }"></span>
          <span class="txt">
            <span class="name" :class="{ hid: r.hidden }">{{ r.name }}</span>
            <span class="meta cd-mono">{{ r.meta }}</span>
          </span>
          <span v-if="r.clash" class="clash" title="Clashes"></span>
        </button>
        <select v-if="r.roleEdit" class="role" :value="r.role" :aria-label="`Role of ${r.name}`" @change="setRole(r.key, ($event.target as HTMLSelectElement).value)">
          <option v-for="[v, l] in ROLES" :key="v" :value="v">{{ l }}</option>
        </select>
        <button type="button" class="eye" :aria-label="(r.hidden ? 'Show ' : 'Hide ') + r.name" @click="s.toggleHidden(r.key)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path :d="r.hidden ? EYE_OFF : EYE_ON" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
      <p v-if="!imported.length" class="cd-note">Nothing imported yet.</p>
      <div class="cd-label head gen">Generated in step 4</div>
      <div v-for="r in generated" :key="r.key" class="row" :class="{ on: s.ui.sel === r.key }">
        <button type="button" class="sel" @click="s.select(r.key)">
          <span class="sw" :style="{ background: r.sw }"></span>
          <span class="txt">
            <span class="name" :class="{ hid: r.hidden }">{{ r.name }}</span>
            <span class="meta cd-mono">{{ r.meta }}</span>
          </span>
          <span v-if="r.clash" class="clash" title="Clashes"></span>
        </button>
        <button type="button" class="eye" :aria-label="(r.hidden ? 'Show ' : 'Hide ') + r.name" @click="s.toggleHidden(r.key)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path :d="r.hidden ? EYE_OFF : EYE_ON" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
    <div v-if="s.hasPlaceholders.value" class="cd-group">
      <div class="cd-note">Parts without a file are placeholder boxes from the sample. Importing a board, a screen or a battery replaces its placeholder in place.</div>
      <button type="button" class="cd-btn md start" @click="s.removePlaceholders">Remove the placeholder boxes</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { CASE } from "./state.ts";
import { ACCEPT } from "./importers.ts";
import { MAT, ROLES, dimsOf, fx, rgba, type Role } from "./model.ts";

const EYE_ON = "M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z M8 10a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z";
const EYE_OFF = "M2 2l12 12 M6.3 3.7A6.6 6.6 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.9 2.4 M4.1 5.1A11 11 0 0 0 1.5 8s2.4 4.5 6.5 4.5a6.4 6.4 0 0 0 2.5-.5";

const s = inject(CASE)!;

const row = (key: string, name: string, meta: string, extra: { child?: boolean; roleEdit?: boolean; role?: Role } = {}) => {
  const b = s.D.value.B.find((x) => x.key === key)!;
  return { key, name, meta, sw: rgba(MAT[b.mat]), clash: !!s.D.value.clash[key], hidden: !!s.project.hidden[key], ...extra };
};
const imported = computed(() => {
  const out: ReturnType<typeof row>[] = [];
  const B = s.D.value.B;
  for (const p of s.project.parts.filter((q) => !q.parent)) {
    out.push(row(p.id, p.name, p.file || "placeholder box"));
    for (const c of s.project.parts.filter((q) => q.parent === p.id)) {
      const b = B.find((x) => x.id === c.id)!;
      out.push(row(c.id, c.name, [c.ref, dimsOf(b)].filter(Boolean).join(" · "), { child: true, roleEdit: !!c.mesh, role: c.role }));
    }
  }
  return out;
});
const generated = computed(() => [
  row("ring", "Wheel exoskeleton", "ring + 4 bumps"),
  row("flex", "Click wheel flex PCB", `Ø${fx(s.project.wheel.R * 2)} · from Click Wheel designer`),
  row("cap", "Centre button", "cap + plunger"),
]);

function setRole(id: string, role: string) {
  const p = s.part(id);
  if (!p) return;
  // One part per role.
  for (const q of s.project.parts) if (q !== p && role && q.role === role) q.role = "";
  p.role = role as Role;
}
function onFiles(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.files?.length) s.importFiles(el.files);
  el.value = "";
}
</script>

<style scoped>
.drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 14px;
  border: 1px dashed var(--line2);
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
}
.drop:hover,
.drop:focus-within {
  background: var(--surface2);
}
.t {
  font-weight: 600;
}
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.head {
  padding: 0 0 6px;
}
.head.gen {
  padding-top: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 8px;
}
.row.on {
  background: var(--brandsoft);
}
.sel {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name.hid {
  color: var(--muted);
}
.meta {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clash {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
  flex: none;
}
.role {
  width: 92px;
  height: 26px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 11px !important;
  flex: none;
}
.eye {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  display: grid;
  place-items: center;
  flex: none;
}
.eye:hover {
  background: var(--surface2);
}
.row:has(.hid) .eye {
  color: var(--muted);
}
.start {
  align-self: flex-start;
}
</style>
