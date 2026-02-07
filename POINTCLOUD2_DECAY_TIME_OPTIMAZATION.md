# PointCloud2 Decay Time 优化方案

## 问题分析

当 `decayTime` 设置很大时，当前实现存在以下问题：

1. **内存无限增长**：历史数据只按时间过滤，没有数量限制，导致内存无限递增
2. **CPU 阻塞**：合并操作在主线程执行，会阻塞渲染
3. **全量合并**：每次都是全量合并所有历史数据，效率低下
4. **无采样机制**：没有对历史数据进行采样/降采样，点数会无限增长

## 优化策略（参照 Rviz 和主流方案）

### 1. 多重限制策略

#### 1.1 时间窗口限制
- 即使 `decayTime` 很大，也设置一个最大时间窗口（如 60 秒）
- 防止历史数据无限累积

#### 1.2 历史项数量限制
- 设置最大历史数据项数量（如 100 项）
- 当超过限制时，删除最旧的数据

#### 1.3 总点数限制
- 设置最大总点数（如 1000 万点）
- 当超过限制时，对历史数据进行采样

### 2. 采样/降采样策略

#### 2.1 时间采样
- 对历史数据按时间间隔采样（如每 0.1 秒采样一次）
- 减少需要合并的数据项数量

#### 2.2 空间采样
- 对每个历史数据项进行空间采样（如体素降采样）
- 减少每个数据项的点数

#### 2.3 自适应采样
- 根据总点数动态调整采样率
- 点数越多，采样率越高

### 3. 增量合并策略

#### 3.1 增量更新
- 只合并新增的数据，而不是每次都全量合并
- 维护一个已合并的缓存，只合并新增部分

#### 3.2 分帧处理
- 将合并操作分帧执行，每帧只处理一部分数据
- 使用 `requestIdleCallback` 或 `setTimeout` 分帧

### 4. Web Worker 优化

#### 4.1 异步合并
- 将合并操作移到 Web Worker 执行
- 避免阻塞主线程

#### 4.2 批量处理
- 在 Worker 中批量处理多个历史数据项
- 使用预分配数组和批量操作

### 5. 内存管理

#### 5.1 定期清理
- 定期清理过旧的历史数据
- 使用 LRU 策略管理历史数据

#### 5.2 内存监控
- 监控内存使用情况
- 当内存超过阈值时，自动降低采样率或清理数据

## 实现方案

### 配置参数

```typescript
interface DecayTimeConfig {
  decayTime: number // 用户设置的 Decay Time（秒）
  maxTimeWindow: number // 最大时间窗口（秒），默认 60
  maxHistoryItems: number // 最大历史项数量，默认 100
  maxTotalPoints: number // 最大总点数，默认 10,000,000
  samplingInterval: number // 时间采样间隔（秒），默认 0.1
  enableSpatialSampling: boolean // 是否启用空间采样，默认 true
  spatialSamplingVoxelSize: number // 空间采样体素大小，默认 0.05
}
```

### 核心优化实现

#### 1. 多重限制的过滤函数

```typescript
private filterPointCloud2HistoryWithLimits(
  historyDataArray: Array<{ data: any; timestamp: number }>,
  decayTimeSeconds: number,
  currentTimestamp: number,
  config: DecayTimeConfig
): Array<{ data: any; timestamp: number }> {
  // 1. 时间窗口限制
  const maxTimeWindowMs = Math.min(
    decayTimeSeconds * 1000,
    config.maxTimeWindow * 1000
  )
  const cutoffTime = currentTimestamp - maxTimeWindowMs
  
  // 2. 时间过滤
  let filtered = historyDataArray.filter(({ timestamp }) => timestamp >= cutoffTime)
  
  // 3. 时间采样（减少数据项数量）
  if (filtered.length > config.maxHistoryItems) {
    filtered = this.temporalSampling(filtered, config.samplingInterval)
  }
  
  // 4. 历史项数量限制
  if (filtered.length > config.maxHistoryItems) {
    // 保留最新的 N 项
    filtered = filtered.slice(-config.maxHistoryItems)
  }
  
  // 5. 总点数检查和空间采样
  const totalPoints = filtered.reduce((sum, item) => {
    return sum + (item.data.points?.length || 0) / 3
  }, 0)
  
  if (totalPoints > config.maxTotalPoints && config.enableSpatialSampling) {
    // 对每个数据项进行空间采样
    filtered = filtered.map(item => ({
      ...item,
      data: this.spatialSampling(item.data, config.spatialSamplingVoxelSize)
    }))
  }
  
  return filtered
}
```

