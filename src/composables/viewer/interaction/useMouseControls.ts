/**
 * 鼠标控制 composable
 * 负责处理中键平移等鼠标交互
 */
import * as THREE from 'three'
import type { PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Ref } from 'vue'

export interface MouseControlsContext {
  containerRef: Ref<HTMLElement | undefined>
  camera: PerspectiveCamera
  controls: OrbitControls
}

export interface MouseControlsResult {
  cleanup: () => void
}

/**
 * 设置中键平移功能
 */
export function useMouseControls(context: MouseControlsContext): MouseControlsResult {
  const { containerRef, camera, controls } = context

  let isMiddleMouseDown = false
  let lastMousePosition = { x: 0, y: 0 }
  let handlers: {
    onMouseDown: (e: MouseEvent) => void
    onMouseMove: (e: MouseEvent) => void
    onMouseUp: (e: MouseEvent) => void
    onContextMenu: (e: MouseEvent) => void
  } | null = null

  const setup = () => {
    if (!containerRef.value) return

    const canvas = containerRef.value

    // 中键按下
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault()
        isMiddleMouseDown = true
        lastMousePosition.x = event.clientX
        lastMousePosition.y = event.clientY
        canvas.style.cursor = 'move'
      }
    }

    // 中键移动
    const onMouseMove = (event: MouseEvent) => {
      if (isMiddleMouseDown && controls) {
        event.preventDefault()

        const deltaX = event.clientX - lastMousePosition.x
        const deltaY = event.clientY - lastMousePosition.y

        // 计算平移距离
        const panSpeed = 0.002
        const panVector = new THREE.Vector3()

        // 计算平移方向
        const right = new THREE.Vector3()
        const up = new THREE.Vector3()
        camera.getWorldDirection(new THREE.Vector3())
        right.setFromMatrixColumn(camera.matrixWorld, 0)
        up.setFromMatrixColumn(camera.matrixWorld, 1)

        // 应用平移
        panVector.addScaledVector(right, -deltaX * panSpeed)
        panVector.addScaledVector(up, deltaY * panSpeed)

        controls.target.add(panVector)
        camera.position.add(panVector)

        lastMousePosition.x = event.clientX
        lastMousePosition.y = event.clientY
      }
    }

    // 中键释放
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault()
        isMiddleMouseDown = false
        canvas.style.cursor = 'default'
      }
    }

    // 防止中键默认行为
    const onContextMenu = (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault()
      }
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', () => {
      isMiddleMouseDown = false
      canvas.style.cursor = 'default'
    })
    canvas.addEventListener('contextmenu', onContextMenu)

    handlers = {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onContextMenu
    }

    // 保存事件处理器以便清理
    ;(canvas as any)._middleMouseHandlers = handlers
  }

  const cleanup = () => {
    if (!containerRef.value || !handlers) return

    const canvas = containerRef.value
    canvas.removeEventListener('mousedown', handlers.onMouseDown)
    canvas.removeEventListener('mousemove', handlers.onMouseMove)
    canvas.removeEventListener('mouseup', handlers.onMouseUp)
    canvas.removeEventListener('contextmenu', handlers.onContextMenu)
    delete (canvas as any)._middleMouseHandlers
    handlers = null
  }

  setup()

  return {
    cleanup
  }
}
