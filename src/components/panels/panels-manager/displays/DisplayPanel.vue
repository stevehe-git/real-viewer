<template>
  <BasePanel title="显示配置" :icon="View">
    <div class="display-panel">
      <!-- 显示组件列表 -->
      <div class="display-list" v-if="displayComponents.length > 0">
        <div
          v-for="component in displayComponents"
          :key="component.id"
          class="display-component-item"
          :class="{ active: selectedComponentId === component.id }"
          @click="handleSelect(component.id)"
        >
          <div class="display-item-header">
            <el-icon class="item-icon">
              <component :is="getComponentIcon(component.type)" />
            </el-icon>
            <el-checkbox
              :model-value="component.enabled"
              @change="(value: boolean) => handleEnabledChange(component.id, value)"
              @click.stop
            />
            <span class="item-name">{{ component.name }}</span>
            <el-icon 
              class="expand-icon" 
              :class="{ expanded: expandedComponents.has(component.id) }"
              @click.stop="handleToggle(component.id)"
            >
              <ArrowDown />
            </el-icon>
          </div>

          <div v-show="expandedComponents.has(component.id)" class="display-item-content">
            <!-- Status子项（global-options 类型不显示） -->
            <div v-if="component.type !== 'global-options'" class="display-sub-item">
              <div class="sub-item-header" @click.stop="toggleSubItem(component.id, 'status')">
                <el-icon 
                  class="sub-item-icon" 
                  :class="{
                    'success-icon': (component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.subscribed && getTFSubscriptionStatus(component.id)?.hasData) : (getSubscriptionStatus(component.id)?.subscribed && getSubscriptionStatus(component.id)?.hasData)),
                    'warning-icon': (component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.subscribed && !getTFSubscriptionStatus(component.id)?.hasData) : (getSubscriptionStatus(component.id)?.subscribed && !getSubscriptionStatus(component.id)?.hasData)),
                    'error-icon': (component.type === 'tf' ? false : getSubscriptionStatus(component.id)?.error)
                  }"
                >
                  <CircleCheck v-if="(component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.subscribed && getTFSubscriptionStatus(component.id)?.hasData) : (getSubscriptionStatus(component.id)?.subscribed && getSubscriptionStatus(component.id)?.hasData))" />
                  <Warning v-else-if="(component.type === 'tf' ? false : getSubscriptionStatus(component.id)?.error)" />
                  <CircleCheck v-else />
                </el-icon>
                <span class="sub-item-name">
                  Status: {{ getStatusText(component) }}
                </span>
                <el-icon class="expand-icon" :class="{ expanded: expandedSubItems[component.id]?.status }">
                  <ArrowDown />
                </el-icon>
              </div>
              <div v-show="expandedSubItems[component.id]?.status" class="sub-item-content">
                <div class="status-detail">
                  <div class="status-row">
                    <span class="status-label">Subscribed:</span>
                    <span class="status-value">{{ (component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.subscribed ?? false) : (getSubscriptionStatus(component.id)?.subscribed ?? false)) ? 'Yes' : 'No' }}</span>
                  </div>
                  <div class="status-row" v-if="(component.type === 'tf' ? getTFSubscriptionStatus(component.id)?.subscribed : getSubscriptionStatus(component.id)?.subscribed)">
                    <span class="status-label">Messages:</span>
                    <span class="status-value">{{ component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.messageCount ?? 0) : (getSubscriptionStatus(component.id)?.messageCount ?? 0) }}</span>
                  </div>
                  <div class="status-row" v-if="(component.type === 'tf' ? getTFSubscriptionStatus(component.id)?.lastMessageTime : getSubscriptionStatus(component.id)?.lastMessageTime)">
                    <span class="status-label">Last Message:</span>
                    <span class="status-value">{{ formatTime((component.type === 'tf' ? (getTFSubscriptionStatus(component.id)?.lastMessageTime ?? 0) : (getSubscriptionStatus(component.id)?.lastMessageTime ?? 0))!) }}</span>
                  </div>
                  <div class="status-row" v-if="(component.type === 'tf' ? false : getSubscriptionStatus(component.id)?.error)">
                    <span class="status-label error-text">Error:</span>
                    <span class="status-value error-text">{{ getSubscriptionStatus(component.id)?.error }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 根据组件类型渲染不同的配置项 -->
            <component
              :is="getConfigComponent(component.type)"
              :component-id="component.id"
              :component-type="component.type"
              :options="component.options || {}"
            />
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="displayComponents.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Document /></el-icon>
        <p class="empty-text">暂无显示组件</p>
        <p class="empty-hint">点击"添加显示"按钮添加新的显示组件</p>
      </div>

      <!-- 工具栏 -->
      <div class="display-toolbar">
        <el-button
          size="small"
          type="primary"
          @click="showAddDialog = true"
        >
          <el-icon><Plus /></el-icon>
          添加显示
        </el-button>
        <el-button
          v-if="selectedComponentId"
          size="small"
          @click="handleDuplicate"
        >
          <el-icon><CopyDocument /></el-icon>
          复制
        </el-button>
        <el-button
          v-if="selectedComponentId"
          size="small"
          @click="handleRename"
        >
          <el-icon><Edit /></el-icon>
          重命名
        </el-button>
        <el-button
          v-if="selectedComponentId && selectedComponent?.type !== 'global-options'"
          size="small"
          type="danger"
          @click="handleRemove"
        >
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </div>

    <!-- 添加显示组件对话框 -->
    <DisplayTypeSelector
      v-model="showAddDialog"
      @select="handleAddDisplay"
    />

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="showRenameDialog"
      title="重命名显示组件"
      width="400px"
    >
      <el-input
        v-model="renameValue"
        placeholder="请输入新名称"
        @keyup.enter="confirmRename"
      />
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted, onUnmounted } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { useDisplayStore } from '@/stores/display'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTopicSubscription } from '@/composables/communication/useTopicSubscription'
import { topicSubscriptionManager, type SubscriptionStatus } from '@/services/topicSubscriptionManager'
import BasePanel from '../../BasePanel.vue'
import DisplayTypeSelector from './DisplayTypeSelector.vue'
import {
  View,
  Plus,
  Document,
  CopyDocument,
  Edit,
  Delete,
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
  Box,
  Files,
  Setting
} from '@element-plus/icons-vue'
import GridConfig from './grid/GridConfig.vue'
import AxesConfig from './axes/AxesConfig.vue'
import CameraConfig from './camera/CameraConfig.vue'
import MapConfig from './map/MapConfig.vue'
import PathConfig from './path/PathConfig.vue'
import MarkerConfig from './mark/MarkerConfig.vue'
import ImageConfig from './image/ImageConfig.vue'
import LaserScanConfig from './laser-scan/LaserScanConfig.vue'
import PointCloud2Config from './point-cloud2/PointCloud2Config.vue'
import TFConfig from './tf/TFConfig.vue'
import RobotModelConfig from './robot-model/RobotModelConfig.vue'
import GlobalOptionsConfig from './global-options/GlobalOptionsConfig.vue'
import { tfManager } from '@/services/tfManager'

