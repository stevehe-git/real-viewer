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

// 查看器选项
const viewerOptions = {
  clearColor: [0.1, 0.1, 0.1, 1.0] as [number, number, number, number],
  enableGrid: true,
  enableAxes: true,
  gridSize: 20,
  gridDivisions: 20
}

// 生成示例数据
function generateSampleData(): void {
  // 生成示例点云数据
  const points: PointCloudData['points'] = []
  const colors: PointCloudData['colors'] = []
  
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 10
    const y = (Math.random() - 0.5) * 10
    const z = Math.random() * 2
    
    points.push({ x, y, z })
    
    // 根据高度设置颜色
    const height = z / 2
    colors.push({
      r: height,
      g: 1 - height,
      b: 0.5,
      a: 1
    })
  }
  
  pointCloudData.value = {
    points,
    colors,
    pointSize: 3
  }

  // 生成示例路径数据
  const waypoints = [
    { x: -5, y: -5, z: 0 },
    { x: -3, y: -3, z: 0.5 },
    { x: 0, y: 0, z: 1 },
    { x: 3, y: 3, z: 0.5 },
    { x: 5, y: 5, z: 0 }
  ]

  pathData.value = [
    {
      waypoints,
      color: { r: 0, g: 1, b: 0, a: 1 },
      lineWidth: 3,
      showPoints: true
    }
  ]
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
