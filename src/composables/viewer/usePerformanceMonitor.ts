/**
 * 性能监控 composable
 * 负责监控和更新场景性能指标
 */
import * as THREE from 'three'
import type { Scene } from 'three'
import type { WebGLRenderer } from 'three'
import type { Ref } from 'vue'

export interface PerformanceMonitorContext {
  scene: Scene
  renderer: WebGLRenderer
  fpsRef?: Ref<number>
  cameraPosRef?: Ref<{ x: number; y: number; z: number }>
  objectCountRef?: Ref<number>
  memoryUsageRef?: Ref<number>
  textureCountRef?: Ref<number>
  targetFPS?: number
}

export interface PerformanceMonitorResult {
  update: () => void
}

/**
 * 创建性能监控器
 */
export function usePerformanceMonitor(context: PerformanceMonitorContext): PerformanceMonitorResult {
  const {
    scene,
    renderer,
    fpsRef,
    cameraPosRef,
    objectCountRef,
    memoryUsageRef,
    textureCountRef,
    targetFPS = 30
  } = context

  let lastTime = performance.now()
  let frameCount = 0

  const updateFPS = () => {
    frameCount++
    const currentTime = performance.now()
    const delta = currentTime - lastTime

    if (delta >= 1000) {
      if (fpsRef) {
        fpsRef.value = targetFPS
      }
      frameCount = 0
      lastTime = currentTime
    }
  }

  const updateCameraPos = (camera: THREE.PerspectiveCamera) => {
    if (cameraPosRef) {
      cameraPosRef.value = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      }
    }
  }

  const updateObjectCount = () => {
    if (objectCountRef) {
      let count = 0
      scene.traverse(() => {
        count++
      })
      objectCountRef.value = count
    }
  }

  const updateMemoryUsage = () => {
    if (memoryUsageRef && renderer.info) {
      const memoryInfo = renderer.info.memory
      memoryUsageRef.value = Math.round((memoryInfo.geometries + memoryInfo.textures) * 0.001)
    }
  }

  const updateTextureCount = () => {
    if (textureCountRef) {
      let count = 0
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            count += child.material.length
          } else {
            count += 1
          }
        }
      })
      textureCountRef.value = count
    }
  }

  const update = (camera?: THREE.PerspectiveCamera) => {
    updateFPS()
    if (camera) {
      updateCameraPos(camera)
    }
    updateObjectCount()
    updateMemoryUsage()
    updateTextureCount()
  }

  return {
    update
  }
}
