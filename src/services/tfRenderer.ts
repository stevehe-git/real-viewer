/**
 * TF 坐标系渲染服务（重构版）
 * 
 * 核心设计原则（参考RViz）：
 * 1. 所有frames都是rootGroup的直接子节点（扁平化结构）
 * 2. 每个frame计算相对于fixed frame的绝对变换
 * 3. 不重建树结构，直接使用矩阵变换计算位置
 * 4. 简化逻辑，避免复杂的树重建
 */

import * as THREE from 'three'
import { createROSAxes } from './coordinateConverter'
import type { TransformFrame } from './tfManager'
import { tfManager } from './tfManager'

/**
 * TF Frame 的 THREE.js 表示
 */
export interface TFFrameObject {
  group: THREE.Group
  name: string
  axes?: THREE.Group
  label?: THREE.Sprite
}

/**
 * TF 渲染器类
 * 负责将 ROS TF 数据转换为 THREE.js 场景对象
 */
export class TFRenderer {
  private scene: THREE.Scene
  public rootGroup: THREE.Group
  private frameObjects = new Map<string, TFFrameObject>()
  private fixedFrame: string = 'map'

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.rootGroup = new THREE.Group()
    this.rootGroup.name = 'TF_Root'
    this.scene.add(this.rootGroup)
  }

  /**
   * 设置固定帧（Fixed Frame）
   */
  setFixedFrame(frameName: string) {
    if (this.fixedFrame !== frameName) {
      this.fixedFrame = frameName
      // 重新计算所有frames的位置
      this.updateAllFramePositions()
    }
  }

  /**
   * 构建或更新所有frames
   * 这是主要的更新方法，每次TF数据更新时调用
   */
  buildFrameHierarchy(
    tfTree: Array<{ name: string; parent: string | null; children: any[] }>,
    _transforms: Map<string, Map<string, TransformFrame>>
  ) {
    // 收集所有需要显示的frames
    const allFrameNames = new Set<string>()
    
    const collectFrames = (nodes: any[]) => {
      nodes.forEach(node => {
        allFrameNames.add(node.name)
        if (node.children) {
          collectFrames(node.children)
        }
      })
    }
    collectFrames(tfTree)

    // 为每个frame创建或更新Group
    allFrameNames.forEach(frameName => {
      this.createOrUpdateFrame(frameName)
    })

    // 移除不再存在的frames
    const framesToRemove: string[] = []
    this.frameObjects.forEach((_, frameName) => {
      if (!allFrameNames.has(frameName)) {
        framesToRemove.push(frameName)
      }
    })
    framesToRemove.forEach(frameName => {
      this.removeFrame(frameName)
    })

    // 更新所有frames的位置（相对于fixed frame）
    this.updateAllFramePositions()
  }

  /**
   * 创建或更新单个frame
   */
  private createOrUpdateFrame(frameName: string) {
    let frameObject = this.frameObjects.get(frameName)
    
    if (!frameObject) {
      // 创建新的frame Group
      const frameGroup = new THREE.Group()
      frameGroup.name = `TF_${frameName}`
      
      // 所有frames都是rootGroup的直接子节点（扁平化结构）
      this.rootGroup.add(frameGroup)

      frameObject = {
        group: frameGroup,
        name: frameName
      }
      
      this.frameObjects.set(frameName, frameObject)
    }
  }

  /**
   * 更新所有frames的位置（相对于fixed frame）
   * 这是核心方法：计算每个frame相对于fixed frame的绝对变换
   */
  private updateAllFramePositions() {
    this.frameObjects.forEach((frameObject, frameName) => {
      if (frameName === this.fixedFrame) {
        // fixed frame 位于原点
        frameObject.group.position.set(0, 0, 0)
        frameObject.group.quaternion.set(0, 0, 0, 1)
      } else {
        // 其他 frame：计算从 frameName 到 fixedFrame 的变换矩阵
        const transformMatrix = tfManager.getTransformMatrix(frameName, this.fixedFrame)
        
        if (transformMatrix) {
          // 分解矩阵得到位置和旋转
          const position = new THREE.Vector3()
          const quaternion = new THREE.Quaternion()
          const scale = new THREE.Vector3()
          transformMatrix.decompose(position, quaternion, scale)
          
          // 应用变换
          frameObject.group.position.copy(position)
          frameObject.group.quaternion.copy(quaternion)
          frameObject.group.visible = true
        } else {
          // 无法找到变换，隐藏frame
          frameObject.group.visible = false
          console.warn(`TFRenderer: Could not find transform from ${frameName} to ${this.fixedFrame}`)
        }
      }
    })
  }

  /**
   * 更新单个frame的变换（当收到新的TF数据时）
   */
  updateTransform(_parentFrame: string, _childFrame: string, _transform: TransformFrame) {
    // 直接重新计算所有frames的位置
    // 这样更简单，也确保了一致性
    this.updateAllFramePositions()
  }

  /**
   * 更新所有frames的变换
   */
  updateAllTransforms(_transforms: Map<string, Map<string, TransformFrame>>) {
    this.updateAllFramePositions()
  }

  /**
   * 添加坐标轴可视化
   */
  addAxes(frameName: string, axisLength: number = 0.3, axisRadius: number = 0.01, showAxes: boolean = true) {
    const frameObject = this.frameObjects.get(frameName)
    if (!frameObject) return

    // 移除旧的坐标轴
    if (frameObject.axes) {
      frameObject.group.remove(frameObject.axes)
      frameObject.axes.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }

    if (!showAxes) {
      frameObject.axes = undefined
      return
    }

    // 使用统一的ROS坐标轴创建函数
    const axesGroup = createROSAxes(axisLength, axisRadius)
    axesGroup.name = `Axes_${frameName}`

    frameObject.group.add(axesGroup)
    frameObject.axes = axesGroup
  }

  /**
   * 添加名称标签
   */
  addLabel(frameName: string, showNames: boolean = true, markerScale: number = 1, markerAlpha: number = 1) {
    const frameObject = this.frameObjects.get(frameName)
    if (!frameObject) return

    // 移除旧的标签
    if (frameObject.label) {
      frameObject.group.remove(frameObject.label)
      if (frameObject.label.material instanceof THREE.SpriteMaterial) {
        if (frameObject.label.material.map) {
          frameObject.label.material.map.dispose()
        }
        frameObject.label.material.dispose()
      }
    }

    if (!showNames) {
      frameObject.label = undefined
      return
    }

    // 创建文本标签
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64

    context.fillStyle = `rgba(255, 255, 255, ${markerAlpha})`
    context.font = 'Bold 24px Arial'
    context.fillText(frameName, 10, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: markerAlpha
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(0.5 * markerScale, 0.125 * markerScale, 1)
    sprite.position.set(0, 0.2 * markerScale, 0)
    sprite.name = `Label_${frameName}`

    frameObject.group.add(sprite)
    frameObject.label = sprite
  }

  /**
   * 配置 frame 的显示选项
   */
  configureFrame(
    frameName: string,
    options: {
      showAxes?: boolean
      showNames?: boolean
      markerScale?: number
      markerAlpha?: number
    }
  ) {
    const { showAxes = true, showNames = true, markerScale = 1, markerAlpha = 1 } = options

    this.addAxes(frameName, 0.3 * markerScale, 0.01, showAxes)
    this.addLabel(frameName, showNames, markerScale, markerAlpha)
  }

  /**
   * 设置 frame 的可见性
   */
  setFrameVisibility(frameName: string, visible: boolean) {
    const frameObject = this.frameObjects.get(frameName)
    if (frameObject) {
      frameObject.group.visible = visible
    }
  }

  /**
   * 获取 frame 对象
   */
  getFrame(frameName: string): TFFrameObject | undefined {
    return this.frameObjects.get(frameName)
  }

  /**
   * 获取所有 frame 名称
   */
  getAllFrameNames(): string[] {
    return Array.from(this.frameObjects.keys())
  }

  /**
   * 移除单个frame
   */
  private removeFrame(frameName: string) {
    const frameObject = this.frameObjects.get(frameName)
    if (!frameObject) return

    // 清理坐标轴
    if (frameObject.axes) {
      frameObject.axes.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }

    // 清理标签
    if (frameObject.label) {
      if (frameObject.label.material instanceof THREE.SpriteMaterial) {
        if (frameObject.label.material.map) {
          frameObject.label.material.map.dispose()
        }
        frameObject.label.material.dispose()
      }
    }

    // 从场景中移除
    if (frameObject.group.parent) {
      frameObject.group.parent.remove(frameObject.group)
    }

    this.frameObjects.delete(frameName)
  }

  /**
   * 清理所有 frame 对象
   */
  clearAllFrames() {
    const frameNames = Array.from(this.frameObjects.keys())
    frameNames.forEach(frameName => {
      this.removeFrame(frameName)
    })
  }

  /**
   * 销毁渲染器，清理所有资源
   */
  dispose() {
    this.clearAllFrames()
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup)
    }
  }
}
