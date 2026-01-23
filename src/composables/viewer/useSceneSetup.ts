/**
 * 场景初始化 composable
 * 负责创建和管理 THREE.js 场景、相机、渲染器、控制器
 */
import { ref, type Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MOUSE } from 'three'
import type { useRvizStore } from '@/stores/rviz'

export interface SceneSetupContext {
  containerRef: Ref<HTMLElement | undefined>
  backgroundColor: string
}

export interface SceneSetupResult {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
}

/**
 * 初始化 THREE.js 场景
 */
export function useSceneSetup(context: SceneSetupContext): SceneSetupResult | null {
  const { containerRef, backgroundColor } = context

  if (!containerRef.value) {
    return null
  }

  // 创建场景
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(backgroundColor)

  // 创建相机
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // 创建控制器
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 0.01
  controls.maxDistance = Infinity
  controls.maxPolarAngle = Math.PI / 2

  // 配置鼠标按钮：左键旋转，中键平移
  controls.mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.PAN,
    RIGHT: MOUSE.ROTATE
  }

  // 启用平移功能
  controls.enablePan = true
  controls.panSpeed = 0.8

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  return {
    scene,
    camera,
    renderer,
    controls
  }
}
