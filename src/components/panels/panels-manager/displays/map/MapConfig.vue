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
      <span class="config-label">Color Scheme</span>
      <el-select
        :model-value="options.colorScheme"
        @update:model-value="update('colorScheme', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="map" value="map" />
        <el-option label="costmap" value="costmap" />
        <el-option label="raw" value="raw" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Draw Behind</span>
      <el-checkbox
        :model-value="options.drawBehind"
        @update:model-value="update('drawBehind', $event)"
        class="config-value"
      />
    </div>
    <!-- 只读参数：从消息中读取，不可修改 -->
    <div class="config-row readonly-param">
      <span class="config-label">Resolution</span>
      <span class="config-value readonly-value">{{ readonlyResolution.toFixed(6) }}</span>
    </div>
    <div class="config-row readonly-param">
      <span class="config-label">Width</span>
      <span class="config-value readonly-value">{{ readonlyWidth }}</span>
    </div>
    <div class="config-row readonly-param">
      <span class="config-label">Height</span>
      <span class="config-value readonly-value">{{ readonlyHeight }}</span>
    </div>

    <!-- Position (可展开，只读) - ROS 地图原点坐标 (info.origin.position) -->
    <div class="display-sub-item readonly-param">
      <div class="sub-item-header" @click="togglePosition">
        <el-icon class="expand-icon" :class="{ expanded: positionExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Position (Origin)</span>
        <span class="config-value-text">{{ `${readonlyPositionX.toFixed(3)}; ${readonlyPositionY.toFixed(3)}; ${readonlyPositionZ.toFixed(3)}` }}</span>
      </div>
      <div v-show="positionExpanded" class="sub-item-content">
        <div class="config-row readonly-param">
          <span class="config-label">X</span>
          <span class="config-value readonly-value">{{ readonlyPositionX.toFixed(6) }}</span>
        </div>
        <div class="config-row readonly-param">
          <span class="config-label">Y</span>
          <span class="config-value readonly-value">{{ readonlyPositionY.toFixed(6) }}</span>
        </div>
        <div class="config-row readonly-param">
          <span class="config-label">Z</span>
          <span class="config-value readonly-value">{{ readonlyPositionZ.toFixed(6) }}</span>
        </div>
      </div>
    </div>

    <!-- Orientation (可展开，只读) -->
    <div class="display-sub-item readonly-param">
      <div class="sub-item-header" @click="toggleOrientation">
        <el-icon class="expand-icon" :class="{ expanded: orientationExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Orientation</span>
        <span class="config-value-text">{{ `${readonlyOrientationX.toFixed(3)}; ${readonlyOrientationY.toFixed(3)}; ${readonlyOrientationZ.toFixed(3)}; ${readonlyOrientationW.toFixed(3)}` }}</span>
      </div>
      <div v-show="orientationExpanded" class="sub-item-content">
        <div class="config-row readonly-param">
          <span class="config-label">X</span>
          <span class="config-value readonly-value">{{ readonlyOrientationX.toFixed(6) }}</span>
        </div>
        <div class="config-row readonly-param">
          <span class="config-label">Y</span>
          <span class="config-value readonly-value">{{ readonlyOrientationY.toFixed(6) }}</span>
        </div>
        <div class="config-row readonly-param">
          <span class="config-label">Z</span>
          <span class="config-value readonly-value">{{ readonlyOrientationZ.toFixed(6) }}</span>
        </div>
        <div class="config-row readonly-param">
          <span class="config-label">W</span>
          <span class="config-value readonly-value">{{ readonlyOrientationW.toFixed(6) }}</span>
        </div>
      </div>
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
      <span class="config-label">Use Timestamp</span>
      <el-checkbox
        :model-value="options.useTimestamp"
        @update:model-value="update('useTimestamp', $event)"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'
import { ArrowRight } from '@element-plus/icons-vue'
import TopicSelector from '../common/TopicSelector.vue'

interface Props {
  componentId: string
  componentType?: string
  options: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  componentType: 'map'
})

const rvizStore = useRvizStore()

// 使用 computed 来响应式地获取消息
// 优先从 store 获取，如果没有则从 topicSubscriptionManager 获取
const mapMessage = computed(() => {
  // 先从 store 获取
  let message = rvizStore.getComponentData(props.componentId)
  
  // 如果 store 中没有，从 topicSubscriptionManager 获取
  if (!message) {
    message = topicSubscriptionManager.getLatestMessage(props.componentId)
  }
  
  if (!message || !message.info) return null
  
  return {
    resolution: message.info.resolution ?? 0,
    width: message.info.width ?? 0,
    height: message.info.height ?? 0,
    origin: message.info.origin || {}
  }
})

// 监听 store 中的组件数据变化
// 使用 watch 监听特定组件的数据，确保响应式更新
watch(
  () => rvizStore.getComponentData(props.componentId),
  () => {
    // 当组件数据更新时，computed 会自动重新计算
  },
  { immediate: true, deep: true }
)

// 计算显示的只读值
// Resolution, Width, Height: 从 message.info 中读取
const readonlyResolution = computed(() => mapMessage.value?.resolution ?? 0)
const readonlyWidth = computed(() => mapMessage.value?.width ?? 0)
const readonlyHeight = computed(() => mapMessage.value?.height ?? 0)

// Position: ROS 地图原点坐标 (info.origin.position)
// 表示地图左下角在世界坐标系中的位置
const readonlyPositionX = computed(() => mapMessage.value?.origin?.position?.x ?? 0)
const readonlyPositionY = computed(() => mapMessage.value?.origin?.position?.y ?? 0)
const readonlyPositionZ = computed(() => mapMessage.value?.origin?.position?.z ?? 0)

// Orientation: ROS 地图原点方向 (info.origin.orientation)
const readonlyOrientationX = computed(() => mapMessage.value?.origin?.orientation?.x ?? 0)
const readonlyOrientationY = computed(() => mapMessage.value?.origin?.orientation?.y ?? 0)
const readonlyOrientationZ = computed(() => mapMessage.value?.origin?.orientation?.z ?? 0)
const readonlyOrientationW = computed(() => mapMessage.value?.origin?.orientation?.w ?? 1)

const positionExpanded = ref(false)
const orientationExpanded = ref(false)

const togglePosition = () => {
  positionExpanded.value = !positionExpanded.value
}

const toggleOrientation = () => {
  orientationExpanded.value = !orientationExpanded.value
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

.config-value-text {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
  margin-left: auto;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}

/* 只读参数样式 */
.readonly-param {
  opacity: 0.8;
}

.readonly-value {
  color: #909399;
  font-family: monospace;
  font-size: 12px;
  user-select: text;
  cursor: default;
}
</style>
