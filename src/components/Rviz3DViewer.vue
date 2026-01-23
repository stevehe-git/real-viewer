<template>
  <div class="rviz-viewer" :class="{ resizing: isResizing }">
    <div class="viewer-container" ref="containerRef" :style="{ width: viewerWidth }"></div>

    <!-- 可拖动分割条 -->
    <div
      v-if="rvizStore.panelConfig.enabledPanels.length > 0"
      class="splitter"
      @mousedown="startResize"
      :class="{ resizing: isResizing }"
    >
      <div class="splitter-handle"></div>
    </div>

    <!-- 面板管理系统 -->
    <PanelManager
      v-if="rvizStore.panelConfig.enabledPanels.length > 0"
      ref="panelManagerRef"
      :camera-mode="rvizStore.sceneState.cameraMode"
      :show-grid="rvizStore.sceneState.showGrid"
      :show-axes="rvizStore.sceneState.showAxes"
      :show-robot="rvizStore.sceneState.showRobot"
      :show-map="rvizStore.sceneState.showMap"
      :show-laser="rvizStore.sceneState.showLaser"
      :background-color="rvizStore.sceneState.backgroundColor"
      :fps="rvizStore.sceneState.fps"
      :camera-pos="rvizStore.sceneState.cameraPos"
      :object-count="rvizStore.sceneState.objectCount"
      :memory-usage="rvizStore.sceneState.memoryUsage"
      :texture-count="rvizStore.sceneState.textureCount"
      :is-recording="rvizStore.sceneState.isRecording"
      :performance-mode="rvizStore.sceneState.performanceMode"
      :show-debug-info="rvizStore.sceneState.showDebugInfo"
      :is-fullscreen="props.isFullscreen"
      @reset-camera="resetCamera"
      @toggle-grid="toggleGrid"
      @toggle-axes="toggleAxes"
      @update:camera-mode="handleCameraModeUpdate"
      @update:show-robot="handleShowRobotUpdate"
      @update:show-map="handleShowMapUpdate"
      @update:show-laser="handleShowLaserUpdate"
      @update:background-color="handleBackgroundColorUpdate"
      @take-screenshot="takeScreenshot"
      @export-scene="exportScene"
      @reset-scene="resetScene"
      @toggle-recording="toggleRecording"
      @toggle-performance-mode="togglePerformanceMode"
      @toggle-debug-info="toggleDebugInfo"
      @toggle-fullscreen="emit('toggleFullscreen')"
      @update:global-options="handleGlobalOptionsUpdate"
      @update:grid-options="handleGridOptionsUpdate"
      @update:axes-options="handleAxesOptionsUpdate"
      @add-display="handleAddDisplay"
      @duplicate-display="handleDuplicateDisplay"
      @remove-display="handleRemoveDisplay"
      @rename-display="handleRenameDisplay"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MOUSE } from 'three'
import PanelManager from './panels/PanelManager.vue'
import { use3DRenderer } from '@/composables/use3DRenderer'
import {
  createROSAxes,
  getROSGridRotation,
  convertROSOffsetToThree
} from '@/services/coordinateConverter'

// 使用RViz store
const rvizStore = useRvizStore()

interface Props {
  isFullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullscreen: false
})

const emit = defineEmits<{
  toggleFullscreen: []
}>()

// Refs
const containerRef = ref<HTMLElement>()
const panelManagerRef = ref<InstanceType<typeof PanelManager> | null>(null)
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

// 分割条相关
const viewerWidth = ref('calc(100% - 300px)')
const panelWidth = ref(300)
const isResizing = ref(false)
let startX = 0
let startPanelWidth = 0

// 中键平移相关
let isMiddleMouseDown = false
let lastMousePosition = { x: 0, y: 0 }

// 场景相关
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number

// 使用store的状态（通过计算属性或直接访问）

// FPS控制
let targetFPS = 30
let frameInterval = 1000 / targetFPS
let lastRenderTime = 0