#### 2. 增量合并策略

```typescript
private incrementalMergePointCloud2Data(
  historyDataArray: Array<{ data: any; timestamp: number }>,
  previousMergedData: any,
  newItems: Array<{ data: any; timestamp: number }>
): any {
  if (!previousMergedData || newItems.length === 0) {
    // 没有缓存或没有新数据，全量合并
    return this.mergePointCloud2Data(historyDataArray)
  }
  
  // 增量合并：只合并新增的数据项
  const mergedPoints = previousMergedData.points ? [...previousMergedData.points] : []
  const mergedColors = previousMergedData.colors ? [...previousMergedData.colors] : []
  
  // 添加新数据项的点
  newItems.forEach(({ data }) => {
    if (data && data.points) {
      mergedPoints.push(...data.points)
      if (data.colors) {
        mergedColors.push(...data.colors)
      } else if (data.color) {
        // 处理单一颜色
        const color = data.color
        const pointCount = data.points.length / 3
        for (let i = 0; i < pointCount; i++) {
          mergedColors.push(color.r || 1, color.g || 1, color.b || 1, color.a || 1)
        }
      }
    }
  })
  
  // 使用最新的 pose 和 scale
  const lastItem = historyDataArray[historyDataArray.length - 1]
  const lastData = lastItem ? lastItem.data : previousMergedData
  
  return {
    points: mergedPoints,
    colors: mergedColors.length > 0 ? mergedColors : undefined,
    color: mergedColors.length === 0 ? lastData.color : undefined,
    pose: lastData.pose,
    scale: lastData.scale
  }
}
```

#### 3. 分帧处理

```typescript
private async mergePointCloud2DataInFrames(
  historyDataArray: Array<{ data: any; timestamp: number }>,
  chunkSize: number = 10 // 每帧处理的数据项数量
): Promise<any> {
  if (historyDataArray.length === 0) {
    return null
  }
  
  if (historyDataArray.length === 1) {
    return historyDataArray[0].data
  }
  
  // 如果数据量小，直接合并
  if (historyDataArray.length <= chunkSize) {
    return this.mergePointCloud2Data(historyDataArray)
  }
  
  // 分块处理
  const chunks: Array<Array<{ data: any; timestamp: number }>> = []
  for (let i = 0; i < historyDataArray.length; i += chunkSize) {
    chunks.push(historyDataArray.slice(i, i + chunkSize))
  }
  
  // 逐帧合并
  let mergedData: any = null
  for (const chunk of chunks) {
    if (mergedData) {
      // 增量合并
      mergedData = this.incrementalMergePointCloud2Data(
        historyDataArray,
        mergedData,
        chunk
      )
    } else {
      // 第一块，全量合并
      mergedData = this.mergePointCloud2Data(chunk)
    }
    
    // 让出主线程，避免阻塞
    await new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(resolve, { timeout: 16 })
      } else {
        setTimeout(resolve, 0)
      }
    })
  }
  
  return mergedData
}
```

#### 4. 时间采样函数

```typescript
/**
 * 时间采样：按时间间隔对历史数据进行采样
 * @param historyDataArray 历史数据数组
 * @param samplingInterval 采样间隔（秒）
 * @returns 采样后的数据数组
 */
private temporalSampling(
  historyDataArray: Array<{ data: any; timestamp: number }>,
  samplingInterval: number
): Array<{ data: any; timestamp: number }> {
  if (historyDataArray.length === 0) {
    return []
  }
  
  const samplingIntervalMs = samplingInterval * 1000
  const sampled: Array<{ data: any; timestamp: number }> = []
  let lastSampledTime = historyDataArray[0].timestamp
  
  // 总是保留第一个和最后一个
  sampled.push(historyDataArray[0])
  
  for (let i = 1; i < historyDataArray.length - 1; i++) {
    const item = historyDataArray[i]
    if (item.timestamp - lastSampledTime >= samplingIntervalMs) {
      sampled.push(item)
      lastSampledTime = item.timestamp
    }
  }
  
  // 保留最后一个
  if (historyDataArray.length > 1) {
    sampled.push(historyDataArray[historyDataArray.length - 1])
  }
  
  return sampled
}
```

