/**
 * URDF 加载服务
 * 负责加载和解析 URDF 文件，转换为 THREE.js 场景对象
 */
import * as THREE from 'three'
import URDFLoader from 'urdf-loader'
import { convertROSTranslationToThree, convertROSRotationToThree } from './coordinateConverter'

export interface URDFLoadOptions {
  /** 包路径映射，用于处理 package:// 路径 */
  packages?: Record<string, string>
  /** 加载管理器，用于管理资源加载 */
  manager?: THREE.LoadingManager
  /** 是否显示碰撞体 */
  showCollision?: boolean
  /** 是否显示视觉模型 */
  showVisual?: boolean
}

export interface RobotModel {
  /** THREE.js 场景对象 */
  scene: THREE.Group
  /** 关节映射表 */
  joints: Map<string, any>
  /** 链接映射表 */
  links: Map<string, THREE.Object3D>
  /** 设置关节值 */
  setJointValue: (jointName: string, value: number) => void
  /** 获取关节值 */
  getJointValue: (jointName: string) => number | null
  /** 更新关节状态 */
  updateJointStates: (jointStates: Record<string, number>) => void
}

/**
 * URDF 加载器类
 */
export class URDFLoaderService {
  private loader: URDFLoader
  private manager: THREE.LoadingManager

  constructor(manager?: THREE.LoadingManager) {
    this.manager = manager || new THREE.LoadingManager()
    this.loader = new URDFLoader(this.manager)
  }

  /**
   * 加载 URDF 文件
   * @param urdfUrl URDF 文件 URL 或内容
   * @param options 加载选项
   * @returns Promise<RobotModel>
   */
  async loadURDF(
    urdfUrl: string,
    options: URDFLoadOptions = {}
  ): Promise<RobotModel> {
    const {
      packages = {},
      showCollision = false,
      showVisual = true
    } = options

    // 设置包路径映射
    this.loader.packages = packages

    return new Promise((resolve, reject) => {
      this.loader.load(
        urdfUrl,
        (robot: any) => {
          try {
            const robotModel = this.processRobotModel(robot, {
              showCollision,
              showVisual
            })
            resolve(robotModel)
          } catch (error) {
            reject(error)
          }
        },
        undefined,
        (error: Error) => {
          reject(error)
        }
      )
    })
  }

  /**
   * 从 ROS 参数加载 URDF
   * 通过 ROS 话题或参数服务器获取 robot_description
   * @param ros ROS 连接实例
   * @param paramName 参数名称，默认为 'robot_description'
   * @param options 加载选项
   * @returns Promise<RobotModel>
   */
  async loadURDFFromROSParam(
    ros: any,
    paramName: string = 'robot_description',
    options: URDFLoadOptions = {}
  ): Promise<RobotModel> {
    return new Promise((resolve, reject) => {
      const param = new ros.Param({ name: paramName })
      param.get((urdfString: string) => {
        if (!urdfString) {
          reject(new Error(`Parameter ${paramName} not found`))
          return
        }

        // 将 URDF 字符串转换为 Blob URL
        const blob = new Blob([urdfString], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)

        this.loadURDF(url, options)
          .then((robotModel) => {
            URL.revokeObjectURL(url)
            resolve(robotModel)
          })
          .catch((error) => {
            URL.revokeObjectURL(url)
            reject(error)
          })
      })
    })
  }

  /**
   * 处理机器人模型，创建关节和链接映射
   */
  private processRobotModel(
    robot: any,
    options: { showCollision: boolean; showVisual: boolean }
  ): RobotModel {
    const joints = new Map<string, any>()
    const links = new Map<string, THREE.Object3D>()

    // 遍历机器人对象，提取关节和链接信息
    robot.traverse((child: THREE.Object3D) => {
      if (child.userData?.joint) {
        const joint = child.userData.joint
        joints.set(joint.name, {
          object: child,
          joint: joint,
          type: joint.type,
          axis: joint.axis,
          limits: joint.limits
        })
      }

      if (child.userData?.link) {
        const link = child.userData.link
        links.set(link.name, child)
      }
    })

    // 设置关节值的函数
    const setJointValue = (jointName: string, value: number) => {
      const jointInfo = joints.get(jointName)
      if (!jointInfo) {
        console.warn(`Joint ${jointName} not found`)
        return
      }

      const { joint, object } = jointInfo

      // 根据关节类型设置值
      if (joint.type === 'revolute' || joint.type === 'continuous') {
        // 旋转关节
        const axis = joint.axis || { x: 0, y: 0, z: 1 }
        const axisVector = new THREE.Vector3(axis.x, axis.y, axis.z).normalize()
        
        // 应用旋转
        object.rotation.setFromAxisAngle(axisVector, value)
      } else if (joint.type === 'prismatic') {
        // 平移关节
        const axis = joint.axis || { x: 1, y: 0, z: 0 }
        const axisVector = new THREE.Vector3(axis.x, axis.y, axis.z).normalize()
        
        // 应用平移
        object.position.copy(axisVector.multiplyScalar(value))
      }
    }

    // 获取关节值的函数
    const getJointValue = (jointName: string): number | null => {
      const jointInfo = joints.get(jointName)
      if (!jointInfo) return null

      const { joint, object } = jointInfo
      if (joint.type === 'revolute' || joint.type === 'continuous') {
        // 从旋转中提取角度
        const axis = joint.axis || { x: 0, y: 0, z: 1 }
        const axisVector = new THREE.Vector3(axis.x, axis.y, axis.z).normalize()
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axisVector, 0)
        const currentQuat = object.quaternion.clone()
        // 简化处理：返回绕轴旋转的角度
        return object.rotation.z // 简化实现
      } else if (joint.type === 'prismatic') {
        const axis = joint.axis || { x: 1, y: 0, z: 0 }
        const axisVector = new THREE.Vector3(axis.x, axis.y, axis.z)
        return object.position.dot(axisVector)
      }
      return null
    }

    // 批量更新关节状态
    const updateJointStates = (jointStates: Record<string, number>) => {
      Object.entries(jointStates).forEach(([name, value]) => {
        setJointValue(name, value)
      })
    }

    // 应用坐标转换：ROS → THREE.js
    // URDF 中的坐标系是 ROS 坐标系，需要转换到 THREE.js 坐标系
    robot.traverse((child: THREE.Object3D) => {
      if (child.position) {
        // 转换位置：ROS(x, y, z) → THREE.js(x, z, -y)
        const rosPos = { x: child.position.x, y: child.position.y, z: child.position.z }
        const threePos = convertROSTranslationToThree(rosPos)
        child.position.copy(threePos)
      }
    })

    return {
      scene: robot,
      joints,
      links,
      setJointValue,
      getJointValue,
      updateJointStates
    }
  }

  /**
   * 释放资源
   */
  dispose() {
    // 清理加载管理器
    if (this.manager) {
      this.manager = new THREE.LoadingManager()
    }
  }
}

// 导出单例实例
export const urdfLoaderService = new URDFLoaderService()
