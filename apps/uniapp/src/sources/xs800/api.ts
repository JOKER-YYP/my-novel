import { absUrl, decodeHtml, matchAll, stripTags } from '../html'
import type { BookItem, ChapterItem } from '../types'
import { getHtml, postForm } from './client'
import {
  BASE_URL,
  SEARCH_URL,
  SOURCE_ID,
  bookUrl,
  chapterUrl,
  coverUrl,
  packBookId,
  packChapterId,
  tocUrl,
  unpackBookId,
  unpackChapterId,
} from './constants'

export async function searchNovels(keyword: string): Promise<BookItem[]> {
  const q = keyword.trim()
  if (!q) return []
  const html = await postForm(SEARCH_URL, { s: q }, BASE_URL + '/')
  const items: BookItem[] = []
  const seen = new Set<string>()

  const listHtml =
    html.match(/<ul[^>]*class=["'][^"']*sort_list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || html

  for (const m of matchAll(
    listHtml,
    /<li[^>]*>[\s\S]*?href=["']\/book_(\d+)\/["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?class=["']s5["'][^>]*>([\s\S]*?)<\/span>/gi,
  )) {
    const id = m[1]
    const title = decodeHtml(stripTags(m[2] || '')).trim()
    const author = decodeHtml(stripTags(m[3] || '')).replace(/\u00a0/g, ' ').trim() || '未知'
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    items.push({
      id: packBookId(id),
      source: SOURCE_ID,
      title,
      author,
      cover: coverUrl(id),
      type: 'text',
      raw: { bookId: id },
    })
  }

  if (items.length) return items

  // 兜底：只在搜索结果列表内抓取，避免封面推荐噪音
  for (const m of matchAll(listHtml, /href=["']\/book_(\d+)\/["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = m[1]
    const title = decodeHtml(stripTags(m[2] || '')).trim()
    if (!id || !title || title.length < 2 || seen.has(id)) continue
    seen.add(id)
    items.push({
      id: packBookId(id),
      source: SOURCE_ID,
      title,
      author: '未知',
      cover: coverUrl(id),
      type: 'text',
      raw: { bookId: id },
    })
  }
  return items
}

export async function getNovelDetail(entityId: string): Promise<BookItem> {
  const bookId = unpackBookId(entityId)
  const html = await getHtml(bookUrl(bookId), { referer: BASE_URL + '/' })
  const title =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    `小说${bookId}`
  const author =
    html.match(/property=["']og:novel:author["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(html.match(/作\s*者[：:\s]*<\/?\w+[^>]*>\s*([^<]+)/i)?.[1] || '') ||
    '未知'
  const intro =
    html.match(/property=["']og:description["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(html.match(/class=["'][^"']*intro[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '')
  const cover =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] || coverUrl(bookId)
  return {
    id: packBookId(bookId),
    source: SOURCE_ID,
    title: decodeHtml(stripTags(title)).trim(),
    author: decodeHtml(author).trim() || '未知',
    cover: absUrl(BASE_URL, cover),
    intro: intro ? decodeHtml(stripTags(intro)).slice(0, 500) : undefined,
    type: 'text',
    raw: { bookId },
  }
}

function parseChapterList(html: string, bookId: string): ChapterItem[] {
  const block =
    html.match(/<ul[^>]*class=["'][^"']*chapter-list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || ''
  const items: ChapterItem[] = []
  const seen = new Set<string>()
  for (const m of matchAll(
    block,
    new RegExp(`href=["']/book_${bookId}/(\\d+)\\.html["'][^>]*>([^<]*)`, 'gi'),
  )) {
    const cid = m[1]
    const title = decodeHtml(stripTags(m[2] || '')).trim()
    if (!cid || !title || seen.has(cid)) continue
    seen.add(cid)
    items.push({
      id: packChapterId(bookId, cid),
      bookId: packBookId(bookId),
      title,
      index: items.length,
      contentUrl: chapterUrl(bookId, cid),
    })
  }
  return items
}

function detectMaxTocPage(html: string, bookId: string): number {
  const pages = matchAll(html, new RegExp(`/book_${bookId}/ml(\\d+)\\.html`, 'gi'))
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0)
  return pages.length ? Math.max(...pages) : 1
}

export async function getNovelChapters(entityId: string): Promise<ChapterItem[]> {
  const bookId = unpackBookId(entityId)
  const firstHtml = await getHtml(tocUrl(bookId, 1), { referer: bookUrl(bookId) })
  const maxPage = detectMaxTocPage(firstHtml, bookId)
  const pageHtmls = [firstHtml]
  if (maxPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: maxPage - 1 }, (_, i) =>
        getHtml(tocUrl(bookId, i + 2), { referer: bookUrl(bookId) }),
      ),
    )
    pageHtmls.push(...rest)
  }

  const items: ChapterItem[] = []
  const seen = new Set<string>()
  for (const html of pageHtmls) {
    for (const ch of parseChapterList(html, bookId)) {
      if (seen.has(ch.id)) continue
      seen.add(ch.id)
      items.push(ch)
    }
  }

  if (!items.length) {
    const detailHtml = await getHtml(bookUrl(bookId), { referer: BASE_URL + '/' })
    for (const ch of parseChapterList(detailHtml, bookId)) {
      if (seen.has(ch.id)) continue
      seen.add(ch.id)
      items.push(ch)
    }
  }

  if (!items.length) throw new Error('目录解析失败')
  items.forEach((c, i) => {
    c.index = i
  })
  return items
}

export async function getChapterContent(chapterEntityId: string): Promise<string> {
  const { bookId, chapterId } = unpackChapterId(chapterEntityId)
  if (!bookId || !chapterId) throw new Error('invalid chapter id')
  const html = await getHtml(chapterUrl(bookId, chapterId), { referer: bookUrl(bookId) })
  const block =
    html.match(/id=["']txt["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/class=["']txt["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    ''
  const text = stripTags(block)
    .replace(/请收藏本站[^\n]*/g, '')
    .replace(/800小说[^\n]*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) throw new Error('正文解析失败')
  return text
}
