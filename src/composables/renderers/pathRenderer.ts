/**
 * Path 渲染器
 * 负责渲染 nav_msgs/Path 路径数据
 */
import * as THREE from 'three'
import { convertROSTranslationToThree } from '@/services/coordinateConverter'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface PathRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
}

/**
 * 更新路径渲染
 */
export function updatePathRender(
  context: PathRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent } = context
  
  if (!message || !message.poses || message.poses.length === 0) {
    // 如果没有数据，隐藏路径线
    if (renderObjects.value.pathLine) {
      renderObjects.value.pathLine.visible = false
    }
    return
  }

  // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
  const points = message.poses.map((pose: any) => {
    const position = pose.pose?.position || pose.position || {}
    const rosX = position.x || 0
    const rosY = position.y || 0
    const rosZ = position.z || 0.1
    
    // 转换到 THREE.js 坐标系：ROS(x, y, z) → THREE.js(x, z, -y)
    return convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
  })

  if (points.length === 0) {
    // 如果没有有效点，隐藏路径线
    if (renderObjects.value.pathLine) {
      renderObjects.value.pathLine.visible = false
    }
    return
  }

  // 获取组件配置
  const component = getComponent(componentId)
  const options = component?.options || {}
  const color = options.color || '#ff0000'
  const lineWidth = options.lineWidth || 2

  // 如果路径线不存在，创建它
  if (!renderObjects.value.pathLine) {
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
    const pathMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(color), 
      linewidth: lineWidth 
    })
    renderObjects.value.pathLine = new THREE.Line(pathGeometry, pathMaterial)
    renderObjects.value.pathLine.visible = false // ✅ 默认不可见，只有在组件启用且有数据时才显示
    scene.add(renderObjects.value.pathLine)
  } else {
    // 更新路径点
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
    renderObjects.value.pathLine.geometry.dispose()
    renderObjects.value.pathLine.geometry = pathGeometry
    
    // 更新颜色和线宽
    if (renderObjects.value.pathLine.material instanceof THREE.LineBasicMaterial) {
      renderObjects.value.pathLine.material.color = new THREE.Color(color)
      renderObjects.value.pathLine.material.linewidth = lineWidth
    }
  }
  
  // ✅ 只有在组件启用时才显示路径
  if (component?.enabled) {
    renderObjects.value.pathLine.visible = true
  }
}
