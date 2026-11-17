import { getContent } from '../book'
import { synthesizeBaiduMp3 } from './cloud/baidu'
import { sanitizeContent } from './sanitize'
import { splitForTts } from './split'
import {
  canUseSystemTts,
  createSystemTts,
  systemTtsUnavailableReason,
} from './systemTts'
import { createAudioService } from '../audio'
import { useSettingsStore } from '../../stores/settings'

export interface TtsProgress {
  chapterId: string
  chunkIndex: number
  totalChunks: number
  text?: string
}

export interface SpeakChapterOptions {
  chapterId: string
  startChunkIndex?: number
  title: string
  cover?: string
  /** 强制走系统朗读，不可用时直接报错（不回退百度） */
  forceSystem?: boolean
  onProgress?: (p: TtsProgress) => void
  onChunkEnd?: (p: TtsProgress) => void
}

/**
 * 朗读一章：
 * - 默认 / 系统模式：手机系统 TTS（小米等自带引擎，仅 App/H5）
 * - AI 模式：百度云 TTS
 */
export function createTtsController() {
  const audio = createAudioService()
  const systemTts = createSystemTts()
  let stopped = false
  let prefetch: Promise<{ src: string } | null> | null = null

  async function speakWithBaidu(chunks: string[], opts: SpeakChapterOptions) {
    for (let i = opts.startChunkIndex || 0; i < chunks.length; i++) {
      if (stopped) return
      opts.onProgress?.({
        chapterId: opts.chapterId,
        chunkIndex: i,
        totalChunks: chunks.length,
        text: chunks[i],
      })

      let src: string
      if (prefetch) {
        const pre = await prefetch
        prefetch = null
        if (pre?.src) src = pre.src
        else {
          const cur = await synthesizeBaiduMp3(chunks[i])
          src = cur.src
        }
      } else {
        const cur = await synthesizeBaiduMp3(chunks[i])
        src = cur.src
      }

      if (i + 1 < chunks.length) {
        const nextText = chunks[i + 1]
        prefetch = synthesizeBaiduMp3(nextText).catch(() => null)
      }

      await new Promise<void>((resolve, reject) => {
        const offEnd = audio.onEnded(() => {
          offEnd()
          opts.onChunkEnd?.({
            chapterId: opts.chapterId,
            chunkIndex: i,
            totalChunks: chunks.length,
          })
          resolve()
        })
        try {
          audio.play(src, {
            title: opts.title,
            cover: opts.cover,
            ep: `片 ${i + 1}/${chunks.length}`,
          })
        } catch (e) {
          offEnd()
          reject(e)
        }
      })
    }
  }

  async function speakWithSystem(chunks: string[], opts: SpeakChapterOptions) {
    if (!canUseSystemTts()) {
      throw new Error(systemTtsUnavailableReason())
    }
    const settings = useSettingsStore()
    for (let i = opts.startChunkIndex || 0; i < chunks.length; i++) {
      if (stopped) return
      opts.onProgress?.({
        chapterId: opts.chapterId,
        chunkIndex: i,
        totalChunks: chunks.length,
        text: chunks[i],
      })
      await systemTts.speak(chunks[i], settings.playbackRate)
      opts.onChunkEnd?.({
        chapterId: opts.chapterId,
        chunkIndex: i,
        totalChunks: chunks.length,
      })
    }
  }

  return {
    async speakChapter(opts: SpeakChapterOptions) {
      stopped = false
      prefetch = null
      const raw = await getContent(opts.chapterId)
      const text = sanitizeContent(raw)
      if (!text.trim()) throw new Error('本章无有效文本')

      const settings = useSettingsStore()
      const wantSystem = opts.forceSystem || settings.ttsEngine === 'system'

      if (wantSystem) {
        // 系统引擎可播更长片段，减少切句停顿
        const chunks = splitForTts(text, 180)
        if (!chunks.length) throw new Error('本章无有效文本')
        await speakWithSystem(chunks, opts)
        return
      }

      const chunks = splitForTts(text, 50)
      if (!chunks.length) throw new Error('本章无有效文本')
      await speakWithBaidu(chunks, opts)
    },
    pause() {
      audio.pause()
      systemTts.stop()
    },
    resume() {
      audio.resume()
    },
    stop() {
      stopped = true
      prefetch = null
      audio.stop()
      systemTts.stop()
    },
  }
}

export type TtsController = ReturnType<typeof createTtsController>
export { canUseSystemTts, systemTtsUnavailableReason, warmupSystemTts } from './systemTts'