// 3D对象
let gridHelper: THREE.GridHelper
let axesHelper: THREE.Group
let robotGroup: THREE.Group

// 使用 3D 渲染器 composable（在场景初始化后设置）
let renderer3D: ReturnType<typeof use3DRenderer> | null = null

// 性能监控
let lastTime = performance.now()
let frameCount = 0

const initScene = () => {
  if (!containerRef.value) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(rvizStore.sceneState.backgroundColor)

  // 创建相机
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 0.01  // 允许无限放大（接近0但不为0，避免数值问题）
  controls.maxDistance = Infinity  // 允许无限缩小
  controls.maxPolarAngle = Math.PI / 2
  
  // 配置鼠标按钮：左键旋转，中键平移
  controls.mouseButtons = {
    LEFT: MOUSE.ROTATE,      // 左键：旋转
    MIDDLE: MOUSE.PAN,       // 中键：平移
    RIGHT: MOUSE.ROTATE      // 右键：也设置为旋转（可选）
  }
  
  // 启用平移功能
  controls.enablePan = true
  controls.panSpeed = 0.8

  // 创建网格和坐标轴（使用配置选项）
  updateGridHelper()
  updateAxesHelper()

  // 创建机器人模型
  createRobot()

  // 初始化 3D 渲染器
  renderer3D = use3DRenderer(scene)

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize)

  // 使用ResizeObserver监听容器尺寸变化（更可靠）
  if (containerRef.value && window.ResizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      // 使用防抖避免频繁调用
      if (resizeTimer) {
        cancelAnimationFrame(resizeTimer)
      }
      resizeTimer = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0 && renderer && camera) {
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            renderer.setSize(width, height)
          }
        }
      })
    })
    resizeObserver.observe(containerRef.value)
  }

  // 设置中键平移功能
  setupMiddleMousePan()

  // 开始渲染循环
  animate()
}

const updateGridHelper = () => {
  if (!scene) return

  // 移除现有的网格
  if (gridHelper) {
    scene.remove(gridHelper)
  }

  // 获取grid配置
  const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
  const options = gridComponent?.options || {}

  // 使用配置选项创建网格
  const cellSize = options.cellSize || 1
  const planeCellCount = options.planeCellCount || 10
  const color = options.color || '#a0a0a4'
  const plane = options.plane || 'XY'

  // 将颜色字符串转换为Three.js颜色
  const threeColor = new THREE.Color(color)

  gridHelper = new THREE.GridHelper(
    planeCellCount * cellSize,
    planeCellCount,
    threeColor,
    threeColor.clone().multiplyScalar(0.5)
  )

  // 设置透明度
  if (options.alpha !== undefined) {
    gridHelper.material.transparent = true
    gridHelper.material.opacity = options.alpha
  }

  // ✅ 使用统一的ROS网格旋转函数
  const gridRotation = getROSGridRotation(plane)
  gridHelper.rotation.copy(gridRotation)

  // ✅ 使用统一的ROS偏移转换函数
  const rosOffset = {
    x: options.offsetX || 0,
    y: options.offsetY || 0,
    z: options.offsetZ || 0
  }
  const threeOffset = convertROSOffsetToThree(rosOffset)
  gridHelper.position.copy(threeOffset)

  scene.add(gridHelper)
  gridHelper.visible = rvizStore.sceneState.showGrid
}

const updateAxesHelper = () => {
  if (!scene) return

  // 移除现有的坐标轴
  if (axesHelper) {
    scene.remove(axesHelper)
  }

  // 获取axes配置
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  const options = axesComponent?.options || {}

  // 使用配置选项创建坐标轴
  const length = options.length || 1
  const radius = options.radius || 0.01 // 默认半径

  // ✅ 使用统一的ROS坐标轴创建函数
  axesHelper = createROSAxes(length, radius)

  // 设置透明度
  if (options.alpha !== undefined) {
    axesHelper.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material.transparent = true
        child.material.opacity = options.alpha
      }
    })
  }

  scene.add(axesHelper)
  axesHelper.visible = rvizStore.sceneState.showAxes
}

