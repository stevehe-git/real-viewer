/**
 * 场景辅助对象管理 composable
 * 负责管理网格、坐标轴、机器人模型等辅助对象
 */
import * as THREE from 'three'
import type { Scene } from 'three'
import { createROSAxes, getROSGridRotation, convertROSOffsetToThree } from '@/services/coordinateConverter'
import type { useRvizStore } from '@/stores/rviz'

export interface SceneHelpersContext {
  scene: Scene
  rvizStore: ReturnType<typeof useRvizStore>
}

export interface SceneHelpersResult {
  gridHelper: THREE.GridHelper | null
  axesHelper: THREE.Group | null
  robotGroup: THREE.Group | null
  mapMesh: THREE.Mesh | null
  updateGridHelper: () => void
  updateAxesHelper: () => void
  createRobot: () => void
  createMap: () => void
  cleanup: () => void
}

/**
 * 创建场景辅助对象管理器
 */
export function useSceneHelpers(context: SceneHelpersContext): SceneHelpersResult {
  const { scene, rvizStore } = context

  let gridHelper: THREE.GridHelper | null = null
  let axesHelper: THREE.Group | null = null
  let robotGroup: THREE.Group | null = null
  let mapMesh: THREE.Mesh | null = null

  const updateGridHelper = () => {
    // 移除现有的网格
    if (gridHelper) {
      scene.remove(gridHelper)
    }

    // 获取grid配置
    const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
    const options = gridComponent?.options || {}

    // 使用配置选项创建网格
    const cellSize = options.cellSize || 1
    const planeCellCount = options.planeCellCount || 10
    const color = options.color || '#a0a0a4'
    const plane = options.plane || 'XY'

    const threeColor = new THREE.Color(color)

    gridHelper = new THREE.GridHelper(
      planeCellCount * cellSize,
      planeCellCount,
      threeColor,
      threeColor.clone().multiplyScalar(0.5)
    )

    // 设置透明度
    if (options.alpha !== undefined) {
      gridHelper.material.transparent = true
      gridHelper.material.opacity = options.alpha
    }

    // 使用统一的ROS网格旋转函数
    const gridRotation = getROSGridRotation(plane)
    gridHelper.rotation.copy(gridRotation)

    // 使用统一的ROS偏移转换函数
    const rosOffset = {
      x: options.offsetX || 0,
      y: options.offsetY || 0,
      z: options.offsetZ || 0
    }
    const threeOffset = convertROSOffsetToThree(rosOffset)
    gridHelper.position.copy(threeOffset)

    scene.add(gridHelper)
    gridHelper.visible = rvizStore.sceneState.showGrid
  }

  const updateAxesHelper = () => {
    // 移除现有的坐标轴
    if (axesHelper) {
      scene.remove(axesHelper)
    }

    // 获取axes配置
    const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
    const options = axesComponent?.options || {}

    // 使用配置选项创建坐标轴
    const length = options.length || 1
    const radius = options.radius || 0.01

    // 使用统一的ROS坐标轴创建函数
    axesHelper = createROSAxes(length, radius)

    // 设置透明度
    if (options.alpha !== undefined) {
      axesHelper.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          child.material.transparent = true
          child.material.opacity = options.alpha
        }
      })
    }

    scene.add(axesHelper)
    axesHelper.visible = rvizStore.sceneState.showAxes
  }

  const createRobot = () => {
    robotGroup = new THREE.Group()

    // 机器人主体（立方体）
    const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 1)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x409eff })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.25
    body.castShadow = true
    robotGroup.add(body)

    // 机器人顶部（圆柱体）
    const topGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16)
    const topMaterial = new THREE.MeshStandardMaterial({ color: 0x67c23a })
    const top = new THREE.Mesh(topGeometry, topMaterial)
    top.position.set(0, 0.6, 0)
    top.castShadow = true
    robotGroup.add(top)

    robotGroup.position.set(0, 0, 0)
    scene.add(robotGroup)
  }

  const createMap = () => {
    // 创建简单的占用网格地图
    const mapGeometry = new THREE.PlaneGeometry(10, 10, 10, 10)
    const mapMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      wireframe: false,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
    mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.position.y = 0
    mapMesh.receiveShadow = true
    mapMesh.visible = false
    scene.add(mapMesh)
  }

  const cleanup = () => {
    if (gridHelper) {
      scene.remove(gridHelper)
      gridHelper = null
    }
    if (axesHelper) {
      scene.remove(axesHelper)
      axesHelper = null
    }
    if (robotGroup) {
      scene.remove(robotGroup)
      robotGroup = null
    }
    if (mapMesh) {
      scene.remove(mapMesh)
      mapMesh = null
    }
  }

  return {
    gridHelper,
    axesHelper,
    robotGroup,
    mapMesh,
    updateGridHelper,
    updateAxesHelper,
    createRobot,
    createMap,
    cleanup
  }
}
