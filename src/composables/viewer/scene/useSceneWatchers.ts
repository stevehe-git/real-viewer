/**
 * 场景状态监听 composable
 * 负责监听场景状态变化并更新3D对象
 */
import { watch } from 'vue'
import * as THREE from 'three'
import type { Scene } from 'three'
import type { useRvizStore } from '@/stores/rviz'
import type { ReturnType as Renderer3DType } from '../../use3DRenderer'

export interface SceneWatchersContext {
  scene: Scene
  rvizStore: ReturnType<typeof useRvizStore>
  renderer3D: Renderer3DType<typeof import('../../use3DRenderer').use3DRenderer> | null
  gridHelper: THREE.GridHelper | null
  axesHelper: THREE.Group | null
  robotGroup: THREE.Group | null
  mapMesh: THREE.Mesh | null
  updateGridHelper: () => void
  updateAxesHelper: () => void
}

export interface SceneWatchersResult {
  cleanup: () => void
}

/**
 * 创建场景状态监听器
 */
export function useSceneWatchers(context: SceneWatchersContext): SceneWatchersResult {
  const {
    scene,
    rvizStore,
    renderer3D,
    gridHelper,
    axesHelper,
    robotGroup,
    mapMesh,
    updateGridHelper,
    updateAxesHelper
  } = context

  // 监听场景状态变化
  const unsubscribeShowRobot = watch(
    () => rvizStore.sceneState.showRobot,
    (val: boolean) => {
      if (robotGroup) {
        robotGroup.visible = val
      }
    }
  )

  const unsubscribeShowMap = watch(
    () => rvizStore.sceneState.showMap,
    (val: boolean) => {
      if (mapMesh) {
        mapMesh.visible = val
      }
    }
  )

  const unsubscribeBackgroundColor = watch(
    () => rvizStore.sceneState.backgroundColor,
    (val: string) => {
      if (scene) {
        scene.background = new THREE.Color(val)
      }
    }
  )

  const unsubscribeShowGrid = watch(
    () => rvizStore.sceneState.showGrid,
    (val: boolean) => {
      if (gridHelper) {
        gridHelper.visible = val
      }
    }
  )

  const unsubscribeShowAxes = watch(
    () => rvizStore.sceneState.showAxes,
    (val: boolean) => {
      if (axesHelper) {
        axesHelper.visible = val
      }
    }
  )

  // 监听grid组件的选项变化
  const unsubscribeGridOptions = watch(
    () => {
      const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
      return gridComponent?.options
    },
    () => {
      updateGridHelper()
    },
    { deep: true }
  )

  // 监听axes组件的选项变化
  const unsubscribeAxesOptions = watch(
    () => {
      const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
      return axesComponent?.options
    },
    () => {
      const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
      if (renderer3D && axesComponent) {
        renderer3D.updateComponentRender(axesComponent.id, 'axes', {})
      } else {
        updateAxesHelper()
      }
    },
    { deep: true }
  )

  const cleanup = () => {
    unsubscribeShowRobot()
    unsubscribeShowMap()
    unsubscribeBackgroundColor()
    unsubscribeShowGrid()
    unsubscribeShowAxes()
    unsubscribeGridOptions()
    unsubscribeAxesOptions()
  }

  return {
    cleanup
  }
}
