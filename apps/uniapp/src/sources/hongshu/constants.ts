export const SOURCE_ID = 'hongshu'
export const SOURCE_NAME = '红薯中文'
export const BASE_URL = 'https://www.hongshu.com'
/** 触屏站搜索（www/m 关键词搜索常被策略拦截） */
export const SEARCH_HOST = 'https://g.hongshu.com'
export const IMG_HOST = 'https://img2.hongshu.com'

export function packBookId(novelId: string | number) {
  return `${SOURCE_ID}:${novelId}`
}

export function unpackBookId(bookId: string) {
  return bookId.startsWith(`${SOURCE_ID}:`) ? bookId.slice(SOURCE_ID.length + 1) : bookId
}

export function packChapterId(bid: string, jid: string, cid: string) {
  return `${SOURCE_ID}:${bid}:${jid}:${cid}`
}

export function unpackChapterId(chapterId: string): {
  bid: string
  jid: string
  cid: string
} {
  const raw = chapterId.startsWith(`${SOURCE_ID}:`)
    ? chapterId.slice(SOURCE_ID.length + 1)
    : chapterId
  const [bid = '', jid = '', ...rest] = raw.split(':')
  return { bid, jid, cid: rest.join(':') }
}

export function bookUrl(bid: string | number) {
  return `${BASE_URL}/book/${bid}/`
}

export function contentListUrl(bid: string | number) {
  return `${BASE_URL}/content/${bid}.html`
}

export function chapterPageUrl(bid: string, jid: string, cid: string) {
  return `${BASE_URL}/content/${bid}/${jid}-${cid}.html`
}

export function coverUrl(bid: string | number, size: 'small' | 'middle' | 'bigdft' = 'middle') {
  const id = Number(bid)
  const a = Math.floor(id / 10000)
  const b = Math.floor(id / 100) % 100
  return `${IMG_HOST}/bookface/${a}/${b}/${id}_${size}.jpg`
}

export const CATEGORIES = [
  { id: 'free', title: '免费' },
  { id: 'finish', title: '完本' },
  { id: 'new', title: '新书' },
] as const

export const RANK_TABS = [
  { id: 'rankboy', title: '男生榜', path: '/rankboy.html', type: 0 },
  { id: 'rankgirl', title: '女生榜', path: '/rankgirl.html', type: 1 },
] as const