const createRobot = () => {
  robotGroup = new THREE.Group()

  // 机器人主体（立方体）
  const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 1)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x409eff })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.25
  body.castShadow = true
  robotGroup.add(body)

  // 机器人顶部（圆柱体）
  const topGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16)
  const topMaterial = new THREE.MeshStandardMaterial({ color: 0x67c23a })
  const top = new THREE.Mesh(topGeometry, topMaterial)
  top.position.set(0, 0.6, 0)
  top.castShadow = true
  robotGroup.add(top)

  // 机器人位置
  robotGroup.position.set(0, 0, 0)
  scene.add(robotGroup)
}

const resetCamera = () => {
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)
  controls.reset()
}

const toggleGrid = () => {
  rvizStore.sceneState.showGrid = !rvizStore.sceneState.showGrid
  if (gridHelper) {
    gridHelper.visible = rvizStore.sceneState.showGrid
  }
}

const toggleAxes = () => {
  rvizStore.sceneState.showAxes = !rvizStore.sceneState.showAxes
  if (axesHelper) {
    axesHelper.visible = rvizStore.sceneState.showAxes
  }
}

// 设置中键平移功能
const setupMiddleMousePan = () => {
  if (!containerRef.value) return

  const canvas = containerRef.value

  // 中键按下
  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 1) { // 中键
      event.preventDefault()
      isMiddleMouseDown = true
      lastMousePosition.x = event.clientX
      lastMousePosition.y = event.clientY
      canvas.style.cursor = 'move'
    }
  }

  // 中键移动
  const onMouseMove = (event: MouseEvent) => {
    if (isMiddleMouseDown && controls) {
      event.preventDefault()
      
      const deltaX = event.clientX - lastMousePosition.x
      const deltaY = event.clientY - lastMousePosition.y
      
      // 计算平移距离（根据屏幕尺寸和相机距离调整）
      const panSpeed = 0.002
      const panVector = new THREE.Vector3()
      
      // 计算平移方向
      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      camera.getWorldDirection(new THREE.Vector3())
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      up.setFromMatrixColumn(camera.matrixWorld, 1)
      
      // 应用平移
      panVector.addScaledVector(right, -deltaX * panSpeed)
      panVector.addScaledVector(up, deltaY * panSpeed)
      
      controls.target.add(panVector)
      camera.position.add(panVector)
      
      lastMousePosition.x = event.clientX
      lastMousePosition.y = event.clientY
    }
  }

  // 中键释放
  const onMouseUp = (event: MouseEvent) => {
    if (event.button === 1) { // 中键
      event.preventDefault()
      isMiddleMouseDown = false
      canvas.style.cursor = 'default'
    }
  }

  // 防止中键默认行为（打开新标签页等）
  const onContextMenu = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  }

  // 防止中键滚动
  const onWheel = (event: WheelEvent) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', () => {
    isMiddleMouseDown = false
    canvas.style.cursor = 'default'
  })
  canvas.addEventListener('contextmenu', onContextMenu)

  // 保存事件处理器以便清理
  ;(canvas as any)._middleMouseHandlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onContextMenu,
    onWheel
  }
}

const onWindowResize = () => {
  if (!containerRef.value || !renderer || !camera) return

  // 使用requestAnimationFrame确保在下一帧更新，避免布局抖动
  if (resizeTimer) {
    cancelAnimationFrame(resizeTimer)
  }

  resizeTimer = requestAnimationFrame(() => {
    // 再次检查containerRef.value是否仍然有效
    if (!containerRef.value || !renderer || !camera) return

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    // 确保尺寸有效
    if (width > 0 && height > 0) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
  })
}

const updateObjectCount = () => {
  let count = 0
  scene.traverse(() => {
    count++
  })
  rvizStore.sceneState.objectCount = count
}

