# 性能优化重构总结

## 问题描述

当渲染只有一个网格时，鼠标进行旋转操作会导致CPU使用率飙升，而在RViz中不会出现此问题。

## 问题根源分析

通过查阅RViz和regl-worldview的相关资料，发现主要问题在于：

1. **Grid命令每帧重新计算顶点数据**：每次渲染时都会重新生成网格的顶点和颜色数组，导致CPU负担过重
2. **渲染频率过高**：交互模式下没有有效的帧率限制，导致每帧都触发渲染
3. **不必要的状态更新**：相机状态即使没有实际变化也会触发渲染回调
4. **缺少GPU缓存机制**：没有使用regl buffer缓存顶点数据，每次都重新创建

## 重构方案

### 1. Grid命令优化（`commands/Grid.ts`）

**问题**：每次渲染时都重新计算网格顶点和颜色数据

**解决方案**：
- 实现网格数据缓存机制，使用`Map`缓存已生成的网格数据
- 使用regl buffer缓存顶点和颜色数据，避免每帧重新创建
- 只在网格参数（count、cellSize、color）改变时才重新生成数据

**关键改进**：
```typescript
// 缓存网格数据，避免每帧重新计算
const gridCache = new Map<string, CachedGridData>()

function generateGridData(regl, count, cellSize, color) {
  const cacheKey = getCacheKey(count, cellSize, color)
  const cached = gridCache.get(cacheKey)
  if (cached) {
    return cached  // 直接返回缓存的数据
  }
  // 只在缓存未命中时才生成新数据
  // ...
}
```

### 2. WorldviewContext渲染节流优化（`core/WorldviewContext.ts`）

**问题**：交互模式下渲染频率过高，没有有效的帧率限制

**解决方案**：
- 区分正常模式和交互模式的帧率限制
  - 正常模式：60 FPS
  - 交互模式：30 FPS（降低以节省CPU）
- 实现智能的渲染调度机制，避免频繁的渲染请求
- 改进交互检测，更精确地判断交互开始和结束

**关键改进**：
```typescript
// 区分正常模式和交互模式的帧率
private _targetFPS = 60 // 正常模式目标帧率
private _interactionFPS = 30 // 交互模式目标帧率（降低以节省CPU）
private _interactionFrameInterval = 1000 / this._interactionFPS

// 智能渲染调度
private _scheduleNextPaint(): void {
  const minInterval = this._isInteracting 
    ? this._interactionFrameInterval 
    : this._minFrameInterval
  // 根据时间间隔决定立即渲染还是延迟渲染
}
```

### 3. CameraStore状态更新优化（`camera/CameraStore.ts`）

**问题**：即使相机状态没有实际变化也会触发渲染回调

**解决方案**：
- 在`cameraRotate`和`cameraMove`方法中添加状态变化检测
- 只在状态真正改变时才更新和触发回调

**关键改进**：
```typescript
cameraRotate = ([x, y]: Vec2) => {
  // ...
  const newThetaOffset = thetaOffset - x
  const newPhi = Math.max(0, Math.min(phi + y, Math.PI))
  
  // 性能优化：只在状态真正改变时才更新和触发回调
  if (newThetaOffset === thetaOffset && newPhi === phi) {
    return
  }
  // ...
}
```

## 性能提升效果

经过以上优化，预期性能提升：

1. **CPU使用率降低**：交互模式下CPU使用率预计降低50%以上
2. **渲染帧率稳定**：交互模式下稳定在30 FPS，正常模式下稳定在60 FPS
3. **内存使用优化**：通过缓存机制，减少重复的内存分配和释放
4. **响应性提升**：减少不必要的渲染，提高整体响应速度

## 参考RViz的最佳实践

1. **GPU加速渲染**：使用regl buffer缓存，充分利用GPU
2. **帧率控制**：在交互模式下降低渲染频率，平衡性能和体验
3. **数据缓存**：缓存静态或变化频率低的数据，避免重复计算
4. **状态变化检测**：只在状态真正改变时才触发更新

## 后续优化建议

1. **视景体剔除**：只渲染可见区域内的网格线
2. **LOD机制**：根据相机距离动态调整网格密度
3. **Web Worker**：将复杂计算移到Worker线程
4. **增量更新**：只更新变化的部分，而非整个场景

## 测试建议

1. 测试单个网格旋转时的CPU使用率
2. 测试多个网格时的性能表现
3. 测试交互模式下的帧率稳定性
4. 测试内存使用情况，确保缓存机制不会导致内存泄漏
