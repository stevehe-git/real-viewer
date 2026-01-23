# Viewer Composables

本目录包含用于重构 `Rviz3DViewer.vue` 的功能模块 composables。

## 模块说明

### 1. `useSceneSetup.ts`
- **功能**: 场景初始化
- **职责**: 创建和管理 THREE.js 场景、相机、渲染器、控制器
- **导出**: `useSceneSetup`, `SceneSetupContext`, `SceneSetupResult`

### 2. `useAnimationLoop.ts`
- **功能**: 动画循环管理
- **职责**: 管理渲染循环、FPS 控制和性能监控
- **导出**: `useAnimationLoop`, `AnimationLoopContext`, `AnimationLoopResult`

### 3. `useMouseControls.ts`
- **功能**: 鼠标控制
- **职责**: 处理中键平移等鼠标交互
- **导出**: `useMouseControls`, `MouseControlsContext`, `MouseControlsResult`

### 4. `useResizeHandler.ts`
- **功能**: 窗口大小调整处理
- **职责**: 处理窗口和容器大小变化
- **导出**: `useResizeHandler`, `ResizeHandlerContext`, `ResizeHandlerResult`

### 5. `useSplitter.ts`
- **功能**: 分割条拖动
- **职责**: 处理面板分割条的拖动功能
- **导出**: `useSplitter`, `SplitterContext`, `SplitterResult`

### 6. `usePerformanceMonitor.ts`
- **功能**: 性能监控
- **职责**: 监控和更新场景性能指标
- **导出**: `usePerformanceMonitor`, `PerformanceMonitorContext`, `PerformanceMonitorResult`

### 7. `useSceneHelpers.ts`
- **功能**: 场景辅助对象管理
- **职责**: 管理网格、坐标轴、机器人模型等辅助对象
- **导出**: `useSceneHelpers`, `SceneHelpersContext`, `SceneHelpersResult`

### 8. `useComponentSubscription.ts`
- **功能**: 组件订阅管理
- **职责**: 管理组件的话题订阅和数据更新
- **导出**: `useComponentSubscription`, `ComponentSubscriptionContext`, `ComponentSubscriptionResult`

### 9. `useSceneWatchers.ts`
- **功能**: 场景状态监听
- **职责**: 监听场景状态变化并更新3D对象
- **导出**: `useSceneWatchers`, `SceneWatchersContext`, `SceneWatchersResult`

## 使用示例

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import {
  useSceneSetup,
  useAnimationLoop,
  useMouseControls,
  useResizeHandler,
  useSplitter,
  usePerformanceMonitor,
  useSceneHelpers,
  useComponentSubscription,
  useSceneWatchers
} from '@/composables/viewer'

const rvizStore = useRvizStore()
const containerRef = ref<HTMLElement>()

// 1. 初始化场景
const sceneSetup = useSceneSetup({
  containerRef,
  backgroundColor: rvizStore.sceneState.backgroundColor
})

if (!sceneSetup) return

const { scene, camera, renderer, controls } = sceneSetup

// 2. 创建场景辅助对象
const sceneHelpers = useSceneHelpers({ scene, rvizStore })
sceneHelpers.updateGridHelper()
sceneHelpers.updateAxesHelper()
sceneHelpers.createRobot()
sceneHelpers.createMap()

// 3. 初始化 3D 渲染器
const renderer3D = use3DRenderer(scene)

// 4. 设置鼠标控制
const mouseControls = useMouseControls({
  containerRef,
  camera,
  controls
})

// 5. 设置窗口resize处理
const resizeHandler = useResizeHandler({
  containerRef,
  camera,
  renderer
})

// 6. 设置分割条
const splitter = useSplitter({ rvizStore })

// 7. 设置性能监控
const performanceMonitor = usePerformanceMonitor({
  scene,
  renderer,
  fpsRef: computed(() => rvizStore.sceneState.fps),
  cameraPosRef: computed(() => rvizStore.sceneState.cameraPos),
  objectCountRef: computed(() => rvizStore.sceneState.objectCount),
  memoryUsageRef: computed(() => rvizStore.sceneState.memoryUsage),
  textureCountRef: computed(() => rvizStore.sceneState.textureCount)
})

// 8. 设置动画循环
const animationLoop = useAnimationLoop({
  scene,
  camera,
  renderer,
  controls,
  onFrame: () => {
    // 更新机器人旋转
    if (sceneHelpers.robotGroup && rvizStore.sceneState.showRobot) {
      sceneHelpers.robotGroup.rotation.y += 0.01
    }
    // 更新性能指标
    performanceMonitor.update(camera)
  }
})

// 9. 设置场景状态监听
const sceneWatchers = useSceneWatchers({
  scene,
  rvizStore,
  renderer3D,
  ...sceneHelpers
})

// 10. 设置组件订阅
const componentSubscription = useComponentSubscription({
  rvizStore,
  renderer3D,
  updateComponentVisibility: (componentId, componentType) => {
    // 实现可见性更新逻辑
  },
  gridHelper: sceneHelpers.gridHelper,
  axesHelper: sceneHelpers.axesHelper
})

// 启动动画循环
animationLoop.start()

// 清理
onUnmounted(() => {
  animationLoop.stop()
  mouseControls.cleanup()
  resizeHandler.cleanup()
  splitter.cleanup()
  sceneHelpers.cleanup()
  sceneWatchers.cleanup()
  componentSubscription.cleanup()
  renderer3D?.cleanup()
})
```

## 重构优势

1. **模块化**: 每个 composable 负责单一职责，代码结构清晰
2. **可复用**: 各个 composable 可以在其他组件中复用
3. **易维护**: 功能分离，修改某个功能不影响其他部分
4. **易测试**: 每个 composable 可以独立测试
5. **类型安全**: 完整的 TypeScript 类型定义
