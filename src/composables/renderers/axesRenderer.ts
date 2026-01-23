/**
 * Axes 渲染器
 * 负责渲染坐标系轴可视化
 */
import * as THREE from 'three'
import { convertROSTranslationToThree, convertROSRotationToThree, createROSAxes } from '@/services/coordinateConverter'
import { tfManager } from '@/services/tfManager'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface AxesRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
  getFixedFrame: () => string
}

/**
 * 计算从 frameName 到 fixedFrame 的变换矩阵
 */
function getFrameTransformToFixed(
  frameName: string,
  fixedFrame: string
): THREE.Matrix4 | null {
  if (frameName === fixedFrame) {
    return new THREE.Matrix4().identity()
  }

  const transforms = tfManager.getTransforms()
  
  // 从 frameName 向上查找路径到 fixedFrame
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
  if (findPathUp(frameName, fixedFrame, path)) {
    // 累积变换矩阵：从 frameName 到 fixedFrame
    let transformMatrix = new THREE.Matrix4().identity()

    // path[0] 是 fixedFrame，path[path.length-1] 是 frameName
    // 我们需要从 frameName 开始向上累积变换到 fixedFrame
    for (let i = path.length - 1; i > 0; i--) {
      const child = path[i]      // 当前坐标系
      const parent = path[i - 1] // 父坐标系

      if (!child || !parent) continue

      const parentTransforms = transforms.get(parent)
      if (!parentTransforms) continue

      const transform = parentTransforms.get(child)
      if (!transform || !transform.translation || !transform.rotation) continue

      // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
      const position = convertROSTranslationToThree(transform.translation)
      const quaternion = convertROSRotationToThree(transform.rotation)

      const localTransform = new THREE.Matrix4()
      localTransform.compose(position, quaternion, new THREE.Vector3(1, 1, 1))

      // 从右向左累积变换（THREE.js矩阵乘法）
      transformMatrix = localTransform.multiply(transformMatrix)
    }

    return transformMatrix
  }

  console.warn(`Axes: Could not find TF path from ${frameName} to ${fixedFrame}`)
  return null
}

/**
 * 更新 Axes 渲染
 */
export function updateAxesRender(
  context: AxesRendererContext,
  componentId: string
) {
  const { scene, renderObjects, getComponent, getFixedFrame } = context
  
  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) return

  const options = component.options || {}
  const referenceFrame = options.referenceFrame || getFixedFrame()
  const length = options.length ?? 1
  const radius = options.radius ?? 0.1
  const alpha = options.alpha ?? 1

  // 创建或获取 Axes 组
  let axesGroup = renderObjects.value.axesGroup
  if (!axesGroup) {
    axesGroup = new THREE.Group()
    axesGroup.name = 'Axes_Group'
    renderObjects.value.axesGroup = axesGroup
    scene.add(axesGroup)
  }

  // 查找或创建该组件的 axes 对象
  let axesObject = axesGroup.children.find(
    child => child.userData.componentId === componentId
  ) as THREE.Group | undefined

  if (!axesObject) {
    axesObject = new THREE.Group()
    axesObject.name = `Axes_${componentId}`
    axesObject.userData.componentId = componentId
    axesGroup.add(axesObject)
  }

  // 清理旧的坐标轴
  const oldAxes = [...axesObject.children]
  oldAxes.forEach(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      if (child.material instanceof THREE.Material) {
        child.material.dispose()
      }
    }
    axesObject!.remove(child)
  })

  // 获取固定帧
  const fixedFrame = getFixedFrame()

  // 计算 referenceFrame 相对于固定帧的变换
  const transform = getFrameTransformToFixed(referenceFrame, fixedFrame)
  
  if (transform) {
    // 提取位置和旋转
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    transform.decompose(position, quaternion, scale)

    // 设置 axes 的位置和旋转
    axesObject.position.copy(position)
    axesObject.quaternion.copy(quaternion)
  } else {
    // 如果找不到变换，设置为原点
    axesObject.position.set(0, 0, 0)
    axesObject.quaternion.set(0, 0, 0, 1)
  }

  // 使用统一的坐标轴创建函数（确保与TF、Grid等组件一致）
  const rosAxes = createROSAxes(length, radius)
  
  // 应用透明度
  rosAxes.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (child.material instanceof THREE.MeshBasicMaterial) {
        child.material.transparent = true
        child.material.opacity = alpha
      }
    }
  })
  
  axesObject.add(rosAxes)

  // TODO: 实现 Show Trail 功能（如果需要）
}
