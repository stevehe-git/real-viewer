<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Reference Frame</span>
      <el-select
        :model-value="options.referenceFrame"
        @update:model-value="update('referenceFrame', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="<Fixed Frame>" value="<Fixed Frame>" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Plane Cell Count</span>
      <el-input-number
        :model-value="options.planeCellCount"
        @update:model-value="update('planeCellCount', $event)"
        size="small"
        :min="1"
        :max="100"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Normal Cell Count</span>
      <el-input-number
        :model-value="options.normalCellCount"
        @update:model-value="update('normalCellCount', $event)"
        size="small"
        :min="0"
        :max="100"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Cell Size</span>
      <el-input-number
        :model-value="options.cellSize"
        @update:model-value="update('cellSize', $event)"
        size="small"
        :min="0.1"
        :max="10"
        :step="0.1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Line Style</span>
      <el-select
        :model-value="options.lineStyle"
        @update:model-value="update('lineStyle', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="Lines" value="Lines" />
        <el-option label="Billboards" value="Billboards" />
      </el-select>
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
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Plane</span>
      <el-select
        :model-value="options.plane"
        @update:model-value="update('plane', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="XY" value="XY" />
        <el-option label="XZ" value="XZ" />
        <el-option label="YZ" value="YZ" />
      </el-select>
    </div>
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleOffset">
        <el-icon class="expand-icon" :class="{ expanded: offsetExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Offset</span>
        <span class="config-value-text">{{ `${options.offsetX}; ${options.offsetY}; ${options.offsetZ}` }}</span>
      </div>
      <div v-show="offsetExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">X</span>
          <el-input-number
            :model-value="options.offsetX"
            @update:model-value="update('offsetX', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Y</span>
          <el-input-number
            :model-value="options.offsetY"
            @update:model-value="update('offsetY', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Z</span>
          <el-input-number
            :model-value="options.offsetZ"
            @update:model-value="update('offsetZ', $event)"
            size="small"
            class="config-value"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ArrowRight } from '@element-plus/icons-vue'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const offsetExpanded = ref(false)

const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
}

const toggleOffset = () => {
  offsetExpanded.value = !offsetExpanded.value
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

.display-sub-item {
  border-top: 1px solid #ebeef5;
  margin-top: 2px;
}

.sub-item-header {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 16px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  gap: 6px;
}

.sub-item-header:hover {
  background: #f0f2f5;
}

.expand-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.sub-item-name {
  flex: 1;
}

.config-value-text {
  font-size: 12px;
  color: #909399;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}
</style>