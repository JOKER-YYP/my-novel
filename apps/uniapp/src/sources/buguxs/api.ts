import { absUrl, decodeHtml, matchAll, stripTags } from '../html'
import type { BookItem, ChapterItem } from '../types'
import { getHtml, getHtmlWithClearance } from './client'
import {
  BASE_URL,
  SOURCE_ID,
  bookUrl,
  chapterUrl,
  packBookId,
  packChapterId,
  searchUrl,
  tocUrl,
  unpackBookId,
  unpackChapterId,
} from './constants'

function mapSearchBlock(block: string): BookItem | null {
  const idm = block.match(/href=["']\/book\/(\d+)\/(\d+)\/["']/i)
  if (!idm) return null
  const groupId = idm[1]
  const bookId = idm[2]
  const title =
    decodeHtml(
      stripTags(
        block.match(/<h4[^>]*class=["']name["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ||
          block.match(/title=["']([^"']+)["']/i)?.[1] ||
          block.match(/alt=["']([^"']+)["']/i)?.[1] ||
          '',
      ),
    ).trim() || ''
  if (!groupId || !bookId || !title) return null
  const author = decodeHtml(
    stripTags(block.match(/class=["']author["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '未知'),
  ).trim()
  const intro = decodeHtml(
    stripTags(block.match(/class=["']intro["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const coverRaw =
    block.match(/data-src=["']([^"']+)["']/i)?.[1] ||
    block.match(/src=["']([^"']*bookcover[^"']+)["']/i)?.[1] ||
    ''
  return {
    id: packBookId(groupId, bookId),
    source: SOURCE_ID,
    title,
    author: author || '未知',
    cover: coverRaw ? absUrl(BASE_URL, coverRaw) : undefined,
    intro: intro || undefined,
    type: 'text',
    raw: { groupId, bookId },
  }
}

export async function searchNovels(keyword: string): Promise<BookItem[]> {
  const q = keyword.trim()
  if (!q) return []
  const html = await getHtmlWithClearance(searchUrl(q))
  const items: BookItem[] = []
  const seen = new Set<string>()
  for (const m of matchAll(
    html,
    /<div[^>]*class=["'][^"']*book-coverlist[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi,
  )) {
    const book = mapSearchBlock(m[0])
    if (!book || seen.has(book.id)) continue
    seen.add(book.id)
    items.push(book)
  }
  if (items.length) return items

  // 兜底：只按 /book/g/id/ 抓取
  for (const m of matchAll(html, /href=["']\/book\/(\d+)\/(\d+)\/["'][^>]*title=["']([^"']+)["']/gi)) {
    const id = packBookId(m[1], m[2])
    if (seen.has(id)) continue
    seen.add(id)
    items.push({
      id,
      source: SOURCE_ID,
      title: decodeHtml(m[3] || '').trim(),
      author: '未知',
      type: 'text',
      raw: { groupId: m[1], bookId: m[2] },
    })
  }
  return items
}

export async function getNovelDetail(entityId: string): Promise<BookItem> {
  const { groupId, bookId } = unpackBookId(entityId)
  const html = await getHtml(bookUrl(groupId, bookId), { referer: BASE_URL })
  const title =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    `小说${bookId}`
  const author =
    html.match(/property=["']og:novel:author["'][^>]*content=["']([^"']+)/i)?.[1] || '未知'
  const intro =
    html.match(/property=["']og:description["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(html.match(/id=["']bookIntro["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '')
  const cover =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/data-src=["']([^"']*bookcover[^"']+)["']/i)?.[1]
  return {
    id: packBookId(groupId, bookId),
    source: SOURCE_ID,
    title: decodeHtml(title).trim(),
    author: decodeHtml(author).trim(),
    cover: cover ? absUrl(BASE_URL, cover) : undefined,
    intro: intro ? decodeHtml(stripTags(intro)).slice(0, 500) : undefined,
    type: 'text',
    raw: { groupId, bookId },
  }
}

function parseChapters(html: string, groupId: string, bookId: string): ChapterItem[] {
  const items: ChapterItem[] = []
  const seen = new Set<string>()
  const reHref = new RegExp(
    `href=["']/book/${groupId}/${bookId}/(\\d+)\\.html["'][^>]*>([^<]+)`,
    'gi',
  )
  const reOnclick = new RegExp(
    `location\\.href=['']/book/${groupId}/${bookId}/(\\d+)\\.html['']\\)[^>]*>([^<]+)`,
    'gi',
  )
  for (const re of [reHref, reOnclick]) {
    for (const m of matchAll(html, re)) {
      const cid = m[1]
      const title = decodeHtml(stripTags(m[2] || '')).trim()
      if (!cid || !title || seen.has(cid)) continue
      seen.add(cid)
      items.push({
        id: packChapterId(groupId, bookId, cid),
        bookId: packBookId(groupId, bookId),
        title,
        index: items.length,
        contentUrl: chapterUrl(groupId, bookId, cid),
      })
    }
  }
  return items
}

export async function getNovelChapters(entityId: string): Promise<ChapterItem[]> {
  const { groupId, bookId } = unpackBookId(entityId)
  const tocHtml = await getHtml(tocUrl(groupId, bookId), {
    referer: bookUrl(groupId, bookId),
  })
  let items = parseChapters(tocHtml, groupId, bookId)
  if (!items.length) {
    const detailHtml = await getHtml(bookUrl(groupId, bookId), { referer: BASE_URL })
    items = parseChapters(detailHtml, groupId, bookId)
  }
  if (!items.length) throw new Error('目录解析失败')
  // 详情页最新章列表可能倒序；完整目录页一般正序。若首章标题像更大章号则反转
  const firstNum = Number((items[0]?.title || '').match(/(\d+)/)?.[1] || 0)
  const lastNum = Number((items[items.length - 1]?.title || '').match(/(\d+)/)?.[1] || 0)
  if (firstNum > lastNum && firstNum > 1) items.reverse()
  items.forEach((c, i) => {
    c.index = i
  })
  return items
}

export async function getChapterContent(chapterEntityId: string): Promise<string> {
  const { groupId, bookId, chapterId } = unpackChapterId(chapterEntityId)
  if (!groupId || !bookId || !chapterId) throw new Error('invalid chapter id')
  const html = await getHtml(chapterUrl(groupId, bookId, chapterId), {
    referer: bookUrl(groupId, bookId),
  })
  const block =
    html.match(/id=["']chaptercontent["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/id=["']content["'][^>]*>[\s\S]*?id=["']chaptercontent["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    ''
  const text = stripTags(block)
    .replace(/请收藏本站[^\n]*/g, '')
    .replace(/布谷小说网[^\n]*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) throw new Error('正文解析失败')
  return text
}

function parseBookCards(html: string): BookItem[] {
  const items: BookItem[] = []
  const seen = new Set<string>()
  for (const m of matchAll(
    html,
    /href=["']\/book\/(\d+)\/(\d+)\/["'][^>]*(?:title=["']([^"']+)["'])?/gi,
  )) {
    const id = packBookId(m[1], m[2])
    if (seen.has(id)) continue
    const title = decodeHtml(m[3] || '').trim()
    if (!title || title.length < 2) continue
    seen.add(id)
    items.push({
      id,
      source: SOURCE_ID,
      title,
      author: '未知',
      type: 'text',
      raw: { groupId: m[1], bookId: m[2] },
    })
  }
  for (const block of matchAll(
    html,
    /<div[^>]*class=["'][^"']*book-coverlist[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi,
  )) {
    const book = mapSearchBlock(block[0])
    if (!book || seen.has(book.id)) continue
    seen.add(book.id)
    items.push(book)
  }
  return items
}

export async function getRankNovels(path = '/top/'): Promise<BookItem[]> {
  const html = await getHtml(absUrl(BASE_URL, path), { referer: BASE_URL })
  return parseBookCards(html)
}

export async function getCategoryNovels(categoryId: string, page = 1): Promise<BookItem[]> {
  const path = `/lists/${categoryId}/${page}/`
  const html = await getHtml(absUrl(BASE_URL, path), { referer: BASE_URL })
  return parseBookCards(html)
}
