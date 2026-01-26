<template>
  <BasePanel title="显示配置" :icon="View">
    <div class="display-panel">
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

      <!-- 显示组件列表 -->
      <div class="display-list" v-if="displayComponents.length > 0">
        <DisplayComponent
          v-for="component in displayComponents"
          :key="component.id"
          :component="{
            id: component.id,
            type: component.type,
            name: component.name,
            enabled: component.enabled,
            expanded: expandedComponents.has(component.id),
            options: component.options || {}
          }"
          :selected="selectedComponentId === component.id"
          @select="handleSelect"
          @toggle="handleToggle"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="displayComponents.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Document /></el-icon>
        <p class="empty-text">暂无显示组件</p>
        <p class="empty-hint">点击"添加显示"按钮添加新的显示组件</p>
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
import { ref, computed, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePanel from '../../BasePanel.vue'
import DisplayTypeSelector from './DisplayTypeSelector.vue'
import { View, Plus, Document, CopyDocument, Edit, Delete } from '@element-plus/icons-vue'

const rvizStore = useRvizStore()

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
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
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
</style>
