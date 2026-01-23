/**
 * TF 可视化渲染器
 * 负责渲染 TF 坐标系树的可视化
 */
import * as THREE from 'three'
import { TFRenderer } from '@/services/tfRenderer'
import { tfManager } from '@/services/tfManager'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface TFRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
  getFixedFrame: () => string
  tfRenderer: TFRenderer | null
  setTFRenderer: (renderer: TFRenderer | null) => void
}

/**
 * 更新 TF 渲染
 */
export function updateTFRender(
  context: TFRendererContext,
  componentId: string
) {
  const { scene, renderObjects, getComponent, getFixedFrame, tfRenderer, setTFRenderer } = context
  
  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) return

  const options = component.options || {}
  const showNames = options.showNames ?? true
  const showAxes = options.showAxes ?? true
  const markerScale = options.markerScale ?? 1
  const markerAlpha = options.markerAlpha ?? 1
  const enabledFrames = new Set<string>()
  
  // 获取启用的 frames
  if (options.frames && Array.isArray(options.frames) && options.frames.length > 0) {
    // 如果配置了 frames 列表，只渲染启用的 frames
    options.frames.forEach((frame: any) => {
      if (frame.enabled) {
        enabledFrames.add(frame.name)
      }
    })
  } else {
    // 如果没有配置 frames 列表，默认渲染所有 frame
    const allFrames = tfManager.getFrames()
    allFrames.forEach(frameName => {
      enabledFrames.add(frameName)
    })
  }

  // 初始化或获取 TF 渲染器
  let currentTFRenderer = tfRenderer
  if (!currentTFRenderer) {
    currentTFRenderer = new TFRenderer(scene)
    setTFRenderer(currentTFRenderer)
    // 将 TF 渲染器的根组存储到 renderObjects 中
    renderObjects.value.tfGroup = currentTFRenderer.rootGroup
  }

  // 设置固定帧
  const fixedFrame = getFixedFrame()
  currentTFRenderer.setFixedFrame(fixedFrame)

  // 从 tfManager 获取变换数据和树结构
  const transforms = tfManager.getTransforms()
  const tfTree = tfManager.getTFTree()

  // 使用 TFRenderer 构建 TF 层级结构
  currentTFRenderer.buildFrameHierarchy(tfTree, transforms)

  // ✅ 对于每个启用的 frame，需要确保它的所有父节点也被显示
  const framesToShow = new Set<string>(enabledFrames)
  
  // 确保固定帧也在显示列表中（作为根节点）
  framesToShow.add(fixedFrame)
  
  // 查找每个启用 frame 的所有父节点
  const findParentPath = (frameName: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(frameName)) return [] // 避免循环
    visited.add(frameName)
    
    const path: string[] = []
    // 从 transforms 中查找 frameName 的父节点
    for (const [parentName, children] of transforms.entries()) {
      if (children.has(frameName)) {
        path.push(parentName)
        // 递归查找父节点的父节点
        const parentPath = findParentPath(parentName, visited)
        path.push(...parentPath)
        break
      }
    }
    return path
  }
  
  // 为每个启用的 frame 添加其所有父节点到显示列表
  enabledFrames.forEach(frameName => {
    const parentPath = findParentPath(frameName)
    parentPath.forEach(parentName => {
      framesToShow.add(parentName)
    })
  })
  
  // 配置每个需要显示的 frame 的显示选项
  framesToShow.forEach(frameName => {
    const frameObject = currentTFRenderer!.getFrame(frameName)
    if (frameObject) {
      // 如果是启用的 frame，显示完整的配置（axes, names等）
      // 如果是父节点（未启用但需要显示），只显示基本结构，不显示 axes 和 names
      const isEnabled = enabledFrames.has(frameName)
      currentTFRenderer!.configureFrame(frameName, {
        showAxes: isEnabled ? showAxes : false,
        showNames: isEnabled ? showNames : false,
        markerScale,
        markerAlpha
      })
      
      // 设置可见性
      currentTFRenderer!.setFrameVisibility(frameName, true)
    }
  })

  // 隐藏未启用且不在显示列表中的 frames
  currentTFRenderer.getAllFrameNames().forEach(frameName => {
    if (!framesToShow.has(frameName)) {
      currentTFRenderer!.setFrameVisibility(frameName, false)
    }
  })

  // TODO: 实现箭头连接线绘制（showArrows）
}
