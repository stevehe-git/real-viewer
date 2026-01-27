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
            <!-- Status子项 -->
            <div class="display-sub-item">
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
          v-if="selectedComponentId"
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'
import { useDisplayTopicSubscription } from '@/composables/communication/useDisplayTopicSubscription'
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
  Files
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
import { tfManager } from '@/services/tfManager'

const rvizStore = useRvizStore()

// 使用全局话题订阅管理器（自动订阅所有显示配置中的 topic）
useDisplayTopicSubscription()

// 显示组件列表
const displayComponents = computed(() => rvizStore.displayComponents)

// 选中的组件ID
const selectedComponentId = ref<string | null>(null)

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
    robotmodel: Box
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
    robotmodel: RobotModelConfig
  }
  return components[type] || 'div'
}

// 获取订阅状态（从 topicSubscriptionManager 获取）
function getSubscriptionStatus(componentId: string) {
  const component = displayComponents.value.find(c => c.id === componentId)
  if (!component) return null
  
  const needsTopic = ['map', 'path', 'laserscan', 'pointcloud2', 'marker', 'image', 'camera'].includes(component.type)
  if (!needsTopic) return null
  
  // 检查是否有订阅
  const hasSubscription = topicSubscriptionManager.getLatestMessage(componentId) !== null
  const lastMessage = topicSubscriptionManager.getLatestMessage(componentId)
  
  return {
    subscribed: hasSubscription && !!component.options?.topic,
    hasData: !!lastMessage,
    messageCount: 0, // topicSubscriptionManager 不提供消息计数
    lastMessageTime: lastMessage ? Date.now() : null,
    error: null
  }
}

// 获取 TF 订阅状态
function getTFSubscriptionStatus(componentId: string) {
  const component = displayComponents.value.find(c => c.id === componentId)
  if (component?.type === 'tf') {
    return tfManager.getSubscriptionStatusRef().value
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

  // 生成唯一ID和名称
  const componentCount = rvizStore.displayComponents.filter(c => c.type === displayType.id).length
  const componentName = componentCount > 0 
    ? `${displayType.name} ${componentCount + 1}`
    : displayType.name

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

  const componentCount = rvizStore.displayComponents.filter(c => c.type === component.type).length
  const newName = `${component.name} (副本 ${componentCount})`

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
