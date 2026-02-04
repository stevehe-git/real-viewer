# LaserScan 和 Map 同视图渲染性能问题深度分析

## 问题描述

当 LaserScan panel 和 Map panel 订阅话题后在同一个视图渲染时，CPU 使用率比它们单独渲染时高很多。

## 根本原因分析

### 1. 渲染架构差异

#### LaserScan 的渲染方式
- **通过 `registerDrawCalls()` 系统渲染**
- 每次 LaserScan 数据更新时，都会调用 `registerDrawCalls()`
- `registerDrawCalls()` 会：
  1. 调用 `unregisterAllDrawCalls()` 清除所有旧的 draw calls
  2. 重新注册所有对象（Grid、Axes、PointCloud、PointCloud2、LaserScan、TF等）

#### Map 的渲染方式
- **通过 `paint callback` 系统渲染**
- 不通过 `registerDrawCalls()`，而是通过 `updateMapRenderCallback()` 注册一个 paint callback
- 在每次 paint 时，paint callback 会被调用

### 2. 关键性能瓶颈

#### 问题 1: `registerDrawCalls()` 的全局重建机制

**代码位置**: `src/components/RvizViewer/core/SceneManager.ts:312-477`

```typescript
registerDrawCalls(): void {
  // 清除旧的绘制调用
  this.unregisterAllDrawCalls()  // ⚠️ 关键问题：清除所有 draw calls
  
  // 然后重新注册所有对象
  // Grid, Axes, PointCloud, PointCloud2, LaserScan, TF...
}
```

**性能影响**：
- 每次 LaserScan 更新时，都会触发 `unregisterAllDrawCalls()`
- `unregisterAllDrawCalls()` 会遍历所有 draw calls，调用 `onUnmount()`
- 然后重新注册所有对象，调用 `onMount()`
- 这导致大量的对象创建和销毁操作

#### 问题 2: `onMount`/`onUnmount` 的开销

**代码位置**: `src/components/RvizViewer/core/WorldviewContext.ts:197-216`

```typescript
onMount(instance: any, command: RawCommand<any>): void {
  // 编译命令（如果未编译）
  this._commands.add(command)
  this._compiled.set(command, compile(initializedData.regl, command))
}

onUnmount(instance: any): void {
  this._drawCalls.delete(instance)
  this._drawCallsVersion++  // 标记需要重新排序
  this._cachedSortedDrawCalls = null  // 清除排序缓存
}
```

**性能影响**：
- `onMount` 会编译 regl 命令（如果未编译），这是相对昂贵的操作
- `onUnmount` 会清除排序缓存，导致下次渲染时需要重新排序
- 每次 `registerDrawCalls()` 都会触发这些操作

#### 问题 3: Draw Calls 排序缓存失效

**代码位置**: `src/components/RvizViewer/core/WorldviewContext.ts:651-657`

```typescript
// 优化：缓存排序结果，只在绘制调用变化时重新排序
if (this._cachedSortedDrawCalls === null || this._drawCallsVersion !== this._lastDrawCallsVersion) {
  this._cachedSortedDrawCalls = Array.from(this._drawCalls.values()).sort(
    (a, b) => (a.layerIndex || 0) - (b.layerIndex || 0)
  )
  this._lastDrawCallsVersion = this._drawCallsVersion
}
```

**性能影响**：
- 每次 `registerDrawCalls()` 都会导致 `_drawCallsVersion++`
- 这会导致排序缓存失效，下次渲染时需要重新排序所有 draw calls
- 排序操作的时间复杂度是 O(n log n)，当 draw calls 数量多时，开销显著

#### 问题 4: 渲染流程的重复执行

**代码位置**: `src/components/RvizViewer/core/WorldviewContext.ts:288-334`

```typescript
_paint(): void {
  // 1. 清除画布
  this._clearCanvas(regl)
  
  // 2. 执行 draw calls（包括 LaserScan）
  camera.draw(cameraState, () => {
    this._drawInput()  // 渲染所有 draw calls
  })
  
  // 3. 执行 paint callbacks（包括 Map）
  if (this._paintCalls.size > 0) {
    for (const paintCall of this._paintCalls.values()) {
      paintCall()  // 渲染 Map
    }
  }
}
```

**性能影响**：
- 每次 paint 时，都会执行所有 draw calls 和 paint callbacks
- 当 LaserScan 和 Map 同时存在时，两者都会在每次 paint 时执行
- 如果 LaserScan 更新频繁，会导致频繁的 paint 调用

### 3. 为什么单独渲染时 CPU 更低？

#### 单独渲染 LaserScan
- `registerDrawCalls()` 只需要处理 LaserScan 相关的对象
- 其他对象（如 PointCloud、PointCloud2）可能不存在，减少了重建开销
- 没有 Map 的 paint callback，减少了渲染开销

#### 单独渲染 Map
- Map 通过 paint callback 渲染，不会触发 `registerDrawCalls()`
- 没有 LaserScan 的频繁更新，不会导致频繁的 draw calls 重建
- 渲染流程更简单，开销更小

### 4. 为什么一起渲染时 CPU 更高？

#### 关键问题：LaserScan 更新触发全局重建

**代码位置**: `src/components/RvizViewer/core/SceneManager.ts:1554-1558`

```typescript
// 延迟注册绘制调用
requestAnimationFrame(() => {
  this.registerDrawCalls()  // ⚠️ 每次 LaserScan 更新都会调用
  this.worldviewContext.onDirty()
})
```