const updateMemoryUsage = () => {
  if (renderer && renderer.info) {
    // Three.js的内存信息 (MB)
    const memoryInfo = renderer.info.memory
    rvizStore.sceneState.memoryUsage = Math.round((memoryInfo.geometries + memoryInfo.textures) * 0.001)
  }
}

const updateTextureCount = () => {
  let count = 0
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (Array.isArray(child.material)) {
        count += child.material.length
      } else {
        count += 1
      }
    }
  })
  rvizStore.sceneState.textureCount = count
}

// 处理面板事件
const handleCameraModeUpdate = (value: string) => {
  rvizStore.sceneState.cameraMode = value
}

const handleShowRobotUpdate = (value: boolean) => {
  rvizStore.sceneState.showRobot = value
}

const handleShowMapUpdate = (value: boolean) => {
  rvizStore.sceneState.showMap = value
}


const handleShowLaserUpdate = (value: boolean) => {
  rvizStore.sceneState.showLaser = value
}

const handleBackgroundColorUpdate = (value: string) => {
  rvizStore.sceneState.backgroundColor = value
}

// 工具面板处理函数
const takeScreenshot = () => {
  if (renderer && containerRef.value) {
    const canvas = renderer.domElement
    const link = document.createElement('a')
    link.download = `rviz-screenshot-${new Date().getTime()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
}

const exportScene = () => {
  // 导出场景数据的功能
  const sceneData = {
    camera: {
      position: camera.position,
      target: controls.target
    },
    objects: {
      showRobot: rvizStore.sceneState.showRobot,
      showMap: rvizStore.sceneState.showMap,
      showLaser: rvizStore.sceneState.showLaser
    },
    display: {
      showGrid: rvizStore.sceneState.showGrid,
      showAxes: rvizStore.sceneState.showAxes,
      backgroundColor: rvizStore.sceneState.backgroundColor
    }
  }

  const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `rviz-scene-${new Date().getTime()}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
}

const resetScene = () => {
  // 重置所有场景设置
  rvizStore.resetScene()
  resetCamera()
}

const toggleRecording = (value: boolean) => {
  rvizStore.sceneState.isRecording = value
  // 这里可以添加录制功能的实现
}

const togglePerformanceMode = (value: boolean) => {
  rvizStore.sceneState.performanceMode = value
  // 这里可以添加性能模式的实现
}

const toggleDebugInfo = (value: boolean) => {
  rvizStore.sceneState.showDebugInfo = value
  // 这里可以添加调试信息的显示/隐藏
}

// 处理全局选项更新
const handleGlobalOptionsUpdate = (options: any) => {
  rvizStore.updateGlobalOptions(options)
  if (options.frameRate !== undefined) {
    // 可以更新FPS设置
    targetFPS = options.frameRate
    frameInterval = 1000 / targetFPS
  }
}

// 处理网格选项更新
const handleGridOptionsUpdate = (options: any) => {
  if (options.enabled !== undefined) {
    rvizStore.sceneState.showGrid = options.enabled
  }
  // 可以更新网格的其他属性，如cellSize等
  if (options.cellSize !== undefined && gridHelper) {
    // 更新网格大小
    scene.remove(gridHelper)
    gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
    scene.add(gridHelper)
  }
}

// 处理坐标轴选项更新
const handleAxesOptionsUpdate = (options: any) => {
  if (options.enabled !== undefined) {
    rvizStore.sceneState.showAxes = options.enabled
  }
  // 使用新的渲染函数更新 axes
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  if (renderer3D && axesComponent) {
    renderer3D.updateComponentRender(axesComponent.id, 'axes', {})
  } else {
    // 如果没有 renderer3D，使用旧的 updateAxesHelper（向后兼容）
    updateAxesHelper()
  }
}

// 处理添加显示项
const handleAddDisplay = (name: string) => {
  console.log('Add display:', name)
  // 可以在这里添加新的显示项
}

// 处理复制显示项
const handleDuplicateDisplay = (itemId: string) => {
  console.log('Duplicate display:', itemId)
  // 可以在这里复制显示项
}

// 处理删除显示项
const handleRemoveDisplay = (itemId: string) => {
  console.log('Remove display:', itemId)
  // 可以在这里删除显示项
}

// 处理重命名显示项
const handleRenameDisplay = (itemId: string, newName: string) => {
  console.log('Rename display:', itemId, 'to', newName)
  // 可以在这里重命名显示项
}

// 分割条拖动功能
const startResize = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  startX = e.clientX
  
  // 获取当前宽度
  startPanelWidth = panelWidth.value

  // 添加全局事件监听
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return

  const deltaX = e.clientX - startX
  const newPanelWidth = Math.max(200, Math.min(600, startPanelWidth - deltaX))
  const newViewerWidth = `calc(100% - ${newPanelWidth}px)`

  panelWidth.value = newPanelWidth
  viewerWidth.value = newViewerWidth

  // 实时更新store中的面板宽度，让PanelManager自动响应
  rvizStore.updatePanelConfig({ panelWidth: newPanelWidth })

  // 触发窗口resize以更新3D视图
  onWindowResize()
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  // 更新store中的面板宽度
  rvizStore.updatePanelConfig({ panelWidth: panelWidth.value })
}


