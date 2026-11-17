import { listAllSources } from '../sources/registry'
import type { BookItem } from '../sources/types'
import { withTimeout } from '../sources/http'
import { useSettingsStore } from '../stores/settings'

export interface SearchError {
  source: string
  message: string
}

export interface SearchResult {
  items: BookItem[]
  errors: SearchError[]
}

function dedupe(items: BookItem[]): BookItem[] {
  const seen = new Set<string>()
  const out: BookItem[] = []
  for (const item of items) {
    const key = `${item.source}|${item.title}|${item.author}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** 多源并行搜索（红薯 + 布谷） */
export async function searchBooks(q: string): Promise<SearchResult> {
  const keyword = q.trim()
  if (!keyword) return { items: [], errors: [] }

  const settings = useSettingsStore()
  const timeoutMs = settings.searchTimeoutMs || 45000
  const enabled = new Set(settings.enabledSourceIds)
  const sources = listAllSources().filter((s) => enabled.has(s.id))

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const items = await withTimeout(source.search(keyword), timeoutMs)
      return { source: source.name, items }
    }),
  )

  const items: BookItem[] = []
  const errors: SearchError[] = []

  settled.forEach((result, i) => {
    const source = sources[i]
    if (!source) return
    if (result.status === 'fulfilled') {
      items.push(...result.value.items)
    } else {
      const reason = result.reason
      errors.push({
        source: source.name,
        message: reason instanceof Error ? reason.message : String(reason),
      })
    }
  })

  return { items: dedupe(items), errors }
}
