<template>
  <div class="cd-seg" :class="{ tight }" role="group" :aria-label="label">
    <button
      v-for="[v, l] in options"
      :key="String(v)"
      type="button"
      :aria-pressed="v === modelValue"
      :class="{ mono }"
      @click="emit('update:modelValue', v)"
    >
      {{ l }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
// Segmented control: one pressed option out of a few.
defineProps<{ options: [T, string][]; modelValue: T; label?: string; tight?: boolean; mono?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [v: T] }>();
</script>

<style scoped>
.mono {
  font-family: var(--mono);
}
</style>
