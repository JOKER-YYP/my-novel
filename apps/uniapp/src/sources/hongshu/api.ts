import { decodeHtml, matchAll, stripTags } from '../html'
import type { BookItem, ChapterItem } from '../types'
import { getHtml, getJsonp, postForm } from './client'
import {
  BASE_URL,
  SEARCH_HOST,
  SOURCE_ID,
  bookUrl,
  chapterPageUrl,
  contentListUrl,
  coverUrl,
  packBookId,
  packChapterId,
  unpackBookId,
  unpackChapterId,
} from './constants'
import { decryptChapterContent } from './decrypt'

interface SearchBook {
  bid?: string
  catename?: string
  authorname?: string
  intro?: string
  bookface?: string
  finish?: number
  charnum?: string
  classname?: string
}

interface SearchResponse {
  bookinfo?: SearchBook[] | null
  totalcount?: number
  pagecount?: number
  words?: string[]
  info?: string
  message?: string
  status?: number
  msg?: string
}

interface ChapterKeyResponse {
  code?: number
  key?: string
  msg?: string
}

interface ChapterContentResponse {
  code?: number
  msg?: string
  chptitle?: string
  content?: string
  needbuy?: number
  needlogin?: number
  url?: string
}

function mapSearchBook(b: SearchBook): BookItem | null {
  const bid = String(b.bid || '')
  const title = decodeHtml(b.catename || '').trim()
  if (!bid || !title) return null
  const intro = stripTags(b.intro || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  return {
    id: packBookId(bid),
    source: SOURCE_ID,
    title,
    author: decodeHtml(b.authorname || '未知').trim() || '未知',
    cover: b.bookface || coverUrl(bid),
    intro: intro || undefined,
    type: 'text',
    raw: { bid, finish: b.finish, classname: b.classname },
  }
}

async function homeSearch(fields: Record<string, string | number>): Promise<SearchResponse> {
  return postForm<SearchResponse>(`${BASE_URL}/homeajax.do`, fields, `${BASE_URL}/bookstore.html`)
}

function assertSearchOk(data: SearchResponse) {
  if (data && typeof data.status === 'number' && data.status === 0 && data.info) {
    throw new Error(data.info)
  }
}

export async function searchNovels(keyword: string): Promise<BookItem[]> {
  const q = keyword.trim()
  if (!q) return []

  // 触屏站 JSONP 搜索（www.homeajax 带 keyword 常被策略拦截）
  const data = await getJsonp<SearchResponse>(
    `${SEARCH_HOST}/Bookajax/search`,
    {
      keyword: q,
      keywordtype: '1',
      free: '0',
      finish: '0',
      charnum: '0',
      updatetime: '0',
      order: '0',
      copyright: '1',
      pagesize: '30',
      pagenum: '1',
    },
    `${SEARCH_HOST}/search/nan.html`,
  )

  if (data && typeof data.status === 'number' && data.status === 2 && data.message) {
    throw new Error(data.message)
  }
  assertSearchOk(data)

  const items = (data.bookinfo || []).map(mapSearchBook).filter(Boolean) as BookItem[]
  if (!items.length) throw new Error((data as { message?: string }).message || '未找到相关书籍')
  return items
}

export async function getNovelDetail(bookId: string): Promise<BookItem> {
  const bid = unpackBookId(bookId)
  const html = await getHtml(bookUrl(bid), BASE_URL)
  const title =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    `小说${bid}`
  const author =
    html.match(/property=["']og:novel:author["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/作者[：:]\s*<a[^>]*>([^<]+)/)?.[1] ||
    html.match(/作者[：:]\s*([^<\s]+)/)?.[1] ||
    '未知'
  const introRaw =
    html.match(/property=["']og:description["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/class=["'][^"']*intro[^"']*["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
    html.match(/内容简介[：:]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\//i)?.[1] ||
    ''
  const cover =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/(https:\/\/img2\.hongshu\.com\/bookface\/[^"']+)/i)?.[1] ||
    coverUrl(bid)
  return {
    id: packBookId(bid),
    source: SOURCE_ID,
    title: decodeHtml(title).trim(),
    author: decodeHtml(author).trim(),
    cover,
    intro: introRaw ? decodeHtml(stripTags(introRaw)).slice(0, 500) : undefined,
    type: 'text',
    raw: { bid },
  }
}

function parseChapterList(html: string, bookId: string): ChapterItem[] {
  const bid = unpackBookId(bookId)
  const items: ChapterItem[] = []
  const seen = new Set<string>()

  for (const m of matchAll(
    html,
    /getChapterContent\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*1\s*\)[^>]*>\s*<span>([^<]+)<\/span>/gi,
  )) {
    const jid = m[2]
    const cid = m[3]
    const title = decodeHtml(m[4] || '').trim()
    if (!jid || !cid || !title || seen.has(cid)) continue
    seen.add(cid)
    items.push({
      id: packChapterId(bid, jid, cid),
      bookId: packBookId(bid),
      title,
      index: items.length,
      contentUrl: chapterPageUrl(bid, jid, cid),
    })
  }

  if (items.length) return items

  for (const m of matchAll(html, /\/content\/(\d+)\/(\d+)-(\d+)\.html[^"]*"[^>]*>([^<]+)/gi)) {
    if (m[1] !== bid) continue
    const jid = m[2]
    const cid = m[3]
    const title = decodeHtml(stripTags(m[4] || '')).trim()
    if (!jid || !cid || !title || seen.has(cid)) continue
    seen.add(cid)
    items.push({
      id: packChapterId(bid, jid, cid),
      bookId: packBookId(bid),
      title,
      index: items.length,
      contentUrl: chapterPageUrl(bid, jid, cid),
    })
  }
  return items
}

export async function getNovelChapters(bookId: string): Promise<ChapterItem[]> {
  const bid = unpackBookId(bookId)
  const html = await getHtml(contentListUrl(bid), bookUrl(bid))
  let items = parseChapterList(html, bookId)
  if (items.length) return items

  // 目录页若未内嵌列表，跟到 hidcid 对应章节页
  const jid = html.match(/id=["']hidjid["'][^>]*value=["'](\d+)/i)?.[1]
  const cid = html.match(/id=["']hidcid["'][^>]*value=["'](\d+)/i)?.[1]
  if (jid && cid) {
    const chHtml = await getHtml(chapterPageUrl(bid, jid, cid), contentListUrl(bid))
    items = parseChapterList(chHtml, bookId)
  }
  if (!items.length) throw new Error('目录解析失败')
  return items
}

function cleanContentHtml(html: string): string {
  return stripTags(
    html
      .replace(/<span[^>]*class=['"][^'"]*context_kw[^'"]*['"][^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/gi, ' '),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function getChapterContent(chapterId: string): Promise<string> {
  const { bid, jid, cid } = unpackChapterId(chapterId)
  if (!bid || !jid || !cid) throw new Error('invalid chapter id')
  const referer = chapterPageUrl(bid, jid, cid)

  const keyData = await postForm<ChapterKeyResponse>(
    `${BASE_URL}/bookajax.do`,
    { method: 'getchptkey', bid, cid },
    referer,
  )
  if (!keyData.key) throw new Error(keyData.msg || '无法获取章节密钥')

  const data = await postForm<ChapterContentResponse>(
    `${BASE_URL}/bookajax.do`,
    { method: 'getchpcontent', bid, jid, cid },
    referer,
  )
  if (data.url && !data.content) {
    throw new Error('本章需要登录或跳转，暂不可读')
  }
  if ((data.needbuy === 1 || data.needlogin === 1) && !data.content) {
    throw new Error('本章为付费章节，暂不可读')
  }
  if (!data.content) throw new Error(data.msg || '正文为空')

  const plain = decryptChapterContent(data.content, keyData.key)
  const text = cleanContentHtml(plain)
  if (!text) throw new Error('正文解密失败')
  return text
}

function parseRankBooks(html: string): BookItem[] {
  const items: BookItem[] = []
  const seen = new Set<string>()
  for (const m of matchAll(
    html,
    /href=["'][^"']*\/book\/(\d+)\/?["'][^>]*title=["']([^"']+)["']/gi,
  )) {
    const bid = m[1]
    const title = decodeHtml(m[2] || '').trim()
    if (!bid || !title || seen.has(bid)) continue
    seen.add(bid)
    items.push({
      id: packBookId(bid),
      source: SOURCE_ID,
      title,
      author: '未知',
      cover: coverUrl(bid),
      type: 'text',
      raw: { bid },
    })
  }
  if (items.length) return items

  for (const m of matchAll(html, /href=["'][^"']*\/book\/(\d+)\/?["'][^>]*>([^<]{2,40})</gi)) {
    const bid = m[1]
    const title = decodeHtml(stripTags(m[2] || '')).trim()
    if (!bid || !title || seen.has(bid) || /首页|排行|书库|登录/.test(title)) continue
    seen.add(bid)
    items.push({
      id: packBookId(bid),
      source: SOURCE_ID,
      title,
      author: '未知',
      cover: coverUrl(bid),
      type: 'text',
      raw: { bid },
    })
  }
  return items
}

export async function getRankNovels(path = '/rankboy.html'): Promise<BookItem[]> {
  const html = await getHtml(`${BASE_URL}${path}`, BASE_URL)
  return parseRankBooks(html)
}

export async function getCategoryNovels(categoryId: string, page = 1): Promise<BookItem[]> {
  const fields: Record<string, string | number> = {
    method: 'search',
    Pclassids: '',
    classids: '',
    free: categoryId === 'free' ? '1' : '',
    finish: categoryId === 'finish' ? '1' : '',
    charnum: '',
    updatetime: categoryId === 'new' ? '1' : '',
    keyword: '',
    keywordtype: '1',
    order: categoryId === 'new' ? 'updatetime' : 'total_hit',
    page: String(page || 1),
    pagesize: '30',
  }
  const data = await homeSearch(fields)
  assertSearchOk(data)
  return (data.bookinfo || []).map(mapSearchBook).filter(Boolean) as BookItem[]
}
