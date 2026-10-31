<template>
  <div class="cd-field" :class="{ narrow }">
    <label :for="id">{{ label }}</label>
    <div class="cd-stepper">
      <button type="button" :aria-label="`Decrease ${label}`" @click="emitClamped(modelValue - step)">−</button>
      <input :id="id" type="number" :step="step" :value="text" @change="onChange" />
      <span v-if="unit">{{ unit }}</span>
      <button type="button" :aria-label="`Increase ${label}`" @click="emitClamped(modelValue + step)">+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Numeric field: label on the left, a −/+ stepper with a mono input and its unit on the right.
import { computed } from "vue";

const props = withDefaults(
  defineProps<{ id: string; label: string; modelValue: number; unit?: string; step?: number; min?: number; max?: number; narrow?: boolean }>(),
  { unit: "mm", step: 0.1, min: -1e9, max: 1e9, narrow: false },
);
const emit = defineEmits<{ "update:modelValue": [v: number] }>();

const text = computed(() => String(Math.round(props.modelValue * 1000) / 1000));
function emitClamped(v: number) {
  emit("update:modelValue", Math.round(Math.max(props.min, Math.min(props.max, v)) * 1000) / 1000);
}
function onChange(e: Event) {
  const el = e.target as HTMLInputElement;
  const v = parseFloat(el.value);
  if (isNaN(v)) el.value = text.value;
  else emitClamped(v);
}
</script>

<style scoped>
.cd-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px;
  gap: 10px;
  align-items: center;
}
.cd-field.narrow {
  grid-template-columns: minmax(0, 1fr) 124px;
}
label {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.25;
}
.narrow label {
  font-size: 12px;
}
.cd-stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--line2);
  border-radius: 8px;
  height: 32px;
  overflow: hidden;
  background: var(--surface);
}
.cd-stepper:focus-within {
  border-color: var(--brand);
}
button {
  width: 26px;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  flex: none;
}
.narrow button {
  width: 24px;
}
button:hover {
  color: var(--text);
  background: var(--surface2);
}
input {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px !important;
  text-align: right;
  outline: none;
  padding: 0 2px;
}
span {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  padding: 0 4px;
}
</style>
