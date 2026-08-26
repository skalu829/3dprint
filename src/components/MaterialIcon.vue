<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :style="{ fill: color }"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path :d="path" />
  </svg>
</template>

<script setup>
/* eslint-disable no-undef */
// MDI 图标的 path 数据全部基于 24x24 坐标系，
// viewBox 必须固定为 0 0 24 24（size 只控制渲染尺寸），
// 否则小尺寸图标会被裁剪显示不全
defineProps({
  path: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
  color: { type: String, default: 'currentColor' }
})
</script>
