import { request, withTimeout } from '../http'
import {
  API_HOSTS,
  CLIENT_BRAND,
  CLIENT_NAME,
  CLIENT_VERSION,
  DEVICE_KEY,
  FALLBACK_AUTH,
  HOST_KEY,
  REQ_TIMEOUT_MS,
  TOKEN_KEY,
} from './constants'

export interface ApiEnvelope<T> {
  code?: number
  msg?: string
  request_id?: string
  data?: T
}

function storageGet(key: string): string {
  try {
    const v = uni.getStorageSync(key)
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

function storageSet(key: string, value: string) {
  try {
    uni.setStorageSync(key, value)
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string {
  const cached = storageGet(DEVICE_KEY)
  if (cached.length >= 16) return cached
  const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  storageSet(DEVICE_KEY, id)
  return id
}

export function getStoredToken(): string {
  return storageGet(TOKEN_KEY) || FALLBACK_AUTH
}

export function setStoredToken(token: string) {
  storageSet(TOKEN_KEY, token)
}

function getPreferredHost(): string {
  const h = storageGet(HOST_KEY)
  return API_HOSTS.includes(h as (typeof API_HOSTS)[number]) ? h : API_HOSTS[0]
}

function rememberEndpoint(scheme: string, host: string) {
  storageSet(HOST_KEY, host)
  storageSet('biquge_apk_active_scheme', scheme)
}

export function buildHeaders(): Record<string, string> {
  return {
    'User-Agent': 'okhttp/4.9.2',
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'client-device': getDeviceId(),
    'client-brand': CLIENT_BRAND,
    'client-version': CLIENT_VERSION,
    'client-name': CLIENT_NAME,
    'client-source': 'android',
    Authorization: getStoredToken(),
  }
}

function isMock(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const env = data as ApiEnvelope<unknown>
  return env.request_id === 'mock'
}

/** https 优先，失败再 http（与抓包一致优先 TLS） */
function bases(maxHosts: number): string[] {
  const preferred = getPreferredHost()
  const hosts = [preferred, ...API_HOSTS.filter((h) => h !== preferred)].slice(0, maxHosts)
  const preferredScheme = storageGet('biquge_apk_active_scheme') === 'http' ? 'http' : 'https'
  const schemes = preferredScheme === 'https' ? (['https', 'http'] as const) : (['http', 'https'] as const)
  const out: string[] = []
  for (const host of hosts) {
    for (const scheme of schemes) out.push(`${scheme}://${host}`)
  }
  return out
}

function hasUsefulData(data: unknown): boolean {
  if (data == null) return false
  if (Array.isArray(data)) return data.length > 0
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.list)) return obj.list.length > 0
    if (Array.isArray(obj.data)) return obj.data.length > 0
    // 详情对象
    if (obj.novelId != null || obj.novelName) return true
    return Object.keys(obj).length > 0
  }
  return true
}

export async function apiGet<T>(path: string, maxHosts: number = API_HOSTS.length): Promise<T> {
  let lastError: Error | null = null
  let sawMock = false

  for (const base of bases(maxHosts)) {
    try {
      const data = await withTimeout(
        request<ApiEnvelope<T>>({
          url: `${base}${path}`,
          method: 'GET',
          header: buildHeaders(),
          timeout: REQ_TIMEOUT_MS,
        }),
        REQ_TIMEOUT_MS + 800,
      )
      if (isMock(data)) {
        sawMock = true
        lastError = new Error(`${base} mock`)
        continue
      }
      if (data && typeof data === 'object' && data.code != null && data.code !== 200) {
        lastError = new Error(data.msg || `code ${data.code}`)
        continue
      }
      const payload = (data?.data ?? data) as T
      if (!hasUsefulData(payload)) {
        lastError = new Error(`${base} 空数据`)
        continue
      }
      const m = base.match(/^(https?):\/\/([^/]+)/i)
      if (m) rememberEndpoint(m[1].toLowerCase(), m[2])
      return payload
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  if (sawMock) {
    throw new Error('笔趣阁服务端返回 mock（接口暂不可用），请稍后重试')
  }
  throw lastError || new Error('笔趣阁接口不可用')
}

export async function tryGuestToken(): Promise<void> {
  if (storageGet(TOKEN_KEY)) return
  for (const base of bases(1)) {
    try {
      const data = await withTimeout(
        request<ApiEnvelope<{ tokens?: { token?: string; tokenType?: string } }>>({
          url: `${base}/auth/third`,
          method: 'POST',
          data: {},
          header: buildHeaders(),
          timeout: 4000,
        }),
        4500,
      )
      if (isMock(data)) continue
      const token = data?.data?.tokens?.token
      if (token && token !== 'mock-token') {
        const typ = (data?.data?.tokens?.tokenType || 'bearer').replace(/\s+/g, '')
        setStoredToken(`${typ}${token}`)
        const m = base.match(/^(https?):\/\/([^/]+)/i)
        if (m) rememberEndpoint(m[1].toLowerCase(), m[2])
        return
      }
    } catch {
      /* ignore */
    }
  }
}

export async function apiGetAbsolute<T>(url: string): Promise<T> {
  return withTimeout(
    request<T>({
      url,
      method: 'GET',
      header: buildHeaders(),
      timeout: 12000,
    }),
    12500,
  )
}
