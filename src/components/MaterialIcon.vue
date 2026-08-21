<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    :style="{ fill: color }"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path :d="path" />
  </svg>
</template>

<script setup>
/* eslint-disable no-undef */
import { computed } from 'vue'

const props = defineProps({
  path: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
  color: { type: String, default: 'currentColor' }
})

const viewBox = computed(() => {
  const s = Number(props.size)
  return `0 0 ${s} ${s}`
})
</script>
