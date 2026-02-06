<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Topic</span>
      <TopicSelector
        :model-value="options.topic"
        @update:model-value="update('topic', $event)"
        :component-type="componentType"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Unreliable</span>
      <el-checkbox
        :model-value="options.unreliable"
        @update:model-value="update('unreliable', $event)"
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
      <span class="config-label">Position Tolerance</span>
      <el-input-number
        :model-value="options.positionTolerance"
        @update:model-value="update('positionTolerance', $event)"
        size="small"
        :min="0"
        :max="10"
        :step="0.1"
        :precision="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Angle Tolerance</span>
      <el-input-number
        :model-value="options.angleTolerance"
        @update:model-value="update('angleTolerance', $event)"
        size="small"
        :min="0"
        :max="10"
        :step="0.1"
        :precision="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Keep</span>
      <el-input-number
        :model-value="options.keep"
        @update:model-value="update('keep', $event)"
        size="small"
        :min="1"
        :max="1000"
        class="config-value"
      />
    </div>
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleShape">
        <el-icon class="expand-icon" :class="{ expanded: shapeExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Shape</span>
        <el-select
          :model-value="options.shape"
          @update:model-value="update('shape', $event)"
          @click.stop
          size="small"
          class="config-value-select"
        >
          <el-option label="Axes" value="Axes" />
        </el-select>
      </div>
      <div v-show="shapeExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">Axes Length</span>
          <el-input-number
            :model-value="options.axesLength"
            @update:model-value="update('axesLength', $event)"
            size="small"
            :min="0.1"
            :max="10"
            :step="0.1"
            :precision="1"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Axes Radius</span>
          <el-input-number
            :model-value="options.axesRadius"
            @update:model-value="update('axesRadius', $event)"
            size="small"
            :min="0.01"
            :max="1"
            :step="0.01"
            :precision="2"
            class="config-value"
          />
        </div>
      </div>
    </div>
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleCovariance">
        <el-icon class="expand-icon" :class="{ expanded: covarianceExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Covariance</span>
        <el-checkbox
          :model-value="options.covariance"
          @update:model-value="update('covariance', $event)"
          @click.stop
          class="config-value-checkbox"
        />
      </div>
      <div v-show="covarianceExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">Position</span>
          <el-checkbox
            :model-value="options.positionCovariance"
            @update:model-value="update('positionCovariance', $event)"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Orientation</span>
          <el-checkbox
            :model-value="options.orientationCovariance"
            @update:model-value="update('orientationCovariance', $event)"
            class="config-value"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useRvizStore } from '@/stores/rviz'
import TopicSelector from '../common/TopicSelector.vue'

interface Props {
  componentId: string
  componentType?: string
  options: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  componentType: 'odometry'
})

const rvizStore = useRvizStore()
const shapeExpanded = ref(false)
const covarianceExpanded = ref(false)

const toggleShape = () => {
  shapeExpanded.value = !shapeExpanded.value
}

const toggleCovariance = () => {
  covarianceExpanded.value = !covarianceExpanded.value
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

.config-value-select {
  flex: 1;
  min-width: 120px;
  margin-left: auto;
}

.config-value-checkbox {
  margin-left: auto;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}
</style>
