<template>
  <div
    class="sidebar"
    :class="{ collapsed: props.collapsed }"
    @mouseenter="handleSidebarEnter"
    @mouseleave="handleSidebarLeave"
  >
    <div class="sidebar-header">
      <div class="sidebar-title">
        <el-icon class="title-icon">
          <Share />
        </el-icon>
        <span v-if="!props.collapsed" class="title-text">RosViewer</span>
      </div>
    </div>
    <div class="sidebar-menu">
      <div
        v-for="item in menuItems"
        :key="item.key"
        class="menu-item"
      >
        <!-- 顶级菜单项（没有children） -->
        <router-link
          v-if="item.path"
          :to="item.path"
          class="menu-parent menu-link"
          :class="{ active: $route.path === item.path, collapsed: props.collapsed }"
          @mouseenter="handleMenuHover(item.key, $event)"
        >
          <el-icon class="menu-icon">
            <component :is="item.icon" />
          </el-icon>
          <span v-if="!props.collapsed" class="menu-title">{{ item.title }}</span>
        </router-link>

        <!-- 可展开的菜单项（有children） -->
        <div
          v-else
          class="menu-parent"
          :class="{ active: isActiveParent(item), collapsed: props.collapsed }"
          @click="toggleMenu(item.key)"
          @mouseenter="handleMenuHover(item.key, $event)"
        >
          <el-icon class="menu-icon">
            <component :is="item.icon" />
          </el-icon>
          <span v-if="!props.collapsed" class="menu-title">{{ item.title }}</span>
          <span v-if="!props.collapsed" class="menu-arrow" :class="{ expanded: expandedMenus.includes(item.key) }">
            ▼
          </span>
        </div>
        <transition name="slide">
          <div
            v-show="expandedMenus.includes(item.key) && !props.collapsed"
            class="menu-children"
          >
            <router-link
              v-for="child in item.children"
              :key="child.path"
              :to="child.path"
              class="menu-child"
              :class="{ active: $route.path === child.path }"
            >
              {{ child.title }}
            </router-link>
          </div>
        </transition>
      </div>
    </div>

    <!-- 收起状态下的hover子菜单模态框 -->
    <HoverSubmenuModal
      :visible="props.collapsed && isHoveringSidebar && !!hoveredMenuItem"
      :menu-item="hoveredMenuItem || null"
      :trigger-rect="triggerRect"
      @mouseenter="handlePanelEnter"
      @mouseleave="handlePanelLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Location,
  Setting,
  Histogram,
  User,
  Share,
  DocumentAdd,
  Aim,
  MapLocation
} from '@element-plus/icons-vue'
import HoverSubmenuModal from './HoverSubmenuModal.vue'

interface MenuChild {
  path: string
  title: string
}

interface MenuItem {
  key: string
  title: string
  icon: any // Icon component
  children?: MenuChild[]
  path?: string
}

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})

const route = useRoute()
const expandedMenus = ref<string[]>([])
const hoveredMenu = ref<string | null>(null)
const isHoveringSidebar = ref(false)
const triggerRect = ref<DOMRect | null>(null)

const menuItems: MenuItem[] = [
  {
    key: 'navigation',
    title: '导航',
    icon: Location,
    children: [
      { path: '/navigation/overview', title: '导航概览' },
      { path: '/navigation/route-planning', title: '路径规划' }
    ]
  },
  {
    key: 'waypoints',
    title: '航点管理',
    icon: Aim,
    path: '/waypoints'
  },
  {
    key: 'map-management',
    title: '地图管理',
    icon: MapLocation,
    path: '/map-management'
  },
  {
    key: 'task-management',
    title: '任务管理',
    icon: DocumentAdd,
    children: [
      { path: '/task-management/task-list', title: '任务列表' },
      { path: '/task-management/task-create', title: '创建任务' }
    ]
  },
  {
    key: 'control',
    title: '控制',
    icon: Setting,
    children: [
      { path: '/control/device-control', title: '设备控制' },
      { path: '/control/remote-control', title: '远程控制' },
      { path: '/control/command-history', title: '指令历史' },
      { path: '/control/status-monitoring', title: '状态监控' }
    ]
  },
  {
    key: 'analysis',
    title: '分析',
    icon: Histogram,
    children: [
      { path: '/analysis/data-analysis', title: '数据分析' },
      { path: '/analysis/performance-report', title: '性能报告' },
      { path: '/analysis/statistics', title: '统计信息' },
      { path: '/analysis/trend-analysis', title: '趋势分析' }
    ]
  },
  {
    key: 'user-management',
    title: '用户管理',
    icon: User,
    children: [
      { path: '/user-management/user-list', title: '用户列表' },
      { path: '/user-management/user-add', title: '添加用户' }
    ]
  }
]

