export interface PlayMeta {
  title: string
  cover?: string
  ep?: string
}

type VoidFn = () => void
type TimeFn = (t: number) => void

function useBackgroundAudio(): boolean {
  try {
    const info = uni.getSystemInfoSync() as UniApp.GetSystemInfoResult & { uniPlatform?: string }
    const platform = info.uniPlatform || ''
    return platform.startsWith('mp-')
  } catch {
    return false
  }
}

/**
 * 统一有声播放：
 * - 小程序：BackgroundAudioManager（可后台）
 * - App/H5：innerAudioContext
 */
export function createAudioService() {
  let endedHandlers: VoidFn[] = []
  let timeHandlers: TimeFn[] = []
  let bg: UniApp.BackgroundAudioManager | null = null
  let inner: UniApp.InnerAudioContext | null = null
  const isMp = useBackgroundAudio()

  function ensurePlayer() {
    if (isMp) {
      if (!bg) {
        bg = uni.getBackgroundAudioManager()
        bg.onEnded(() => endedHandlers.forEach((h) => h()))
        bg.onTimeUpdate(() => {
          const t = bg?.currentTime || 0
          timeHandlers.forEach((h) => h(t))
        })
        bg.onError((e) => {
          console.error('bg audio error', e)
        })
      }
      return { kind: 'bg' as const, player: bg! }
    }
    if (!inner) {
      inner = uni.createInnerAudioContext()
      inner.obeyMuteSwitch = false
      inner.onEnded(() => endedHandlers.forEach((h) => h()))
      inner.onTimeUpdate(() => {
        const t = inner?.currentTime || 0
        timeHandlers.forEach((h) => h(t))
      })
      inner.onError((e) => {
        console.error('inner audio error', e)
      })
    }
    return { kind: 'inner' as const, player: inner! }
  }

  return {
    play(src: string, meta: PlayMeta) {
      const { kind, player } = ensurePlayer()
      if (kind === 'bg') {
        const p = player as UniApp.BackgroundAudioManager
        p.title = meta.title
        p.epname = meta.ep || meta.title
        p.singer = '听书匣'
        if (meta.cover) p.coverImgUrl = meta.cover
        p.src = src
      } else {
        const p = player as UniApp.InnerAudioContext
        p.src = src
        p.play()
      }
    },
    pause() {
      const { kind, player } = ensurePlayer()
      if (kind === 'bg') (player as UniApp.BackgroundAudioManager).pause()
      else (player as UniApp.InnerAudioContext).pause()
    },
    resume() {
      const { kind, player } = ensurePlayer()
      if (kind === 'bg') (player as UniApp.BackgroundAudioManager).play()
      else (player as UniApp.InnerAudioContext).play()
    },
    stop() {
      const { kind, player } = ensurePlayer()
      if (kind === 'bg') (player as UniApp.BackgroundAudioManager).pause()
      else (player as UniApp.InnerAudioContext).stop()
    },
    seek(t: number) {
      const { kind, player } = ensurePlayer()
      if (kind === 'bg') (player as UniApp.BackgroundAudioManager).seek(t)
      else (player as UniApp.InnerAudioContext).seek(t)
    },
    setRate(r: number) {
      if (!isMp && inner) {
        try {
          // @ts-expect-error platform field
          inner.playbackRate = r
        } catch {
          /* ignore */
        }
      }
      void r
    },
    onEnded(cb: VoidFn) {
      endedHandlers.push(cb)
      return () => {
        endedHandlers = endedHandlers.filter((h) => h !== cb)
      }
    },
    onTimeUpdate(cb: TimeFn) {
      timeHandlers.push(cb)
      return () => {
        timeHandlers = timeHandlers.filter((h) => h !== cb)
      }
    },
  }
}

export type AudioService = ReturnType<typeof createAudioService>
