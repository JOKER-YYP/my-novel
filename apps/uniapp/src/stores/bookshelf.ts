import { defineStore } from 'pinia'
import type { ListenSource } from '../services/book'
import type { BookItem } from '../sources/types'
import { loadJson, saveJson } from '../utils/storage'

export interface ReadProgress {
  bookId: string
  chapterId: string
  chapterIndex: number
  chapterTitle?: string
  updatedAt: number
}

export interface ListenProgress {
  bookId: string
  chapterId: string
  chapterIndex: number
  chapterTitle?: string
  source: ListenSource
  positionSec?: number
  chunkIndex?: number
  updatedAt: number
}

/** 兼容旧统一进度结构 */
export interface ProgressRecord {
  bookId: string
  chapterId: string
  chapterIndex: number
  chapterTitle?: string
  mode: 'read' | 'source-audio' | 'tts' | ListenSource
  positionSec?: number
  chunkIndex?: number
  updatedAt: number
}

const SHELF_KEY = 'bookshelf'
const HISTORY_KEY = 'history'
const READ_PREFIX = 'progress:read:'
const LISTEN_PREFIX = 'progress:listen:'
const LEGACY_UNIFIED = 'progress:'
const LEGACY_READ_PREFIX = 'read:'

function migrateUnified(bookId: string): void {
  const old = loadJson<ProgressRecord | null>(`${LEGACY_UNIFIED}${bookId}`, null)
  if (!old) return
  if (old.mode === 'read') {
    saveJson(`${READ_PREFIX}${bookId}`, {
      bookId,
      chapterId: old.chapterId,
      chapterIndex: old.chapterIndex,
      chapterTitle: old.chapterTitle,
      updatedAt: old.updatedAt,
    } satisfies ReadProgress)
  } else {
    const source: ListenSource =
      old.mode === 'source-audio'
        ? 'source-audio'
        : old.mode === 'system'
          ? 'system'
          : old.mode === 'ai'
            ? 'ai'
            : 'ai'
    saveJson(`${LISTEN_PREFIX}${bookId}`, {
      bookId,
      chapterId: old.chapterId,
      chapterIndex: old.chapterIndex,
      chapterTitle: old.chapterTitle,
      source,
      positionSec: old.positionSec,
      chunkIndex: old.chunkIndex,
      updatedAt: old.updatedAt,
    } satisfies ListenProgress)
  }
}

export function formatProgressLine(p: ProgressRecord | null): string {
  if (!p) return ''
  const chapter = p.chapterTitle || (p.chapterIndex >= 0 ? `第${p.chapterIndex + 1}章` : '')
  if (!chapter) return ''
  if (p.mode === 'read') return `读到 ${chapter}`
  if (p.mode === 'source-audio') return `听到 ${chapter}`
  if (p.mode === 'system') return `系统朗读 ${chapter}`
  if (p.mode === 'ai') return `AI 听书 ${chapter}`
  return `听书 ${chapter}`
}

