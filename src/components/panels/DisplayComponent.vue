<template>
  <div
    class="display-component-item"
    :class="{ active: selected }"
    @click="$emit('select', component.id)"
  >
    <div class="display-item-header">
      <el-icon class="item-icon">
        <component :is="getComponentIcon(component.type)" />
      </el-icon>
      <el-checkbox
        v-model="localEnabled"
        @change="handleEnabledChange"
        @click.stop
      />
      <span class="item-name">{{ component.name }}</span>
      <el-icon 
        class="expand-icon" 
        :class="{ expanded: component.expanded }"
        @click.stop="$emit('toggle', component.id)"
      >
        <ArrowDown />
      </el-icon>
    </div>

    <div v-show="component.expanded" class="display-item-content">
      <!-- Status子项 -->
      <div class="display-sub-item">
        <div class="sub-item-header" @click.stop="toggleSubItem('status')">
          <el-icon 
            class="sub-item-icon" 
            :class="{
              'success-icon': (component.type === 'tf' ? (tfSubscriptionStatus?.subscribed && tfSubscriptionStatus?.hasData) : (subscriptionStatus.subscribed && subscriptionStatus.hasData)),
              'warning-icon': (component.type === 'tf' ? (tfSubscriptionStatus?.subscribed && !tfSubscriptionStatus?.hasData) : (subscriptionStatus.subscribed && !subscriptionStatus.hasData)),
              'error-icon': (component.type === 'tf' ? false : subscriptionStatus.error)
            }"
          >
            <CircleCheck v-if="(component.type === 'tf' ? (tfSubscriptionStatus?.subscribed && tfSubscriptionStatus?.hasData) : (subscriptionStatus.subscribed && subscriptionStatus.hasData))" />
            <Warning v-else-if="(component.type === 'tf' ? false : subscriptionStatus.error)" />
            <CircleCheck v-else />
          </el-icon>
          <span class="sub-item-name">
            Status: {{ getStatusText() }}
          </span>
          <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['status'] }">
            <ArrowDown />
          </el-icon>
        </div>
        <div v-show="expandedSubItems['status']" class="sub-item-content">
          <div class="status-detail">
            <div class="status-row">
              <span class="status-label">Subscribed:</span>
              <span class="status-value">{{ (component.type === 'tf' ? (tfSubscriptionStatus?.subscribed ?? false) : subscriptionStatus.subscribed) ? 'Yes' : 'No' }}</span>
            </div>
            <div class="status-row" v-if="(component.type === 'tf' ? tfSubscriptionStatus?.subscribed : subscriptionStatus.subscribed)">
              <span class="status-label">Messages:</span>
              <span class="status-value">{{ component.type === 'tf' ? (tfSubscriptionStatus?.messageCount ?? 0) : subscriptionStatus.messageCount }}</span>
            </div>
            <div class="status-row" v-if="(component.type === 'tf' ? tfSubscriptionStatus?.lastMessageTime : subscriptionStatus.lastMessageTime)">
              <span class="status-label">Last Message:</span>
              <span class="status-value">{{ formatTime((component.type === 'tf' ? (tfSubscriptionStatus?.lastMessageTime ?? 0) : subscriptionStatus.lastMessageTime)!) }}</span>
            </div>
            <div class="status-row" v-if="(component.type === 'tf' ? false : subscriptionStatus.error)">
              <span class="status-label error-text">Error:</span>
              <span class="status-value error-text">{{ subscriptionStatus.error }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 根据组件类型渲染不同的配置项 -->
      <component
        :is="getConfigComponent(component.type)"
        :component-id="component.id"
        :options="component.options"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { useTopicSubscription } from '@/composables/useTopicSubscription'
import {
  Grid,
  Position,
  Camera,
  Connection,
  Location,
  Picture,
  DataLine,
  Monitor,
  ArrowDown,
  CircleCheck,
  Share,
  Warning,
  Box
} from '@element-plus/icons-vue'
import GridConfig from './display-configs/GridConfig.vue'
import AxesConfig from './display-configs/AxesConfig.vue'
import CameraConfig from './display-configs/CameraConfig.vue'
import MapConfig from './display-configs/MapConfig.vue'
import { Files } from '@element-plus/icons-vue'
import PathConfig from './display-configs/PathConfig.vue'
import MarkerConfig from './display-configs/MarkerConfig.vue'
import ImageConfig from './display-configs/ImageConfig.vue'
import LaserScanConfig from './display-configs/LaserScanConfig.vue'
import PointCloud2Config from './display-configs/PointCloud2Config.vue'
import TFConfig from './display-configs/TFConfig.vue'
import RobotModelConfig from './display-configs/RobotModelConfig.vue'
import { tfManager } from '@/services/tfManager'

// 使用RViz store
const rvizStore = useRvizStore()

interface DisplayComponentData {
  id: string
  type: string
  name: string
  enabled: boolean
  expanded: boolean
  options: Record<string, any>
}

interface Props {
  component: DisplayComponentData
  selected: boolean
}

const props = defineProps<Props>()

const localEnabled = ref(props.component.enabled)

watch(() => props.component.enabled, (newVal) => {
  localEnabled.value = newVal
})

const expandedSubItems = reactive<Record<string, boolean>>({
  status: true
})


// 话题订阅（仅对需要话题的组件类型）
const needsTopic = computed(() => {
  return ['map', 'path', 'laserscan', 'pointcloud2', 'marker', 'image', 'camera'].includes(props.component.type)
})

// RobotModel 组件需要监听组件启用状态来触发加载
watch(() => props.component.enabled, (enabled) => {
  if (props.component.type === 'robotmodel' && enabled) {
    // RobotModel 组件启用时，触发渲染更新
    // 这会在 Rviz3DViewer 中通过 updateComponentRender 调用
    rvizStore.updateComponent(props.component.id, { enabled })
  }
}, { immediate: true })

// 使用话题订阅 composable（使用统一的话题订阅管理器）
const {
  status: subscriptionStatus,
  getLatestMessage,
  subscribe,
  unsubscribe
} = useTopicSubscription(
  props.component.id,
  props.component.type,
  props.component.options?.topic,
  props.component.options?.queueSize || 10
)

// 监听组件启用状态
watch(() => props.component.enabled, (enabled) => {
  if (enabled && needsTopic.value) {
    subscribe()
  } else {
    unsubscribe()
  }
}, { immediate: true })

// 监听话题变化
watch(() => props.component.options?.topic, () => {
  if (props.component.enabled && needsTopic.value) {
    subscribe()
  }
})

// 监听队列大小变化
watch(() => props.component.options?.queueSize, () => {
  if (props.component.enabled && needsTopic.value) {
    subscribe()
  }
})

// 将最新消息存储到 store 中供 rviz-viewer 使用
// 注意：数据现在直接从 topicSubscriptionManager 获取，这里保留 updateComponentData 作为兼容层
watch(() => getLatestMessage(), (message) => {
  if (message && props.component.enabled) {
    // 将数据存储到 store 中供 rviz-viewer 使用（兼容旧代码）
    rvizStore.updateComponentData(props.component.id, message)
  } else if (!props.component.enabled) {
    // 组件禁用时清除数据
    rvizStore.clearComponentData(props.component.id)
  }
}, { immediate: true, deep: true })

// 获取 TF 组件的订阅状态（从 tfManager）
const tfSubscriptionStatus = computed(() => {
  if (props.component.type === 'tf') {
    return tfManager.getSubscriptionStatusRef()
  }
  return null
})

// 获取状态文本
const getStatusText = (): string => {
  // TF 组件使用 tfManager 的订阅状态
  if (props.component.type === 'tf') {
    const tfStatus = tfSubscriptionStatus.value
    if (!tfStatus) {
      return 'Not Subscribed'
    }
    if (!tfStatus.subscribed) {
      return 'Not Subscribed'
    }
    if (tfStatus.hasData) {
      return 'Ok'
    }
    return 'Waiting for data...'
  }
  
  // 其他组件使用 useTopicSubscription 的状态
  if (subscriptionStatus.error) {
    return 'Error'
  }
  if (!subscriptionStatus.subscribed) {
    return 'Not Subscribed'
  }
  if (subscriptionStatus.hasData) {
    return 'Ok'
  }
  return 'Waiting for data...'
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

const getComponentIcon = (type: string) => {
  const icons: Record<string, any> = {
    grid: Grid,
    axes: Position,
    camera: Camera,
    map: Files,
    path: Connection,
    marker: Location,
    image: Picture,
    laserscan: DataLine,
    pointcloud2: Monitor,
    tf: Share,
    robotmodel: Box
  }
  return icons[type] || Monitor
}

const getConfigComponent = (type: string) => {
  const components: Record<string, any> = {
    grid: GridConfig,
    axes: AxesConfig,
    camera: CameraConfig,
    map: MapConfig,
    path: PathConfig,
    marker: MarkerConfig,
    image: ImageConfig,
    laserscan: LaserScanConfig,
    pointcloud2: PointCloud2Config,
    tf: TFConfig,
    robotmodel: RobotModelConfig
  }
  return components[type] || 'div'
}

const toggleSubItem = (itemId: string) => {
  expandedSubItems[itemId] = !expandedSubItems[itemId]
}

const handleEnabledChange = (value: boolean) => {
  rvizStore.updateComponent(props.component.id, { enabled: value })
}

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
}>()
</script>

<style scoped>
.display-component-item {
  border-bottom: 1px solid #ebeef5;
  user-select: none;
}

.display-component-item.active {
  background: #ecf5ff;
}

.display-item-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 13px;
  color: #303133;
  gap: 6px;
}

.display-item-header:hover {
  background: #f5f7fa;
}

.item-icon {
  font-size: 16px;
  color: #606266;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-weight: 500;
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

.display-item-content {
  padding-left: 24px;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
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

.sub-item-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.success-icon {
  color: #67c23a;
}

.sub-item-name {
  flex: 1;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}

.warning-icon {
  color: #e6a23c;
}

.error-icon {
  color: #f56c6c;
}

.status-detail {
  padding: 8px;
  font-size: 11px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  color: #606266;
}

.status-label {
  font-weight: 500;
}

.status-value {
  color: #909399;
}

.error-text {
  color: #f56c6c;
}
</style>