const rvizStore = useRvizStore()

// 显示组件列表
const displayComponents = computed(() => rvizStore.displayComponents)

// 需要订阅话题的组件类型
const TOPIC_COMPONENT_TYPES = ['map', 'path', 'laserscan', 'pointcloud2', 'marker', 'image', 'camera']

// 为每个组件维护 useTopicSubscription 实例
// 类型：Map<componentId, useTopicSubscription返回值>
const subscriptionInstances = reactive(new Map()) as Map<string, ReturnType<typeof useTopicSubscription>>

// 初始化或更新组件的订阅实例
function setupComponentSubscription(component: any) {
  const needsTopic = TOPIC_COMPONENT_TYPES.includes(component.type)
  if (!needsTopic) {
    return
  }

  // 如果已存在实例，先清理
  if (subscriptionInstances.has(component.id)) {
    const instance = subscriptionInstances.get(component.id)
    instance?.cleanup()
    subscriptionInstances.delete(component.id)
  }

  // 创建新的订阅实例（新实现会自动监听话题和连接状态）
  const instance = useTopicSubscription(
    component.id,
    component.type,
    component.options?.topic,
    component.options?.queueSize || 10
  )

  subscriptionInstances.set(component.id, instance)

  // 如果组件已启用且有话题，自动订阅
  if (component.enabled && component.options?.topic && rvizStore.communicationState.isConnected) {
    instance.subscribe()
  }
}