const updateFPS = () => {
  frameCount++
  const currentTime = performance.now()
  const delta = currentTime - lastTime

  if (delta >= 1000) {
    // 由于我们限制了渲染频率，这里显示目标FPS而不是实际的requestAnimationFrame频率
    rvizStore.sceneState.fps = targetFPS
    frameCount = 0
    lastTime = currentTime
  }
}

const updateCameraPos = () => {
  rvizStore.sceneState.cameraPos = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z
  }
}

const animate = (currentTime: number = 0) => {
  animationId = requestAnimationFrame(animate)

  // 控制渲染频率
  if (currentTime - lastRenderTime >= frameInterval) {
    lastRenderTime = currentTime

    // 更新控制器
    controls.update()

    // 更新机器人旋转（演示动画）
    if (robotGroup && rvizStore.sceneState.showRobot) {
      robotGroup.rotation.y += 0.01
    }

    // 渲染场景
    renderer.render(scene, camera)

    // 更新信息
    updateFPS()
    updateCameraPos()
    updateObjectCount()
    updateMemoryUsage()
    updateTextureCount()
  }
}

// 监听器
watch(() => rvizStore.sceneState.showRobot, (val: boolean) => {
  if (robotGroup) {
    robotGroup.visible = val
  }
})

watch(() => rvizStore.sceneState.backgroundColor, (val: string) => {
  if (scene) {
    scene.background = new THREE.Color(val)
  }
})

// 监听网格和坐标轴显示状态
watch(() => rvizStore.sceneState.showGrid, (val: boolean) => {
  if (gridHelper) {
    gridHelper.visible = val
  }
})

watch(() => rvizStore.sceneState.showAxes, (val: boolean) => {
  if (axesHelper) {
    axesHelper.visible = val
  }
})

// 监听grid组件的选项变化
watch(() => {
  const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
  return gridComponent?.options
}, () => {
  updateGridHelper()
}, { deep: true })

// 监听axes组件的选项变化
watch(() => {
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  return axesComponent?.options
}, (newOptions, oldOptions) => {
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  if (renderer3D && axesComponent) {
    // 使用新的渲染函数更新 axes
    renderer3D.updateComponentRender(axesComponent.id, 'axes', {})
  } else {
    // 如果没有 renderer3D，使用旧的 updateAxesHelper（向后兼容）
    updateAxesHelper()
  }
}, { deep: true })

// 检查topic是否有效
const isValidTopic = (topic: string | undefined): boolean => {
  return !!(topic && topic.trim() !== '' && topic !== '<Fixed Frame>')
}

