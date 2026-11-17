import { absUrl, decodeHtml, matchAll, stripTags } from '../html'
import { CookieJar, encodeFormGbk, request } from '../httpClient'
import type { BookItem, CaptchaChallenge, ChapterItem } from '../types'
import {
  BASE_URL,
  SOURCE_ID,
  bookUrl,
  chapterUrl,
  packBookId,
  packChapterId,
  unpackBookId,
  unpackChapterId,
} from './constants'
import { fetchWithGate, passJsGate } from './gate'
import { saveTicket, takeTicket } from './tickets'

function parseSearchForm(html: string) {
  const form = html.match(/<form[^>]*id=["']searchForm["'][\s\S]*?<\/form>/i)?.[0] || ''
  const act = form.match(/name=["']act["'][^>]*value=["']([^"']+)/i)?.[1]
  const submit = form.match(/name=["']submit["'][^>]*value=["']([^"']*)/i)?.[1] || '搜索'
  if (!act || act === 'login') throw new Error('无法读取搜索表单')
  return { act, submit }
}

function parseBookCards(html: string): BookItem[] {
  const items: BookItem[] = []
  const seen = new Set<string>()

  const blocks = matchAll(html, /<dl class=["']B["'][\s\S]*?<\/dl>/gi)
  for (const b of blocks) {
    const block = b[0]
    const id = block.match(/\/bqgfs\/(\d+)\//)?.[1]
    if (!id || seen.has(id)) continue
    const title =
      stripTags(block.match(/<dt[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '') ||
      stripTags(block.match(/alt=["']([^"']+)["']/i)?.[1] || '')
    if (!title) continue
    seen.add(id)
    const author = (block.match(/作者[：:]\s*([^<\s]+)/)?.[1] || '未知').trim()
    const intro = stripTags(block.match(/简介[：:]\s*([\s\S]*?)(?:<\/dd>|<dd)/i)?.[1] || '').slice(0, 120)
    const coverRaw =
      block.match(/data-src=["']([^"']+)["']/i)?.[1] ||
      block.match(/src=["']([^"']*bqgfsimg[^"']+)["']/i)?.[1] ||
      ''
    items.push({
      id: packBookId(id),
      source: SOURCE_ID,
      title: decodeHtml(title),
      author: decodeHtml(author),
      cover: coverRaw ? absUrl(BASE_URL, coverRaw) : undefined,
      intro: intro || undefined,
      type: 'text',
      raw: { novelId: id },
    })
  }

  if (items.length) return items

  // fallback: generic book links
  for (const m of matchAll(html, /href=["']\/bqgfs\/(\d+)\/["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = m[1]
    const title = stripTags(m[2] || '')
    if (!id || seen.has(id) || !title || title.length < 2) continue
    if (/^(首页|书库|排行榜|完本)$/.test(title)) continue
    seen.add(id)
    const around = html.slice(Math.max(0, m.index ?? 0), (m.index ?? 0) + 400)
    const author = (around.match(/作者[：:]\s*([^<\s]+)/)?.[1] || '未知').trim()
    items.push({
      id: packBookId(id),
      source: SOURCE_ID,
      title: decodeHtml(title),
      author: decodeHtml(author),
      type: 'text',
      raw: { novelId: id },
    })
  }
  return items
}

async function loadCaptchaImage(jar: CookieJar, referer: string): Promise<{ imageBase64: string; mime: string }> {
  const img = await request(`${BASE_URL}/member/getcode.asp`, {
    jar,
    headers: { Referer: referer },
  })
  const mime = String(img.headers['content-type'] || 'image/bmp').split(';')[0]
  return { imageBase64: img.buf.toString('base64'), mime }
}

function captchaFromSearchPage(
  html: string,
  jar: CookieJar,
  resultUrl: string,
): Promise<CaptchaChallenge> | null {
  const actyzm = html.match(/name=["']actyzm["'][^>]*value=["']([^"']+)/i)?.[1]
  if (!actyzm) return null
  const button = html.match(/name=["']button["'][^>]*value=["']([^"']+)/i)?.[1] || '提交搜索'
  return (async () => {
    const { imageBase64, mime } = await loadCaptchaImage(jar, resultUrl)
    const ticket = saveTicket({
      kind: 'search',
      jar,
      resultUrl,
      actyzm,
      button,
      createdAt: Date.now(),
    })
    return { needCaptcha: true as const, ticket, imageBase64, mime }
  })()
}

export async function searchNovels(
  keyword: string,
): Promise<{ items: BookItem[] } | CaptchaChallenge> {
  const q = keyword.trim()
  if (!q) return { items: [] }

  const jar = new CookieJar()
  const home = await request(`${BASE_URL}/`, { jar })
  const { act, submit } = parseSearchForm(home.text)
  const body = encodeFormGbk({ act, q, submit })

  const post = await request(`${BASE_URL}/sscc/`, {
    method: 'POST',
    body,
    jar,
    follow: false,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
    },
  })

  const resultUrl = post.location || `${BASE_URL}/sscc/`
  let page = await request(resultUrl, {
    jar,
    headers: { Referer: `${BASE_URL}/sscc/` },
  })
  if (/var\s+c2=|内容正在载入/.test(page.text)) {
    await passJsGate(page.text, resultUrl, jar)
    page = await request(resultUrl, {
      jar,
      headers: { Referer: `${BASE_URL}/sscc/` },
    })
  }

  const challenge = captchaFromSearchPage(page.text, jar, resultUrl)
  if (challenge) return challenge

  return { items: parseBookCards(page.text) }
}

export async function verifySearchCaptcha(
  ticket: string,
  code: string,
): Promise<{ items: BookItem[] } | CaptchaChallenge> {
  const t = takeTicket(ticket, 'search')
  if (!t) throw new Error('验证码已过期，请重新搜索')
  const yzm = code.trim()
  if (!yzm) throw new Error('请输入验证码')

  const body = encodeFormGbk({
    actyzm: t.actyzm,
    yzm,
    button: t.button,
  })
  let page = await request(t.resultUrl, {
    method: 'POST',
    body,
    jar: t.jar,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE_URL,
      Referer: t.resultUrl,
    },
  })
  if (/var\s+c2=|内容正在载入/.test(page.text)) {
    await passJsGate(page.text, t.resultUrl, t.jar)
    page = await request(t.resultUrl, {
      jar: t.jar,
      headers: { Referer: t.resultUrl },
    })
  }

  const again = captchaFromSearchPage(page.text, t.jar, t.resultUrl)
  if (again) return again

  return { items: parseBookCards(page.text) }
}

export async function getNovelDetail(bookId: string): Promise<BookItem> {
  const novelId = unpackBookId(bookId)
  const jar = new CookieJar()
  const { text } = await fetchWithGate(bookUrl(novelId), jar)
  const title =
    text.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
    stripTags(text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    `小说${novelId}`
  const author =
    text.match(/property=["']og:novel:author["'][^>]*content=["']([^"']+)/i)?.[1] ||
    '未知'
  const intro =
    text.match(/property=["']og:description["'][^>]*content=["']([^"']+)/i)?.[1] ||
    undefined
  const cover = text.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
  return {
    id: packBookId(novelId),
    source: SOURCE_ID,
    title: decodeHtml(title),
    author: decodeHtml(author),
    cover,
    intro: intro ? decodeHtml(intro).slice(0, 500) : undefined,
    type: 'text',
    raw: { novelId },
  }
}

export async function getNovelChapters(bookId: string): Promise<ChapterItem[]> {
  const novelId = unpackBookId(bookId)
  const jar = new CookieJar()
  const { text } = await fetchWithGate(bookUrl(novelId), jar)
  const items: ChapterItem[] = []
  const seen = new Set<string>()
  // 页面通常最新章在前，收集后反转为正序
  const links = matchAll(
    text,
    new RegExp(`href=["'](/bqgfsk/${novelId}/(\\d+)\\.html)["'][^>]*>([\\s\\S]*?)</a>`, 'gi'),
  )
  for (const m of links) {
    const cid = m[2]
    if (!cid || seen.has(cid)) continue
    const title = stripTags(m[3] || '')
    if (!title) continue
    seen.add(cid)
    items.push({
      id: packChapterId(novelId, cid),
      bookId: packBookId(novelId),
      title,
      index: items.length,
      contentUrl: absUrl(BASE_URL, m[1]),
    })
  }
  items.reverse()
  items.forEach((c, i) => {
    c.index = i
  })
  return items
}

function extractContent(html: string): string {
  const block =
    html.match(/<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/<div[^>]+class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    ''
  return stripTags(block)
    .replace(/请记住本站域名[^\n]*/g, '')
    .replace(/一秒记住[^\n]*/g, '')
    .trim()
}

async function captchaFromContentPage(
  html: string,
  jar: CookieJar,
  url: string,
): Promise<CaptchaChallenge | null> {
  const rdyzm =
    html.match(/name=["']rdyzm["'][^>]*value=["']([^"']+)/i)?.[1] ||
    html.match(/name=["']actyzm["'][^>]*value=["']([^"']+)/i)?.[1]
  if (!rdyzm || !/验证码|安全验证|getcode\.asp/.test(html)) return null
  const button =
    html.match(/name=["']button["'][^>]*value=["']([^"']+)/i)?.[1] || '验证免费阅读'
  const { imageBase64, mime } = await loadCaptchaImage(jar, url)
  const ticket = saveTicket({
    kind: 'content',
    jar,
    chapterUrl: url,
    rdyzm,
    button,
    createdAt: Date.now(),
  })
  return { needCaptcha: true, ticket, imageBase64, mime }
}

export async function getChapterContent(
  chapterId: string,
): Promise<{ content: string } | CaptchaChallenge> {
  const { novelId, chapterId: cid } = unpackChapterId(chapterId)
  if (!novelId || !cid) throw new Error('invalid chapter id')
  const jar = new CookieJar()
  const url = chapterUrl(novelId, cid)
  const page = await fetchWithGate(url, jar, bookUrl(novelId))
  const challenge = await captchaFromContentPage(page.text, jar, url)
  if (challenge) return challenge
  const content = extractContent(page.text)
  if (!content) throw new Error('正文解析失败')
  return { content }
}

export async function verifyContentCaptcha(
  ticket: string,
  code: string,
): Promise<{ content: string } | CaptchaChallenge> {
  const t = takeTicket(ticket, 'content')
  if (!t) throw new Error('验证码已过期，请重新打开章节')
  const yzm = code.trim()
  if (!yzm) throw new Error('请输入验证码')

  // 章节验证码字段名可能是 rdyzm 或 actyzm
  const body = encodeFormGbk({
    rdyzm: t.rdyzm,
    actyzm: t.rdyzm,
    yzm,
    button: t.button,
  })
  let page = await request(t.chapterUrl, {
    method: 'POST',
    body,
    jar: t.jar,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE_URL,
      Referer: t.chapterUrl,
    },
  })
  if (/var\s+c2=|内容正在载入/.test(page.text)) {
    await passJsGate(page.text, t.chapterUrl, t.jar)
    page = await request(t.chapterUrl, {
      jar: t.jar,
      headers: { Referer: t.chapterUrl },
    })
  }
  const again = await captchaFromContentPage(page.text, t.jar, t.chapterUrl)
  if (again) return again
  const content = extractContent(page.text)
  if (!content) throw new Error('正文解析失败')
  return { content }
}

export async function getRankNovels(path = '/rank/'): Promise<BookItem[]> {
  const jar = new CookieJar()
  const { text } = await fetchWithGate(absUrl(BASE_URL, path), jar)
  return parseBookCards(text)
}

export async function getCategoryNovels(categoryId: string, page = 1): Promise<BookItem[]> {
  const jar = new CookieJar()
  const path =
    page <= 1 ? `/bqgfs${categoryId}/` : `/bqgfs${categoryId}/index_${page}.html`
  const { text } = await fetchWithGate(absUrl(BASE_URL, path), jar)
  return parseBookCards(text)
}
