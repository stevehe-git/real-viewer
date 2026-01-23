/**
 * 3D 渲染 composable
 * 负责将数据渲染到 THREE.js 场景中
 * 分离业务逻辑和 UI 代码
 * 
 * 重构说明：
 * - 按功能模块拆分渲染器到 renderers/ 目录
 * - 主文件负责组合和协调所有渲染器
 * - 提供统一的接口和上下文
 */
import * as THREE from 'three'
import { ref } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { DataConverter } from '@/services/dataConverter'
import { TFRenderer } from '@/services/tfRenderer'
import {
  updateMapRender,
  updatePathRender,
  updateLaserScanRender,
  updatePointCloudRender,
  updateAxesRender,
  updateTFRender,
  updateRobotModelRender,
  cleanupMapComponent
} from './renderers'
import type { RobotModel } from '@/services/urdfLoader'

export interface RendererObjects {
  mapMesh?: THREE.Mesh
  pathLine?: THREE.Line
  laserscanMesh?: THREE.Mesh
  laserscanPoints?: THREE.Points
  laserscanGroup?: THREE.Group // 支持多个 LaserScan 组件
  pointcloudMesh?: THREE.Mesh
  pointcloudPoints?: THREE.Points
  pointcloudGroup?: THREE.Group // 支持多个 PointCloud2 组件
  tfGroup?: THREE.Group // TF 可视化组
  axesGroup?: THREE.Group // 支持多个 Axes 组件
  robotModelGroup?: THREE.Group // 支持多个 RobotModel 组件
  robotModels?: Map<string, RobotModel> // 存储每个组件的机器人模型
  [key: string]: any
}

/**
 * 3D 渲染器 composable
 */
