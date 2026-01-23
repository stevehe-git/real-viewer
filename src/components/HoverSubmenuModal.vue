<template>
  <div
    v-if="visible && menuItem"
    ref="modalRef"
    class="hover-submenu-modal"
    :style="modalStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="modal-children">
      <router-link
        v-for="child in menuItem.children"
        :key="child.path"
        :to="child.path"
        class="modal-child"
        :class="{ active: $route.path === child.path }"
      >
        {{ child.title }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

interface MenuChild {
  path: string
  title: string
}

interface MenuItem {
  key: string
  title: string
  icon: any
  children?: MenuChild[]
  path?: string
}

interface Props {
  visible: boolean
  menuItem: MenuItem | null
  triggerRect?: DOMRect | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  mouseenter: []
  mouseleave: []
}>()

const route = useRoute()
const modalRef = ref<HTMLElement>()

const modalStyle = computed(() => {
  if (!props.triggerRect) return {}

  const sidebarWidth = 60 // 收起状态下的sidebar宽度
  const modalWidth = 200
  const modalHeight = props.menuItem ? (props.menuItem.children.length * 48) : 0 // 只有子项高度

  // 计算modal位置，使其在触发元素右侧居中显示
  const triggerCenterY = props.triggerRect.top + (props.triggerRect.height / 2)
  const headerHeight = 60 // header高度
  const modalTop = Math.max(headerHeight, triggerCenterY - (modalHeight / 2))

  return {
    left: `${sidebarWidth}px`,
    top: `${modalTop}px`,
    width: `${modalWidth}px`,
    height: `${modalHeight}px`
  }
})

const handleMouseEnter = () => {
  emit('mouseenter')
}

const handleMouseLeave = () => {
  emit('mouseleave')
}
</script>

<style scoped>
.hover-submenu-modal {
  position: fixed;
  background-color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.modal-children {
  padding: 0;
}

.modal-child {
  display: block;
  padding: 12px 16px;
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  cursor: pointer;
}

.modal-child:hover {
  background-color: #f5f7fa;
  color: #409eff;
  border-left-color: #409eff;
}

.modal-child.active {
  background-color: #ecf5ff;
  color: #409eff;
  border-left-color: #409eff;
  font-weight: 500;
}
</style>