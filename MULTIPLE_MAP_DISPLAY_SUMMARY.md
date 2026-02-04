# 多个 Map 显示逻辑总结

## 核心设计原则

**所有相同类型的 panel 使用相同的标题**，不添加序号或后缀。例如：
- 第一个 Map panel → 标题：`Map`
- 第二个 Map panel → 标题：`Map`（不是 `Map 2`）
- 复制 Map panel → 标题：`Map`（不是 `Map (副本 1)`）

## 多个 Map 渲染架构

### 1. 独立管理，统一渲染

每个 Map panel 都有：
- **独立的 componentId**：用于区分不同的地图实例
- **独立的配置**：alpha、colorScheme、drawBehind、topic
- **独立的数据**：纹理数据、消息数据
- **独立的 regl command**：每个地图创建独立的渲染命令

但所有地图**共享一次 `camera.draw` 调用**，在回调内部依次渲染所有地图。

### 2. 数据流程

```
ROS Topic (OccupancyGrid)
    ↓
TopicSubscriptionManager (订阅)
    ↓
useDisplaySync.syncMapDisplay() (同步显示状态)
    ↓
SceneManager.updateMap() (处理数据)
    ↓
Web Worker (转换为纹理数据)
    ↓
SceneManager.updateMapDrawCall() (创建渲染命令)
    ↓
统一渲染回调 (所有地图共享一次 camera.draw)
    ↓
GPU 渲染 (按 Z 偏移排序依次渲染)
```

## 深度排序策略（Z 偏移）

### 核心机制

为每个地图分配**唯一的 Z 偏移**，确保正确的渲染顺序和深度排序。

### Z 偏移分配规则

1. **drawBehind 地图**（Z < 0）：
   - 第一个：`-0.01`
   - 第二个：`-0.02`
   - 第三个：`-0.03`
   - ...（按添加顺序，间隔 0.001）

2. **正常地图**（Z >= 0）：
   - 第一个：`0.0`
   - 第二个：`0.001`
   - 第三个：`0.002`
   - ...（按添加顺序，间隔 0.001）

### 渲染顺序

按 **Z 偏移升序排序**（Z 值小的先渲染）：
- drawBehind 地图先渲染（在后面）
- 正常地图后渲染（在前面）
- 相同类型的地图按添加顺序渲染

### 示例

假设有 3 个地图：
- **Map A**：`drawBehind=false` → Z = `0.0`
- **Map B**：`drawBehind=true` → Z = `-0.01`
- **Map C**：`drawBehind=false` → Z = `0.001`

**渲染顺序**：
1. Map B (Z = -0.01) - 先渲染，在后面
2. Map A (Z = 0.0) - 中间渲染
3. Map C (Z = 0.001) - 最后渲染，在最前面

## 关键数据结构

### SceneManager 中的 Map 集合

```typescript
// 数据存储
mapTextureDataMap: Map<componentId, TextureData>  // 纹理数据
mapConfigMap: Map<componentId, Config>             // 配置（alpha, colorScheme, drawBehind）
mapPropsMap: Map<componentId, RenderProps>         // 渲染属性（包含 zOffset）
mapCommands: Map<componentId, ReglCommand>         // regl 渲染命令

// 辅助数据
mapTopicMap: Map<componentId, Topic>              // topic（用于检测变化）
mapDataHashMap: Map<componentId, DataHash>        // 数据哈希（纹理缓存）
mapMessageHashMap: Map<componentId, MessageHash>  // 消息哈希（变化检测）
mapRequestIds: Map<componentId, RequestId>        // Worker 请求 ID（取消过时请求）
```

## 渲染流程

### 1. 数据更新 (`updateMap`)

```typescript
// 1. 验证消息并生成哈希
const messageHash = generateMapMessageHash(message)

// 2. 如果数据未变化，跳过处理
if (lastMessageHash === messageHash) return

// 3. Web Worker 处理（后台线程）
const result = await worker.processMap({ componentId, message, config })

// 4. 保存纹理数据
mapTextureDataMap.set(componentId, result.textureData)

// 5. 更新渲染命令
updateMapDrawCall(componentId)
```

### 2. 渲染命令创建 (`updateMapDrawCall`)

```typescript
// 1. 为每个地图创建独立的 regl command
if (!mapCommands.has(componentId)) {
  mapCommands.set(componentId, makeMapTextureCommand()(reglContext))
}

// 2. 计算 Z 偏移（根据 drawBehind 和添加顺序）
const zOffset = calculateZOffset(componentId, drawBehind)

// 3. 创建渲染属性
const mapProps = {
  textureData, width, height, resolution, origin,
  alpha, colorScheme, zOffset, dataHash
}

// 4. 保存渲染属性
mapPropsMap.set(componentId, mapProps)

// 5. 更新统一渲染回调
updateMapRenderCallback()
```