#### 5. 空间采样函数（体素降采样）

```typescript
/**
 * 空间采样：使用体素降采样减少点数
 * @param data 点云数据
 * @param voxelSize 体素大小（米）
 * @returns 采样后的点云数据
 */
private spatialSampling(data: any, voxelSize: number): any {
  if (!data || !data.points || data.points.length === 0) {
    return data
  }
  
  const points = data.points
  const colors = data.colors
  const pointCount = points.length / 3
  
  // 体素网格
  const voxelMap = new Map<string, {
    point: [number, number, number]
    color: [number, number, number, number]
    count: number
  }>()
  
  // 将点分配到体素
  for (let i = 0; i < pointCount; i++) {
    const x = points[i * 3]
    const y = points[i * 3 + 1]
    const z = points[i * 3 + 2]
    
    // 计算体素索引
    const voxelX = Math.floor(x / voxelSize)
    const voxelY = Math.floor(y / voxelSize)
    const voxelZ = Math.floor(z / voxelSize)
    const voxelKey = `${voxelX},${voxelY},${voxelZ}`
    
    // 获取或创建体素
    let voxel = voxelMap.get(voxelKey)
    if (!voxel) {
      voxel = {
        point: [x, y, z],
        color: colors ? [colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2], colors[i * 4 + 3]] : [1, 1, 1, 1],
        count: 1
      }
      voxelMap.set(voxelKey, voxel)
    } else {
      // 累加点坐标和颜色（用于计算平均值）
      voxel.point[0] += x
      voxel.point[1] += y
      voxel.point[2] += z
      if (colors) {
        voxel.color[0] += colors[i * 4]
        voxel.color[1] += colors[i * 4 + 1]
        voxel.color[2] += colors[i * 4 + 2]
        voxel.color[3] += colors[i * 4 + 3]
      }
      voxel.count++
    }
  }
  
  // 计算每个体素的平均点和颜色
  const sampledPoints: number[] = []
  const sampledColors: number[] = []
  
  voxelMap.forEach(voxel => {
    const count = voxel.count
    sampledPoints.push(
      voxel.point[0] / count,
      voxel.point[1] / count,
      voxel.point[2] / count
    )
    sampledColors.push(
      voxel.color[0] / count,
      voxel.color[1] / count,
      voxel.color[2] / count,
      voxel.color[3] / count
    )
  })
  
  return {
    points: sampledPoints,
    colors: sampledColors.length > 0 ? sampledColors : undefined,
    color: sampledColors.length === 0 ? data.color : undefined,
    pose: data.pose,
    scale: data.scale
  }
}
```

#### 6. Web Worker 异步合并

```typescript
/**
 * 在 Web Worker 中异步合并点云数据
 * @param historyDataArray 历史数据数组
 * @returns 合并后的点云数据
 */
private async mergePointCloud2DataInWorker(
  historyDataArray: Array<{ data: any; timestamp: number }>
): Promise<any> {
  if (historyDataArray.length === 0) {
    return null
  }
  
  if (historyDataArray.length === 1) {
    return historyDataArray[0].data
  }
  
  try {
    // 序列化数据（确保可传输）
    const serializedData = historyDataArray.map(({ data, timestamp }) => ({
      data: {
        points: Array.isArray(data.points) ? data.points : Array.from(data.points || []),
        colors: data.colors ? (Array.isArray(data.colors) ? data.colors : Array.from(data.colors)) : undefined,
        color: data.color,
        pose: data.pose,
        scale: data.scale
      },
      timestamp
    }))
    
    // 发送到 Worker 处理
    const result = await this.dataProcessorWorker.mergePointCloud2Data(serializedData)
    
    if (result.error) {
      console.error('[PointCloud2] Worker merge error:', result.error)
      // 降级到主线程合并
      return this.mergePointCloud2Data(historyDataArray)
    }
    
    return result.data
  } catch (error) {
    console.error('[PointCloud2] Error merging in worker:', error)
    // 降级到主线程合并
    return this.mergePointCloud2Data(historyDataArray)
  }
}
```

#### 7. 优化的合并函数（使用预分配和批量操作）

