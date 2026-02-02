<template>
  <el-card class="base-panel" :class="{ collapsed }">
    <template #header>
      <div class="panel-header">
        <div class="panel-title">
          <el-icon class="panel-icon" v-if="icon">
            <component :is="icon" />
          </el-icon>
          <span>{{ title }}</span>
        </div>
        <div class="panel-actions">
          <el-button
            v-if="collapsible"
            size="small"
            link
            @click="toggleCollapse"
            class="collapse-btn"
          >
            <el-icon>
              <ArrowDown v-if="!collapsed" />
              <ArrowRight v-else />
            </el-icon>
          </el-button>
          <el-button
            v-if="closable"
            size="small"
            link
            @click="$emit('close')"
            class="close-btn"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </template>

    <div v-show="!collapsed" class="panel-content">
      <slot></slot>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowRight, Close } from '@element-plus/icons-vue'

interface Props {
  title: string
  icon?: any
  collapsible?: boolean
  closable?: boolean
  defaultCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
  closable: false,
  defaultCollapsed: false
})

const collapsed = ref(props.defaultCollapsed)

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

defineEmits<{
  close: []
}>()
</script>

<style scoped>
.base-panel {
  margin-bottom: 0px;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0px 0px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.panel-icon {
  font-size: 16px;
  color: #409eff;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.collapse-btn,
.close-btn {
  padding: 4px;
  color: #909399;
}

.collapse-btn:hover,
.close-btn:hover {
  color: #303133;
}

.panel-content {
  padding: 16px;
}
</style>