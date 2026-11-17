import type { BookItem, ChapterItem } from '../sources/types'
import { getSourceFromEntityId } from '../sources/registry'

export async function getBookDetail(bookId: string): Promise<BookItem> {
  const source = getSourceFromEntityId(bookId)
  return source.detail(bookId)
}

export async function getChapters(bookId: string, page = 1): Promise<ChapterItem[]> {
  const source = getSourceFromEntityId(bookId)
  return source.chapters(bookId, page)
}

export async function getAudioUrl(chapterId: string): Promise<string> {
  const source = getSourceFromEntityId(chapterId)
  if (!source.resolveAudio) throw new Error('该源不支持有声播放')
  return source.resolveAudio(chapterId)
}

export async function getContent(chapterId: string): Promise<string> {
  const source = getSourceFromEntityId(chapterId)
  if (!source.resolveContent) throw new Error('该源不支持正文/TTS')
  return source.resolveContent(chapterId)
}

/** Fanqie 对齐的三路朗读来源 */
export type ListenSource = 'system' | 'ai' | 'source-audio'

/** @deprecated 兼容旧字段，等价于 ai / source-audio */
export type ListenMode = 'source-audio' | 'tts'

export function listenSourceToMode(source: ListenSource): ListenMode {
  return source === 'source-audio' ? 'source-audio' : 'tts'
}

export function modeToListenSource(
  mode: ListenMode,
  ttsEngine: 'system' | 'baidu',
): ListenSource {
  if (mode === 'source-audio') return 'source-audio'
  return ttsEngine === 'system' ? 'system' : 'ai'
}

export function resolveListenSource(
  book: BookItem,
  userPref: 'auto' | ListenMode,
  ttsEngine: 'system' | 'baidu',
): ListenSource {
  if (userPref === 'tts') return ttsEngine === 'system' ? 'system' : 'ai'
  if (userPref === 'source-audio') return 'source-audio'
  if (book.type === 'audio' || book.type === 'both') return 'source-audio'
  return ttsEngine === 'system' ? 'system' : 'ai'
}

export function resolveListenMode(
  book: BookItem,
  userPref: 'auto' | ListenMode,
): ListenMode {
  if (userPref === 'tts') return 'tts'
  if (userPref === 'source-audio') return 'source-audio'
  if (book.type === 'audio' || book.type === 'both') return 'source-audio'
  return 'tts'
}
