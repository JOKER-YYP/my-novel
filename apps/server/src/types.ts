export type BookType = 'text' | 'audio' | 'both'

export interface BookItem {
  id: string
  source: string
  title: string
  author: string
  cover?: string
  intro?: string
  type: BookType
  chapterCount?: number
  raw?: unknown
}

export interface ChapterItem {
  id: string
  bookId: string
  title: string
  index: number
  contentUrl?: string
}

export interface CaptchaChallenge {
  needCaptcha: true
  ticket: string
  imageBase64: string
  mime: string
}