export function formatRelativeTime(ts?: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const useBookshelfStore = defineStore('bookshelf', {
  state: () => ({
    books: loadJson<BookItem[]>(SHELF_KEY, []),
    history: loadJson<BookItem[]>(HISTORY_KEY, []),
  }),
  actions: {
    persistShelf() {
      saveJson(SHELF_KEY, this.books)
    },
    persistHistory() {
      saveJson(HISTORY_KEY, this.history)
    },
    isInShelf(bookId: string) {
      return this.books.some((b) => b.id === bookId)
    },
    add(book: BookItem) {
      if (this.isInShelf(book.id)) return false
      this.books.unshift(book)
      this.persistShelf()
      return true
    },
    remove(bookId: string) {
      this.books = this.books.filter((b) => b.id !== bookId)
      this.persistShelf()
    },
    touchHistory(book: BookItem) {
      this.history = [book, ...this.history.filter((b) => b.id !== book.id)].slice(0, 80)
      this.persistHistory()
      const idx = this.books.findIndex((b) => b.id === book.id)
      if (idx >= 0) {
        this.books[idx] = { ...this.books[idx], ...book, id: book.id }
        this.persistShelf()
      }
    },
    clearHistory() {
      this.history = []
      this.persistHistory()
    },
    saveReadProgress(progress: ReadProgress) {
      saveJson(`${READ_PREFIX}${progress.bookId}`, progress)
      saveJson(`${LEGACY_READ_PREFIX}${progress.bookId}`, {
        chapterId: progress.chapterId,
        chapterIndex: progress.chapterIndex,
        updatedAt: progress.updatedAt,
      })
    },
    saveListenProgress(progress: ListenProgress) {
      saveJson(`${LISTEN_PREFIX}${progress.bookId}`, progress)
    },
    /** @deprecated 统一写入：阅读或听书按 mode 分流 */
    saveProgress(progress: ProgressRecord) {
      if (progress.mode === 'read') {
        this.saveReadProgress({
          bookId: progress.bookId,
          chapterId: progress.chapterId,
          chapterIndex: progress.chapterIndex,
          chapterTitle: progress.chapterTitle,
          updatedAt: progress.updatedAt,
        })
        return
      }
      const source: ListenSource =
        progress.mode === 'source-audio'
          ? 'source-audio'
          : progress.mode === 'system'
            ? 'system'
            : 'ai'
      this.saveListenProgress({
        bookId: progress.bookId,
        chapterId: progress.chapterId,
        chapterIndex: progress.chapterIndex,
        chapterTitle: progress.chapterTitle,
        source,
        positionSec: progress.positionSec,
        chunkIndex: progress.chunkIndex,
        updatedAt: progress.updatedAt,
      })
    },
    getReadProgress(bookId: string): ReadProgress | null {
      migrateUnified(bookId)
      const cur = loadJson<ReadProgress | null>(`${READ_PREFIX}${bookId}`, null)
      if (cur?.chapterId || typeof cur?.chapterIndex === 'number') return cur
      const legacy = loadJson<{
        chapterId?: string
        chapterIndex?: number
        updatedAt?: number
      } | null>(`${LEGACY_READ_PREFIX}${bookId}`, null)
      if (!legacy) return null
      if (!legacy.chapterId && typeof legacy.chapterIndex !== 'number') return null
      const mapped: ReadProgress = {
        bookId,
        chapterId: legacy.chapterId || '',
        chapterIndex: legacy.chapterIndex ?? 0,
        updatedAt: legacy.updatedAt || Date.now(),
      }
      this.saveReadProgress(mapped)
      return mapped
    },
    getListenProgress(bookId: string): ListenProgress | null {
      migrateUnified(bookId)
      const cur = loadJson<ListenProgress | null>(`${LISTEN_PREFIX}${bookId}`, null)
      if (cur?.chapterId || typeof cur?.chapterIndex === 'number') {
        if (!cur.source) cur.source = 'ai'
        return cur
      }
      return null
    },
    /** 书架展示：取更新更晚的那条 */
    getProgress(bookId: string): ProgressRecord | null {
      const read = this.getReadProgress(bookId)
      const listen = this.getListenProgress(bookId)
      if (!read && !listen) return null
      const readAt = read?.updatedAt || 0
      const listenAt = listen?.updatedAt || 0
      if (listen && listenAt >= readAt) {
        return {
          bookId,
          chapterId: listen.chapterId,
          chapterIndex: listen.chapterIndex,
          chapterTitle: listen.chapterTitle,
          mode: listen.source,
          positionSec: listen.positionSec,
          chunkIndex: listen.chunkIndex,
          updatedAt: listen.updatedAt,
        }
      }
      if (!read) return null
      return {
        bookId,
        chapterId: read.chapterId,
        chapterIndex: read.chapterIndex,
        chapterTitle: read.chapterTitle,
        mode: 'read',
        updatedAt: read.updatedAt,
      }
    },
  },
})