export function use3DRenderer(scene: THREE.Scene) {
  const rvizStore = useRvizStore()
  const renderObjects = ref<RendererObjects>({})
  
  // TF 渲染器实例（单例，在场景中共享）
  let tfRenderer: TFRenderer | null = null

  /**
   * 获取组件配置
   */
  const getComponent = (componentId: string) => {
    return rvizStore.displayComponents.find(c => c.id === componentId)
  }

  /**
   * 获取固定帧
   */
  const getFixedFrame = () => {
    return rvizStore.globalOptions.fixedFrame || 'map'
  }

  /**
   * 获取 ROS 实例
   */
  const getROSInstance = () => {
        if (rvizStore.robotConnection.connected && rvizStore.robotConnection.protocol === 'ros') {
          const rosPlugin = rvizStore.getPlugin('ros')
          if (rosPlugin && typeof (rosPlugin as any).getROSInstance === 'function') {
        return (rosPlugin as any).getROSInstance()
      }
    }
      return null
  }

  /**
   * 设置 TF 渲染器
   */
  const setTFRenderer = (renderer: TFRenderer | null) => {
    tfRenderer = renderer
  }

  /**
   * 更新组件渲染
   */
  const updateComponentRender = (componentId: string, componentType: string, message: any) => {
    if (!message) return

    // 使用数据转换器转换数据
    const unifiedMessage = DataConverter.convert(message, componentType, 'ros')
    if (!unifiedMessage) return

    // console.log(`Renderer: Updating component ${componentType} ${componentId}`)

    // 根据组件类型调用相应的渲染函数
    switch (componentType) {
      case 'map':
        updateMapRender(
          { scene, renderObjects, getComponent },
          componentId,
          unifiedMessage.data
        )
        break
      case 'path':
        updatePathRender(
          { scene, renderObjects, getComponent },
          componentId,
          unifiedMessage.data
        )
        break
      case 'laserscan':
        updateLaserScanRender(
          { scene, renderObjects, getComponent, getFixedFrame },
          componentId,
          unifiedMessage.data
        )
        break
      case 'pointcloud2':
        updatePointCloudRender(
          { scene, renderObjects, getComponent },
          componentId,
          unifiedMessage.data
        )
        break
      case 'tf':
        updateTFRender(
          { scene, renderObjects, getComponent, getFixedFrame, tfRenderer, setTFRenderer },
          componentId
        )
        break
      case 'axes':
        updateAxesRender(
          { scene, renderObjects, getComponent, getFixedFrame },
          componentId
        )
        break
      case 'robotmodel':
        updateRobotModelRender(
          { scene, renderObjects, getComponent, getROSInstance },
          componentId
        )
        break
      default:
        break
    }
  }

  /**
   * 设置组件可见性
   */
  const setComponentVisibility = (componentType: string, visible: boolean, componentId?: string) => {
    switch (componentType) {
      case 'map':
        if (componentId) {
          // 设置特定组件的可见性
          const mapKey = `map_${componentId}`
          const mapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined
          if (mapMesh) {
            mapMesh.visible = visible
          }
        } else {
          // 设置所有 Map 组件的可见性
          Object.keys(renderObjects.value).forEach(key => {
            if (key.startsWith('map_')) {
              const mapMesh = renderObjects.value[key] as THREE.Mesh | undefined
              if (mapMesh) {
                mapMesh.visible = visible
              }
            }
          })
        }
        break
      case 'path':
        // ✅ 路径可见性由 updatePathRender 控制，这里只处理隐藏的情况
        if (renderObjects.value.pathLine && !visible) {
          renderObjects.value.pathLine.visible = false
        }
        break
      case 'laserscan':
        if (renderObjects.value.laserscanGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.laserscanGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.laserscanGroup) {
          // 设置所有 LaserScan 的可见性
          renderObjects.value.laserscanGroup.visible = visible
        }
        break
      case 'pointcloud2':
        if (renderObjects.value.pointcloudGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.pointcloudGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.pointcloudGroup) {
          // 设置所有 PointCloud2 的可见性
          renderObjects.value.pointcloudGroup.visible = visible
        }
        break
      case 'axes':
        if (renderObjects.value.axesGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.axesGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.axesGroup) {
          // 设置所有 Axes 的可见性
          renderObjects.value.axesGroup.visible = visible
        }
        break
      case 'robotmodel':
        if (renderObjects.value.robotModelGroup && componentId) {
          // 设置特定组件的可见性
          const robotModel = renderObjects.value.robotModels?.get(componentId)
          if (robotModel) {
            robotModel.scene.visible = visible
          }
        } else if (renderObjects.value.robotModelGroup) {
          // 设置所有 RobotModel 的可见性
          renderObjects.value.robotModelGroup.visible = visible
        }
        break
      default:
        break
    }
  }

  /**
   * 移除单个组件的渲染对象
   */
  const removeComponentRender = (componentId: string, componentType: string) => {
    switch (componentType) {
      case 'map': {
        const mapKey = `map_${componentId}`
        const mapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined
        if (mapMesh) {
          // 清理几何体和材质
          if (mapMesh.geometry) {
            mapMesh.geometry.dispose()
          }
          if (mapMesh.material) {
            if (Array.isArray(mapMesh.material)) {
              mapMesh.material.forEach((mat: any) => mat.dispose())
            } else {
              mapMesh.material.dispose()
            }
          }
          // 从场景中移除
          if (mapMesh.parent) {
            mapMesh.parent.remove(mapMesh)
          } else {
            scene.remove(mapMesh)
          }
          // 从 renderObjects 中移除
          delete renderObjects.value[mapKey]
        }
        // 清理地图数据缓存
        cleanupMapComponent(componentId)
        break
      }
      default:
        // 其他类型的组件清理可以在这里添加
        break
    }
  }

  /**
   * 清理渲染对象
   */
  const cleanup = () => {
    // 清理 TF 渲染器
    if (tfRenderer) {
      tfRenderer.dispose()
      tfRenderer = null
    }

    // 清理所有渲染对象
    Object.values(renderObjects.value).forEach((obj) => {
      if (obj && 'geometry' in obj && obj.geometry) {
        obj.geometry.dispose()
      }
      if (obj && 'material' in obj && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat: any) => mat.dispose())
        } else {
          obj.material.dispose()
        }
      }
      if (obj && scene) {
        scene.remove(obj as THREE.Object3D)
      }
    })
    renderObjects.value = {}
  }

  return {
    renderObjects,
    updateComponentRender,
    setComponentVisibility,
    removeComponentRender,
    cleanup
  }
}
