import type { BookSource } from '../types'
import {
  getChapterContent,
  getNovelChapters,
  getNovelDetail,
  searchNovels,
} from './api'
import { SOURCE_ID, SOURCE_NAME } from './constants'

/** BookSource 适配：仅阅读链路，不含登录/广告/充值 */
export const biqugeApkSource: BookSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  search: (q) => searchNovels(q, 1),
  detail: (bookId) => getNovelDetail(bookId),
  chapters: (bookId) => getNovelChapters(bookId),
  resolveContent: (chapterId) => getChapterContent(chapterId),
}
