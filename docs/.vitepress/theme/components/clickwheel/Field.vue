<template>
  <div class="cw-field">
    <div class="cw-field-row">
      <label :for="id">{{ def.label }}</label>
      <div v-if="def.stepper" class="cw-stepper">
        <button type="button" :aria-label="`Fewer ${def.more}`" @click="f.step(-1)">−</button>
        <input
          :id="id"
          :value="f.text()"
          inputmode="numeric"
          @input="f.type(($event.target as HTMLInputElement).value)"
          @blur="f.blur"
        />
        <button type="button" :aria-label="`More ${def.more}`" @click="f.step(1)">+</button>
      </div>
      <div v-else class="cw-value">
        <input
          :id="id"
          :value="f.text()"
          inputmode="decimal"
          @input="f.type(($event.target as HTMLInputElement).value)"
          @blur="f.blur"
        />
        <span>{{ def.unit }}</span>
      </div>
    </div>
    <input
      v-if="!def.stepper"
      type="range"
      :min="def.min"
      :max="def.max"
      :step="def.step"
      :value="f.value()"
      :aria-label="def.label"
      @input="f.range(+($event.target as HTMLInputElement).value)"
    />
    <div v-if="def.hint" class="cw-hint">{{ def.hint }}</div>
  </div>
</template>

<script setup lang="ts">
import type { FieldDef } from "./geometry.ts";
import { useClickwheel, type FieldModel } from "./state.ts";

// model binds the row to something other than a parameter (the finger position).
const props = defineProps<{ def: FieldDef; model?: FieldModel }>();
const f = props.model ?? useClickwheel().field(props.def);
const id = `cw-${props.def.key}`;
</script>

<style scoped>
.cw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cw-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
}
.cw-value {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid var(--cw-line2);
  border-radius: 8px;
}
.cw-value:focus-within {
  border-color: var(--cw-text);
}
.cw-value input {
  width: 52px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--cw-text);
  font-family: var(--cw-mono);
  font-size: 13px;
  text-align: right;
  outline: none;
}
.cw-value span {
  min-width: 18px;
  font-family: var(--cw-mono);
  font-size: 12px;
  color: var(--cw-muted);
}
.cw-stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cw-stepper button,
.cw-stepper input {
  height: 32px;
  box-sizing: border-box;
  border: 1px solid var(--cw-line2);
  border-radius: 8px;
  background: transparent;
  color: var(--cw-text);
}
.cw-stepper button {
  width: 32px;
  display: grid;
  place-items: center;
  font-size: 16px;
  cursor: pointer;
}
.cw-stepper button:hover {
  background: var(--cw-surface2);
}
.cw-stepper input {
  width: 44px;
  font-family: var(--cw-mono);
  font-size: 13px;
  text-align: center;
  outline: none;
}
.cw-stepper input:focus {
  border-color: var(--cw-text);
}
input[type="range"] {
  width: 100%;
  margin: 0;
  accent-color: var(--cw-brandbtn);
  cursor: pointer;
}
.cw-hint {
  font-size: 12px;
  color: var(--cw-muted);
  text-wrap: pretty;
}
</style>
