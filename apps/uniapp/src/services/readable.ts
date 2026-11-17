import type { BookItem } from '../sources/types'

const READABLE_SOURCE_IDS = ['hongshu', 'buguxs', 'xs800'] as const

export function isDirectlyReadable(bookOrSource: BookItem | string | null | undefined): boolean {
  if (!bookOrSource) return false
  const source = typeof bookOrSource === 'string' ? bookOrSource : bookOrSource.source
  return (READABLE_SOURCE_IDS as readonly string[]).includes(source)
}

export function resolveReadableBook(book: BookItem): BookItem {
  return book
}