// 监听组件列表变化，为每个需要订阅的组件创建订阅实例
// 关键修复：只在组件真正新增或删除时处理，不在配置改变时触发
watch(
  () => displayComponents.value.map(c => c.id), // 只监听组件ID列表，不监听配置
  (newIds, oldIds) => {
    if (!oldIds) {
      // 初始化：为所有组件创建订阅实例
      displayComponents.value.forEach(component => {
        if (TOPIC_COMPONENT_TYPES.includes(component.type)) {
          setupComponentSubscription(component)
        }
      })
      return
    }

    const newIdsSet = new Set(newIds)
    const oldIdsSet = new Set(oldIds)

    // 处理新增的组件（只在真正新增时创建订阅实例）
    newIds.forEach(componentId => {
      if (!oldIdsSet.has(componentId)) {
        const component = displayComponents.value.find(c => c.id === componentId)
        if (component && TOPIC_COMPONENT_TYPES.includes(component.type)) {
          setupComponentSubscription(component)
        }
      }
    })

    // 处理删除的组件
    oldIds.forEach(componentId => {
      if (!newIdsSet.has(componentId) && subscriptionInstances.has(componentId)) {
        const instance = subscriptionInstances.get(componentId)
        instance?.cleanup()
        subscriptionInstances.delete(componentId)
      }
    })
  },
  { immediate: true }
)

// 监听每个组件的话题、队列大小和启用状态变化
// 参照 rviz/webviz：只有 topic 或 queueSize 改变时才重新订阅
// 其他配置（alpha、colorScheme等）改变时，只更新 SceneManager 配置，不重新订阅
watch(
  () => displayComponents.value.map(c => ({
    id: c.id,
    type: c.type,
    enabled: c.enabled,
    topic: c.options?.topic,
    queueSize: c.options?.queueSize || 10
  })),
  (newComponents, oldComponents) => {
    if (!oldComponents) return

    const oldMap = new Map(oldComponents.map(c => [c.id, c]))

    newComponents.forEach(newComponent => {
      if (!TOPIC_COMPONENT_TYPES.includes(newComponent.type)) {
        return
      }

      const oldComponent = oldMap.get(newComponent.id)
      if (!oldComponent) {
        return
      }

      const instance = subscriptionInstances.get(newComponent.id)
      if (!instance) {
        return
      }

      // 检查话题或队列大小是否变化
      const topicChanged = oldComponent.topic !== newComponent.topic
      const queueSizeChanged = oldComponent.queueSize !== newComponent.queueSize
      const enabledChanged = oldComponent.enabled !== newComponent.enabled

      // 参照 rviz/webviz：只有 topic 或 queueSize 改变时才重新订阅
      // 注意：ROSLIB.Topic 的 queue_size 在创建时设置，无法动态修改，所以 queueSize 改变时也需要重新订阅
      if (topicChanged || queueSizeChanged) {
        // 话题或队列大小变化，重新创建订阅实例
        const fullComponent = displayComponents.value.find(c => c.id === newComponent.id)
        if (fullComponent) {
          setupComponentSubscription(fullComponent)
        }
      } else if (enabledChanged) {
        // 只有启用状态变化，不重新订阅，只更新订阅状态
        if (newComponent.enabled && newComponent.topic && rvizStore.communicationState.isConnected) {
          instance.subscribe()
        } else {
          instance.unsubscribe()
        }
      }
      // 其他配置（alpha、colorScheme、drawBehind等）改变时，不触发任何订阅相关逻辑
      // 这些配置的更新由 useDisplaySync 中的 watch 监听处理，只更新 SceneManager 配置
    })
  },
  { deep: true }
)

// 监听连接状态
watch(
  () => rvizStore.communicationState.isConnected,
  (isConnected) => {
    if (isConnected) {
      // 连接后延迟一小段时间再订阅，确保 ROS 连接完全建立
      setTimeout(() => {
        displayComponents.value.forEach(component => {
          if (TOPIC_COMPONENT_TYPES.includes(component.type) && component.enabled && component.options?.topic) {
            const instance = subscriptionInstances.get(component.id)
            if (instance) {
              instance.subscribe()
            } else {
              setupComponentSubscription(component)
            }
          }
        })
      }, 200)
    } else {
      // 断开连接时取消所有订阅
      subscriptionInstances.forEach(instance => {
        instance.unsubscribe()
      })
    }
  }
)

// 组件挂载时，确保 global-options 组件存在
onMounted(() => {
  // 确保 global-options 组件存在（通过调用 store 的 initialize 方法）
  const globalOptionsExists = displayComponents.value.some(
    c => c.type === 'global-options'
  )
  if (!globalOptionsExists) {
    // 直接调用 display store 的 initialize 方法
    const displayStore = useDisplayStore()
    displayStore.initialize()
  }
  
  // 如果已连接，立即订阅所有组件
  if (rvizStore.communicationState.isConnected) {
    displayComponents.value.forEach(component => {
      if (TOPIC_COMPONENT_TYPES.includes(component.type)) {
        setupComponentSubscription(component)
      }
    })
  }
})

