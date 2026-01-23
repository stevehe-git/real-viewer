/**
 * LaserScan 渲染器
 * 负责渲染 sensor_msgs/LaserScan 激光扫描数据
 */
import * as THREE from 'three'
import { convertROSTranslationToThree } from '@/services/coordinateConverter'
import { tfManager } from '@/services/tfManager'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface LaserScanRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
  getFixedFrame: () => string
}

/**
 * 计算 ROS 坐标系中的 TF 变换矩阵（从 scanFrame 到 fixedFrame）
 */
function getScanFrameTransformToFixedROS(
  scanFrame: string,
  fixedFrame: string
): THREE.Matrix4 | null {
  if (scanFrame === fixedFrame) {
    return new THREE.Matrix4().identity()
  }

  const transforms = tfManager.getTransforms()

  // 从 scanFrame 向上查找路径到 fixedFrame
  const findPathUp = (current: string, target: string, path: string[]): boolean => {
    if (current === target) {
      path.push(current)
      return true
    }

    // 查找 current 的父节点
    for (const [parent, children] of transforms.entries()) {
      if (children.has(current)) {
        if (findPathUp(parent, target, path)) {
          path.push(current)
          return true
        }
      }
    }
    return false
  }

  const path: string[] = []
  if (findPathUp(scanFrame, fixedFrame, path)) {
    // 累积变换矩阵：从 scanFrame 到 fixedFrame（在 ROS 坐标系中）
    let transformMatrix = new THREE.Matrix4().identity()

    // path[0] 是 fixedFrame，path[path.length-1] 是 scanFrame
    // 我们需要从 scanFrame 开始向上累积变换到 fixedFrame
    for (let i = path.length - 1; i > 0; i--) {
      const child = path[i]      // 当前坐标系
      const parent = path[i - 1] // 父坐标系

      if (!child || !parent) continue

      const parentTransforms = transforms.get(parent)
      if (!parentTransforms) continue

      const transform = parentTransforms.get(child)
      if (!transform || !transform.translation || !transform.rotation) continue

      // ✅ 在 ROS 坐标系中构建变换矩阵（不进行坐标系统转换）
      const rosPosition = new THREE.Vector3(
        transform.translation.x,
        transform.translation.y,
        transform.translation.z
      )
      const rosQuat = new THREE.Quaternion(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        transform.rotation.w
      )

      const localTransform = new THREE.Matrix4()
      localTransform.compose(rosPosition, rosQuat, new THREE.Vector3(1, 1, 1))

      // 从右向左累积变换（THREE.js矩阵乘法）
      transformMatrix = localTransform.multiply(transformMatrix)
    }

    return transformMatrix
  }

  console.warn(`LaserScan: Could not find TF path from ${scanFrame} to ${fixedFrame}`)
  return null
}

/**
 * 生成颜色数组
 */
