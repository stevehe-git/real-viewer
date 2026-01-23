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

    switch (componentType) {
      case 'map':
        return !!(message.info && message.data && message.data.length > 0)
      case 'path':
        return !!(message.poses && message.poses.length > 0)
      case 'laserscan':
        return !!(message.ranges && message.ranges.length > 0)
      case 'pointcloud2':
        return !!(message.data && message.data.length > 0)
      case 'marker':
        return true
      case 'image':
      case 'camera':
        return !!(message.data && message.data.length > 0)
      default:
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
