export const SOURCE_ID = 'xs800'
export const SOURCE_NAME = '800小说'
export const BASE_URL = 'https://www.800xs.org'

export function packBookId(bookId: string | number) {
  return `${SOURCE_ID}:${bookId}`
}

export function unpackBookId(entityId: string): string {
  if (entityId.startsWith(`${SOURCE_ID}:`)) return entityId.slice(SOURCE_ID.length + 1)
  return entityId
}

export function packChapterId(bookId: string | number, chapterId: string | number) {
  return `${SOURCE_ID}:${bookId}:${chapterId}`
}

export function unpackChapterId(chapterEntityId: string): { bookId: string; chapterId: string } {
  const raw = chapterEntityId.startsWith(`${SOURCE_ID}:`)
    ? chapterEntityId.slice(SOURCE_ID.length + 1)
    : chapterEntityId
  const [bookId = '', ...rest] = raw.split(':')
  return { bookId, chapterId: rest.join(':') }
}

export function bookUrl(bookId: string | number) {
  return `${BASE_URL}/book_${bookId}/`
}

export function tocUrl(bookId: string | number, page = 1) {
  return `${BASE_URL}/book_${bookId}/ml${page}.html`
}

export function chapterUrl(bookId: string | number, chapterId: string | number) {
  return `${BASE_URL}/book_${bookId}/${chapterId}.html`
}

export function coverUrl(bookId: string | number) {
  return `${BASE_URL}/img/${bookId}.jpg`
}

export const SEARCH_URL = `${BASE_URL}/search.html`
