/**
 * 动画循环 composable
 * 负责管理渲染循环、FPS 控制和性能监控
 */
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Ref } from 'vue'

export interface AnimationLoopContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  targetFPS?: number
  onFrame?: () => void
}

export interface AnimationLoopResult {
  start: () => void
  stop: () => void
  updateFPS: (fps: number) => void
}

/**
 * 创建动画循环
 */
export function useAnimationLoop(context: AnimationLoopContext): AnimationLoopResult {
  const { scene, camera, renderer, controls, targetFPS = 30, onFrame } = context

  let animationId: number | null = null
  let frameInterval = 1000 / targetFPS
  let lastRenderTime = 0

  const animate = (currentTime: number = 0) => {
    animationId = requestAnimationFrame(animate)

    // 控制渲染频率
    if (currentTime - lastRenderTime >= frameInterval) {
      lastRenderTime = currentTime

      // 更新控制器
      controls.update()

      // 执行自定义帧回调
      if (onFrame) {
        onFrame()
      }

      // 渲染场景
      renderer.render(scene, camera)
    }
  }

  const start = () => {
    if (animationId === null) {
      animate()
    }
  }

  const stop = () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  const updateFPS = (fps: number) => {
    frameInterval = 1000 / fps
  }

  return {
    start,
    stop,
    updateFPS
  }
}