```typescript
/**
 * 优化的合并函数：使用预分配数组和批量操作
 * @param historyDataArray 历史数据数组
 * @returns 合并后的点云数据
 */
private mergePointCloud2DataOptimized(
  historyDataArray: Array<{ data: any; timestamp: number }>
): any {
  if (historyDataArray.length === 0) {
    return null
  }
  
  if (historyDataArray.length === 1) {
    return historyDataArray[0].data
  }
  
  // 第一遍：计算总点数
  let totalPoints = 0
  let totalColors = 0
  let hasColors = false
  
  for (const { data } of historyDataArray) {
    if (data && data.points) {
      const pointCount = Array.isArray(data.points) ? data.points.length / 3 : data.points.length / 3
      totalPoints += pointCount
      
      if (data.colors) {
        hasColors = true
        totalColors += pointCount * 4
      } else if (data.color) {
        hasColors = true
        totalColors += pointCount * 4
      }
    }
  }
  
  // 预分配数组
  const mergedPoints = new Float32Array(totalPoints * 3)
  const mergedColors = hasColors ? new Float32Array(totalColors) : null
  
  // 第二遍：批量复制数据
  let pointOffset = 0
  let colorOffset = 0
  
  for (const { data } of historyDataArray) {
    if (data && data.points) {
      const points = Array.isArray(data.points) ? data.points : Array.from(data.points)
      const pointCount = points.length / 3
      
      // 批量复制点
      mergedPoints.set(points, pointOffset * 3)
      pointOffset += pointCount
      
      // 处理颜色
      if (mergedColors) {
        if (data.colors) {
          const colors = Array.isArray(data.colors) ? data.colors : Array.from(data.colors)
          mergedColors.set(colors, colorOffset)
          colorOffset += colors.length
        } else if (data.color) {
          const color = data.color
          const colorArray = Array.isArray(color) ? color : [color.r || 1, color.g || 1, color.b || 1, color.a || 1]
          for (let i = 0; i < pointCount; i++) {
            mergedColors.set(colorArray, colorOffset + i * 4)
          }
          colorOffset += pointCount * 4
        }
      }
    }
  }
  
  // 使用最新的 pose 和 scale
  const lastItem = historyDataArray[historyDataArray.length - 1]
  const lastData = lastItem.data
  
  return {
    points: Array.from(mergedPoints), // 转换为普通数组（如果需要）
    colors: mergedColors ? Array.from(mergedColors) : undefined,
    color: mergedColors ? undefined : lastData.color,
    pose: lastData.pose,
    scale: lastData.scale
  }
}
```

## 完整实现流程

### 更新 PointCloud2 的完整流程

```typescript
async updatePointCloud2(message: any, componentId: string): Promise<void> {
  // ... 前面的处理逻辑 ...
  
  // 获取配置
  const config = this.pointCloud2ConfigMap.get(componentId) || {}
  const decayTime = config.decayTime ?? 0
  
  // 获取默认配置
  const decayTimeConfig: DecayTimeConfig = {
    decayTime,
    maxTimeWindow: 60, // 最大 60 秒
    maxHistoryItems: 100, // 最多 100 项
    maxTotalPoints: 10_000_000, // 最多 1000 万点
    samplingInterval: 0.1, // 0.1 秒采样间隔
    enableSpatialSampling: true,
    spatialSamplingVoxelSize: 0.05 // 5cm 体素
  }
  
  // 获取历史数据
  let historyDataArray = this.pointCloud2HistoryMap.get(componentId) || []
  
  // 添加新数据
  const timestamp = message.header?.stamp?.sec 
    ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
    : Date.now()
  
  historyDataArray.push({
    data: result.data,
    timestamp
  })
  
  // 多重限制过滤
  const filteredHistory = this.filterPointCloud2HistoryWithLimits(
    historyDataArray,
    decayTime,
    timestamp,
    decayTimeConfig
  )
  
  // 更新历史数据
  this.pointCloud2HistoryMap.set(componentId, filteredHistory)
  
  // 合并数据（根据数据量选择策略）
  let finalData: any
  
  if (decayTime > 0 && filteredHistory.length > 1) {
    const totalPoints = filteredHistory.reduce((sum, item) => {
      return sum + (item.data.points?.length || 0) / 3
    }, 0)
    
    // 根据数据量选择合并策略
    if (totalPoints > 1_000_000) {
      // 大数据量：使用 Worker 异步合并
      finalData = await this.mergePointCloud2DataInWorker(filteredHistory)
    } else if (totalPoints > 100_000) {
      // 中等数据量：分帧合并
      finalData = await this.mergePointCloud2DataInFrames(filteredHistory)
    } else {
      // 小数据量：直接合并
      finalData = this.mergePointCloud2DataOptimized(filteredHistory)
    }
  } else {
    // Decay Time 为 0 或只有一条数据
    finalData = result.data
  }
  
  // 更新数据并触发渲染
  this.pointCloud2DataMap.set(componentId, finalData)
  
  // 使用 requestAnimationFrame 延迟渲染，避免阻塞
  requestAnimationFrame(() => {
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  })
}
```

