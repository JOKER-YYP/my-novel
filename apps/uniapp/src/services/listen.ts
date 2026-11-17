import type { BookItem } from '../sources/types'
import type { ListenProgress, ReadProgress } from '../stores/bookshelf'
import { useBookshelfStore } from '../stores/bookshelf'
import type { ListenSource } from './book'

/** Fanqie 对齐：听书进度与阅读进度可分离；跨章时让用户二选一 */
export function askListenStartChapter(opts: {
  book: BookItem
  currentChapterIndex: number
  preferredSource?: ListenSource
}): Promise<{ chapterIndex: number; resumeListen: boolean; source?: ListenSource } | null> {
  const shelf = useBookshelfStore()
  const listen = shelf.getListenProgress(opts.book.id)
  const read = shelf.getReadProgress(opts.book.id)

  const currentIdx = Math.max(0, opts.currentChapterIndex)
  if (!listen || (!listen.chapterId && typeof listen.chapterIndex !== 'number')) {
    return Promise.resolve({
      chapterIndex: currentIdx,
      resumeListen: false,
      source: opts.preferredSource || listenSourceFromLegacy(listen),
    })
  }

  const listenIdx = listen.chapterIndex ?? 0
  const same =
    (listen.chapterId && read?.chapterId && listen.chapterId === read.chapterId) ||
    listenIdx === currentIdx

  if (same) {
    return Promise.resolve({
      chapterIndex: listenIdx,
      resumeListen: true,
      source: opts.preferredSource || listen.source,
    })
  }

  const listenTitle = listen.chapterTitle || `第${listenIdx + 1}章`
  const currentTitle =
    read?.chapterTitle && read.chapterIndex === currentIdx
      ? read.chapterTitle
      : `第${currentIdx + 1}章`

  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: [`接着上次听（${listenTitle}）`, `从当前章节听（${currentTitle}）`],
      success: (res) => {
        if (res.tapIndex === 0) {
          resolve({
            chapterIndex: listenIdx,
            resumeListen: true,
            source: opts.preferredSource || listen.source,
          })
          return
        }
        resolve({
          chapterIndex: currentIdx,
          resumeListen: false,
          source: opts.preferredSource || listen.source,
        })
      },
      fail: () => resolve(null),
    })
  })
}

function listenSourceFromLegacy(p: ListenProgress | null): ListenSource | undefined {
  return p?.source
}

export function describeListenSource(source: ListenSource): string {
  if (source === 'source-audio') return '真人有声'
  if (source === 'system') return '系统朗读'
  return 'AI 音色'
}

export function pickDisplayProgress(
  read: ReadProgress | null,
  listen: ListenProgress | null,
): { kind: 'read' | 'listen'; updatedAt: number; line: string } | null {
  if (!read && !listen) return null
  const readAt = read?.updatedAt || 0
  const listenAt = listen?.updatedAt || 0
  if (listen && listenAt >= readAt) {
    const chapter = listen.chapterTitle || `第${(listen.chapterIndex ?? 0) + 1}章`
    const src =
      listen.source === 'source-audio'
        ? '有声'
        : listen.source === 'system'
          ? '系统'
          : 'AI'
    return { kind: 'listen', updatedAt: listenAt, line: `听到 ${chapter}（${src}）` }
  }
  if (read) {
    const chapter = read.chapterTitle || `第${(read.chapterIndex ?? 0) + 1}章`
    return { kind: 'read', updatedAt: readAt, line: `读到 ${chapter}` }
  }
  return null
}
