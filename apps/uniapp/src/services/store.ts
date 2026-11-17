import {
  CATEGORIES,
  RANK_TABS,
  getCategoryNovels,
  getRankNovels,
} from '../sources/hongshu'
import type { BookItem } from '../sources/types'

export { CATEGORIES, RANK_TABS }

export async function fetchRank(
  type: number,
  _channel: 1 | 2 = 1,
  _page = 1,
): Promise<BookItem[]> {
  const tab = RANK_TABS.find((t) => t.type === type) || RANK_TABS[0]
  return getRankNovels(tab?.path || '/rankboy.html')
}

export async function fetchCategory(
  categoryId: string,
  page = 1,
  _isComplete?: 0 | 1,
): Promise<BookItem[]> {
  return getCategoryNovels(categoryId, page)
}