// 更新组件可见性（从 store 获取数据）
const updateComponentVisibility = (componentId: string, componentType: string) => {
  const component = rvizStore.displayComponents.find(c => c.id === componentId)
  if (!component || !component.enabled) {
    return
  }

  const topic = component.options?.topic
  const hasValidTopic = isValidTopic(topic)
  
  // 从统一订阅管理器获取状态
  const status = rvizStore.getComponentSubscriptionStatus(componentId)
  const hasData = status?.hasData || false

  const visible = hasValidTopic && hasData

  // 使用 3D 渲染器设置可见性（传递 componentId 以支持多个相同类型的组件）
  if (renderer3D) {
    renderer3D.setComponentVisibility(componentType, visible, componentId)
  }

  // 根据组件类型更新 sceneState
  switch (componentType) {
    case 'map':
      // Map 可见性由 mapRenderer 管理，这里只更新 sceneState
      rvizStore.sceneState.showMap = visible
      break
    // 其他组件类型的可视化可以在这里添加
    default:
      break
  }
}


// 监听displayComponents的变化，使用统一订阅管理器订阅话题
watch(() => rvizStore.displayComponents, (newComponents) => {
  // 检查各种组件是否存在且启用（不依赖topic的组件）
  const hasGrid = newComponents.some(c => c.type === 'grid' && c.enabled)
  const hasAxes = newComponents.some(c => c.type === 'axes' && c.enabled)

  // 遍历所有组件，订阅配置了topic的组件（使用统一订阅管理器）
  newComponents.forEach((component) => {
    // 跳过不需要topic的组件类型
    if (component.type === 'grid' || component.type === 'axes' || component.type === 'robotmodel') {
      return
    }

    // 如果组件启用且有有效的topic，则订阅
    if (component.enabled) {
      const topic = component.options?.topic
      if (isValidTopic(topic) && rvizStore.robotConnection.connected) {
        // 使用统一订阅管理器订阅
        // 如果订阅失败（例如插件未设置），会在连接状态变化时重试
        const success = rvizStore.subscribeComponentTopic(
          component.id,
          component.type,
          topic,
          component.options?.queueSize || 10
        )
        if (!success) {
          console.warn(`Failed to subscribe component ${component.id}, will retry on connection`)
        }
      } else {
        // topic无效或未连接，取消订阅
        rvizStore.unsubscribeComponentTopic(component.id)
        updateComponentVisibility(component.id, component.type)
      }
    } else {
      // 组件被禁用，取消订阅
      rvizStore.unsubscribeComponentTopic(component.id)
      updateComponentVisibility(component.id, component.type)
    }
  })

  // 更新不依赖topic的组件可见性
  if (gridHelper) {
    gridHelper.visible = hasGrid
  }
  if (axesHelper) {
    axesHelper.visible = hasAxes
  }

  // 更新sceneState以保持同步
  rvizStore.sceneState.showGrid = hasGrid
  rvizStore.sceneState.showAxes = hasAxes
}, { deep: true, immediate: true })

// 监听连接状态，当连接时重新订阅所有组件（使用统一订阅管理器）
watch(() => rvizStore.robotConnection.connected, (connected) => {
  console.log("Rviz3DViewer watch robotConnection.connected", connected)
  if (connected) {
    // 延迟一点确保 ROS 插件已设置到订阅管理器
    setTimeout(() => {
      // 重新订阅所有启用的组件（使用统一订阅管理器）
      rvizStore.displayComponents.forEach((component) => {
        if (component.enabled && isValidTopic(component.options?.topic)) {
          rvizStore.subscribeComponentTopic(
            component.id,
            component.type,
            component.options?.topic,
            component.options?.queueSize || 10
          )
        }
      })
    }, 300)
  } else {
    // 断开连接时，统一订阅管理器会自动处理取消订阅
    // Map 可见性由 mapRenderer 管理，这里不需要处理
  }
})

