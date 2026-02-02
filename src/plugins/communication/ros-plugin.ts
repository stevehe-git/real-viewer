import { toRaw } from 'vue'
import * as ROSLIB from 'roslib'
import type { CommunicationPlugin, ConnectionParams, ConnectionParam } from '@/stores/types'

export class ROSPlugin implements CommunicationPlugin {
  id = 'ros'
  name = 'ROS'
  description = 'Robot Operating System WebSocket连接'

  private rosInstance: ROSLIB.Ros | null = null
  private rosapiWarningShown = false // 标记是否已显示 rosapi 警告

  getConnectionParams(): ConnectionParam[] {
    return [
      {
        key: 'host',
        label: 'ROS Master主机',
        type: 'text',
        required: true,
        defaultValue: 'localhost',
        placeholder: '输入ROS Master主机地址',
        description: 'ROS Master运行的主机地址'
      },
      {
        key: 'port',
        label: 'WebSocket端口',
        type: 'number',
        required: true,
        defaultValue: 9090,
        placeholder: '输入WebSocket端口',
        description: 'ROS WebSocket服务器端口'
      }
    ]
  }

  private currentParams: ConnectionParams | null = null

  async connect(params: ConnectionParams): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 如果已经存在连接，先断开
      if (this.rosInstance) {
        this.disconnect()
      }

      const { host, port } = params
      console.log(`Connecting to ROS at ${host}:${port}`)

      // 保存当前连接参数
      this.currentParams = { ...params, connected: false }

      // 创建ROS连接
      this.rosInstance = new ROSLIB.Ros({
        url: `ws://${host}:${port}`
      })

      // 连接成功
      this.rosInstance.on('connection', () => {
        console.log('Connected to ROS')
        if (this.currentParams) {
          this.currentParams.connected = true
        }
        resolve(true)
      })

      // 连接错误
      this.rosInstance.on('error', (error) => {
        console.error('ROS connection error:', error)
        if (this.currentParams) {
          this.currentParams.connected = false
        }
        reject(error)
      })

      // 连接关闭
      this.rosInstance.on('close', () => {
        console.log('ROS connection closed')
        if (this.currentParams) {
          this.currentParams.connected = false
        }
      })

