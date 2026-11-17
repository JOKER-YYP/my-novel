export const SOURCE_ID = 'buguxs'
export const SOURCE_NAME = '布谷小说'
export const BASE_URL = 'https://www.buguxs.com'
export const CLEARANCE_COOKIE = '__sc_clearance=1'

export function packBookId(groupId: string | number, bookId: string | number) {
  return `${SOURCE_ID}:${groupId}:${bookId}`
}

export function unpackBookId(bookId: string): { groupId: string; bookId: string } {
  const raw = bookId.startsWith(`${SOURCE_ID}:`)
    ? bookId.slice(SOURCE_ID.length + 1)
    : bookId
  const [groupId = '', id = ''] = raw.split(':')
  return { groupId, bookId: id }
}

export function packChapterId(
  groupId: string | number,
  bookId: string | number,
  chapterId: string | number,
) {
  return `${SOURCE_ID}:${groupId}:${bookId}:${chapterId}`
}

export function unpackChapterId(chapterId: string): {
  groupId: string
  bookId: string
  chapterId: string
} {
  const raw = chapterId.startsWith(`${SOURCE_ID}:`)
    ? chapterId.slice(SOURCE_ID.length + 1)
    : chapterId
  const [groupId = '', bookId = '', ...rest] = raw.split(':')
  return { groupId, bookId, chapterId: rest.join(':') }
}

export function bookUrl(groupId: string | number, bookId: string | number) {
  return `${BASE_URL}/book/${groupId}/${bookId}/`
}

export function tocUrl(groupId: string | number, bookId: string | number) {
  return `${BASE_URL}/book/${groupId}/${bookId}/1/`
}

export function chapterUrl(
  groupId: string | number,
  bookId: string | number,
  chapterId: string | number,
) {
  return `${BASE_URL}/book/${groupId}/${bookId}/${chapterId}.html`
}

export function searchUrl(keyword: string) {
  return `${BASE_URL}/search/?searchkey=${encodeURIComponent(keyword)}`
}

export const CATEGORIES = [
  { id: '1', title: '玄幻' },
  { id: '2', title: '仙侠' },
  { id: '3', title: '都市' },
  { id: '4', title: '历史' },
  { id: '5', title: '网游' },
  { id: '6', title: '科幻' },
  { id: '7', title: '灵异' },
  { id: '8', title: '言情' },
  { id: '9', title: '其他' },
] as const

export const RANK_TABS = [
  { id: 'top', title: '排行榜', path: '/top/', type: 0 },
  { id: 'quanben', title: '全本', path: '/quanben/lists/', type: 1 },
] as const