// 组件卸载时，取消所有订阅
onUnmounted(() => {
  subscriptionInstances.forEach(instance => {
    instance.cleanup()
  })
  subscriptionInstances.clear()
})

// 选中的组件ID
const selectedComponentId = ref<string | null>(null)

// 选中的组件（计算属性）
const selectedComponent = computed(() => {
  if (!selectedComponentId.value) return null
  return rvizStore.displayComponents.find(c => c.id === selectedComponentId.value) || null
})

// 展开的组件ID集合
const expandedComponents = ref<Set<string>>(new Set())

// 添加对话框显示状态
const showAddDialog = ref(false)

// 重命名对话框
const showRenameDialog = ref(false)
const renameValue = ref('')

// 展开的子项（按组件ID组织）
const expandedSubItems = reactive<Record<string, Record<string, boolean>>>({})

// 初始化每个组件的展开子项
watch(displayComponents, (components) => {
  components.forEach(component => {
    if (!expandedSubItems[component.id]) {
      expandedSubItems[component.id] = { status: true }
    }
  })
}, { immediate: true, deep: true })

// 监听组件列表变化，保持展开状态
watch(displayComponents, (_newComponents, oldComponents) => {
  // 如果组件被删除，从展开集合中移除
  if (oldComponents) {
    const newIds = new Set(displayComponents.value.map(c => c.id))
    const removedIds = Array.from(expandedComponents.value).filter(id => !newIds.has(id))
    removedIds.forEach(id => expandedComponents.value.delete(id))
    
    // 如果选中的组件被删除，清除选中状态
    if (selectedComponentId.value && !newIds.has(selectedComponentId.value)) {
      selectedComponentId.value = null
    }
  }
}, { deep: true })

// 选择组件
function handleSelect(componentId: string) {
  selectedComponentId.value = componentId
}

// 切换组件展开/折叠
function handleToggle(componentId: string) {
  if (expandedComponents.value.has(componentId)) {
    expandedComponents.value.delete(componentId)
  } else {
    expandedComponents.value.add(componentId)
  }
}

// 切换子项展开/折叠
function toggleSubItem(componentId: string, itemId: string) {
  if (!expandedSubItems[componentId]) {
    expandedSubItems[componentId] = {}
  }
  expandedSubItems[componentId][itemId] = !expandedSubItems[componentId][itemId]
}

// 获取组件图标
function getComponentIcon(type: string) {
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
    robotmodel: Box,
    'global-options': Setting
  }
  return icons[type] || Monitor
}

// 获取配置组件
function getConfigComponent(type: string) {
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
    robotmodel: RobotModelConfig,
    'global-options': GlobalOptionsConfig
  }
  return components[type] || 'div'
}

// 获取订阅状态（直接从 topicSubscriptionManager 获取，确保响应式更新）
const statusUpdateTrigger = topicSubscriptionManager.getStatusUpdateTrigger()

// 使用 computed 确保响应式更新
// 直接从 topicSubscriptionManager 获取状态，而不是通过实例
const subscriptionStatuses = computed(() => {
  // 访问触发器以确保响应式追踪
  statusUpdateTrigger.value
  
  const statuses: Record<string, SubscriptionStatus | null> = {}
  // 遍历所有需要订阅的组件
  displayComponents.value.forEach(component => {
    if (TOPIC_COMPONENT_TYPES.includes(component.type)) {
      // 直接从 topicSubscriptionManager 获取最新状态
      const managerStatus = topicSubscriptionManager.getStatus(component.id)
      statuses[component.id] = managerStatus
    }
  })
  return statuses
})

function getSubscriptionStatus(componentId: string): SubscriptionStatus | null {
  // 访问 computed 以确保响应式追踪
  const status = subscriptionStatuses.value[componentId]
  if (status) {
    return status
  }
  
  // 如果 computed 中没有，直接从 manager 获取（用于新创建的组件）
  // 访问触发器以确保响应式追踪
  statusUpdateTrigger.value
  return topicSubscriptionManager.getStatus(componentId)
}

// 获取 TF 订阅状态（响应式）
const tfSubscriptionStatusRef = computed(() => {
  // 访问 ref 以确保响应式追踪
  return tfManager.getSubscriptionStatusRef()
})

