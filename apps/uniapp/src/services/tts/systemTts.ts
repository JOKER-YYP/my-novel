/**
 * 系统语音合成：优先走 Android 原生 TextToSpeech（小米等自带引擎），
 * 其次 plus.speech，再次 H5 speechSynthesis。
 * 微信小程序无法调用系统 TTS。
 */

type SpeakOpts = {
  rate?: number
  pitch?: number
}

type AndroidTts = {
  setLanguage: (locale: unknown) => number
  setSpeechRate: (rate: number) => number
  setPitch: (pitch: number) => number
  speak: (text: string, queueMode: number, params: unknown, utteranceId?: string) => number
  stop: () => number
  shutdown: () => void
  isSpeaking?: () => boolean
}

let androidTts: AndroidTts | null = null
let androidReady: Promise<boolean> | null = null
let speaking = false
let stopped = false

function getPlus(): any {
  return (globalThis as { plus?: any }).plus
}

function isAndroidApp(): boolean {
  try {
    const info = uni.getSystemInfoSync() as { uniPlatform?: string; platform?: string }
    const uniPlatform = info.uniPlatform || ''
    if (uniPlatform.startsWith('mp-')) return false
    if (uniPlatform === 'app' || uniPlatform === 'app-android') {
      return (info.platform || '').toLowerCase() === 'android' || uniPlatform === 'app-android'
    }
    // 部分运行时只有 platform
    return Boolean(getPlus()) && (info.platform || '').toLowerCase() === 'android'
  } catch {
    return false
  }
}

function ensureAndroidTts(): Promise<boolean> {
  if (androidReady) return androidReady
  androidReady = new Promise((resolve) => {
    const plus = getPlus()
    if (!plus?.android) {
      resolve(false)
      return
    }
    try {
      const main = plus.android.runtimeMainActivity()
      const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
      const Locale = plus.android.importClass('java.util.Locale')
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        resolve(ok)
      }
      // 部分机型初始化较慢，超时后仍可尝试 speak
      setTimeout(() => finish(Boolean(androidTts)), 4000)

      androidTts = new TextToSpeech(
        main,
        plus.android.implements('android.speech.tts.TextToSpeech$OnInitListener', {
          onInit(status: number) {
            try {
              if (status !== TextToSpeech.SUCCESS && status !== 0) {
                finish(false)
                return
              }
              const lang =
                Locale.SIMPLIFIED_CHINESE ||
                Locale.CHINA ||
                Locale.CHINESE ||
                new Locale('zh', 'CN')
              const r = androidTts!.setLanguage(lang)
              // LANG_MISSING_DATA=-1 LANG_NOT_SUPPORTED=-2
              if (r === -1 || r === -2) {
                finish(false)
                return
              }
              finish(true)
            } catch {
              finish(false)
            }
          },
        }),
      ) as AndroidTts
    } catch {
      resolve(false)
    }
  })
  return androidReady
}