// 监听面板变化，当面板显示/隐藏时触发resize
watch(() => rvizStore.panelConfig.enabledPanels, (newPanels) => {
  // 如果面板被隐藏，恢复viewer-container为100%宽度
  if (newPanels.length === 0) {
    viewerWidth.value = '100%'
  } else {
    // 如果有面板，使用store中的面板宽度
    viewerWidth.value = `calc(100% - ${rvizStore.panelConfig.panelWidth}px)`
  }
  // 延迟执行，等待DOM更新完成
  nextTick(() => {
    setTimeout(() => {
      onWindowResize()
    }, 100)
  })
}, { deep: true })

onMounted(() => {
  // PanelManager 现在通过 :style 绑定自动响应 store 的 panelWidth
  // 不需要手动设置宽度

  initScene()
})

// 监听组件数据变化，更新 3D 渲染
// 优化：只监听组件数组的长度和基本属性，避免 deep: true 导致的频繁触发
watch(() => rvizStore.displayComponents.map(c => ({ id: c.id, enabled: c.enabled, type: c.type })), (newComponents, oldComponents) => {
  if (!renderer3D) return

  // 检测被移除的组件
  const currentComponentIds = new Set(newComponents.map(c => c.id))
  const removedComponentIds = new Set(
    (oldComponents || []).filter(c => !currentComponentIds.has(c.id)).map(c => c.id)
  )

  // 清理被移除的组件
  removedComponentIds.forEach(componentId => {
    const oldComponent = (oldComponents || []).find(c => c.id === componentId)
    if (oldComponent && renderer3D) {
      // 清理渲染对象
      renderer3D.removeComponentRender(componentId, oldComponent.type)
      // 清理数据缓存和订阅
      rvizStore.clearComponentData(componentId)
      rvizStore.unsubscribeComponentTopic(componentId)
    }
  })

  // 遍历所有组件，检查数据变化并更新渲染
  rvizStore.displayComponents.forEach((component) => {
    // 跳过不需要数据的组件（grid）
    // Axes 组件需要根据 referenceFrame 更新位置，需要调用渲染函数
    if (component.type === 'grid') {
      return
    }

    // Axes 组件特殊处理：根据 referenceFrame 更新位置
    if (component.type === 'axes') {
      if (component.enabled && renderer3D) {
        renderer3D.updateComponentRender(component.id, component.type, {})
        updateComponentVisibility(component.id, component.type)
      } else if (renderer3D) {
        renderer3D.setComponentVisibility(component.type, false, component.id)
      }
      return
    }

    // TF 组件从 tfManager 获取数据，不需要从订阅管理器获取

    // TF 组件特殊处理：从 tfManager 获取数据
    if (component.type === 'tf') {
      if (component.enabled && renderer3D) {
        // TF 数据从 tfManager 实时获取，不需要传入 message
        renderer3D.updateComponentRender(component.id, component.type, {})
        updateComponentVisibility(component.id, component.type)
      } else if (renderer3D) {
        renderer3D.setComponentVisibility(component.type, false, component.id)
      }
      return
    }

    // RobotModel 组件特殊处理：从 URDF 文件或 ROS 参数加载
    if (component.type === 'robotmodel') {
      if (component.enabled && renderer3D) {
        // RobotModel 从配置的 URDF 文件或 ROS 参数加载，不需要传入 message
        renderer3D.updateComponentRender(component.id, component.type, {})
        updateComponentVisibility(component.id, component.type)
      } else if (renderer3D) {
        renderer3D.setComponentVisibility(component.type, false, component.id)
      }
      return
    }

    // 如果组件未启用，跳过
    if (!component.enabled) {
      return
    }

    // 直接从统一订阅管理器获取数据（单一数据源）
    const data = rvizStore.getComponentData(component.id)
    const subscriptionStatus = rvizStore.getComponentSubscriptionStatus(component.id)
    
    if (data && subscriptionStatus?.hasData && renderer3D) {
      // 使用 3D 渲染器更新渲染（配置更新时重新渲染以应用新配置）
      renderer3D.updateComponentRender(component.id, component.type, data)
      // 更新可见性
      updateComponentVisibility(component.id, component.type)
    } else if (renderer3D) {
      // 没有数据时隐藏（但需要传递 componentId 以避免隐藏其他组件）
      renderer3D.setComponentVisibility(component.type, false, component.id)
    }
  })
}, { deep: false })

