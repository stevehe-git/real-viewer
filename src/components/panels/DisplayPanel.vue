<template>
  <div class="display-panel-container">
    <div class="display-panel-header">
      <span class="panel-title">Displays</span>
    </div>

    <div class="display-list-container">
      <div class="display-list">
        <!-- Global Options -->
        <div class="display-item">
          <div class="display-item-header">
            <el-icon class="item-icon">
              <Setting />
            </el-icon>
            <span class="item-name">Global Options</span>
            <el-icon 
              class="expand-icon" 
              :class="{ expanded: expandedItems['global-options'] }"
              @click.stop="toggleItem('global-options')"
            >
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['global-options']" class="display-item-content">
            <div class="config-row">
              <span class="config-label">Fixed Frame</span>
              <el-select
                v-model="globalOptions.fixedFrame"
                size="small"
                class="config-value"
                @change="updateGlobalOptions"
                filterable
                placeholder="Select frame"
              >
                <el-option
                  v-for="frame in availableFrames"
                  :key="frame"
                  :label="frame"
                  :value="frame"
                />
              </el-select>
            </div>
            <div class="config-row">
              <span class="config-label">Background Color</span>
              <div class="config-value color-config">
                <el-color-picker
                  v-model="globalOptions.backgroundColor"
                  size="small"
                  @change="updateGlobalOptions"
                />
                <span class="color-text">{{ formatColor(globalOptions.backgroundColor) }}</span>
              </div>
            </div>
            <div class="config-row">
              <span class="config-label">Frame Rate</span>
              <el-input-number
                v-model="globalOptions.frameRate"
                size="small"
                :min="1"
                :max="120"
                class="config-value"
                @change="updateGlobalOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Default Light</span>
              <el-checkbox
                v-model="globalOptions.defaultLight"
                class="config-value"
                @change="updateGlobalOptions"
              />
            </div>
          </div>
        </div>

        <!-- Global Status -->
        <div class="display-item">
          <div class="display-item-header">
            <el-icon class="item-icon warning-icon">
              <Warning />
            </el-icon>
            <span class="item-name">Global Status</span>
            <el-icon 
              class="expand-icon" 
              :class="{ expanded: expandedItems['global-status'] }"
              @click.stop="toggleItem('global-status')"
            >
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['global-status']" class="display-item-content">
            <div class="config-row">
              <span class="config-label">
                <el-icon class="warning-icon-small">
                  <Warning />
                </el-icon>
                Fixed Frame
              </span>
              <span class="config-value status-text warning-text">No TF data</span>
            </div>
          </div>
        </div>

        <!-- 动态显示组件列表 -->
        <DisplayComponent
          v-for="component in displayComponents"
          :key="component.id"
          :component="component"
          :selected="selectedItem === component.id"
          @select="selectItem(component.id)"
          @toggle="handleToggleComponent"
          @update="updateComponent"
          @remove="removeComponent"
        />
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="display-actions">
      <div class="actions-title">Global Options</div>
      <div class="action-buttons">
        <el-button size="small" @click="showTypeSelector = true">Add</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="duplicateDisplay">Duplicate</el-button>
        <el-button size="small" :disabled="!selectedItem" type="danger" @click="removeDisplay">Remove</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="renameDisplay">Rename</el-button>
      </div>
    </div>

    <!-- 显示类型选择器 -->
    <DisplayTypeSelector
      v-model="showTypeSelector"
      @select="handleAddComponent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import {
  Setting,
  Warning,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useRvizStore } from '@/stores/rviz'
import DisplayComponent from './DisplayComponent.vue'
import DisplayTypeSelector from './DisplayTypeSelector.vue'
import { tfManager } from '@/services/tfManager'

// 使用RViz store
const rvizStore = useRvizStore()

// 展开状态
const expandedItems = reactive<Record<string, boolean>>({
  'global-options': true,
  'global-status': true
})

// 显示类型选择器
const showTypeSelector = ref(false)

// 计算属性
const selectedItem = computed(() => rvizStore.selectedItem)
const displayComponents = computed(() => rvizStore.displayComponents)
const globalOptions = computed(() => rvizStore.globalOptions)

