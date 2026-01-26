/**
 * 窗口大小调整处理 composable
 * 负责处理窗口和容器大小变化
 */
import type { Ref } from 'vue'
import type { PerspectiveCamera } from 'three'
import type { WebGLRenderer } from 'three'

export interface ResizeHandlerContext {
  containerRef: Ref<HTMLElement | undefined>
  camera: PerspectiveCamera
  renderer: WebGLRenderer
}

export interface ResizeHandlerResult {
  handleResize: () => void
  cleanup: () => void
}

/**
 * 创建窗口大小调整处理器
 */
export function useResizeHandler(context: ResizeHandlerContext): ResizeHandlerResult {
  const { containerRef, camera, renderer } = context

  let resizeObserver: ResizeObserver | null = null
  let resizeTimer: number | null = null

  const handleResize = () => {
    if (!containerRef.value) return

    if (resizeTimer) {
      cancelAnimationFrame(resizeTimer)
    }

    resizeTimer = requestAnimationFrame(() => {
      if (!containerRef.value) return

      const width = containerRef.value.clientWidth
      const height = containerRef.value.clientHeight

      if (width > 0 && height > 0) {
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }
    })
  }

  const setupResizeObserver = () => {
    if (!containerRef.value || !window.ResizeObserver) return

    resizeObserver = new ResizeObserver((entries) => {
      if (resizeTimer) {
        cancelAnimationFrame(resizeTimer)
      }
      resizeTimer = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0 && renderer && camera) {
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            renderer.setSize(width, height)
          }
        }
      })
    })
    resizeObserver.observe(containerRef.value)
  }

  const cleanup = () => {
    window.removeEventListener('resize', handleResize)

    if (resizeObserver && containerRef.value) {
      resizeObserver.unobserve(containerRef.value)
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (resizeTimer) {
      cancelAnimationFrame(resizeTimer)
      resizeTimer = null
    }
  }

  // 设置窗口resize监听
  window.addEventListener('resize', handleResize)

  // 设置ResizeObserver
  setupResizeObserver()

  return {
    handleResize,
    cleanup
  }
}
