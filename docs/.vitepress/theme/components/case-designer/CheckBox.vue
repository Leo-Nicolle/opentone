<template>
  <button type="button" class="cd-checkbox" :aria-pressed="modelValue" :aria-label="aria" @click="emit('update:modelValue', !modelValue)">
    <span class="box" aria-hidden="true">{{ modelValue ? "✓" : "" }}</span>
    <slot />
  </button>
</template>

<script setup lang="ts">
// 18 px checkbox as a real toggle button, with its label as the slot.
defineProps<{ modelValue: boolean; aria?: string }>();
const emit = defineEmits<{ "update:modelValue": [v: boolean] }>();
</script>

<style scoped>
.cd-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.box {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--line2);
  background: transparent;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  flex: none;
}
[aria-pressed="true"] .box {
  border-color: var(--brandbtn);
  background: var(--brandbtn);
}
</style>