// 监听组件数据变化（从统一订阅管理器）
// 使用定时器定期检查数据更新，避免过度监听
let dataCheckTimer: ReturnType<typeof setInterval> | null = null
watch(() => rvizStore.robotConnection.connected, (connected) => {
  if (connected && !dataCheckTimer) {
    // 每100ms检查一次数据更新
    dataCheckTimer = setInterval(() => {
      if (!renderer3D) return
      
      rvizStore.displayComponents.forEach((component) => {
        if (component.enabled) {
          // TF 组件特殊处理：从 tfManager 获取数据
          if (component.type === 'tf') {
            renderer3D!.updateComponentRender(component.id, component.type, {})
            updateComponentVisibility(component.id, component.type)
            return
          }
          
          // RobotModel 组件特殊处理：从 URDF 文件或 ROS 参数加载
          if (component.type === 'robotmodel') {
            renderer3D!.updateComponentRender(component.id, component.type, {})
            updateComponentVisibility(component.id, component.type)
            return
          }
          
          const data = rvizStore.getComponentData(component.id)
          const subscriptionStatus = rvizStore.getComponentSubscriptionStatus(component.id)
          
          if (data && subscriptionStatus?.hasData && renderer3D) {
            renderer3D.updateComponentRender(component.id, component.type, data)
            updateComponentVisibility(component.id, component.type)
          }
        }
      })
    }, 100)
  } else if (!connected && dataCheckTimer) {
    clearInterval(dataCheckTimer)
    dataCheckTimer = null
  }
})

onUnmounted(() => {
  // 清理 3D 渲染器
  renderer3D?.cleanup()

  // 清理资源（订阅由统一管理器处理）
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  if (resizeTimer) {
    cancelAnimationFrame(resizeTimer)
  }

  window.removeEventListener('resize', onWindowResize)

  // 清理ResizeObserver
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清理中键平移事件监听器
  if (containerRef.value) {
    const canvas = containerRef.value
    const handlers = (canvas as any)._middleMouseHandlers
    if (handlers) {
      canvas.removeEventListener('mousedown', handlers.onMouseDown)
      canvas.removeEventListener('mousemove', handlers.onMouseMove)
      canvas.removeEventListener('mouseup', handlers.onMouseUp)
      canvas.removeEventListener('contextmenu', handlers.onContextMenu)
      delete (canvas as any)._middleMouseHandlers
    }
  }

  if (renderer) {
    renderer.dispose()
  }

  // 安全地移除renderer的DOM元素
  if (containerRef.value && renderer && renderer.domElement && renderer.domElement.parentNode === containerRef.value) {
    try {
      containerRef.value.removeChild(renderer.domElement)
    } catch (error) {
      console.warn('Failed to remove renderer DOM element:', error)
    }
  }
})
</script>

<style scoped>
.rviz-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.rviz-viewer.resizing {
  user-select: none;
}

.viewer-container {
  position: relative;
  background: #1a1a1a;
  height: 100%;
  overflow: hidden;
  min-width: 200px;
  flex-shrink: 0;
}

.rviz-viewer.resizing .viewer-container {
  transition: none;
}

.splitter {
  width: 4px;
  background: #dcdfe6;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  z-index: 10;
  transition: background 0.2s;
  user-select: none;
}

.splitter:hover {
  background: #409eff;
}

.splitter.resizing {
  background: #409eff;
  width: 4px;
}

.splitter-handle {
  position: absolute;
  top: 0;
  left: -2px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
}

</style>