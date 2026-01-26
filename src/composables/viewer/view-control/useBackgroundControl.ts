/**
 * 背景控制 Composable
 * 负责背景颜色的控制
 */
import { type Ref } from 'vue'

export interface BackgroundControlMethods {
  setBackgroundColor: (color: string) => void
}

export interface UseBackgroundControlOptions {
  viewerRef: Ref<{ setBackgroundColor: (color: string) => void } | null>
}

export function useBackgroundControl(options: UseBackgroundControlOptions) {
  const { viewerRef } = options

  /**
   * 设置背景颜色
   */
  function setBackgroundColor(color: string): void {
    if (viewerRef.value) {
      viewerRef.value.setBackgroundColor(color)
    }
  }

  return {
    setBackgroundColor
  }
}