## 内存管理策略

### 定期清理机制

```typescript
/**
 * 定期清理过旧的历史数据
 */
private cleanupPointCloud2History(): void {
  const now = Date.now()
  const maxAge = 120 * 1000 // 2 分钟
  
  this.pointCloud2HistoryMap.forEach((historyArray, componentId) => {
    // 清理超过最大年龄的数据
    const filtered = historyArray.filter(item => {
      return now - item.timestamp < maxAge
    })
    
    if (filtered.length !== historyArray.length) {
      this.pointCloud2HistoryMap.set(componentId, filtered)
    }
  })
}

// 每 30 秒清理一次
setInterval(() => {
  this.cleanupPointCloud2History()
}, 30 * 1000)
```

### 内存监控

```typescript
/**
 * 监控内存使用情况
 */
private checkMemoryUsage(): {
  shouldReduceQuality: boolean
  shouldCleanup: boolean
} {
  // 计算总点数
  let totalPoints = 0
  this.pointCloud2HistoryMap.forEach(historyArray => {
    historyArray.forEach(item => {
      totalPoints += (item.data.points?.length || 0) / 3
    })
  })
  
  // 估算内存使用（每个点约 28 字节：3*4 float + 4*4 color）
  const estimatedMemoryMB = (totalPoints * 28) / (1024 * 1024)
  
  return {
    shouldReduceQuality: estimatedMemoryMB > 500, // 超过 500MB 降低质量
    shouldCleanup: estimatedMemoryMB > 1000 // 超过 1GB 强制清理
  }
}
```

## 性能优化建议

### 1. 自适应采样率

根据总点数动态调整采样率：

```typescript
private getAdaptiveSamplingRate(totalPoints: number): number {
  if (totalPoints < 100_000) {
    return 0.1 // 0.1 秒
  } else if (totalPoints < 1_000_000) {
    return 0.2 // 0.2 秒
  } else if (totalPoints < 5_000_000) {
    return 0.5 // 0.5 秒
  } else {
    return 1.0 // 1.0 秒
  }
}
```

### 2. 增量合并缓存

维护合并缓存，避免重复计算：

```typescript
private pointCloud2MergedCache = new Map<string, {
  data: any
  historyHash: string
}>()

private getHistoryHash(historyArray: Array<{ data: any; timestamp: number }>): string {
  // 使用时间戳和数量生成哈希
  return `${historyArray.length}-${historyArray[0]?.timestamp}-${historyArray[historyArray.length - 1]?.timestamp}`
}
```

### 3. 渲染优化

- 使用 `requestAnimationFrame` 延迟非关键渲染
- 使用 `requestIdleCallback` 处理后台任务
- 避免在渲染循环中进行复杂计算

## 测试和验证

### 性能指标

1. **内存使用**：监控历史数据占用的内存
2. **CPU 使用率**：监控合并操作的 CPU 占用
3. **帧率**：确保渲染帧率 > 30 FPS
4. **主线程阻塞时间**：确保单次阻塞 < 16ms

### 测试场景

1. **小数据量**（< 10 万点）：验证基本功能
2. **中等数据量**（10-100 万点）：验证采样和分帧
3. **大数据量**（> 100 万点）：验证 Worker 和内存管理
4. **长时间运行**：验证内存不会无限增长

## 总结

通过多重限制、采样策略、增量合并、Web Worker 和内存管理，可以在保证渲染流畅性的同时，防止 CPU 和内存无限递增。关键点：

1. **多重限制**：时间窗口、历史项数量、总点数
2. **采样策略**：时间采样和空间采样
3. **增量合并**：避免全量重新计算
4. **异步处理**：使用 Worker 和分帧处理
5. **内存管理**：定期清理和监控

这些策略的组合使用，可以确保即使 `decayTime` 设置很大，系统也能保持流畅运行。