// 获取可用的坐标系列表（响应式）
const availableFrames = computed(() => {
  const frames = tfManager.getFramesRef().value
  return frames.length > 0 ? frames : ['map', 'odom', 'base_link', 'base_footprint']
})

// 方法
const toggleItem = (itemId: string) => {
  expandedItems[itemId] = !expandedItems[itemId]
}

const handleToggleComponent = (componentId: string) => {
  const component = rvizStore.displayComponents.find((c) => c.id === componentId)
  if (component) {
    rvizStore.updateComponent(componentId, { expanded: !component.expanded })
  }
}

const selectItem = (itemId: string) => {
  rvizStore.selectComponent(itemId)
}

const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
}

const updateGlobalOptions = () => {
  rvizStore.updateGlobalOptions({ ...rvizStore.globalOptions })
}

// 处理添加组件
const handleAddComponent = (type: any) => {
  rvizStore.addComponent(type.id, type.name)
}

// 更新组件配置
const updateComponent = (componentId: string, updates: Record<string, any>) => {
  if (updates.options) {
    rvizStore.updateComponentOptions(componentId, updates.options)
  } else {
    rvizStore.updateComponent(componentId, updates)
  }
}

// 删除组件
const removeComponent = (componentId: string) => {
  rvizStore.removeComponent(componentId)
}

const duplicateDisplay = () => {
  rvizStore.duplicateComponent(rvizStore.selectedItem)
}

const removeDisplay = () => {
  if (!rvizStore.selectedItem) return
  const component = rvizStore.displayComponents.find((c) => c.id === rvizStore.selectedItem)
  if (component) {
    ElMessageBox.confirm(
      `Are you sure you want to remove this display?`,
      'Remove Display',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    ).then(() => {
      removeComponent(rvizStore.selectedItem)
    }).catch(() => {
      // User cancelled
    })
  }
}

const renameDisplay = () => {
  if (!rvizStore.selectedItem) return
  const component = rvizStore.displayComponents.find((c) => c.id === rvizStore.selectedItem)
  if (!component) return

  ElMessageBox.prompt('Enter new name:', 'Rename Display', {
    confirmButtonText: 'Rename',
    cancelButtonText: 'Cancel',
    inputValue: component.name,
    inputPattern: /.+/,
    inputErrorMessage: 'Display name cannot be empty'
  }).then(({ value }) => {
    if (value) {
      rvizStore.renameComponent(component.id, value)
    }
  }).catch(() => {
    // User cancelled
  })
}

onMounted(() => {
  // 初始化store（如果还没有初始化）
  rvizStore.init()
})

// 不再需要emit，因为所有状态都通过Pinia管理
const emit = defineEmits<{
  // 保留空的emit定义，因为可能还有其他地方使用
}>()
</script>

<style scoped>
.display-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.display-panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid #dcdfe6;
  background: #f5f7fa;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.panel-title {
  user-select: none;
}

.display-list-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.display-list {
  padding: 4px 0;
}

.display-item {
  border-bottom: 1px solid #ebeef5;
  user-select: none;
}

.display-item.active {
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

.warning-icon {
  color: #e6a23c;
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
  cursor: pointer;
  padding: 2px;
}

.expand-icon:hover {
  color: #409eff;
  background: #ecf5ff;
  border-radius: 2px;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.display-item-content {
  padding-left: 24px;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.warning-icon-small {
  font-size: 14px;
  color: #e6a23c;
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

.status-text {
  font-size: 12px;
  color: #606266;
}

.warning-text {
  color: #e6a23c;
}

.display-actions {
  border-top: 2px solid #dcdfe6;
  padding: 12px;
  background: #f5f7fa;
}

.actions-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  margin-bottom: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons .el-button {
  flex: 1;
}

/* 滚动条样式 */
.display-list-container::-webkit-scrollbar {
  width: 8px;
}

.display-list-container::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.display-list-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.display-list-container::-webkit-scrollbar-thumb:hover {
  background: #a0a4ac;
}
</style>