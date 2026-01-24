/**
 * HitmapObjectIdManager
 * 完全基于 regl-worldview 的 HitmapObjectIdManager.js 实现
 */
import type { ObjectHitmapId, Vec4, MouseEventObject } from '../types'
import { intToRGB } from '../commands/utils/commandUtils'

function fillArray(start: number, length: number): number[] {
  return new Array(length).fill(0).map((_, index) => start + index)
}

type CommandType = any // Command<any>

/*
 * This object manages the mapping between objects that are rendered into the scene and their IDs.
 * It supplies an API for generating IDs for a rendered object and then accessing those objects based on their ID.
 */
export default class HitmapObjectIdManager {
  _objectsByObjectHitmapIdMap: { [key: number]: any } = {}
  _commandsByObjectMap: Map<any, CommandType> = new Map()
  _nextObjectHitmapId = 1
  _instanceIndexByObjectHitmapIdMap: { [key: number]: number } = {}

  assignNextColors = (command: CommandType, object: any, count: number): Vec4[] => {
    if (count < 1) {
      throw new Error('Must get at least 1 id')
    }

    const ids: ObjectHitmapId[] = fillArray(this._nextObjectHitmapId, count)
    this._nextObjectHitmapId = ids[ids.length - 1] + 1

    // Instanced rendering - add to the instanced ID map.
    if (count > 1) {
      ids.forEach((id, index) => {
        this._instanceIndexByObjectHitmapIdMap[id] = index
      })
    }

    // Store the mapping of ID to original marker object
    for (const id of ids) {
      this._objectsByObjectHitmapIdMap[id] = object
    }
    this._commandsByObjectMap.set(object, command)

    // Return colors from the IDs.
    const colors = ids.map((id) => intToRGB(id))
    return colors
  }

  getObjectByObjectHitmapId = (objectHitmapId: ObjectHitmapId): MouseEventObject => {
    return {
      object: this._objectsByObjectHitmapIdMap[objectHitmapId],
      instanceIndex: this._instanceIndexByObjectHitmapIdMap[objectHitmapId]
    }
  }

  getCommandForObject = (object: any): CommandType | undefined => {
    return this._commandsByObjectMap.get(object)
  }
}