function generateColors(
  pointIntensities: number[],
  colorTransformer: string,
  intensityRange: number,
  finalMinIntensity: number,
  options: any
): THREE.Color[] {
  const colors: THREE.Color[] = []
  const useRainbow = options.useRainbow ?? true

  for (let i = 0; i < pointIntensities.length; i++) {
    let color: THREE.Color

    if (colorTransformer === 'Intensity') {
      const intensity = pointIntensities[i] || 0
      const normalizedIntensity = intensityRange > 0 
        ? Math.max(0, Math.min(1, (intensity - finalMinIntensity) / intensityRange))
        : 0

      if (useRainbow) {
        // 彩虹色映射：从红色到紫色
        const invertRainbow = options.invertRainbow ?? false
        const hueValue = invertRainbow 
          ? normalizedIntensity * 0.7 
          : (1 - normalizedIntensity) * 0.7
        color = new THREE.Color().setHSL(hueValue, 1, 0.5)
      } else {
        // 线性插值：从 minColor 到 maxColor
        const minColor = options.minColor || { r: 0, g: 0, b: 0 }
        const maxColor = options.maxColor || { r: 255, g: 255, b: 255 }
        const r = (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255
        const g = (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255
        const b = (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255
        color = new THREE.Color(r, g, b)
      }
    } else {
      // 默认红色（Flat 模式）
      color = new THREE.Color(0xff0000)
    }

    colors.push(color)
  }

  return colors
}

/**
 * 更新激光扫描渲染
 */
export function updateLaserScanRender(
  context: LaserScanRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent, getFixedFrame } = context
  
  if (!message || !message.ranges || message.ranges.length === 0) {
    console.warn('LaserScan: Message is null or has no ranges', { componentId, hasMessage: !!message, rangesLength: message?.ranges?.length })
    return
  }

  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) {
    console.warn('LaserScan: Component not found', componentId)
    return
  }

  const options = component.options || {}
  const style = options.style || 'Flat Squares'
  const size = options.size || 0.01
  const alpha = options.alpha ?? 1
  const colorTransformer = options.colorTransformer || 'Intensity'
  const useRainbow = options.useRainbow ?? true
  const minIntensity = options.minIntensity ?? 0
  const maxIntensity = options.maxIntensity ?? 0
  const autocomputeIntensityBounds = options.autocomputeIntensityBounds ?? true

  // 解析 LaserScan 数据
  const ranges = message.ranges || []
  const intensities = message.intensities || []
  const angleMin = message.angle_min || 0
  const angleIncrement = message.angle_increment || 0
  const rangeMin = message.range_min || 0
  const rangeMax = message.range_max || 0

  if (ranges.length === 0 || angleIncrement === 0) return

  // 获取 LaserScan 的 frame_id 和 fixedFrame
  const scanFrame = message.header?.frame_id || 'base_scan'
  const fixedFrame = getFixedFrame()

  // console.log(`LaserScan: Processing scan in frame "${scanFrame}", fixed frame is "${fixedFrame}"`)

  // 计算 ROS 坐标系中的 TF 变换矩阵
  const scanToFixedTransformROS = getScanFrameTransformToFixedROS(scanFrame, fixedFrame)

  if (scanToFixedTransformROS) {
    // console.log(`LaserScan: Found TF transform from ${scanFrame} to ${fixedFrame}`)
  } else {
    console.warn(`LaserScan: No TF transform found from ${scanFrame} to ${fixedFrame}. Point cloud will not be transformed.`)
  }

  // 创建点云数据（先在 ROS 坐标系中应用 TF 变换，再转换为 THREE.js 坐标）
  const points: THREE.Vector3[] = []
  const pointIntensities: number[] = []
  let intensityMin = Infinity
  let intensityMax = -Infinity

  // 第一遍：计算点位置和强度范围
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]
    
    // 过滤无效范围
    if (!range || range < rangeMin || range > rangeMax || !isFinite(range)) {
      continue
    }

    const angle = angleMin + i * angleIncrement
    // ✅ 步骤 1: 极坐标转换 → ROS 坐标
    const rosX = range * Math.cos(angle)
    const rosY = range * Math.sin(angle)
    const rosZ = 0
    
    // ✅ 步骤 2: 在 ROS 坐标系中应用 TF 变换
    let rosPoint = new THREE.Vector3(rosX, rosY, rosZ)
    if (scanToFixedTransformROS) {
      rosPoint.applyMatrix4(scanToFixedTransformROS)
    }
    
    // ✅ 步骤 3: ROS → THREE.js 坐标转换
    const threePosition = convertROSTranslationToThree({ 
      x: rosPoint.x, 
      y: rosPoint.y, 
      z: rosPoint.z 
    })
    points.push(threePosition)

    // 获取对应的强度值
    const intensity = (intensities.length > i && intensities[i] !== undefined) ? intensities[i] : 0
    pointIntensities.push(intensity)

    // 计算强度范围（如果需要自动计算）
    if (colorTransformer === 'Intensity' && autocomputeIntensityBounds) {
      intensityMin = Math.min(intensityMin, intensity)
      intensityMax = Math.max(intensityMax, intensity)
    }
  }

  if (points.length === 0) {
    console.warn('LaserScan: No valid points after filtering', { componentId, rangesLength: ranges.length })
    return
  }

  // 计算强度边界
  const finalMinIntensity = autocomputeIntensityBounds ? intensityMin : minIntensity
  const finalMaxIntensity = autocomputeIntensityBounds ? intensityMax : maxIntensity
  const intensityRange = finalMaxIntensity - finalMinIntensity || 1

  // 生成颜色
  const colors = generateColors(pointIntensities, colorTransformer, intensityRange, finalMinIntensity, options)

  // 创建或更新渲染对象
  let laserscanGroup = renderObjects.value.laserscanGroup
  if (!laserscanGroup) {
    laserscanGroup = new THREE.Group()
    renderObjects.value.laserscanGroup = laserscanGroup
    scene.add(laserscanGroup)
  }

  // 移除旧的该组件的点云
  const oldPoints = laserscanGroup.children.find(child => child.userData.componentId === componentId)
  if (oldPoints) {
    laserscanGroup.remove(oldPoints)
    if ('geometry' in oldPoints && oldPoints.geometry) oldPoints.geometry.dispose()
    if ('material' in oldPoints && oldPoints.material) {
      if (Array.isArray(oldPoints.material)) {
        oldPoints.material.forEach((mat: any) => mat.dispose())
      } else {
        oldPoints.material.dispose()
      }
    }
  }

  // 根据样式创建点云
  if (style === 'Flat Squares' || style === 'Points') {
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const colorArray = new Float32Array(points.length * 3)
    colors.forEach((color, i) => {
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    })
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

    const useSizeAttenuation = style === 'Flat Squares'
    const pointSize = useSizeAttenuation ? size : Math.max(size * 100, 2)

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      transparent: true,
      opacity: alpha,
      sizeAttenuation: useSizeAttenuation
    })

    const pointsObject = new THREE.Points(geometry, material)
    pointsObject.userData.componentId = componentId
    
    laserscanGroup.add(pointsObject)
  } else if (style === 'Billboards') {
    const sprites: THREE.Sprite[] = []
    colors.forEach((color, i) => {
      const spriteMaterial = new THREE.SpriteMaterial({
        color: color,
        transparent: true,
        opacity: alpha
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.copy(points[i])
      sprite.scale.set(size, size, 1)
      sprite.userData.componentId = componentId
      sprites.push(sprite)
    })

    const spriteGroup = new THREE.Group()
    spriteGroup.userData.componentId = componentId
    sprites.forEach(sprite => spriteGroup.add(sprite))
    
    laserscanGroup.add(spriteGroup)
  } else {
    // 默认使用 Points
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const colorArray = new Float32Array(points.length * 3)
    colors.forEach((color, i) => {
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    })
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

    const material = new THREE.PointsMaterial({
      size: Math.max(size * 100, 2),
      vertexColors: true,
      transparent: true,
      opacity: alpha,
      sizeAttenuation: false
    })

    const pointsObject = new THREE.Points(geometry, material)
    pointsObject.userData.componentId = componentId
    
    laserscanGroup.add(pointsObject)
  }
}
