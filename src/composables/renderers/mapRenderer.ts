/**
 * Map 渲染器（增量更新版本）
 * 负责渲染 nav_msgs/OccupancyGrid 地图数据
 * 实现增量更新，只渲染改变的部分，大幅降低 CPU 使用率
 */
import * as THREE from 'three'
import { convertROSTranslationToThree, convertROSRotationToThree } from '@/services/coordinateConverter'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface MapRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
}

/**
 * 地图数据缓存
 */
interface MapDataCache {
  width: number
  height: number
  resolution: number
  data: Int8Array // 原始占用值数组
  colorArray: Float32Array // 颜色数组 (r, g, b) per vertex
  headerSeq: number // header.seq 用于检测数据变化
  colorScheme?: string // 颜色方案，用于检测颜色方案变化
}

// 每个组件的地图数据缓存
const mapDataCache = new Map<string, MapDataCache>()

// 更新节流：每个组件独立节流
const lastUpdateTime = new Map<string, number>()
const UPDATE_THROTTLE_MS = 200 // 200ms 节流，避免过于频繁的更新

/**
 * 将占用值转换为颜色
 * -1: 未知 (灰色)
 * 0-100: 占用概率 (0=白色/自由, 100=黑色/占用)
 */
function occupancyToColor(occupancy: number, colorScheme: string = 'map'): [number, number, number] {
  if (occupancy < 0) {
    // 未知区域：灰色
    return [0.5, 0.5, 0.5]
  }

  const probability = occupancy / 100.0

  if (colorScheme === 'costmap') {
    // Costmap 颜色方案：绿色渐变
    return [0, probability, 0]
  } else if (colorScheme === 'raw') {
    // Raw 颜色方案：灰度
    const gray = 1.0 - probability
    return [gray, gray, gray]
  } else {
    // 默认 map 颜色方案：白色(自由) -> 黑色(占用)
    const gray = 1.0 - probability
    return [gray, gray, gray]
  }
}

/**
 * 创建地图几何体（使用 BufferGeometry 支持增量更新）
 * 
 * 地图坐标系说明（与RViz一致）：
 * - 地图数据按行优先（row-major）存储
 * - 数据索引 i = y * width + x，其中 (x, y) 是地图坐标
 * - 地图原点(0,0)位于左下角
 * - 地图的origin表示地图左下角在世界坐标系中的位置
 * - 在ROS坐标系中，地图位于XY平面（Z=0）
 * - 在THREE.js中，需要旋转到XZ平面（Y=0）
 */
function createMapGeometry(
  width: number,
  height: number,
  resolution: number,
  colorArray: Float32Array
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  // 创建顶点位置
  const vertices: number[] = []
  const indices: number[] = []
  const uvs: number[] = []

  // 地图原点在左下角(0,0)，向右为X正方向，向上为Y正方向
  // 顶点位置从(0,0)开始，不需要偏移到中心
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      // 地图坐标：从(0,0)开始，向右和向上扩展
      const px = x * resolution
      const pz = y * resolution
      vertices.push(px, 0, pz)
      uvs.push(x / width, 1 - y / height) // 翻转 V 坐标以匹配 THREE.js 坐标系
    }
  }

  // 创建索引（每个网格单元由两个三角形组成）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (width + 1) + x
      // 第一个三角形
      indices.push(i, i + width + 1, i + 1)
      // 第二个三角形
      indices.push(i + 1, i + width + 1, i + width + 2)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  // 设置颜色属性（每个顶点一个颜色）
  const vertexCount = (width + 1) * (height + 1)
  if (colorArray.length < vertexCount * 3) {
    // 初始化颜色数组
    colorArray = new Float32Array(vertexCount * 3)
    colorArray.fill(0.5) // 默认灰色
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))

  return geometry
}

/**
 * 增量更新地图颜色（只更新变化的网格单元）
 */
function updateMapColorsIncremental(
  geometry: THREE.BufferGeometry,
  oldData: Int8Array | null,
  newData: Int8Array,
  width: number,
  height: number,
  colorScheme: string
): number {
  const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
  if (!colorAttribute) return 0

  const colorArray = colorAttribute.array as Float32Array
  let changedCount = 0

  // 验证数据长度
  if (newData.length !== width * height) {
    console.warn(`Map data length mismatch: expected ${width * height}, got ${newData.length}`)
    return 0
  }

  // 如果旧数据不存在，需要初始化所有颜色
  if (!oldData || oldData.length !== newData.length) {
    for (let i = 0; i < newData.length; i++) {
      const y = Math.floor(i / width)
      const x = i % width
      
      // 边界检查
      if (y >= height || x >= width) continue
      
      // 每个网格单元有4个顶点（共享），我们更新所有相关顶点
      const occupancy = newData[i] ?? -1
      const color = occupancyToColor(occupancy, colorScheme)
      
      // 更新4个顶点的颜色
      const baseIdx = y * (width + 1) + x
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const idx = (baseIdx + dy * (width + 1) + dx) * 3
          if (idx < colorArray.length) {
            colorArray[idx] = color[0]
            colorArray[idx + 1] = color[1]
            colorArray[idx + 2] = color[2]
          }
        }
      }
    }
    colorAttribute.needsUpdate = true
    return newData.length
  }

  // 增量更新：只更新变化的网格单元
  for (let i = 0; i < newData.length; i++) {
    if (oldData[i] !== newData[i]) {
      const y = Math.floor(i / width)
      const x = i % width
      
      const occupancy = newData[i] ?? -1
      const color = occupancyToColor(occupancy, colorScheme)
      
      // 更新4个顶点的颜色
      const baseIdx = y * (width + 1) + x
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const idx = (baseIdx + dy * (width + 1) + dx) * 3
          if (idx < colorArray.length) {
            colorArray[idx] = color[0]
            colorArray[idx + 1] = color[1]
            colorArray[idx + 2] = color[2]
          }
        }
      }
      changedCount++
    }
  }

  if (changedCount > 0) {
    colorAttribute.needsUpdate = true
  }

  return changedCount
}

