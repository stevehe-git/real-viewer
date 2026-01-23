/**
 * ROS 坐标系到 THREE.js 坐标系转换工具（统一标准版）
 * 
 * 核心原则：所有组件（TF、Axes、Grid、LaserScan）必须使用相同的坐标系转换标准
 * 
 * ROS (RViz) 标准坐标系：右手坐标系
 *   X 轴 → 机器人正前方（红色）
 *   Y 轴 → 机器人左侧方（绿色）
 *   Z 轴 → 垂直地面正上方（蓝色）
 *   XY平面是水平面（地面，Z=0）
 * 
 * THREE.js 标准坐标系：右手坐标系
 *   X 轴 → 屏幕右侧方
 *   Y 轴 → 屏幕正上方（垂直向上）
 *   Z 轴 → 屏幕正前方（朝向自己）
 *   XZ平面是水平面（地面，Y=0）
 * 
 * 统一转换公式（所有组件必须使用）：
 * ROS(x, y, z) → THREE.js(x, z, -y)
 *
 * 坐标轴对应关系：
 * - ROS X(向前，红色) → THREE.js X（向右）
 * - ROS Y(向左，绿色) → THREE.js -Z（向后，取反）
 * - ROS Z(向上，蓝色) → THREE.js Y（向上）
 *
 * 这样确保：
 * - ROS的XY平面（水平面，Z=0）→ THREE.js的XZ平面（水平面，Y=0）
 * - ROS的Z轴（垂直向上）→ THREE.js的Y轴（垂直向上）
 * - map、odom、base_link等frames都在Y=0的水平面上
 * - 所有可视化组件（TF、Axes、Grid、LaserScan）位置一致
 *
 * 可视化颜色标准（与RViz一致）：
 * - ROS X轴：红色 (0xff0000)
 * - ROS Y轴：绿色 (0x00ff00)
 * - ROS Z轴：蓝色 (0x0000ff)
 */

import * as THREE from 'three'

/**
 * ROS 平移坐标转换为 THREE.js 坐标
 * 
 * 统一转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
 * 
 * 所有组件（TF、LaserScan、PointCloud2、Path等）必须使用此函数进行转换
 * 
 * @param rosTranslation ROS 原始平移数据 {x, y, z}
 * @returns THREE.js Vector3 坐标
 */
export function convertROSTranslationToThree(rosTranslation: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(
    rosTranslation.x,    // ROS X → THREE.js X（向右）
    rosTranslation.z,    // ROS Z → THREE.js Y（向上）
    -rosTranslation.y    // ROS Y → THREE.js Z（向后，取反）
  )
}

/**
 * ROS 四元数转换为 THREE.js 四元数
 * 
 * 核心原理：
 * - 坐标轴映射：ROS(x, y, z) → THREE.js(x, z, -y)
 * - 四元数需要反映这个坐标轴变换
 * 
 * 转换公式：
 * - ROS绕X轴旋转 → THREE.js绕X轴旋转（相同）
 * - ROS绕Y轴旋转 → THREE.js绕Z轴旋转（Y→Z，取反）
 * - ROS绕Z轴旋转 → THREE.js绕Y轴旋转（Z→Y）
 * 
 * 对于坐标轴映射 ROS(x, y, z) → THREE.js(x, z, -y)：
 * 四元数转换：(x, z, -y, w)
 * 
 * @param rosRotation ROS 原始四元数 {x, y, z, w}
 * @returns THREE.js Quaternion
 */
export function convertROSRotationToThree(rosRotation: { x: number; y: number; z: number; w: number }): THREE.Quaternion {
  // 对于坐标轴映射 ROS(x, y, z) → THREE.js(x, z, -y)
  // 四元数转换：(x, z, -y, w)
  return new THREE.Quaternion(
    rosRotation.x,    // X轴不变
    rosRotation.z,    // ROS Z → THREE.js Y
    -rosRotation.y,   // ROS Y → THREE.js Z（取反）
    rosRotation.w
  )
}

/**
 * 应用 ROS Transform 到 THREE.js 对象
 * 
 * 这是一个便捷函数，同时应用平移和旋转转换
 * 
 * @param object THREE.js 对象（Group、Mesh 等）
 * @param rosTransform ROS Transform 数据
 */
