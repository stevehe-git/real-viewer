/**
 * 全屏控制 Composable
 * 负责全屏功能的实现和管理
 */
import { ref, onMounted, onUnmounted } from 'vue'

export interface UseFullscreenOptions {
  target?: HTMLElement | null
}

export function useFullscreen(options: UseFullscreenOptions = {}) {
  const { target } = options
  const isFullscreen = ref(false)

  /**
   * 进入全屏
   */
  function enterFullscreen(element?: HTMLElement): void {
    const el = element || target || document.documentElement
    
    if (!el) {
      console.warn('No element available for fullscreen')
      return
    }

    // 使用标准 Fullscreen API
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        isFullscreen.value = true
      }).catch((err) => {
        console.error('Error entering fullscreen:', err)
      })
    }
    // 兼容 WebKit
    else if ((el as any).webkitRequestFullscreen) {
      ;(el as any).webkitRequestFullscreen()
      isFullscreen.value = true
    }
    // 兼容 Mozilla
    else if ((el as any).mozRequestFullScreen) {
      ;(el as any).mozRequestFullScreen()
      isFullscreen.value = true
    }
    // 兼容 MS
    else if ((el as any).msRequestFullscreen) {
      ;(el as any).msRequestFullscreen()
      isFullscreen.value = true
    }
  }

  /**
   * 退出全屏
   */
  function exitFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        isFullscreen.value = false
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err)
      })
    }
    // 兼容 WebKit
    else if ((document as any).webkitExitFullscreen) {
      ;(document as any).webkitExitFullscreen()
      isFullscreen.value = false
    }
    // 兼容 Mozilla
    else if ((document as any).mozCancelFullScreen) {
      ;(document as any).mozCancelFullScreen()
      isFullscreen.value = false
    }
    // 兼容 MS
    else if ((document as any).msExitFullscreen) {
      ;(document as any).msExitFullscreen()
      isFullscreen.value = false
    }
  }

  /**
   * 切换全屏
   */
  function toggleFullscreen(element?: HTMLElement): void {
    if (isFullscreen.value) {
      exitFullscreen()
    } else {
      enterFullscreen(element)
    }
  }

  /**
   * 检查是否支持全屏
   */
  function isFullscreenSupported(): boolean {
    return !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    )
  }

  /**
   * 获取当前全屏元素
   */
  function getFullscreenElement(): Element | null {
    return (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      null
    )
  }

  // 监听全屏状态变化
  function handleFullscreenChange(): void {
    const fullscreenElement = getFullscreenElement()
    isFullscreen.value = !!fullscreenElement
  }

  // 监听全屏事件
  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
  })

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isFullscreenSupported,
    getFullscreenElement
  }
}
