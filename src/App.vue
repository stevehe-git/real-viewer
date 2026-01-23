<template>
  <div class="app-container">
    <Sidebar :collapsed="sidebarCollapsed" />
    <div class="main-content" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <Header :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="toggleSidebar" />
      <div class="content-wrapper">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const sidebarCollapsed = ref(false)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
</script>

<style scoped>
.app-container {
  display: flex;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.main-content {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
}

.main-content.sidebar-collapsed {
  margin-left: 60px;
}

.content-wrapper {
  margin-top: 60px;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-height: calc(100vh - 60px);
}
</style>
