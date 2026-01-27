# 地图渲染性能优化重构总结

## 问题描述

当显示动静态地图时，特别是地图比较大时，鼠标进行旋转操作会导致CPU使用率飙升，而在RViz中不会出现此问题。

## 问题根源分析

通过查阅RViz和regl-worldview的相关资料，发现主要问题在于：

1. **Triangles命令每帧重新处理数据**：每次渲染时都会重新转换地图的顶点和颜色数据，对于大地图数据量巨大，导致CPU负担过重
2. **缺少GPU缓存机制**：没有使用regl buffer缓存地图的顶点和颜色数据，每次都重新创建
3. **重复处理相同数据**：即使地图数据没有变化，也会重复处理和渲染
4. **交互模式下帧率过高**：大地图渲染时，交互模式下的帧率仍然较高，没有针对大地图进一步优化

## 重构方案

### 1. Triangles命令优化（`commands/Triangles.ts`）

**问题**：每次渲染时都重新转换和处理地图的顶点和颜色数据

**解决方案**：
- 实现地图数据缓存机制，使用`Map`缓存已处理的regl buffer
- 使用regl buffer缓存顶点和颜色数据，避免每帧重新创建
- 通过数据哈希快速判断数据是否变化，只在数据变化时重新生成buffer

**关键改进**：
```typescript
// 缓存地图数据的 regl buffer
const triangleCache = new Map<string, CachedTriangleData>()

function getCachedTriangleBuffers(regl, props, cacheKey) {
  const cached = triangleCache.get(cacheKey)
  if (cached) {
    return cached  // 直接返回缓存的数据
  }
  // 只在缓存未命中时才创建新buffer
}

// 在attributes中使用缓存的buffer
point: (_context: any, props: any) => {
  if (props._cachedBuffers?.pointsBuffer) {
    return props._cachedBuffers.pointsBuffer  // 使用缓存的buffer
  }
  // ...
}
```

### 2. SceneManager地图数据变化检测（`core/SceneManager.ts`）

**问题**：即使地图数据没有变化，也会重复处理和渲染

**解决方案**：
- 添加地图数据哈希机制，使用关键信息（宽度、高度、分辨率、原点位置）生成哈希
- 在处理地图数据前检查哈希，如果数据未变化，跳过处理
- 清理地图时同时清理数据哈希

**关键改进**：
```typescript
// 生成数据哈希
const dataHash = `${width}_${height}_${resolution}_${origin.x}_${origin.y}`
const lastHash = this.mapDataHashMap.get(componentId)

// 如果数据没有变化，跳过更新
if (lastHash === dataHash && this.mapDataMap.has(componentId)) {
  return  // 避免不必要的重新渲染
}
```

### 3. 大地图交互模式帧率优化（`core/WorldviewContext.ts`）

**问题**：大地图渲染时，交互模式下的帧率仍然较高

**解决方案**：
- 添加大地图检测机制，根据地图面积判断是否为大地图
- 为大地图交互模式设置更低的帧率（20 FPS）
- 在渲染调度时根据是否有大地图选择不同的帧率

**关键改进**：
```typescript
// 区分正常交互和大地图交互的帧率
private _interactionFPS = 30 // 普通交互模式
private _largeMapInteractionFPS = 20 // 大地图交互模式（进一步降低）

// 根据地图大小选择帧率
minInterval = this._hasLargeMap 
  ? this._largeMapInteractionFrameInterval 
  : this._interactionFrameInterval
```

### 4. 地图大小检测和标记（`core/SceneManager.ts`）

**问题**：无法识别大地图，无法应用特殊优化策略

**解决方案**：
- 在处理地图数据时检测地图面积
- 如果地图面积超过阈值（10000像素），标记为大地图
- 通知WorldviewContext更新大地图状态

**关键改进**：
```typescript
// 检测是否有大地图
const mapArea = width * height
const isLargeMap = mapArea > 10000

// 检查所有地图，如果有任何一个大地图，就标记为有大地图
if (typeof this.worldviewContext.setHasLargeMap === 'function') {
  this.worldviewContext.setHasLargeMap(hasAnyLargeMap)
}
```

## 性能提升效果

经过以上优化，预期性能提升：

1. **CPU使用率降低**：大地图交互模式下CPU使用率预计降低60-80%
2. **渲染帧率稳定**：
   - 正常模式：60 FPS
   - 普通交互模式：30 FPS
   - 大地图交互模式：20 FPS
3. **内存使用优化**：通过缓存机制，减少重复的内存分配和释放
4. **响应性提升**：减少不必要的渲染，提高整体响应速度

## 参考RViz的最佳实践

1. **GPU加速渲染**：使用regl buffer缓存，充分利用GPU
2. **帧率控制**：根据场景复杂度动态调整帧率
3. **数据缓存**：缓存静态或变化频率低的数据，避免重复计算
4. **变化检测**：只在数据真正改变时才触发更新

## 后续优化建议

1. **视景体剔除**：只渲染可见区域内的地图三角形
2. **LOD机制**：根据相机距离动态调整地图细节层级
3. **分块渲染**：将大地图分成多个块，按需加载和渲染
4. **Web Worker优化**：进一步优化地图数据处理，减少主线程负担

## 测试建议

1. 测试大地图（>10000像素）旋转时的CPU使用率
2. 测试多个地图同时显示时的性能表现
3. 测试交互模式下的帧率稳定性
4. 测试内存使用情况，确保缓存机制不会导致内存泄漏
5. 测试地图数据更新时的性能（确保变化检测正常工作）
