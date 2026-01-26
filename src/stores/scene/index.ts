/**
 * 场景状态管理
 * 管理3D场景的显示状态、相机、性能等
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SceneState {
  cameraMode: 'orbit' | 'firstPerson'
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showLaser: boolean
  backgroundColor: string
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}

export const useSceneStore = defineStore('scene', () => {
  const sceneState = ref<SceneState>({
    cameraMode: 'orbit',
    showGrid: true,
    showAxes: true,
    showRobot: false,
    showMap: false,
    showLaser: false,
    backgroundColor: '#808080',
    fps: 60,
    cameraPos: { x: 0, y: 0, z: 0 },
    objectCount: 0,
    memoryUsage: 0,
    textureCount: 0,
    isRecording: false,
    performanceMode: true,
    showDebugInfo: false
  })

  return {
    sceneState
  }
})
