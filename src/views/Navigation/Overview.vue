<template>
  <div class="navigation-overview">
    <div class="page-header">
      <h2>导航预览</h2>
      <div class="header-actions">
        <el-button size="small" @click="showPanelSettings = true">
          <el-icon><Setting /></el-icon>
          面板设置
        </el-button>
      </div>
    </div>

    <!-- 面板设置抽屉 -->
    <PanelSettingsDrawer
      v-model="showPanelSettings"
    />

    <div class="viewer-wrapper" ref="viewerWrapperRef">
      <Rviz3DViewer
        :is-fullscreen="isFullscreen"
        @toggle-fullscreen="toggleFullscreen"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import Rviz3DViewer from '@/components/Rviz3DViewer.vue'
import PanelSettingsDrawer from '@/components/panels/PanelSettingsDrawer.vue'

const isFullscreen = ref(false)
const viewerWrapperRef = ref<HTMLElement>()
const showPanelSettings = ref(false)

const toggleFullscreen = () => {
  if (!viewerWrapperRef.value) return

  if (!isFullscreen.value) {
    if (viewerWrapperRef.value.requestFullscreen) {
      viewerWrapperRef.value.requestFullscreen()
    } else if ((viewerWrapperRef.value as any).webkitRequestFullscreen) {
      (viewerWrapperRef.value as any).webkitRequestFullscreen()
    } else if ((viewerWrapperRef.value as any).mozRequestFullScreen) {
      (viewerWrapperRef.value as any).mozRequestFullScreen()
    } else if ((viewerWrapperRef.value as any).msRequestFullscreen) {
      (viewerWrapperRef.value as any).msRequestFullscreen()
    }
    isFullscreen.value = true
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
    isFullscreen.value = false
  }
}


// 监听全屏状态变化
document.addEventListener('fullscreenchange', () => {
  isFullscreen.value = !!document.fullscreenElement
})

document.addEventListener('webkitfullscreenchange', () => {
  isFullscreen.value = !!(document as any).webkitFullscreenElement
})

document.addEventListener('mozfullscreenchange', () => {
  isFullscreen.value = !!(document as any).mozFullScreenElement
})

document.addEventListener('msfullscreenchange', () => {
  isFullscreen.value = !!(document as any).msFullscreenElement
})
</script>

<style scoped>
.navigation-overview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
  min-height: 48px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.viewer-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
  width: 100%;
}
</style>