/**
 * 更新地图渲染（增量更新版本）
 */
export function updateMapRender(
  context: MapRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent } = context

  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) {
    console.warn('Map: Component not found', componentId)
    return
  }

  // 检查是否已有地图，如果已有地图但没新消息，仍然可以更新配置
  const mapKey = `map_${componentId}`
  const existingMapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined
  
  // 如果没有消息且没有现有地图，无法创建，直接返回
  if ((!message || !message.info || !message.data) && !existingMapMesh) {
    return
  }
  
  // 如果没有新消息但有现有地图，只更新可编辑的配置选项（alpha、drawBehind）
  // 注意：position 和 orientation 是只读参数，只能从消息中读取，不能在没有消息时更新
  if ((!message || !message.info || !message.data) && existingMapMesh) {
    const options = component.options || {}
    const alpha = options.alpha ?? 0.7
    const drawBehind = options.drawBehind ?? false
    
    updateMapConfig(existingMapMesh, alpha, drawBehind)
    return
  }

  // 节流检查（只在有新消息时进行节流，配置更新不受节流限制）
  const now = Date.now()
  const lastUpdate = lastUpdateTime.get(componentId) || 0
  if (message && message.info && message.data && now - lastUpdate < UPDATE_THROTTLE_MS) {
    return // 跳过，还在节流期内
  }
  if (message && message.info && message.data) {
    lastUpdateTime.set(componentId, now)
  }

  const options = component.options || {}
  const alpha = options.alpha ?? 0.7
  const colorScheme = options.colorScheme || 'map'
  const drawBehind = options.drawBehind ?? false

  const mapInfo = message.info
  // 只读参数：只从消息中读取，不允许通过 options 覆盖
  const width = mapInfo.width || 10
  const height = mapInfo.height || 10
  const resolution = mapInfo.resolution || 0.05
  const headerSeq = message.header?.seq || 0

  // 获取地图原点（从消息中的 origin 字段）
  // Position 指的是 ROS 中地图原点坐标 (info.origin.position)
  // 表示地图左下角在世界坐标系中的位置
  // 这些是只读参数，只能从消息中读取，不允许通过 options 覆盖
  const origin = mapInfo.origin || {}
  const originPosition = origin.position || {}  // ROS 地图原点坐标
  const originOrientation = origin.orientation || {}  // ROS 地图原点方向
  
  // 位置：只从 origin.position 读取（只读参数）
  const positionX = originPosition.x ?? 0
  const positionY = originPosition.y ?? 0
  const positionZ = originPosition.z ?? 0
  
  // 方向：只从 origin.orientation 读取（只读参数）
  const orientationX = originOrientation.x ?? 0
  const orientationY = originOrientation.y ?? 0
  const orientationZ = originOrientation.z ?? 0
  const orientationW = originOrientation.w !== undefined ? originOrientation.w : 1

  // 转换数据为 Int8Array（占用值范围：-1 到 100）
  const dataArray = new Int8Array(message.data)

  // 使用已声明的mapKey
  let mapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined

  // 检查数据是否真的变化了
  const cache = mapDataCache.get(componentId)
  const dataChanged = !cache || cache.headerSeq !== headerSeq || cache.width !== width || cache.height !== height
  
  // 检查配置选项是否变化了（即使数据没变化，配置变化也需要更新）
  let configChanged = false
  if (!mapMesh) {
    // 如果地图不存在，需要创建（配置变化）
    configChanged = true
  } else {
    // 检查各个配置选项是否变化
    const material = mapMesh.material instanceof THREE.MeshStandardMaterial ? mapMesh.material : null
    if (material) {
      configChanged = configChanged || material.opacity !== alpha
    }
    configChanged = configChanged || mapMesh.renderOrder !== (drawBehind ? -1 : 0)
    configChanged = configChanged || cache?.colorScheme !== colorScheme
    
    // 检查位置和方向是否变化
    const currentPos = mapMesh.position
    const currentQuat = mapMesh.quaternion
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }
    const expectedPos = convertROSTranslationToThree(rosPosition)
    const expectedQuat = convertROSRotationToThree(rosOrientation)
    
    configChanged = configChanged || 
      !currentPos.equals(expectedPos) || 
      !currentQuat.equals(expectedQuat)
  }

  // 如果数据和配置都没变化，跳过渲染
  if (!dataChanged && !configChanged && mapMesh) {
    return
  }
  
  // 如果只有配置变化但数据没变化，只需要更新配置
  if (!dataChanged && configChanged && mapMesh) {
    // 如果颜色方案变化，需要重新计算颜色
    if (cache?.colorScheme !== colorScheme) {
      const geometry = mapMesh.geometry as THREE.BufferGeometry
      updateMapColorsIncremental(geometry, null, dataArray, width, height, colorScheme)
    }
    // 更新可编辑的配置选项（alpha、drawBehind）
    updateMapConfig(mapMesh, alpha, drawBehind)
    // 更新位置和方向（只读参数，从消息中读取）
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }
    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)
    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)
    // 更新缓存中的颜色方案
    if (cache) {
      cache.colorScheme = colorScheme
    }
    return
  }

  if (!mapMesh) {
    // 创建新地图
    const vertexCount = (width + 1) * (height + 1)
    const colorArray = new Float32Array(vertexCount * 3)
    colorArray.fill(0.5) // 初始化为灰色

    const geometry = createMapGeometry(width, height, resolution, colorArray)
    
    // 更新所有颜色
    updateMapColorsIncremental(geometry, null, dataArray, width, height, colorScheme)

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: alpha,
      side: THREE.DoubleSide
    })

    mapMesh = new THREE.Mesh(geometry, material)
    mapMesh.userData.componentId = componentId

    // ROS 地图在 XY 平面，转换后应该在 THREE.js 的 XZ 平面
    mapMesh.rotation.set(-Math.PI / 2, 0, 0)
    mapMesh.receiveShadow = true

    // 设置位置和方向
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }

    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)

    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)

    if (drawBehind) {
      mapMesh.renderOrder = -1
    }

    scene.add(mapMesh)
    renderObjects.value[mapKey] = mapMesh

    // 保存缓存
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    mapDataCache.set(componentId, {
      width,
      height,
      resolution,
      data: new Int8Array(dataArray),
      colorArray: colorAttribute ? (colorAttribute.array as Float32Array).slice() : new Float32Array(0),
      headerSeq,
      colorScheme
    })
  } else {
    // 更新现有地图
    const geometry = mapMesh.geometry as THREE.BufferGeometry

    // 检查尺寸是否变化
    if (cache && (cache.width !== width || cache.height !== height)) {
      // 尺寸变化，需要重建几何体
      geometry.dispose()
      const vertexCount = (width + 1) * (height + 1)
      const colorArray = new Float32Array(vertexCount * 3)
      const newGeometry = createMapGeometry(width, height, resolution, colorArray)
      updateMapColorsIncremental(newGeometry, null, dataArray, width, height, colorScheme)
      mapMesh.geometry = newGeometry
    } else {
      // 尺寸未变化，检查是否需要更新颜色
      const oldData = cache?.data || null
      const oldColorScheme = cache?.colorScheme || 'map'
      
      // 如果颜色方案变化了，需要重新计算所有颜色
      if (oldColorScheme !== colorScheme) {
        // 颜色方案变化，重新计算所有颜色
        updateMapColorsIncremental(geometry, null, dataArray, width, height, colorScheme)
      } else if (dataChanged) {
        // 数据变化但颜色方案没变，增量更新
        const changedCount = updateMapColorsIncremental(
          geometry,
          oldData,
          dataArray,
          width,
          height,
          colorScheme
        )

        if (changedCount > 0) {
          // 只在有变化时输出日志（调试用）
          // console.log(`Map ${componentId}: Updated ${changedCount} cells`)
        }
      }
    }

    // 更新可编辑的配置选项（alpha、drawBehind）
    updateMapConfig(mapMesh, alpha, drawBehind)
    // 更新位置和方向（只读参数，从消息中读取）
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }
    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)
    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)

    // 更新缓存
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    mapDataCache.set(componentId, {
      width,
      height,
      resolution,
      data: new Int8Array(dataArray),
      colorArray: colorAttribute ? (colorAttribute.array as Float32Array).slice() : new Float32Array(0),
      headerSeq,
      colorScheme
    })
  }
}

/**
 * 更新地图配置选项（不改变几何体和颜色）
 * 注意：position 和 orientation 是只读参数，只能从消息中读取，不能通过此函数更新
 */
function updateMapConfig(
  mapMesh: THREE.Mesh,
  alpha: number,
  drawBehind: boolean
) {
  // 更新材质透明度
  if (mapMesh.material instanceof THREE.MeshStandardMaterial) {
    mapMesh.material.opacity = alpha
  }

  // 更新渲染顺序
  if (drawBehind) {
    mapMesh.renderOrder = -1
  } else {
    mapMesh.renderOrder = 0
  }
}

/**
 * 清理组件的地图数据缓存
 */
export function cleanupMapComponent(componentId: string) {
  mapDataCache.delete(componentId)
  lastUpdateTime.delete(componentId)
}