export function applyROSTransformToObject(
  object: THREE.Object3D,
  rosTransform: {
    translation: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
): void {
  // 应用平移转换
  const position = convertROSTranslationToThree(rosTransform.translation)
  object.position.copy(position)
  
  // 应用旋转转换
  const quaternion = convertROSRotationToThree(rosTransform.rotation)
  object.quaternion.copy(quaternion)
}

/**
 * 创建ROS坐标轴的可视化对象（统一标准版）
 * 
 * 所有组件（TF、Axes组件）必须使用此函数创建坐标轴，确保一致性
 * 
 * 坐标轴方向（在THREE.js坐标系中）：
 * - X轴（红色）：沿 THREE.js X 轴方向（向右）
 * - Y轴（绿色）：沿 THREE.js -Z 轴方向（向后，对应ROS Y向左）
 * - Z轴（蓝色）：沿 THREE.js Y 轴方向（向上，对应ROS Z向上）
 *
 * @param axisLength 坐标轴长度
 * @param axisRadius 坐标轴半径
 * @returns THREE.Group 包含三个坐标轴的对象
 */
export function createROSAxes(axisLength: number = 1, axisRadius: number = 0.01): THREE.Group {
  const axesGroup = new THREE.Group()
  axesGroup.name = 'ROS_Axes'

  // X 轴（红色）- ROS X 向前 → THREE.js X 方向（向右）
  const xGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const xAxis = new THREE.Mesh(xGeometry, xMaterial)
  xAxis.rotation.z = Math.PI / 2  // 旋转到 X 轴方向
  xAxis.position.x = axisLength / 2
  xAxis.name = 'ROS_X_Axis'
  axesGroup.add(xAxis)

  // Y 轴（绿色）- ROS Y 向左 → THREE.js -Z 方向（向后，取反）
  const yGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  const yAxis = new THREE.Mesh(yGeometry, yMaterial)
  yAxis.rotation.x = Math.PI / 2  // 旋转到 Z 轴方向
  yAxis.position.z = -axisLength / 2  // 负 Z 方向（对应 ROS Y 向左）
  yAxis.name = 'ROS_Y_Axis'
  axesGroup.add(yAxis)

  // Z 轴（蓝色）- ROS Z 向上 → THREE.js Y 方向（向上）
  const zGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
  const zAxis = new THREE.Mesh(zGeometry, zMaterial)
  zAxis.position.y = axisLength / 2  // Y 方向（向上，对应 ROS Z 向上）
  zAxis.name = 'ROS_Z_Axis'
  axesGroup.add(zAxis)

  return axesGroup
}

/**
 * 根据ROS平面类型设置THREE.js网格的旋转（统一标准版）
 * 
 * Grid 必须使用此函数设置旋转，确保与TF、Axes、LaserScan一致
 *
 * @param plane ROS平面类型 ('XY', 'XZ', 'YZ')
 * @returns THREE.Euler 旋转角度
 */
export function getROSGridRotation(plane: 'XY' | 'XZ' | 'YZ'): THREE.Euler {
  switch (plane) {
    case 'XY':
      // ROS XY 平面：网格线沿 ROS X（THREE.js X）和 ROS Y（THREE.js -Z）
      // GridHelper默认在XY平面，但ROS XY平面对应THREE.js的XZ平面（Y=0）
      // 绕X轴旋转-90度，使XY平面变为XZ平面
      return new THREE.Euler(-Math.PI / 2, 0, 0)
    case 'XZ':
      // ROS XZ 平面：网格线沿 ROS X（THREE.js X）和 ROS Z（THREE.js Y）
      // 这对应THREE.js的XY平面，GridHelper默认就在XY平面
      return new THREE.Euler(0, 0, 0)
    case 'YZ':
      // ROS YZ 平面：网格线沿 ROS Y（THREE.js -Z）和 ROS Z（THREE.js Y）
      // 这对应THREE.js的YZ平面，需要绕Z轴旋转90度
      return new THREE.Euler(0, 0, Math.PI / 2)
    default:
      return new THREE.Euler(-Math.PI / 2, 0, 0) // 默认XY平面
  }
}

/**
 * 转换ROS位置偏移到THREE.js坐标系
 *
 * @param rosOffset ROS坐标系下的偏移 {x, y, z}
 * @returns THREE.Vector3 THREE.js坐标系下的偏移
 */
export function convertROSOffsetToThree(rosOffset: { x: number; y: number; z: number }): THREE.Vector3 {
  return convertROSTranslationToThree(rosOffset)
}

/**
 * THREE.js 坐标转换为 ROS 坐标（反向转换）
 * 
 * 转换公式：THREE.js(x, y, z) → ROS(x, -z, y)
 * 
 * @param threePosition THREE.js Vector3 坐标
 * @returns ROS 坐标 {x, y, z}
 */
export function convertThreeToROSTranslation(threePosition: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: threePosition.x,    // THREE.js X → ROS X
    y: -threePosition.z,   // THREE.js -Z → ROS Y（取反）
    z: threePosition.y     // THREE.js Y → ROS Z
  }
}