### 3. 统一渲染回调 (`updateMapRenderCallback`)

```typescript
// 核心优化：所有地图共享一次 camera.draw 调用
mapRenderCallback = () => {
  camera.draw(cameraState, () => {
    // 按 Z 偏移排序（从后到前）
    const sortedMaps = Array.from(mapPropsMap.entries())
      .sort((a, b) => a[1].zOffset - b[1].zOffset)
    
    // 依次渲染所有地图
    for (const [componentId, mapProps] of sortedMaps) {
      const mapCommand = mapCommands.get(componentId)
      mapCommand([mapProps], false)
    }
  })
}

// 注册到 WorldviewContext
worldviewContext.registerPaintCallback(mapRenderCallback)
```

## GPU 渲染细节

### 顶点着色器

```glsl
// 计算世界坐标
vec2 worldPos2D = mapOrigin + position * mapSize;
vec3 worldPos = vec3(worldPos2D.x, worldPos2D.y, zOffset);
gl_Position = projection * view * vec4(worldPos, 1.0);
```

### 片段着色器

支持三种颜色方案：
1. **map**：浅灰色自由空间，深灰色占用区域，深青灰色未知区域
2. **costmap**：深灰色背景，洋红色高成本区域
3. **raw**：直接显示原始占用值（灰度图）

### 深度测试配置

```typescript
depth: {
  enable: true,
  mask: false,  // 禁用深度写入（避免 Z-fighting）
  func: 'less'  // 只渲染更近的像素
}
```

**为什么禁用深度写入**：
- 每个地图已经有唯一的 Z 偏移（0.001 间隔）
- 不需要深度写入即可确保正确的渲染顺序
- 避免多个地图之间的 Z-fighting

## 配置管理

### 配置更新 (`updateMapOptions`)

```typescript
// 1. 更新配置
mapConfigMap.set(componentId, newConfig)

// 2. 如果 topic 改变，清理旧数据
if (oldTopic !== newTopic) {
  clearMapTextureCache(componentId, dataHash)
  // 清理所有相关数据
}

// 3. 如果 drawBehind 改变，重新计算所有地图的 Z 偏移
if (oldDrawBehind !== newDrawBehind) {
  recalculateAllMapZOffsets()
}

// 4. 更新渲染命令
if (hasMapData) {
  updateMapDrawCall(componentId)
}
```

### 配置与数据分离

- **配置**存储在 `mapConfigMap` 中（独立于数据）
- **数据更新**不会覆盖配置
- **渲染时**从 `mapConfigMap` 读取最新配置

## 性能优化

### 1. 统一渲染回调
- N 个地图只调用 1 次 `camera.draw`，而不是 N 次
- 大幅降低 CPU 使用率

### 2. 纹理缓存
- 复用相同数据的纹理，避免重复创建
- 缓存键：`width_height_dataHash`

### 3. 消息哈希检测
- 采样检查数据变化（前100、中间100、后100个点）
- 如果数据未变化，跳过处理

### 4. Web Worker 后台处理
- 地图数据处理在 Worker 线程中进行
- 不阻塞主线程
- 自动取消过时的请求

### 5. Buffer 复用
- 预创建顶点和纹理坐标 buffer（全局复用）
- 避免每帧重新创建数组

### 6. Props 缓存
- 缓存 mapProps，避免重复创建
- 只有数据或配置变化时才更新

## 关键文件

1. **`src/components/RvizViewer/core/SceneManager.ts`**
   - 地图数据管理
   - Z 偏移计算
   - 统一渲染回调

2. **`src/components/RvizViewer/commands/MapTexture.ts`**
   - GPU 渲染命令
   - 着色器实现
   - 纹理缓存

3. **`src/composables/viewer/scene/useDisplaySync.ts`**
   - 显示状态同步
   - 数据订阅管理

4. **`src/workers/dataProcessor.worker.ts`**
   - 地图数据预处理
   - OccupancyGrid → 纹理数据转换

5. **`src/components/panels/panels-manager/displays/DisplayPanel.vue`**
   - Panel 标题生成（相同类型使用相同标题）

## 总结

多个 Map 显示的核心逻辑：

1. **独立管理**：每个地图有独立的 componentId、配置、数据和渲染命令
2. **统一渲染**：所有地图共享一次 `camera.draw` 调用，在回调内部依次渲染
3. **深度排序**：通过 Z 偏移（0.001 间隔）确保正确的渲染顺序
4. **性能优化**：纹理缓存、消息哈希检测、Web Worker 处理、Buffer 复用
5. **标题统一**：相同类型的 panel 使用相同的标题，不添加序号

这种设计既保证了多地图的正确渲染，又实现了高性能和低 CPU 使用率。
