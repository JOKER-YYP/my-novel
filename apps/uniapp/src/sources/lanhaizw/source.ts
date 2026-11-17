import type { BookSource } from '../types'
import {
  getChapterContent,
  getNovelChapters,
  getNovelDetail,
  isCaptchaChallenge,
  searchNovels,
} from './api'
import { SOURCE_ID, SOURCE_NAME } from './constants'

export const lanhaizwSource: BookSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  search: async (q) => {
    const result = await searchNovels(q)
    if (isCaptchaChallenge(result)) {
      const err = new Error('NEED_CAPTCHA') as Error & { captcha: typeof result }
      err.captcha = result
      throw err
    }
    return result
  },
  detail: (bookId) => getNovelDetail(bookId),
  chapters: (bookId) => getNovelChapters(bookId),
  resolveContent: async (chapterId) => {
    const result = await getChapterContent(chapterId)
    if (isCaptchaChallenge(result)) {
      const err = new Error('NEED_CAPTCHA') as Error & { captcha: typeof result }
      err.captcha = result
      throw err
    }
    return result
  },
}
