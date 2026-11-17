import { defineStore } from 'pinia'
import type { BookItem, ChapterItem } from '../sources/types'
import {
  getAudioUrl,
  getChapters,
  resolveListenSource,
  type ListenSource,
} from '../services/book'
import { createAudioService } from '../services/audio'
import { createTtsController } from '../services/tts'
import { useBookshelfStore } from './bookshelf'
import { useSettingsStore } from './settings'

const audio = createAudioService()
const tts = createTtsController()

const PERSIST_INTERVAL_MS = 10_000

export const usePlayerStore = defineStore('player', {
  state: () => ({
    book: null as BookItem | null,
    chapters: [] as ChapterItem[],
    chapterIndex: 0,
    /** Fanqie 三路：系统朗读 / AI 音色 / 真人有声 */
    source: 'ai' as ListenSource,
    playing: false,
    positionSec: 0,
    chunkIndex: 0,
    totalChunks: 0,
    currentChunkText: '',
    statusText: '',
    /** 边听边读：听书面板是否展开（阅读器内） */
    panelOpen: false,
    _persistTimer: 0 as number,
  }),
  getters: {
    currentChapter(state): ChapterItem | null {
      return state.chapters[state.chapterIndex] || null
    },
    hasSession(state): boolean {
      return Boolean(state.book && state.chapters.length)
    },
    /** 兼容旧 UI */
    mode(state): 'tts' | 'source-audio' {
      return state.source === 'source-audio' ? 'source-audio' : 'tts'
    },
  },
  actions: {
    _clearPersistTimer() {
      if (this._persistTimer) {
        clearInterval(this._persistTimer)
        this._persistTimer = 0
      }
    },
    _ensurePersistTimer() {
      this._clearPersistTimer()
      // Fanqie：播放中约每 10 秒落盘听书进度
      this._persistTimer = setInterval(() => {
        if (this.playing) this.persistListenProgress()
      }, PERSIST_INTERVAL_MS) as unknown as number
    },

    async openBook(
      book: BookItem,
      chapterIndex = 0,
      opts?: {
        autoPlay?: boolean
        source?: ListenSource
        mode?: 'tts' | 'source-audio'
        resumeProgress?: boolean
        panelOpen?: boolean
      },
    ) {
      const settings = useSettingsStore()
      const shelf = useBookshelfStore()
      const autoPlay = opts?.autoPlay !== false
      const resumeProgress = opts?.resumeProgress === true

      this.book = book
      this.chapters = await getChapters(book.id)
      this.chapterIndex = Math.min(Math.max(chapterIndex, 0), Math.max(this.chapters.length - 1, 0))
      this.source =
        opts?.source ||
        (opts?.mode
          ? opts.mode === 'source-audio'
            ? 'source-audio'
            : settings.ttsEngine === 'system'
              ? 'system'
              : 'ai'
          : resolveListenSource(book, settings.listenPref, settings.ttsEngine))
      this.positionSec = 0
      this.chunkIndex = 0
      this.currentChunkText = ''
      this.panelOpen = opts?.panelOpen ?? this.panelOpen
      shelf.touchHistory(book)

      if (resumeProgress) {
        const progress = shelf.getListenProgress(book.id)
        if (progress) {
          const idx = this.chapters.findIndex((c) => c.id === progress.chapterId)
          if (idx >= 0) this.chapterIndex = idx
          else if (typeof progress.chapterIndex === 'number') {
            this.chapterIndex = Math.min(
              Math.max(progress.chapterIndex, 0),
              Math.max(this.chapters.length - 1, 0),
            )
          }
          if (!opts?.source && !opts?.mode) this.source = progress.source || this.source
          this.positionSec = progress.positionSec || 0
          this.chunkIndex = progress.chunkIndex || 0
        }
      }

      // 同步设置里的引擎偏好（系统 / AI）
      if (this.source === 'system' || this.source === 'ai') {
        settings.patch({ ttsEngine: this.source === 'system' ? 'system' : 'baidu' })
      }

      if (autoPlay) await this.playCurrent()
    },

    persistListenProgress() {
      if (!this.book || !this.currentChapter) return
      useBookshelfStore().saveListenProgress({
        bookId: this.book.id,
        chapterId: this.currentChapter.id,
        chapterIndex: this.chapterIndex,
        chapterTitle: this.currentChapter.title,
        source: this.source,
        positionSec: this.positionSec,
        chunkIndex: this.chunkIndex,
        updatedAt: Date.now(),
      })
    },

    /** @deprecated */
    persistProgress() {
      this.persistListenProgress()
    },

    async playCurrent() {
      if (!this.book || !this.currentChapter) return
      this.playing = true
      this.statusText = '缓冲中…'
      this._ensurePersistTimer()
      tts.stop()
      audio.stop()

      try {
        if (this.source === 'source-audio') {
          await this.playSourceAudio()
        } else {
          await this.playTts()
        }
      } catch (e) {
        this.playing = false
        this._clearPersistTimer()
        this.statusText = e instanceof Error ? e.message : String(e)
        uni.showToast({ title: this.statusText.slice(0, 40), icon: 'none' })
      }
    },

    async playSourceAudio() {
      if (!this.book || !this.currentChapter) return
      const src = await getAudioUrl(this.currentChapter.id)
      this.statusText = '有声播放中'
      const offTime = audio.onTimeUpdate((t) => {
        this.positionSec = t
      })
      const offEnd = audio.onEnded(async () => {
        offTime()
        offEnd()
        this.persistListenProgress()
        if (useSettingsStore().autoNextChapter) await this.nextChapter()
        else {
          this.playing = false
          this._clearPersistTimer()
        }
      })
      audio.setRate(useSettingsStore().playbackRate)
      audio.play(src, {
        title: this.book.title,
        cover: this.book.cover,
        ep: this.currentChapter.title,
      })
      if (this.positionSec > 1) {
        setTimeout(() => audio.seek(this.positionSec), 400)
      }
    },

    async playTts() {
      if (!this.book || !this.currentChapter) return
      const label = this.source === 'system' ? '系统朗读' : 'AI 音色'
      this.statusText = `${label}中`
      const startChunk = this.chunkIndex || 0
      await tts.speakChapter({
        chapterId: this.currentChapter.id,
        startChunkIndex: startChunk,
        title: this.book.title,
        cover: this.book.cover,
        forceSystem: this.source === 'system',
        onProgress: (p) => {
          this.chunkIndex = p.chunkIndex
          this.totalChunks = p.totalChunks
          this.currentChunkText = p.text || ''
          this.statusText = `${label} ${p.chunkIndex + 1}/${p.totalChunks}`
        },
      })
      this.chunkIndex = 0
      this.currentChunkText = ''
      this.persistListenProgress()
      if (!this.playing) return
      if (useSettingsStore().autoNextChapter) await this.nextChapter()
      else {
        this.playing = false
        this._clearPersistTimer()
      }
    },

    pause() {
      this.playing = false
      if (this.source === 'source-audio') audio.pause()
      else tts.pause()
      this.persistListenProgress()
      this._clearPersistTimer()
    },

    resume() {
      this.playing = true
      this._ensurePersistTimer()
      if (this.source === 'source-audio') audio.resume()
      else {
        // 系统 TTS pause 实际是 stop，需从当前片续读
        if (this.source === 'system') void this.playCurrent()
        else tts.resume()
      }
    },

    stop() {
      this.playing = false
      tts.stop()
      audio.stop()
      this.persistListenProgress()
      this._clearPersistTimer()
    },

    async nextChapter() {
      if (this.chapterIndex >= this.chapters.length - 1) {
        this.playing = false
        this.statusText = '已到最后一章'
        this._clearPersistTimer()
        return
      }
      this.chapterIndex += 1
      this.positionSec = 0
      this.chunkIndex = 0
      this.currentChunkText = ''
      await this.playCurrent()
    },

    async prevChapter() {
      if (this.chapterIndex <= 0) return
      this.chapterIndex -= 1
      this.positionSec = 0
      this.chunkIndex = 0
      this.currentChunkText = ''
      await this.playCurrent()
    },

    /** 阅读器翻页时：开跟随时从该章重新开读（Fanqie #467） */
    async syncFromReader(chapterIndex: number) {
      if (!this.book || !this.chapters.length) return
      if (!useSettingsStore().listenFollowReader) return
      if (chapterIndex === this.chapterIndex && this.playing) return
      this.chapterIndex = Math.min(Math.max(chapterIndex, 0), this.chapters.length - 1)
      this.positionSec = 0
      this.chunkIndex = 0
      this.currentChunkText = ''
      if (this.playing || this.panelOpen) await this.playCurrent()
    },

    async switchSource(source: ListenSource) {
      this.source = source
      const settings = useSettingsStore()
      if (source === 'system' || source === 'ai') {
        settings.patch({ ttsEngine: source === 'system' ? 'system' : 'baidu' })
      }
      this.positionSec = 0
      this.chunkIndex = 0
      this.currentChunkText = ''
      if (source === 'system') {
        const { canUseSystemTts, systemTtsUnavailableReason } = await import('../services/tts')
        if (!canUseSystemTts()) {
          this.playing = false
          this.statusText = systemTtsUnavailableReason()
          uni.showModal({
            title: '需要 App 真机',
            content: systemTtsUnavailableReason(),
            showCancel: false,
          })
          return
        }
      }
      await this.playCurrent()
    },

    async switchMode(mode: 'tts' | 'source-audio') {
      const settings = useSettingsStore()
      await this.switchSource(
        mode === 'source-audio' ? 'source-audio' : settings.ttsEngine === 'system' ? 'system' : 'ai',
      )
    },

    setPanelOpen(open: boolean) {
      this.panelOpen = open
    },
  },
})
