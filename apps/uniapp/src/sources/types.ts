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
  audioUrl?: string
  contentUrl?: string
}

export interface BookSource {
  id: string
  name: string
  search(q: string): Promise<BookItem[]>
  detail(bookId: string): Promise<BookItem>
  chapters(bookId: string, page?: number): Promise<ChapterItem[]>
  resolveAudio?(chapterId: string): Promise<string>
  resolveContent?(chapterId: string): Promise<string>
}
