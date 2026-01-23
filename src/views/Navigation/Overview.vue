<template>
  <div class="page-container">
    <h1>导航概览</h1>
    <div class="content">
      <div class="viewer-wrapper">
        <RvizViewer
          :width="viewerWidth"
          :height="viewerHeight"
          :point-cloud="pointCloudData"
          :paths="pathData"
          :options="viewerOptions"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import RvizViewer from '../../components/RvizViewer/RvizViewer.vue'
import type { PointCloudData } from '../../components/RvizViewer/visualizations/PointCloud'
import type { PathData } from '../../components/RvizViewer/visualizations/Path'

// 视口尺寸
const viewerWidth = ref(1200)
const viewerHeight = ref(600)

// 点云数据示例
const pointCloudData = ref<PointCloudData | undefined>(undefined)

// 路径数据示例
const pathData = ref<PathData[]>([])

// 查看器选项（rviz 风格：深灰色背景，浅灰色网格）
const viewerOptions = {
  clearColor: [0.2, 0.2, 0.2, 1.0] as [number, number, number, number], // 深灰色背景 #333333
  enableGrid: true,
  enableAxes: false, // rviz 默认不显示坐标轴
  gridSize: 10,
  gridDivisions: 10,
  gridColor: [0.67, 0.67, 0.67, 1.0] as [number, number, number, number] // 浅灰色网格 #AAAAAA
}

// 生成示例数据（rviz 风格：简洁的网格视图）
function generateSampleData(): void {
  // rviz 默认不显示点云和路径，只显示网格
  pointCloudData.value = undefined
  pathData.value = []
}

// 更新视口尺寸
function updateViewportSize(): void {
  const container = document.querySelector('.viewer-wrapper')
  if (container) {
    viewerWidth.value = container.clientWidth
    viewerHeight.value = container.clientHeight
  }
}

onMounted(() => {
  generateSampleData()
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportSize)
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.content {
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-wrapper {
  flex: 1;
  width: 100%;
  min-height: 500px;
  position: relative;
}
</style>
