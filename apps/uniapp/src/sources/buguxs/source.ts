import type { BookSource } from '../types'
import { getChapterContent, getNovelChapters, getNovelDetail, searchNovels } from './api'
import { SOURCE_ID, SOURCE_NAME } from './constants'

export const buguxsSource: BookSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  search: (q) => searchNovels(q),
  detail: (bookId) => getNovelDetail(bookId),
  chapters: (bookId) => getNovelChapters(bookId),
  resolveContent: (chapterId) => getChapterContent(chapterId),
}