const isActiveParent = (item: MenuItem): boolean => {
  if (item.path) {
    // 顶级菜单项（航点管理、地图管理、任务管理等）
    return route.path === item.path
  } else if (item.children) {
    // 有子项的菜单（导航、控制、分析、用户管理）
    if (props.collapsed) {
      // 收起状态：显示父级路由激活状态
      return item.children.some(child => route.path === child.path)
    } else {
      // 展开状态：不显示父级背景色，只有次级路由显示
      return false
    }
  }
  return false
}

const hoveredMenuItem = computed((): MenuItem | null => {
  if (!hoveredMenu.value) return null
  return menuItems.find(item => item.key === hoveredMenu.value) || null
})

const toggleMenu = (key: string) => {
  const index = expandedMenus.value.indexOf(key)
  if (index > -1) {
    expandedMenus.value.splice(index, 1)
  } else {
    expandedMenus.value.push(key)
  }
}

const handleMenuHover = (key: string, event?: MouseEvent) => {
  hoveredMenu.value = key
  if (event && event.target) {
    const target = event.target as HTMLElement
    const parentElement = target.closest('.menu-parent') as HTMLElement
    if (parentElement) {
      triggerRect.value = parentElement.getBoundingClientRect()
    }
  }
}

const handleSidebarEnter = () => {
  isHoveringSidebar.value = true
}

const handleSidebarLeave = () => {
  isHoveringSidebar.value = false
  hoveredMenu.value = null
}

const handlePanelEnter = () => {
  isHoveringSidebar.value = true
}

const handlePanelLeave = () => {
  isHoveringSidebar.value = false
  hoveredMenu.value = null
}

onMounted(() => {
  // 根据当前路由自动展开对应的父菜单
  menuItems.forEach(item => {
    if (isActiveParent(item)) {
      if (!expandedMenus.value.includes(item.key)) {
        expandedMenus.value.push(item.key)
      }
    }
  })
})
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background-color: #2c3e50;
  color: #ecf0f1;
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  padding: 20px 20px 10px 20px;
  border-bottom: 1px solid #34495e;
  margin-bottom: 10px;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ecf0f1;
  font-weight: 600;
  font-size: 18px;
  transition: all 0.3s ease;
}

.title-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-text-collapsed {
  font-size: 14px;
  font-weight: bold;
}

.sidebar-menu {
  padding: 0 0 20px 0;
}

.menu-item {
  margin-bottom: 4px;
}

.menu-parent {
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.3s;
  user-select: none;
}

.menu-parent:hover {
  background-color: #34495e;
}

.menu-parent.active,
.menu-link.active {
  background-color: #3498db;
  color: white;
}

.menu-icon {
  margin-right: 10px;
  font-size: 18px;
}

.menu-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.menu-arrow {
  font-size: 10px;
  transition: transform 0.3s;
  transform: rotate(-90deg);
}

.menu-arrow.expanded {
  transform: rotate(0deg);
}

.menu-children {
  background-color: #1a252f;
  overflow: hidden;
}

.menu-child {
  display: block;
  padding: 10px 20px 10px 50px;
  color: #bdc3c7;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.3s;
}

.menu-child:hover {
  background-color: #2c3e50;
  color: #ecf0f1;
}

.menu-child.active {
  background-color: #3498db;
  color: white;
  font-weight: 500;
}

.slide-enter-active,
.slide-leave-active {
  transition: max-height 0.3s ease;
  max-height: 500px;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  overflow: hidden;
}

</style>
