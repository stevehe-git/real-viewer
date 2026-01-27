/**
 * 数据转换层
 * 支持多种数据格式：ROS/protobuf/json
 * 将不同格式的数据转换为统一的内部格式
 */

export type DataFormat = 'ros' | 'protobuf' | 'json'

export interface UnifiedMessage {
  format: DataFormat
  type: string
  data: any
  timestamp: number
}

/**
 * ROS 数据转换器
 */
export class ROSDataConverter {
  /**
   * 检查数据是否有效
   */
  static isValidData(message: any, componentType: string): boolean {
    if (!message) return false

    // 如果消息是对象但没有属性，认为无效
    if (typeof message === 'object' && Object.keys(message).length === 0) {
      return false
    }

    switch (componentType) {
      case 'map':
        // 检查必需字段：info 和 data
        if (!message.info || !message.data) return false
        // data 可以是数组或字符串（base64编码）
        return Array.isArray(message.data) ? message.data.length > 0 : typeof message.data === 'string' && message.data.length > 0
      case 'path':
        return !!(message.poses && Array.isArray(message.poses) && message.poses.length > 0)
      case 'laserscan':
        return !!(message.ranges && Array.isArray(message.ranges) && message.ranges.length > 0)
      case 'pointcloud2':
        // data 可以是数组或字符串
        if (!message.data) return false
        return Array.isArray(message.data) ? message.data.length > 0 : typeof message.data === 'string' && message.data.length > 0
      case 'marker':
        // Marker 消息总是有效的（即使为空对象）
        return true
      case 'image':
      case 'camera':
        // 检查必需字段：data, width, height
        if (!message.data) return false
        // data 可以是数组、字符串（base64）或 Uint8Array
        const hasValidData = Array.isArray(message.data) ? message.data.length > 0 :
                            typeof message.data === 'string' ? message.data.length > 0 :
                            message.data instanceof Uint8Array ? message.data.length > 0 : false
        return hasValidData && message.width > 0 && message.height > 0
      default:
        // 对于未知类型，只要消息存在就认为有效
        return true
    }
  }

  /**
   * 转换 ROS 消息为统一格式
   */
  static convert(message: any, componentType: string): UnifiedMessage | null {
    if (!this.isValidData(message, componentType)) {
      return null
    }

    return {
      format: 'ros',
      type: componentType,
      data: message,
      timestamp: Date.now()
    }
  }
}

/**
 * Protobuf 数据转换器（预留）
 */
export class ProtobufDataConverter {
  static convert(message: any, componentType: string): UnifiedMessage | null {
    // TODO: 实现 protobuf 数据转换
    return null
  }
}

/**
 * JSON 数据转换器（预留）
 */
export class JSONDataConverter {
  static convert(message: any, componentType: string): UnifiedMessage | null {
    // TODO: 实现 JSON 数据转换
    return null
  }
}

/**
 * 统一数据转换器
 * 根据数据格式自动选择合适的转换器
 */
export class DataConverter {
  /**
   * 转换数据为统一格式
   */
  static convert(
    message: any,
    componentType: string,
    format: DataFormat = 'ros'
  ): UnifiedMessage | null {
    switch (format) {
      case 'ros':
        return ROSDataConverter.convert(message, componentType)
      case 'protobuf':
        return ProtobufDataConverter.convert(message, componentType)
      case 'json':
        return JSONDataConverter.convert(message, componentType)
      default:
        return ROSDataConverter.convert(message, componentType)
    }
  }

  /**
   * 检查数据是否有效
   */
  static isValidData(message: any, componentType: string, format: DataFormat = 'ros'): boolean {
    switch (format) {
      case 'ros':
        return ROSDataConverter.isValidData(message, componentType)
      case 'protobuf':
        // TODO: 实现 protobuf 数据验证
        return false
      case 'json':
        // TODO: 实现 JSON 数据验证
        return false
      default:
        return ROSDataConverter.isValidData(message, componentType)
    }
  }
}
