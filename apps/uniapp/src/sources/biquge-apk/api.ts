import { aesCbcDecryptBase64 } from '../aes'
import type { BookItem, ChapterItem } from '../types'
import { apiGet, apiGetAbsolute, tryGuestToken } from './client'
import { SEARCH_HOST_TRIES, SOURCE_ID } from './constants'

export interface NovelRow {
  novelId?: number | string
  novelName?: string
  authorName?: string
  cover?: string
  summary?: string
  className?: string
  tagName?: string
  wordNum?: string | number
  chapterName?: string
  lastUpdatedAt?: string
  hotInfo?: string
  readInfo?: string | number
  lastChapter?: { chapterName?: string; decTime?: string }
}

export interface ChapterRow {
  chapterId?: number | string
  chapterName?: string
  path?: string
  updatedAt?: string
  wordNum?: string | number
}

function packBookId(novelId: string | number) {
  return `${SOURCE_ID}:${novelId}`
}

function unpackBookId(bookId: string) {
  return bookId.startsWith(`${SOURCE_ID}:`) ? bookId.slice(SOURCE_ID.length + 1) : bookId
}

function packChapterId(novelId: string, chapterId: string | number) {
  return `${SOURCE_ID}:${novelId}:${chapterId}`
}

export function unpackChapterId(chapterId: string): { novelId: string; chapterId: string } {
  const raw = chapterId.startsWith(`${SOURCE_ID}:`) ? chapterId.slice(SOURCE_ID.length + 1) : chapterId
  const [novelId, ...rest] = raw.split(':')
  return { novelId, chapterId: rest.join(':') }
}

function asNovelList(data: unknown): NovelRow[] {
  if (Array.isArray(data)) return data as NovelRow[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.list)) return obj.list as NovelRow[]
    if (Array.isArray(obj.data)) return obj.data as NovelRow[]
  }
  return []
}

export function mapBook(row: NovelRow): BookItem | null {
  const id = row.novelId
  if (id == null || id === '') return null
  const kind = [row.className, row.tagName].filter(Boolean).join(' · ')
  const introParts = [
    row.summary,
    kind ? `分类：${kind}` : '',
    row.wordNum != null ? `字数：${row.wordNum}` : '',
  ].filter(Boolean)
  return {
    id: packBookId(id),
    source: SOURCE_ID,
    title: (row.novelName || '').trim() || '未知书名',
    author: (row.authorName || '').trim() || '未知',
    cover: row.cover || undefined,
    intro: introParts.join('\n') || undefined,
    type: 'text',
    raw: row,
  }
}

function cleanChapterName(name: string): string {
  return name
    .replace(/正文卷\.|正文\.|VIP卷\.|默认卷\.|卷_|VIP章节\.|免费章节\.|章节目录\.|最新章节\./g, '')
    .replace(/[（(【][^）)】]*[求更票谢乐发订合补加架字修Kk][^）)】]*[）)】]/g, '')
    .trim()
}

function cleanContent(text: string): string {
  return text
    .replace(/一秒记住[\s\S]*?精彩阅读。/g, '')
    .replace(/看无广告[\s\S]*?/g, '')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}

/** 搜索 */
export async function searchNovels(keyword: string, page = 1): Promise<BookItem[]> {
  void tryGuestToken()
  const q = keyword.trim() || '热门'
  const data = await apiGet<NovelRow[] | { list?: NovelRow[] }>(
    `/search?keyword=${encodeURIComponent(q)}&page=${page}`,
    SEARCH_HOST_TRIES,
  )
  const items: BookItem[] = []
  for (const row of asNovelList(data)) {
    const book = mapBook(row)
    if (book) items.push(book)
    if (items.length >= 40) break
  }
  return items
}

/** 详情 */
export async function getNovelDetail(bookId: string): Promise<BookItem> {
  void tryGuestToken()
  const novelId = unpackBookId(bookId)
  const data = await apiGet<NovelRow>(`/novel/${encodeURIComponent(novelId)}?isSearch=1`)
  const book = mapBook({ ...data, novelId: data?.novelId ?? novelId })
  if (!book) throw new Error('详情为空')
  return book
}

/** 目录 */
export async function getNovelChapters(bookId: string): Promise<ChapterItem[]> {
  void tryGuestToken()
  const novelId = unpackBookId(bookId)
  const data = await apiGet<{ list?: ChapterRow[] }>(
    `/novel/${encodeURIComponent(novelId)}/chapters?readNum=1`,
  )
  const list = Array.isArray(data?.list) ? data.list : (asNovelList(data) as ChapterRow[])
  return list.map((row, i) => {
    const cid = row.chapterId ?? i
    return {
      id: packChapterId(novelId, cid),
      bookId: packBookId(novelId),
      title: cleanChapterName(row.chapterName || `第${i + 1}章`),
      index: i,
      contentUrl: row.path ? aesCbcDecryptBase64(row.path) || undefined : undefined,
    }
  })
}

/** 正文 */
export async function getChapterContent(chapterId: string): Promise<string> {
  const { novelId, chapterId: cid } = unpackChapterId(chapterId)
  const chapters = await getNovelChapters(packBookId(novelId))
  const hit = chapters.find((c) => c.id === chapterId || c.id.endsWith(`:${cid}`))
  const contentUrl = hit?.contentUrl || ''
  if (!contentUrl) throw new Error('章节地址解密失败')

  const data = await apiGetAbsolute<{ content?: string } | { data?: { content?: string } }>(contentUrl)
  let text = ''
  if (data && typeof data === 'object') {
    if ('content' in data && typeof data.content === 'string') text = data.content
    else if ('data' in data && data.data && typeof data.data.content === 'string') text = data.data.content
  }
  text = cleanContent(text || '')
  if (!text) throw new Error('正文为空')
  return text
}

/**
 * 榜单：GET /module/rank?type=&channel=&page=
 * channel: 1 男频 / 2 女频
 */
export async function getRankNovels(type: number, channel: number, page = 1): Promise<BookItem[]> {
  void tryGuestToken()
  const data = await apiGet<NovelRow[] | { list?: NovelRow[] }>(
    `/module/rank?type=${type}&channel=${channel}&page=${page}`,
    SEARCH_HOST_TRIES,
  )
  return asNovelList(data)
    .map(mapBook)
    .filter((b): b is BookItem => Boolean(b))
    .slice(0, 40)
}

/**
 * 分类列表：GET /novel?sort=1&page=&categoryId=&isComplete?
 * isComplete: 1 完结 / 0 连载 / 省略全部
 */
export async function getCategoryNovels(
  categoryId: string,
  page = 1,
  isComplete?: 0 | 1,
): Promise<BookItem[]> {
  void tryGuestToken()
  let path = `/novel?sort=1&page=${page}&categoryId=${encodeURIComponent(categoryId)}`
  if (isComplete === 0 || isComplete === 1) path += `&isComplete=${isComplete}`
  const data = await apiGet<NovelRow[] | { list?: NovelRow[] }>(path, SEARCH_HOST_TRIES)
  return asNovelList(data)
    .map(mapBook)
    .filter((b): b is BookItem => Boolean(b))
    .slice(0, 40)
}
