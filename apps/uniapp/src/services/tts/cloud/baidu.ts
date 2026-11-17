import { request } from '../../../sources/http'
import { useSettingsStore } from '../../../stores/settings'
import { loadJson, saveJson } from '../../../utils/storage'

const TOKEN_KEY = 'baidu_tts_token'
const CUID_KEY = 'baidu_tts_cuid'

interface TokenCache {
  access_token: string
  expires_at: number
}

function getCuid(): string {
  let cuid = uni.getStorageSync(CUID_KEY) as string
  if (!cuid) {
    cuid = `mynovel_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    uni.setStorageSync(CUID_KEY, cuid)
  }
  return cuid
}

function getUserDataPath(): string {
  try {
    // 微信小程序
    // @ts-expect-error wx global in mp
    if (typeof wx !== 'undefined' && wx?.env?.USER_DATA_PATH) {
      // @ts-expect-error wx global
      return wx.env.USER_DATA_PATH as string
    }
  } catch {
    /* ignore */
  }
  return '_doc'
}

export async function ensureBaiduToken(): Promise<string> {
  const settings = useSettingsStore()
  if (!settings.baiduApiKey || !settings.baiduSecretKey) {
    throw new Error('请先在设置里填写百度 API Key / Secret Key')
  }

  const cached = loadJson<TokenCache | null>(TOKEN_KEY, null)
  if (cached && cached.expires_at > Date.now() + 60_000) {
    return cached.access_token
  }

  const url =
    `https://aip.baidubce.com/oauth/2.0/token` +
    `?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(settings.baiduApiKey)}` +
    `&client_secret=${encodeURIComponent(settings.baiduSecretKey)}`

  const data = await request<{
    access_token?: string
    expires_in?: number
    error_description?: string
  }>({
    url,
    method: 'GET',
  })

  if (!data.access_token) {
    throw new Error(data.error_description || '获取百度 token 失败')
  }

  const cache: TokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 2592000) * 1000,
  }
  saveJson(TOKEN_KEY, cache)
  return data.access_token
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  // @ts-expect-error btoa
  if (typeof btoa === 'function') return btoa(binary)
  // App 环境
  // @ts-expect-error plus
  if (typeof plus !== 'undefined' && plus?.android) {
    // fallback unlikely needed
  }
  throw new Error('当前环境无法编码 base64')
}

function looksLikeJson(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8))
  const first = bytes[0]
  return first === 0x7b || first === 0x5b // { or [
}

/** 合成短文本，返回本地临时 mp3 路径 */
export async function synthesizeBaiduMp3(text: string): Promise<{ src: string }> {
  const settings = useSettingsStore()
  const token = await ensureBaiduToken()
  const cuid = getCuid()

  const params = [
    `tex=${encodeURIComponent(text)}`,
    `tok=${encodeURIComponent(token)}`,
    `cuid=${encodeURIComponent(cuid)}`,
    'ctp=1',
    'lan=zh',
    `spd=${settings.baiduSpd}`,
    `pit=${settings.baiduPit}`,
    `vol=${settings.baiduVol}`,
    `per=${settings.baiduPer}`,
    'aue=3',
  ].join('&')

  const url = `https://tsn.baidu.com/text2audio`

  const data = await request<ArrayBuffer>({
    url,
    method: 'POST',
    data: params,
    responseType: 'arraybuffer',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (!data || !(data instanceof ArrayBuffer) && !(data as ArrayBuffer)?.byteLength) {
    // 部分运行时不返回 instanceof ArrayBuffer，仍可能有 byteLength
    const buf = data as ArrayBuffer
    if (!buf || !buf.byteLength) throw new Error('百度合成无音频数据')
  }

  const buffer = data as ArrayBuffer
  if (looksLikeJson(buffer)) {
    let msg = '百度合成失败'
    try {
      const str =
        typeof TextDecoder !== 'undefined'
          ? new TextDecoder('utf-8').decode(buffer)
          : String.fromCharCode(...new Uint8Array(buffer))
      const json = JSON.parse(str) as { err_msg?: string; errMsg?: string }
      msg = json.err_msg || json.errMsg || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const base64 = arrayBufferToBase64(buffer)
  const filePath = `${getUserDataPath()}/tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`

  await new Promise<void>((resolve, reject) => {
    const fs = uni.getFileSystemManager()
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(),
      fail: (e) => reject(new Error(e.errMsg || 'writeFile failed')),
    })
  })

  return { src: filePath }
}