      // 设置连接超时
      setTimeout(() => {
        if (!this.currentParams?.connected) {
          reject(new Error('Connection timeout'))
        }
      }, 5000)
    })
  }

  disconnect(): void {
    if (this.rosInstance) {
      console.log('Disconnecting from ROS')
      this.rosInstance.close()
      this.rosInstance = null
    }
    if (this.currentParams) {
      this.currentParams.connected = false
    }
    // 重置警告标志，下次连接时重新显示
    this.rosapiWarningShown = false
  }

  isConnected(): boolean {
    return this.currentParams?.connected || false
  }

  getConnectionInfo(): ConnectionParams & { status: string } {
    return {
      ...(this.currentParams || { host: '', port: 0, connected: false }),
      status: this.currentParams?.connected ? '已连接' : '未连接'
    }
  }

  async getTopics(): Promise<string[]> {
    if (!this.rosInstance || !this.isConnected()) {
      console.warn('[ROSPlugin] getTopics: No ROS instance or not connected')
      return []
    }

    return new Promise((resolve) => {
      // 使用 toRaw 获取原始对象，避免 Vue 响应式代理导致的私有成员访问问题
      const rosInstance = toRaw(this.rosInstance!)
      
      // 方法1: 尝试使用 rosapi 服务（rosbridge_suite 提供）
      // rosapi 是 rosbridge_suite 的一部分，提供 WebSocket 友好的 ROS API
      // 注意：需要运行 rosapi 节点：rosrun rosapi rosapi_node
      const topicsClient = new ROSLIB.Service({
        ros: rosInstance,
        name: '/rosapi/topics',
        serviceType: 'rosapi/Topics'
      })

      // ROSLIB.ServiceRequest 不是构造函数，直接使用对象字面量
      const request = {}

      // 备选方法：尝试使用 /rosapi/topic_list（某些版本的 rosbridge 可能使用这个）
      const tryAlternativeMethod = (resolveFn: (value: string[]) => void) => {
        const altTopicsClient = new ROSLIB.Service({
          ros: rosInstance,
          name: '/rosapi/topic_list',
          serviceType: 'rosapi/TopicList'
        })

        // ROSLIB.ServiceRequest 不是构造函数，直接使用对象字面量
        const altRequest = {}
        const altTimeout = setTimeout(() => {
          console.warn('[ROSPlugin] getTopics: Alternative method also timeout')
          resolveFn([])
        }, 3000)

        altTopicsClient.callService(altRequest, (result: any) => {
          clearTimeout(altTimeout)
          if (result && result.topics && Array.isArray(result.topics)) {
            console.log('[ROSPlugin] getTopics: Got', result.topics.length, 'topics from alternative method')
            resolveFn(result.topics)
          } else {
            console.warn('[ROSPlugin] getTopics: Alternative method returned invalid result')
            resolveFn([])
          }
        }, (error: any) => {
          clearTimeout(altTimeout)
          console.warn('[ROSPlugin] getTopics: Alternative method also failed:', error)
          // 如果所有方法都失败，返回空数组
          // 提示：需要启动 rosapi 节点才能获取话题列表
          // 运行命令：rosrun rosapi rosapi_node
          // 或者：roslaunch rosbridge_server rosbridge_websocket.launch
          console.warn('[ROSPlugin] getTopics: rosapi service not available. To enable topic discovery, run: rosrun rosapi rosapi_node')
          resolveFn([])
        })
      }

      // 设置超时
      const timeout = setTimeout(() => {
        console.warn('[ROSPlugin] getTopics: Timeout waiting for rosapi response')
        // 方法2: 如果 rosapi 超时，尝试使用备选方法
        tryAlternativeMethod(resolve)
      }, 5000)

      topicsClient.callService(request, (result: any) => {
        clearTimeout(timeout)
        if (result && result.topics && Array.isArray(result.topics)) {
          console.log('[ROSPlugin] getTopics: Got', result.topics.length, 'topics from rosapi')
          // 只返回话题列表，不包含类型（即使 result 中有 types）
          resolve(result.topics)
        } else {
          console.warn('[ROSPlugin] getTopics: rosapi returned invalid result:', result)
          // 方法2: 尝试备选方法
          tryAlternativeMethod(resolve)
        }
      }, (error: any) => {
        clearTimeout(timeout)
        // 如果错误明确表示服务不存在，直接返回空数组并提示（只提示一次）
        if (error && (error.toString().includes('does not exist') || error.toString().includes('not exist'))) {
          // 只在第一次遇到这个错误时显示详细提示
          if (!this.rosapiWarningShown) {
            console.info('[ROSPlugin] rosapi service not available. Topic discovery disabled.')
            console.info('[ROSPlugin] To enable: rosrun rosapi rosapi_node (ROS 1) or ros2 run rosapi rosapi_node (ROS 2)')
            console.info('[ROSPlugin] You can still manually type topic names in the dropdown.')
            this.rosapiWarningShown = true
          }
          resolve([])
          return
        }
        // 其他错误，尝试备选方法
        console.warn('[ROSPlugin] getTopics: rosapi service error, trying alternative:', error)
        tryAlternativeMethod(resolve)
      })
    })
  }

  // 获取话题类型
  async getTopicsAndTypes(): Promise<Array<{ topic: string; type: string }>> {
    if (!this.rosInstance || !this.isConnected()) {
      console.warn('[ROSPlugin] getTopicsAndTypes: No ROS instance or not connected')
      return []
    }

    return new Promise((resolve) => {
      // 使用 toRaw 获取原始对象，避免 Vue 响应式代理导致的私有成员访问问题
      const rosInstance = toRaw(this.rosInstance!)
      
      // 方法1: 尝试使用 rosapi 服务（rosbridge_suite 提供）
      const topicsClient = new ROSLIB.Service({
        ros: rosInstance,
        name: '/rosapi/topics_and_types',
        serviceType: 'rosapi/TopicsAndTypes'
      })

      // ROSLIB.ServiceRequest 不是构造函数，直接使用对象字面量
      const request = {}

      // 设置超时
      const timeout = setTimeout(() => {
        console.warn('[ROSPlugin] getTopicsAndTypes: Timeout, falling back to topics only')
        this.getTopics().then(topics => {
          const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
          resolve(topicsAndTypes)
        }).catch(() => {
          resolve([])
        })
      }, 5000)

      topicsClient.callService(request, (result: any) => {
        clearTimeout(timeout)
        if (result && result.topics && result.types) {
          const topicsAndTypes: Array<{ topic: string; type: string }> = []
          const topics = result.topics
          const types = result.types
          
          for (let i = 0; i < topics.length; i++) {
            const topic = topics[i]
            // types[i] 可能是字符串（单个类型）或数组（多个类型）
            let typeValue = ''
            if (types[i]) {
              if (Array.isArray(types[i])) {
                // 如果是数组，取第一个
                typeValue = types[i].length > 0 ? types[i][0] : ''
              } else if (typeof types[i] === 'string') {
                // 如果是字符串，直接使用
                typeValue = types[i]
              }
            }
            
            topicsAndTypes.push({
              topic: topic,
              type: typeValue
            })
          }
          console.log('[ROSPlugin] getTopicsAndTypes: Got', topicsAndTypes.length, 'topics with types')
          // 统计有类型信息的话题数量
          const withType = topicsAndTypes.filter(t => t.type && t.type !== '').length
          console.log('[ROSPlugin] getTopicsAndTypes: Topics with type info:', withType, 'out of', topicsAndTypes.length)
          // 显示一些示例，包括类型信息
          const samples = topicsAndTypes.slice(0, 10).map(t => `${t.topic} (${t.type || 'no type'})`)
          console.log('[ROSPlugin] getTopicsAndTypes: Sample topics:', samples)
          resolve(topicsAndTypes)
        } else {
          console.warn('[ROSPlugin] getTopicsAndTypes: rosapi returned invalid result:', result)
          // 方法2: 如果 rosapi topics_and_types 不可用，尝试直接调用 /rosapi/topics
          // 某些版本的 rosapi，/rosapi/topics 也返回类型信息
          const fallbackClient = new ROSLIB.Service({
            ros: rosInstance,
            name: '/rosapi/topics',
            serviceType: 'rosapi/Topics'
          })
          
          fallbackClient.callService({}, (fallbackResult: any) => {
            if (fallbackResult && fallbackResult.topics && fallbackResult.types) {
              // /rosapi/topics 也返回了类型信息，使用它
              const topicsAndTypes: Array<{ topic: string; type: string }> = []
              const topics = fallbackResult.topics
              const types = fallbackResult.types
              
              for (let i = 0; i < topics.length; i++) {
                let typeValue = ''
                if (types[i]) {
                  if (Array.isArray(types[i])) {
                    typeValue = types[i].length > 0 ? types[i][0] : ''
                  } else if (typeof types[i] === 'string') {
                    typeValue = types[i]
                  }
                }
                topicsAndTypes.push({
                  topic: topics[i],
                  type: typeValue
                })
              }
              console.log('[ROSPlugin] getTopicsAndTypes: Got types from /rosapi/topics fallback')
              resolve(topicsAndTypes)
            } else if (fallbackResult && fallbackResult.topics) {
              // 只有话题列表，没有类型
              const topicsAndTypes = fallbackResult.topics.map((topic: string) => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            } else {
              // 回退到 getTopics
              this.getTopics().then(topics => {
                const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
                resolve(topicsAndTypes)
              }).catch(() => {
                resolve([])
              })
            }
          }, () => {
            // 回退到 getTopics
            this.getTopics().then(topics => {
              const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            }).catch(() => {
              resolve([])
            })
          })
        }
      }, (error: any) => {
        clearTimeout(timeout)
        // 如果错误明确表示服务不存在，使用警告标志避免重复提示
        if (error && (error.toString().includes('does not exist') || error.toString().includes('not exist'))) {
          // 只在第一次遇到这个错误时显示提示（getTopics 已经显示过了）
          // 方法2: 如果 rosapi topics_and_types 不可用，尝试直接调用 /rosapi/topics
          // 某些版本的 rosapi，/rosapi/topics 也返回类型信息
          const fallbackClient = new ROSLIB.Service({
            ros: rosInstance,
            name: '/rosapi/topics',
            serviceType: 'rosapi/Topics'
          })
          
          fallbackClient.callService({}, (fallbackResult: any) => {
            if (fallbackResult && fallbackResult.topics && fallbackResult.types) {
              // /rosapi/topics 也返回了类型信息，使用它
              const topicsAndTypes: Array<{ topic: string; type: string }> = []
              const topics = fallbackResult.topics
              const types = fallbackResult.types
              
              for (let i = 0; i < topics.length; i++) {
                let typeValue = ''
                if (types[i]) {
                  if (Array.isArray(types[i])) {
                    typeValue = types[i].length > 0 ? types[i][0] : ''
                  } else if (typeof types[i] === 'string') {
                    typeValue = types[i]
                  }
                }
                topicsAndTypes.push({
                  topic: topics[i],
                  type: typeValue
                })
              }
              console.log('[ROSPlugin] getTopicsAndTypes: Got types from /rosapi/topics fallback')
              resolve(topicsAndTypes)
            } else if (fallbackResult && fallbackResult.topics) {
              // 只有话题列表，没有类型
              const topicsAndTypes = fallbackResult.topics.map((topic: string) => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            } else {
              // 回退到 getTopics
              this.getTopics().then(topics => {
                const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
                resolve(topicsAndTypes)
              }).catch(() => {
                resolve([])
              })
            }
          }, () => {
            // 回退到 getTopics
            this.getTopics().then(topics => {
              const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            }).catch(() => {
              resolve([])
            })
          })
        } else {
          // 其他错误才显示警告
          console.warn('[ROSPlugin] getTopicsAndTypes: rosapi service error, falling back to topics only:', error)
          // 尝试直接调用 /rosapi/topics
          const fallbackClient = new ROSLIB.Service({
            ros: rosInstance,
            name: '/rosapi/topics',
            serviceType: 'rosapi/Topics'
          })
          
          fallbackClient.callService({}, (fallbackResult: any) => {
            if (fallbackResult && fallbackResult.topics && fallbackResult.types) {
              // /rosapi/topics 也返回了类型信息，使用它
              const topicsAndTypes: Array<{ topic: string; type: string }> = []
              const topics = fallbackResult.topics
              const types = fallbackResult.types
              
              for (let i = 0; i < topics.length; i++) {
                let typeValue = ''
                if (types[i]) {
                  if (Array.isArray(types[i])) {
                    typeValue = types[i].length > 0 ? types[i][0] : ''
                  } else if (typeof types[i] === 'string') {
                    typeValue = types[i]
                  }
                }
                topicsAndTypes.push({
                  topic: topics[i],
                  type: typeValue
                })
              }
              console.log('[ROSPlugin] getTopicsAndTypes: Got types from /rosapi/topics fallback')
              resolve(topicsAndTypes)
            } else if (fallbackResult && fallbackResult.topics) {
              const topicsAndTypes = fallbackResult.topics.map((topic: string) => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            } else {
              this.getTopics().then(topics => {
                const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
                resolve(topicsAndTypes)
              }).catch(() => {
                resolve([])
              })
            }
          }, () => {
            this.getTopics().then(topics => {
              const topicsAndTypes = topics.map(topic => ({ topic, type: '' }))
              resolve(topicsAndTypes)
            }).catch(() => {
              resolve([])
            })
          })
        }
      })
    })
  }

  // 获取 ROS 实例
  getROSInstance(): ROSLIB.Ros | null {
    // 使用 toRaw 返回原始对象，避免 Vue 响应式代理导致的私有成员访问问题
    return this.rosInstance ? toRaw(this.rosInstance) : null
  }
}

// 创建ROS插件实例
export const rosPlugin = new ROSPlugin()