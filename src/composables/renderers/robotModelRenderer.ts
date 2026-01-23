/**
 * RobotModel 渲染器
 * 负责渲染 URDF 机器人模型
 */
import * as THREE from 'three'
import { urdfLoaderService } from '@/services/urdfLoader'
import type { RobotModel } from '@/services/urdfLoader'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface RobotModelRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
  getROSInstance: () => any
}

/**
 * 更新 RobotModel 渲染
 */
export async function updateRobotModelRender(
  context: RobotModelRendererContext,
  componentId: string
) {
  const { scene, renderObjects, getComponent, getROSInstance } = context
  
  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) {
    console.warn('RobotModel: Component not found', componentId)
    return
  }

  const options = component.options || {}
  const urdfParameter = options.urdfParameter || 'robot_description'
  const urdfFileUrl = options.urdfFileUrl || ''
  const visualEnabled = options.visualEnabled !== false // 默认启用
  const collisionEnabled = options.collisionEnabled || false
  const alpha = options.alpha ?? 1
  const packages = options.packages || {}

  // 创建或获取 RobotModel 组
  let robotModelGroup = renderObjects.value.robotModelGroup
  if (!robotModelGroup) {
    robotModelGroup = new THREE.Group()
    robotModelGroup.name = 'RobotModel_Group'
    renderObjects.value.robotModelGroup = robotModelGroup
    scene.add(robotModelGroup)
  }

  // 初始化 robotModels Map
  if (!renderObjects.value.robotModels) {
    renderObjects.value.robotModels = new Map()
  }

  // 移除旧的该组件的机器人模型
  const oldModel = renderObjects.value.robotModels.get(componentId)
  if (oldModel) {
    robotModelGroup.remove(oldModel.scene)
    renderObjects.value.robotModels.delete(componentId)
  }

  try {
    let robotModel: RobotModel | null = null

    // 优先从文件 URL 加载，否则从 ROS 参数加载
    if (urdfFileUrl) {
      robotModel = await urdfLoaderService.loadURDF(urdfFileUrl, {
        packages,
        showVisual: visualEnabled,
        showCollision: collisionEnabled
      })
    } else {
      // 从 ROS 参数加载（需要 ROS 连接）
      const ros = getROSInstance()
      if (ros) {
        robotModel = await urdfLoaderService.loadURDFFromROSParam(
          ros,
          urdfParameter,
          {
            packages,
            showVisual: visualEnabled,
            showCollision: collisionEnabled
          }
        )
      } else {
        console.warn('RobotModel: No ROS connection available. Please provide URDF File URL or connect to ROS.')
        return
      }
    }

    if (!robotModel) {
      console.warn('RobotModel: Failed to load robot model')
      return
    }

    // 应用透明度
    robotModel.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            if (mat instanceof THREE.Material) {
              mat.transparent = true
              mat.opacity = alpha
            }
          })
        } else if (child.material instanceof THREE.Material) {
          child.material.transparent = true
          child.material.opacity = alpha
        }
      }
    })

    // 设置组件 ID
    robotModel.scene.userData.componentId = componentId

    // 添加到场景
    robotModelGroup.add(robotModel.scene)

    // 存储模型引用
    renderObjects.value.robotModels!.set(componentId, robotModel)

    // 设置可见性
    robotModel.scene.visible = component.enabled

    console.log('RobotModel: Loaded successfully', {
      componentId,
      jointsCount: robotModel.joints.size,
      linksCount: robotModel.links.size
    })
  } catch (error) {
    console.error('RobotModel: Error loading robot model', error)
  }
}
