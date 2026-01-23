/**
 * PointCloud2 渲染器
 * 负责渲染 sensor_msgs/PointCloud2 点云数据
 */
import * as THREE from 'three'
import { convertROSTranslationToThree } from '@/services/coordinateConverter'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface PointCloudRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
}

/**
 * 从字节数组中读取 Float32
 */
function readFloat32(data: Uint8Array, offset: number): number {
  try {
    if (offset + 4 > data.length) {
      return 0
    }
    const view = new DataView(data.buffer, data.byteOffset + offset, 4)
    return view.getFloat32(0, true) // little endian
  } catch (error) {
    console.error('Error reading Float32:', error, { offset, dataLength: data.length })
    return 0
  }
}

/**
 * 从字节数组中读取 Uint32
 */
function readUint32(data: Uint8Array, offset: number): number {
  try {
    if (offset + 4 > data.length) {
      return 0
    }
    const view = new DataView(data.buffer, data.byteOffset + offset, 4)
    return view.getUint32(0, true) // little endian
  } catch (error) {
    console.error('Error reading Uint32:', error, { offset, dataLength: data.length })
    return 0
  }
}

/**
 * 更新点云渲染
 */
export function updatePointCloudRender(
  context: PointCloudRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent } = context
  
  if (!message) {
    console.warn('PointCloud2: Message is null or undefined')
    return
  }

  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) {
    console.warn('PointCloud2: Component not found', componentId)
    return
  }

  const options = component.options || {}
  const size = options.size || 0.01
  const alpha = options.alpha ?? 1
  const colorTransformer = options.colorTransformer || 'RGB'
  const useRainbow = options.useRainbow ?? true

  // 解析 PointCloud2 数据
  const fields = message.fields || []
  const height = message.height || 1
  const width = message.width || 0
  const pointStep = message.point_step || 0
  let data = message.data || []

  // 确保 data 是 Uint8Array
  if (Array.isArray(data)) {
    data = new Uint8Array(data)
  } else if (!(data instanceof Uint8Array)) {
    console.warn('PointCloud2: Invalid data format', typeof data)
    return
  }

  if (data.length === 0 || pointStep === 0) {
    console.warn('PointCloud2: Empty data or invalid point_step', { dataLength: data.length, pointStep })
    return
  }

  console.log('PointCloud2: Processing point cloud', {
    componentId,
    width,
    height,
    pointStep,
    dataLength: data.length,
    fields: fields.map((f: any) => f.name)
  })

  // 查找字段索引
  const findField = (name: string) => {
    return fields.findIndex((f: any) => f.name === name)
  }

  const xIndex = findField('x')
  const yIndex = findField('y')
  const zIndex = findField('z')
  const rgbIndex = findField('rgb')
  const intensityIndex = findField('intensity')

  // 检查必需字段
  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    console.warn('PointCloud2: Missing required fields (x, y, z)')
    return
  }

  // 获取字段偏移和数据类型
  const getFieldOffset = (fieldIndex: number) => {
    if (fieldIndex === -1) return -1
    return fields[fieldIndex].offset || 0
  }

  const xOffset = getFieldOffset(xIndex)
  const yOffset = getFieldOffset(yIndex)
  const zOffset = getFieldOffset(zIndex)
  const rgbOffset = getFieldOffset(rgbIndex)
  const intensityOffset = getFieldOffset(intensityIndex)

  // 解析点云数据
  const points: THREE.Vector3[] = []
  const pointIntensities: number[] = []
  let intensityMin = Infinity
  let intensityMax = -Infinity

  // 计算点数量
  const pointCount = width * height || Math.floor(data.length / pointStep)

  // 第一遍：解析点位置和强度
  for (let i = 0; i < pointCount; i++) {
    const pointOffset = i * pointStep

    // 检查边界
    if (pointOffset + Math.max(xOffset, yOffset, zOffset) + 4 > data.length) {
      break
    }

    // 读取 ROS 坐标系中的 x, y, z 坐标
    const rosX = readFloat32(data, pointOffset + xOffset)
    const rosY = readFloat32(data, pointOffset + yOffset)
    const rosZ = readFloat32(data, pointOffset + zOffset)

    // 过滤无效点（NaN 或 Infinity）
    if (!isFinite(rosX) || !isFinite(rosY) || !isFinite(rosZ)) {
      continue
    }

    // ✅ 使用统一的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
    const threePosition = convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
    points.push(threePosition)

    // 获取强度值（如果存在）
    if (intensityOffset !== -1 && pointOffset + intensityOffset + 4 <= data.length) {
      const intensity = readFloat32(data, pointOffset + intensityOffset)
      pointIntensities.push(intensity)
      if (colorTransformer === 'Intensity') {
        intensityMin = Math.min(intensityMin, intensity)
        intensityMax = Math.max(intensityMax, intensity)
      }
    } else {
      pointIntensities.push(0)
    }
  }

  if (points.length === 0) {
    console.warn('PointCloud2: No valid points found')
    return
  }

  // 计算强度范围
  const intensityRange = intensityMax - intensityMin || 1

  // 生成颜色
  const colors: THREE.Color[] = []
  for (let i = 0; i < points.length; i++) {
    let color: THREE.Color

    if (colorTransformer === 'RGB' && rgbOffset !== -1) {
      // 从 RGB 字段读取颜色
      const pointOffset = i * pointStep
      if (pointOffset + rgbOffset + 4 <= data.length) {
        const rgb = readUint32(data, pointOffset + rgbOffset)
        // PointCloud2 中 RGB 通常存储为 uint32，格式可能是 RGB 或 BGR
        const r = (rgb >> 16) & 0xff
        const g = (rgb >> 8) & 0xff
        const b = rgb & 0xff
        color = new THREE.Color(r / 255, g / 255, b / 255)
      } else {
        color = new THREE.Color(0xff0000)
      }
    } else if (colorTransformer === 'Intensity' && pointIntensities.length > i) {
      // 从强度字段读取颜色
      const intensity = pointIntensities[i] || 0
      const normalizedIntensity = intensityRange > 0
        ? Math.max(0, Math.min(1, (intensity - intensityMin) / intensityRange))
        : 0

      if (useRainbow) {
        // 彩虹色映射
        const hue = (1 - normalizedIntensity) * 0.7
        color = new THREE.Color().setHSL(hue, 1, 0.5)
      } else {
        // 线性插值
        const minColor = options.minColor || { r: 0, g: 0, b: 0 }
        const maxColor = options.maxColor || { r: 255, g: 255, b: 255 }
        const r = (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255
        const g = (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255
        const b = (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255
        color = new THREE.Color(r, g, b)
      }
    } else {
      // 默认颜色
      color = new THREE.Color(0xff0000)
    }

    colors.push(color)
  }

  // 创建或更新渲染对象
  let pointcloudGroup = renderObjects.value.pointcloudGroup
  if (!pointcloudGroup) {
    pointcloudGroup = new THREE.Group()
    renderObjects.value.pointcloudGroup = pointcloudGroup
    scene.add(pointcloudGroup)
  }

  // 移除旧的该组件的点云
  const oldPoints = pointcloudGroup.children.find(child => child.userData.componentId === componentId)
  if (oldPoints) {
    pointcloudGroup.remove(oldPoints)
    if ('geometry' in oldPoints && oldPoints.geometry) oldPoints.geometry.dispose()
    if ('material' in oldPoints && oldPoints.material) {
      if (Array.isArray(oldPoints.material)) {
        oldPoints.material.forEach((mat: any) => mat.dispose())
      } else {
        oldPoints.material.dispose()
      }
    }
  }

  // 创建点云几何体
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const colorArray = new Float32Array(points.length * 3)
  colors.forEach((color, i) => {
    colorArray[i * 3] = color.r
    colorArray[i * 3 + 1] = color.g
    colorArray[i * 3 + 2] = color.b
  })
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

  // 创建材质
  const material = new THREE.PointsMaterial({
    size: size,
    vertexColors: true,
    transparent: true,
    opacity: alpha,
    sizeAttenuation: true // 点云通常需要距离衰减
  })

  const pointsObject = new THREE.Points(geometry, material)
  pointsObject.userData.componentId = componentId
  
  pointcloudGroup.add(pointsObject)

  console.log('PointCloud2: Rendered point cloud', {
    componentId,
    pointCount: points.length,
    colorTransformer,
    useRainbow
  })
}
