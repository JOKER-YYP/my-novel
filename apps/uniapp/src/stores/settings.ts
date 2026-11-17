import { defineStore } from 'pinia'
import { defaultEnabledSourceIds } from '../sources/registry'
import type {
  PageTurnMode,
  ReaderFontFamily,
  ReaderThemeId,
} from '../services/reader/themes'
import { BAIDU_VOICES } from '../services/tts/cloud/voices'
import { loadJson, saveJson } from '../utils/storage'

export type ListenPref = 'auto' | 'source-audio' | 'tts'
export type TtsEnginePref = 'system' | 'baidu'

export interface AppSettings {
  enabledSourceIds: string[]
  searchTimeoutMs: number
  listenPref: ListenPref
  playbackRate: number
  ttsEngine: TtsEnginePref
  /** Fanqie 对齐：边听边读时，听书切章跟随阅读器 / 阅读器跟随听书 */
  listenFollowReader: boolean
  baiduApiKey: string
  baiduSecretKey: string
  baiduPer: number
  baiduSpd: number
  baiduPit: number
  baiduVol: number
  autoNextChapter: boolean
  readerFontSize: number
  /** @deprecated 由 readerTheme=6 替代，保留兼容 */
  readerNight: boolean
  /** 番茄风格主题 1~7 */
  readerTheme: ReaderThemeId
  readerFontFamily: ReaderFontFamily
  readerTextColor: string
  readerLineHeight: number
  readerPageTurn: PageTurnMode
  readerEyeCare: boolean
}

const STORAGE_KEY = 'settings'

function defaults(): AppSettings {
  return {
    enabledSourceIds: defaultEnabledSourceIds(),
    searchTimeoutMs: 45000,
    listenPref: 'tts',
    playbackRate: 1,
    ttsEngine: 'system',
    listenFollowReader: true,
    baiduApiKey: '',
    baiduSecretKey: '',
    baiduPer: BAIDU_VOICES[0]?.per ?? 0,
    baiduSpd: 5,
    baiduPit: 5,
    baiduVol: 5,
    autoNextChapter: true,
    readerFontSize: 20,
    readerNight: false,
    readerTheme: 2,
    readerFontFamily: 'hand',
    readerTextColor: '',
    readerLineHeight: 2.1,
    readerPageTurn: 'scroll',
    readerEyeCare: false,
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): AppSettings => {
    const loaded = loadJson<Partial<AppSettings> & { apiBaseUrl?: string }>(STORAGE_KEY, {})
    // 丢弃旧版后端地址字段
    const { apiBaseUrl: _drop, ...rest } = loaded
    const merged: AppSettings = {
      ...defaults(),
      ...rest,
    }
    if (!merged.searchTimeoutMs || merged.searchTimeoutMs < 12000) {
      merged.searchTimeoutMs = 45000
    }
    // 旧版仅有 readerNight：迁移为主题 6
    if (!merged.readerTheme) {
      merged.readerTheme = merged.readerNight ? 7 : 2
    }
    if (![1, 2, 3, 4, 5, 6, 7].includes(Number(merged.readerTheme))) {
      merged.readerTheme = 2
    }
    if (!merged.readerFontFamily) merged.readerFontFamily = 'hand'
    if (!merged.readerLineHeight) merged.readerLineHeight = 2.1
    if (!merged.readerPageTurn) merged.readerPageTurn = 'scroll'
    if (merged.readerTextColor == null) merged.readerTextColor = ''
    if (merged.readerEyeCare == null) merged.readerEyeCare = false
    merged.readerNight = merged.readerTheme === 6
    // 听书默认改用系统语音（小米等自带引擎）；旧默认 baidu 一并切到 system
    if (!merged.ttsEngine || merged.ttsEngine === 'baidu') {
      // 仅当用户从未显式配置过时迁移：若已有百度 key 且原先选 baidu，保留 baidu
      const hadBaiduKeys = Boolean(merged.baiduApiKey && merged.baiduSecretKey)
      if (!hadBaiduKeys) merged.ttsEngine = 'system'
    }
    merged.enabledSourceIds = defaultEnabledSourceIds()
    return merged
  },
  getters: {
    baiduConfigured(state): boolean {
      return Boolean(state.baiduApiKey && state.baiduSecretKey)
    },
  },
  actions: {
    persist() {
      saveJson(STORAGE_KEY, { ...this.$state })
    },
    patch(partial: Partial<AppSettings>) {
      Object.assign(this.$state, partial)
      this.persist()
    },
    toggleSource(id: string, enabled: boolean) {
      const set = new Set(this.enabledSourceIds)
      if (enabled) set.add(id)
      else set.delete(id)
      this.enabledSourceIds = [...set]
      this.persist()
    },
    exportBackup(): string {
      return JSON.stringify(
        {
          settings: { ...this.$state },
          bookshelf: uni.getStorageSync('bookshelf') || [],
          history: uni.getStorageSync('history') || [],
        },
        null,
        2,
      )
    },
    importBackup(raw: string) {
      const data = JSON.parse(raw) as {
        settings?: Partial<AppSettings>
        bookshelf?: unknown
        history?: unknown
      }
      if (data.settings) this.patch(data.settings)
      if (data.bookshelf) uni.setStorageSync('bookshelf', data.bookshelf)
      if (data.history) uni.setStorageSync('history', data.history)
    },
  },
})
