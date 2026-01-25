/**
 * 数组聚合工具函数
 * 完全基于 regl-worldview 的 aggregate.js 实现
 */

/**
 * 接受一个 [value, key] 数组，按 key 聚合
 * 返回一个 Map<key, values[]>，按数组中的 key 顺序
 */
export default function aggregate<T, K>(array: Array<[T, K]>): Map<K, T[]> {
  const aggregationMap = new Map<K, T[]>()
  array.forEach(([item, key]) => {
    const existingItems = aggregationMap.get(key) || []
    existingItems.push(item)
    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, existingItems)
    }
  })
  return aggregationMap
}
