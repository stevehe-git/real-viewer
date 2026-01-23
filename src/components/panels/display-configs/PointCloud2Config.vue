<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Topic</span>
      <el-input
        :model-value="options.topic"
        @update:model-value="update('topic', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Queue Size</span>
      <el-input-number
        :model-value="options.queueSize"
        @update:model-value="update('queueSize', $event)"
        size="small"
        :min="1"
        :max="100"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Size</span>
      <el-input-number
        :model-value="options.size"
        @update:model-value="update('size', $event)"
        size="small"
        :min="0.001"
        :max="1"
        :step="0.001"
        :precision="3"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        :precision="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Color Transformer</span>
      <el-select
        :model-value="options.colorTransformer"
        @update:model-value="update('colorTransformer', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="RGB" value="RGB" />
        <el-option label="Intensity" value="Intensity" />
        <el-option label="Flat" value="Flat" />
      </el-select>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity'">
      <span class="config-label">Use Rainbow</span>
      <el-checkbox
        :model-value="options.useRainbow"
        @update:model-value="update('useRainbow', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.useRainbow">
      <span class="config-label">Min Color</span>
      <el-color-picker
        :model-value="getColorString(options.minColor)"
        @update:model-value="updateColor('minColor', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.useRainbow">
      <span class="config-label">Max Color</span>
      <el-color-picker
        :model-value="getColorString(options.maxColor)"
        @update:model-value="updateColor('maxColor', $event)"
        size="small"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRvizStore } from '@/stores/rviz'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

// 将颜色对象转换为十六进制字符串
const getColorString = (color: any): string => {
  if (!color) return '#000000'
  if (typeof color === 'string') return color
  const r = Math.round(color.r || 0).toString(16).padStart(2, '0')
  const g = Math.round(color.g || 0).toString(16).padStart(2, '0')
  const b = Math.round(color.b || 0).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

// 更新颜色（从颜色选择器）
const updateColor = (key: string, hexColor: string) => {
  if (!hexColor) return
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  update(key, { r, g, b })
}
</script>

<style scoped>
.config-content {
  padding: 4px 0;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  min-height: 28px;
  font-size: 12px;
}

.config-label {
  flex: 1;
  color: #606266;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}
</style>