export const SOURCE_ID = 'lanhaizw'
export const SOURCE_NAME = '蓝海中文'
export const BASE_URL = 'https://www.lanhaizw.com'

export function packBookId(novelId: string | number) {
  return `${SOURCE_ID}:${novelId}`
}

export function unpackBookId(bookId: string) {
  return bookId.startsWith(`${SOURCE_ID}:`) ? bookId.slice(SOURCE_ID.length + 1) : bookId
}

export function packChapterId(novelId: string, chapterId: string | number) {
  return `${SOURCE_ID}:${novelId}:${chapterId}`
}

export function unpackChapterId(chapterId: string): { novelId: string; chapterId: string } {
  const raw = chapterId.startsWith(`${SOURCE_ID}:`)
    ? chapterId.slice(SOURCE_ID.length + 1)
    : chapterId
  const [novelId, ...rest] = raw.split(':')
  return { novelId: novelId || '', chapterId: rest.join(':') }
}

export function bookUrl(novelId: string | number) {
  return `${BASE_URL}/bqgfs/${novelId}/`
}

export function chapterUrl(novelId: string | number, chapterId: string | number) {
  return `${BASE_URL}/bqgfsk/${novelId}/${chapterId}.html`
}

export const CATEGORIES = [
  { id: '331', title: '女生言情' },
  { id: '332', title: '仙侠武侠' },
  { id: '333', title: '二次元' },
  { id: '334', title: '玄幻奇幻' },
  { id: '335', title: '灵异悬疑' },
  { id: '336', title: '历史军事' },
  { id: '337', title: '科幻未来' },
  { id: '338', title: '都市重生' },
  { id: '339', title: '游戏竞技' },
] as const

export const RANK_TABS = [
  { id: 'rank', title: '排行榜', path: '/rank/' },
  { id: 'finish', title: '完本', path: '/finish/' },
  { id: 'all', title: '书库', path: '/all/index.html' },
] as const
