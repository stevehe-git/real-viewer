/**
 * 场景状态管理模块
 * 负责 3D 场景状态的初始化和更新
 */
import type { SceneState } from './types'

/**
 * 创建默认场景状态
 */
export function createDefaultSceneState(): SceneState {
  return {
    showGrid: true,
    showAxes: true,
    showRobot: true,
    showMap: true,
    showPath: false,
    showLaser: false,
    cameraMode: 'orbit',
    backgroundColor: '#fdfdfd',
    fps: 30,
    cameraPos: { x: 0, y: 0, z: 0 },
    objectCount: 0,
    memoryUsage: 0,
    textureCount: 0,
    isRecording: false,
    performanceMode: false,
    showDebugInfo: false
  }
}

/**
 * 创建场景状态管理功能
 */
export function createSceneStateManager(sceneState: SceneState) {
  // 更新场景状态
  const updateSceneState = (updates: Partial<SceneState>) => {
    Object.assign(sceneState, updates)
  }

  return {
    updateSceneState
  }
}
