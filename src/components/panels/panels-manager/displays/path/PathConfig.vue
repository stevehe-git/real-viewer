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
      <span class="config-label">Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="options.color"
          @update:model-value="update('color', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(options.color) }}</span>
      </div>
    </div>
    <div class="config-row">
      <span class="config-label">Buffer Length</span>
      <el-input-number
        :model-value="options.bufferLength"
        @update:model-value="update('bufferLength', $event)"
        size="small"
        :min="1"
        :max="1000"
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

const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
}

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
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

.color-config {
  gap: 8px;
}

.color-text {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}
</style>