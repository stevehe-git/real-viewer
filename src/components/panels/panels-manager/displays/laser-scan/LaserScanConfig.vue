<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Topic</span>
      <TopicSelector
        :model-value="options.topic"
        @update:model-value="update('topic', $event)"
        :component-type="componentType"
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
      <span class="config-label">Style</span>
      <el-select
        :model-value="options.style"
        @update:model-value="update('style', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="Flat Squares" value="Flat Squares" />
        <el-option label="Points" value="Points" />
        <el-option label="Billboards" value="Billboards" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Size (m)</span>
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
    <div class="config-row" v-if="options.colorTransformer === 'Intensity'">
      <span class="config-label">Autocompute Intensity Bounds</span>
      <el-checkbox
        :model-value="options.autocomputeIntensityBounds"
        @update:model-value="update('autocomputeIntensityBounds', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.autocomputeIntensityBounds">
      <span class="config-label">Min Intensity</span>
      <el-input-number
        :model-value="options.minIntensity"
        @update:model-value="update('minIntensity', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.autocomputeIntensityBounds">
      <span class="config-label">Max Intensity</span>
      <el-input-number
        :model-value="options.maxIntensity"
        @update:model-value="update('maxIntensity', $event)"
        size="small"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRvizStore } from '@/stores/rviz'
import TopicSelector from '../common/TopicSelector.vue'

interface Props {
  componentId: string
  componentType?: string
  options: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  componentType: 'laserscan'
})

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