**性能影响**：
1. **频繁的全局重建**：
   - LaserScan 通常更新频率很高（10-30 Hz）
   - 每次更新都会触发 `registerDrawCalls()`
   - 这会导致每帧都重建整个 draw calls 系统

2. **Map 的重复渲染**：
   - 虽然 Map 通过 paint callback 渲染，不直接受 `registerDrawCalls()` 影响
   - 但是 `registerDrawCalls()` 会调用 `onDirty()`，触发 paint
   - 这会导致 Map 在每次 LaserScan 更新时都被重新渲染

3. **排序缓存失效**：
   - 每次 `registerDrawCalls()` 都会导致排序缓存失效
   - 下次渲染时需要重新排序所有 draw calls
   - 当 draw calls 数量多时，排序开销显著

4. **对象创建和销毁**：
   - `onMount`/`onUnmount` 会创建和销毁对象
   - 频繁的创建和销毁会导致内存分配和垃圾回收开销

## 性能数据估算

假设：
- LaserScan 更新频率：20 Hz（每 50ms 一次）
- Draw calls 数量：10 个（Grid, Axes, PointCloud, PointCloud2, LaserScan, TF等）
- 排序操作：O(n log n) ≈ 10 * log(10) ≈ 33 次比较

**单独渲染 LaserScan**：
- 每次更新：1 次 `registerDrawCalls()` + 1 次排序 ≈ 1ms
- 每秒：20 次更新 ≈ 20ms CPU 时间

**单独渲染 Map**：
- 每次更新：1 次 paint callback ≈ 0.5ms
- 每秒：1-2 次更新（地图更新频率低）≈ 1ms CPU 时间

**一起渲染**：
- 每次 LaserScan 更新：1 次 `registerDrawCalls()` + 1 次排序 + 1 次 Map 渲染 ≈ 2ms
- 每秒：20 次更新 ≈ 40ms CPU 时间
- **额外开销**：Map 的重复渲染（20 次/秒，即使 Map 数据未变化）

## 优化建议

### 1. 优化 `registerDrawCalls()` 机制（推荐）

**问题**：每次 LaserScan 更新都重建整个 draw calls 系统

**解决方案**：只更新变化的 draw call，而不是重建所有

```typescript
// 优化前
registerDrawCalls(): void {
  this.unregisterAllDrawCalls()  // 清除所有
  // 重新注册所有对象
}

// 优化后
updateLaserScanDrawCall(): void {
  // 只更新 LaserScan 的 draw call
  const allLaserScans = Array.from(this.laserScanDataMap.values())
  const existingDrawCall = this.worldviewContext._drawCalls.get(this._batchInstances.laserScan)
  
  if (existingDrawCall) {
    // 更新现有的 draw call
    existingDrawCall.children = allLaserScans
    this.worldviewContext._drawCallsVersion++  // 标记需要重新排序
  } else {
    // 创建新的 draw call
    this.worldviewContext.registerDrawCall({
      instance: this._batchInstances.laserScan,
      reglCommand: this.pointsCommandWithWorldSpace,
      children: allLaserScans,
      layerIndex: 5
    })
  }
}
```

### 2. 优化排序缓存机制

**问题**：每次 `registerDrawCalls()` 都导致排序缓存失效

**解决方案**：只在 layerIndex 变化时才失效排序缓存

```typescript
// 已经在 registerDrawCall 中实现了部分优化
// 但 registerDrawCalls() 会调用 unregisterAllDrawCalls()，导致缓存失效
// 需要避免不必要的 unregisterAllDrawCalls() 调用
```

### 3. 减少 Map 的重复渲染

**问题**：每次 LaserScan 更新都会触发 Map 的重新渲染

**解决方案**：在 Map 的 paint callback 中添加脏标记检查

```typescript
private mapRenderCallback = () => {
  // 检查 Map 数据是否真的变化了
  if (!this._mapNeedsRender) {
    return  // 数据未变化，跳过渲染
  }
  
  // 渲染 Map
  // ...
  
  this._mapNeedsRender = false  // 清除脏标记
}
```

### 4. 批量更新机制

**问题**：频繁的单个更新导致频繁的重建

**解决方案**：使用批量更新机制，在 requestAnimationFrame 中批量处理

```typescript
private pendingLaserScanUpdates = new Set<string>()

updateLaserScan(message: any, componentId: string): Promise<void> {
  // 标记需要更新
  this.pendingLaserScanUpdates.add(componentId)
  
  // 延迟批量更新
  if (!this._pendingBatchUpdate) {
    this._pendingBatchUpdate = requestAnimationFrame(() => {
      this._processBatchUpdates()
      this._pendingBatchUpdate = null
    })
  }
}

private _processBatchUpdates(): void {
  // 批量处理所有待更新的 LaserScan
  // 只调用一次 registerDrawCalls()
}
```

## 总结

**核心问题**：
1. LaserScan 使用 `registerDrawCalls()` 系统，每次更新都重建整个系统
2. Map 使用 paint callback 系统，但受 LaserScan 更新影响，被频繁重新渲染
3. 两者一起渲染时，LaserScan 的频繁更新导致全局重建，CPU 开销显著增加

**优化方向**：
1. 避免全局重建，只更新变化的 draw call
2. 减少排序缓存失效
3. 减少 Map 的重复渲染
4. 使用批量更新机制
