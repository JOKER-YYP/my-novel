import type { BookSource } from './types'
import { buguxsSource } from './buguxs'
import { hongshuSource } from './hongshu'
import { xs800Source } from './xs800'

/** 多源并行：红薯中文 + 布谷小说 + 800小说 */
const ALL_SOURCES: BookSource[] = [hongshuSource, buguxsSource, xs800Source]

export function listAllSources(): BookSource[] {
  return ALL_SOURCES
}

export function getSourceById(id: string): BookSource | undefined {
  return ALL_SOURCES.find((s) => s.id === id)
}

export function defaultEnabledSourceIds(): string[] {
  return ALL_SOURCES.map((s) => s.id)
}

export function getSourceFromEntityId(entityId: string): BookSource {
  const sourceId = entityId.split(':')[0]
  const source = sourceId ? getSourceById(sourceId) : undefined
  if (!source) throw new Error(`未知书源: ${sourceId || entityId}`)
  return source
}
