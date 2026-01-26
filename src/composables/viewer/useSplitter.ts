/**
 * 分割条拖动 composable
 * 负责处理面板分割条的拖动功能
 */
import { ref, type Ref } from 'vue'
import type { useRvizStore } from '@/stores/rviz'

export interface SplitterContext {
  rvizStore: ReturnType<typeof useRvizStore>
}

export interface SplitterResult {
  panelWidth: Ref<number>
  isResizing: Ref<boolean>
  startResize: (e: MouseEvent) => void
  cleanup: () => void
}

/**
 * 创建分割条拖动功能
 */
export function useSplitter(context: SplitterContext): SplitterResult {
  const { rvizStore } = context

  const panelWidth = ref(rvizStore.panelConfig.panelWidth || 300)
  const isResizing = ref(false)
  let startX = 0
  let startPanelWidth = 0

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.value = true
    startX = e.clientX
    startPanelWidth = panelWidth.value

    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResize = (e: MouseEvent) => {
    if (!isResizing.value) return

    const deltaX = startX - e.clientX // 反向，因为向右拖拽应该增加面板宽度
    const newPanelWidth = Math.max(200, Math.min(800, startPanelWidth + deltaX))

    panelWidth.value = newPanelWidth
    rvizStore.updatePanelConfig({ panelWidth: newPanelWidth })
  }

  const stopResize = () => {
    if (!isResizing.value) return
    
    isResizing.value = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    rvizStore.updatePanelConfig({ panelWidth: panelWidth.value })
  }

  const cleanup = () => {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return {
    panelWidth,
    isResizing,
    startResize,
    cleanup
  }
}
