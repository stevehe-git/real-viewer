<template>
  <div class="header" :class="{ 'sidebar-collapsed': props.sidebarCollapsed }">
    <div class="header-left">
      <button class="menu-toggle" @click="$emit('toggleSidebar')">
        <svg
          :class="{ 'menu-icon': true, 'collapsed': props.sidebarCollapsed }"
          width="20"
          height="16"
          viewBox="0 0 20 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- 上横线 -->
          <rect x="2" y="2" width="16" height="2" rx="1" fill="currentColor"/>
          <!-- 中横线 - 根据状态变化长度 -->
          <rect
            :x="props.sidebarCollapsed ? '4' : '2'"
            y="7"
            :width="props.sidebarCollapsed ? '12' : '16'"
            height="2"
            rx="1"
            fill="currentColor"
            :class="{ 'middle-line': true }"
          />
          <!-- 下横线 -->
          <rect x="2" y="12" width="16" height="2" rx="1" fill="currentColor"/>
        </svg>
      </button>
    </div>
    <div class="header-right">
      <div class="language-selector">
        <el-icon class="globe-icon">
          <Setting />
        </el-icon>
        <span>简体中文</span>
      </div>
      <div class="user-profile">
        <div class="avatar">S</div>
        <span class="username">supermowingadmin</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

interface Props {
  sidebarCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sidebarCollapsed: false
})

defineEmits<{
  toggleSidebar: []
}>()
</script>

<style scoped>
.header {
  height: 60px;
  background-color: #ecf0f1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 240px;
  right: 0;
  z-index: 100;
  transition: left 0.3s ease;
}

.header.sidebar-collapsed {
  left: 60px;
}

.header-left {
  display: flex;
  align-items: center;
}

.menu-toggle {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 5px 10px;
  color: #2c3e50;
  transition: background-color 0.3s;
  border-radius: 4px;
}

.menu-toggle:hover {
  background-color: #d5dbdb;
}

.menu-icon {
  transition: all 0.3s ease;
}

.menu-icon.collapsed {
  transform: rotate(180deg);
}

.middle-line {
  transition: all 0.3s ease;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
  color: #2c3e50;
  font-size: 14px;
}

.language-selector:hover {
  background-color: #d5dbdb;
}

.globe-icon {
  font-size: 16px;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-profile:hover {
  background-color: #d5dbdb;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #3498db;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.username {
  color: #2c3e50;
  font-size: 14px;
}
</style>