function getTFSubscriptionStatus(componentId: string) {
  const component = displayComponents.value.find(c => c.id === componentId)
  if (component?.type === 'tf') {
    // 访问 computed 以确保响应式追踪
    return tfSubscriptionStatusRef.value.value
  }
  return null
}

// 获取状态文本
function getStatusText(component: any): string {
  // TF 组件使用 tfManager 的订阅状态
  if (component.type === 'tf') {
    const tfStatus = getTFSubscriptionStatus(component.id)
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
  const status = getSubscriptionStatus(component.id)
  if (!status) {
    return 'Not Subscribed'
  }
  if (status.error) {
    return 'Error'
  }
  if (!status.subscribed) {
    return 'Not Subscribed'
  }
  if (status.hasData) {
    return 'Ok'
  }
  return 'Waiting for data...'
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 处理启用状态变化
function handleEnabledChange(componentId: string, value: boolean) {
  rvizStore.updateComponent(componentId, { enabled: value })
}

// 添加显示组件
function handleAddDisplay(displayType: any) {
  if (!displayType) return

  // 所有相同类型的 panel 使用相同的标题，不添加序号
  const componentName = displayType.name

  const newComponent = {
    id: `display-${displayType.id}-${Date.now()}`,
    name: componentName,
    type: displayType.id,
    enabled: true,
    options: {}
  }

  rvizStore.addComponent(newComponent)
  showAddDialog.value = false
  
  // 自动展开新添加的组件
  expandedComponents.value.add(newComponent.id)
  selectedComponentId.value = newComponent.id
  
  ElMessage.success(`已添加 ${componentName}`)
}

// 复制组件
function handleDuplicate() {
  if (!selectedComponentId.value) return

  const component = rvizStore.displayComponents.find(c => c.id === selectedComponentId.value)
  if (!component) return

  // 所有相同类型的 panel 使用相同的标题，不添加序号
  const newName = component.name

  const duplicatedComponent = {
    id: `display-${component.type}-${Date.now()}`,
    name: newName,
    type: component.type,
    enabled: component.enabled,
    options: { ...component.options }
  }

  rvizStore.addComponent(duplicatedComponent)
  
  // 自动展开复制的组件
  expandedComponents.value.add(duplicatedComponent.id)
  selectedComponentId.value = duplicatedComponent.id
  
  ElMessage.success(`已复制 ${component.name}`)
}

// 重命名组件
function handleRename() {
  if (!selectedComponentId.value) return

  const component = rvizStore.displayComponents.find(c => c.id === selectedComponentId.value)
  if (!component) return

  renameValue.value = component.name
  showRenameDialog.value = true
}

// 确认重命名
function confirmRename() {
  if (!selectedComponentId.value || !renameValue.value.trim()) {
    ElMessage.warning('请输入有效的名称')
    return
  }

  rvizStore.updateComponent(selectedComponentId.value, { name: renameValue.value.trim() })
  showRenameDialog.value = false
  ElMessage.success('重命名成功')
}

// 删除组件
function handleRemove() {
  if (!selectedComponentId.value) return

  const component = rvizStore.displayComponents.find(c => c.id === selectedComponentId.value)
  if (!component) return

  // 不允许删除 global-options 组件
  if (component.type === 'global-options') {
    ElMessage.warning('Global Options 组件不能删除')
    return
  }

  ElMessageBox.confirm(
    `确定要删除显示组件 "${component.name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    rvizStore.removeComponent(selectedComponentId.value!)
    expandedComponents.value.delete(selectedComponentId.value!)
    selectedComponentId.value = null
    ElMessage.success('已删除')
  }).catch(() => {
    // 用户取消
  })
}

// 定义事件，用于与父组件通信
defineEmits<{
  'update:globalOptions': [options: any]
  'update:gridOptions': [options: any]
  'update:axesOptions': [options: any]
  'addDisplay': [name: string]
  'duplicateDisplay': [itemId: string]
  'removeDisplay': [itemId: string]
  'renameDisplay': [itemId: string, newName: string]
}>()
</script>

<style scoped>
.display-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

.display-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
  flex-shrink: 0;
}

.display-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #909399;
  flex: 1;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c0c4cc;
}

.empty-text {
  font-size: 14px;
  margin: 0 0 8px 0;
  color: #606266;
}

.empty-hint {
  font-size: 12px;
  margin: 0;
  color: #909399;
}

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