function speakAndroid(text: string, opts: SpeakOpts): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const ok = await ensureAndroidTts()
    if (!ok || !androidTts) {
      reject(new Error('系统 TTS 初始化失败，请到手机设置开启「文字转语音」'))
      return
    }
    if (stopped) {
      resolve()
      return
    }
    try {
      const Text = Math.min(2, Math.max(0.5, opts.rate ?? 1))
      androidTts.setSpeechRate(rate)
      androidTts.setPitch(opts.pitch ?? 1)
      speaking = true

      // QUEUE_FLUSH = 0
      const code = androidTts.speak(text, 0, null, `utt_${Date.now()}`)
      if (code === -1) {
        speaking = false
        reject(new Error('系统 TTS 播报失败'))
        return
      }

      // TextToSpeech 完成回调在 HTML5+ 中不稳定，用轮询 isSpeaking
      const started = Date.now()
      const maxMs = Math.max(8000, text.length * 280)
      const timer = setInterval(() => {
        if (stopped) {
          clearInterval(timer)
          try {
            androidTts?.stop()
          } catch {
            /* ignore */
          }
          speaking = false
          resolve()
          return
        }
        let busy = false
        try {
          busy = Boolean(androidTts?.isSpeaking?.())
        } catch {
          busy = false
        }
        // 刚开始的几百毫秒可能尚未标记 speaking
        if (!busy && Date.now() - started > 600) {
          clearInterval(timer)
          speaking = false
          resolve()
          return
        }
        if (Date.now() - started > maxMs) {
          clearInterval(timer)
          speaking = false
          resolve()
        }
      }, 200)
    } catch (e) {
      speaking = false
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

function speakPlusSpeech(text: string, opts: SpeakOpts): Promise<void> {
  const plus = getPlus()
  const speech = plus?.speech
  if (!speech?.startSpeaking && !speech?.startSpeak) {
    return Promise.reject(new Error('当前 App 未启用 Speech 模块'))
  }
  return new Promise((resolve, reject) => {
    speaking = true
    const rate = Math.min(2, Math.max(0.5, opts.rate ?? 1))
    const onOk = () => {
      speaking = false
      resolve()
    }
    const onFail = (err: { message?: string } | string) => {
      speaking = false
      const msg = typeof err === 'string' ? err : err?.message
      reject(new Error(msg || 'plus.speech 失败'))
    }
    try {
      // 兼容不同运行时签名
      if (typeof speech.startSpeaking === 'function') {
        speech.startSpeaking(text, { rate, pitch: opts.pitch ?? 1 }, onOk, onFail)
      } else {
        speech.startSpeak(text, { rate }, onOk, onFail)
      }
    } catch (e) {
      speaking = false
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

function speakWeb(text: string, opts: SpeakOpts): Promise<void> {
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
  if (!synth) return Promise.reject(new Error('浏览器不支持 speechSynthesis'))
  return new Promise((resolve, reject) => {
    try {
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = Math.min(2, Math.max(0.5, opts.rate ?? 1))
      u.pitch = opts.pitch ?? 1
      speaking = true
      u.onend = () => {
        speaking = false
        resolve()
      }
      u.onerror = () => {
        speaking = false
        reject(new Error('speechSynthesis 播放失败'))
      }
      synth.speak(u)
    } catch (e) {
      speaking = false
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export function canUseSystemTts(): boolean {
  try {
    const info = uni.getSystemInfoSync() as { uniPlatform?: string }
    const p = info.uniPlatform || ''
    if (p.startsWith('mp-')) return false
    if (getPlus()?.speech || getPlus()?.android) return true
    if ((globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis) return true
    return false
  } catch {
    return false
  }
}

export function systemTtsUnavailableReason(): string {
  try {
    const info = uni.getSystemInfoSync() as { uniPlatform?: string }
    if ((info.uniPlatform || '').startsWith('mp-')) {
      return '微信小程序无法调用手机系统语音。请用 HBuilderX 运行到「Android App」真机（小米会走系统文字转语音）。'
    }
  } catch {
    /* ignore */
  }
  return '当前环境不支持系统语音合成'
}

/** 预热系统引擎，减少首句延迟（小米等机型常见） */
export async function warmupSystemTts(): Promise<void> {
  if (!canUseSystemTts()) return
  try {
    if (isAndroidApp()) await ensureAndroidTts()
  } catch {
    /* ignore */
  }
}

export function createSystemTts() {
  return {
    async speak(text: string, rate = 1): Promise<void> {
      stopped = false
      const opts: SpeakOpts = { rate, pitch: 1 }
      const errors: string[] = []

      if (isAndroidApp()) {
        try {
          await speakAndroid(text, opts)
          return
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e))
        }
        try {
          await speakPlusSpeech(text, opts)
          return
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e))
        }
      } else if (getPlus()?.speech) {
        try {
          await speakPlusSpeech(text, opts)
          return
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e))
        }
      }

      try {
        await speakWeb(text, opts)
        return
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }

      throw new Error(errors.filter(Boolean).join('；') || systemTtsUnavailableReason())
    },
    stop() {
      stopped = true
      speaking = false
      try {
        androidTts?.stop()
      } catch {
        /* ignore */
      }
      try {
        getPlus()?.speech?.stopSpeaking?.()
        getPlus()?.speech?.stop?.()
      } catch {
        /* ignore */
      }
      try {
        ;(globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis?.cancel()
      } catch {
        /* ignore */
      }
    },
    get isSpeaking() {
      return speaking
    },
  }
}
