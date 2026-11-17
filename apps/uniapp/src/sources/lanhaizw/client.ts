import iconv from 'iconv-lite'
import { Buffer } from 'buffer'

/** 微信会自动管理同域 Cookie；此处 jar 作补充（可写 Cookie 的端） */
export class CookieJar {
  private map = new Map<string, string>()

  absorb(cookies: string[] | string | undefined) {
    const list = !cookies ? [] : Array.isArray(cookies) ? cookies : [cookies]
    for (const c of list) {
      const m = String(c).match(/^([^=]+)=([^;]*)/)
      if (m) this.map.set(m[1], m[2])
    }
  }

  absorbSetCookieHeader(header: Record<string, string | string[] | undefined>) {
    const raw = header['set-cookie'] || header['Set-Cookie']
    if (!raw) return
    this.absorb(raw)
  }

  header(): string | undefined {
    if (!this.map.size) return undefined
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  get(name: string): string | undefined {
    return this.map.get(name)
  }
}

export function encodeFormGbk(fields: Record<string, string>): ArrayBuffer {
  const parts: number[] = []
  let first = true
  for (const [k, v] of Object.entries(fields)) {
    if (!first) parts.push(0x26) // &
    first = false
    const pushEnc = (s: string) => {
      const buf = iconv.encode(s, 'gbk')
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i]
        const ch = String.fromCharCode(b)
        if (/[A-Za-z0-9\-_.!~*'()]/.test(ch)) parts.push(b)
        else {
          const hex = b.toString(16).toUpperCase().padStart(2, '0')
          parts.push(0x25, hex.charCodeAt(0), hex.charCodeAt(1)) // %XX
        }
      }
    }
    pushEnc(k)
    parts.push(0x3d) // =
    pushEnc(v)
  }
  return Uint8Array.from(parts).buffer
}

function decodeBody(buf: ArrayBuffer): string {
  const bytes = Buffer.from(buf)
  const head = bytes.slice(0, 800).toString('latin1')
  if (/charset\s*=\s*gb/i.test(head)) return iconv.decode(bytes, 'gbk')
  const utf = bytes.toString('utf8')
  if (/作者|搜索|蓝海|章节|验证|对象已移动/.test(utf)) return utf
  return iconv.decode(bytes, 'gbk')
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += chars[(n >> 18) & 63]
    out += chars[(n >> 12) & 63]
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? chars[n & 63] : '='
  }
  return out
}

export interface RawResult {
  status: number
  header: Record<string, string>
  cookies: string[]
  buf: ArrayBuffer
  text: string
  location?: string
  url: string
}

function normalizeHeader(h: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!h || typeof h !== 'object') return out
  for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
    if (v == null) continue
    out[k] = Array.isArray(v) ? String(v[0]) : String(v)
  }
  return out
}

/**
 * 小程序直连：arraybuffer + GBK。
 * Cookie / Referer 在微信里可能被禁写，依赖运行时自动带同域 Cookie。
 */
export function rawRequest(
  url: string,
  opts: {
    method?: 'GET' | 'POST'
    body?: ArrayBuffer | string
    header?: Record<string, string>
    jar?: CookieJar
    timeout?: number
  } = {},
): Promise<RawResult> {
  const { method = 'GET', body, header = {}, jar, timeout = 30000 } = opts
  const cookie = jar?.header()
  // 微信禁止自定义 Cookie/Referer/UA；能写的端会带上
  const finalHeader: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    ...header,
  }
  if (cookie) finalHeader.Cookie = cookie

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: body,
      header: finalHeader,
      timeout,
      responseType: 'arraybuffer',
      // @ts-expect-error 部分端支持
      enableCookie: true,
      success: (res) => {
        const headerMap = normalizeHeader(res.header)
        const cookies = ((res as { cookies?: string[] }).cookies || []).map(String)
        jar?.absorb(cookies)
        jar?.absorbSetCookieHeader(headerMap as Record<string, string | string[] | undefined>)

        const locRaw = headerMap.Location || headerMap.location
        const location = locRaw
          ? locRaw.startsWith('http')
            ? locRaw
            : locRaw.startsWith('?') || locRaw.startsWith('/')
              ? // 相对 Location
                locRaw.startsWith('?')
                  ? `${url.replace(/[?#].*$/, '')}${locRaw}`
                  : `${url.match(/^https?:\/\/[^/?#]+/i)?.[0] || ''}${locRaw}`
              : locRaw
          : undefined

        const buf =
          res.data instanceof ArrayBuffer
            ? res.data
            : typeof res.data === 'string'
              ? Uint8Array.from(res.data, (c) => c.charCodeAt(0)).buffer
              : new ArrayBuffer(0)

        // 302 页面体里也可能带跳转链接
        let text = ''
        try {
          text = decodeBody(buf)
        } catch {
          text = ''
        }
        const hrefLoc = text.match(/HREF=["'](\?[^"']+)["']/i)?.[1]
        const resolvedLoc =
          location ||
          (hrefLoc ? `${url.replace(/[?#].*$/, '')}${hrefLoc}` : undefined)

        resolve({
          status: res.statusCode || 0,
          header: headerMap,
          cookies,
          buf,
          text,
          location: resolvedLoc,
          url,
        })
      },
      fail: (err) => reject(new Error(err.errMsg || 'network error')),
    })
  })
}

export async function fetchText(
  url: string,
  opts: {
    method?: 'GET' | 'POST'
    body?: ArrayBuffer | string
    header?: Record<string, string>
    jar?: CookieJar
    timeout?: number
  } = {},
): Promise<RawResult> {
  const res = await rawRequest(url, opts)
  // 手动跟随一轮重定向（若端未自动跟随）
  if (res.status >= 300 && res.status < 400 && res.location) {
    return rawRequest(res.location, { method: 'GET', jar: opts.jar, header: opts.header })
  }
  return res
}

export function bufferToBase64(buf: ArrayBuffer): string {
  if (typeof uni.arrayBufferToBase64 === 'function') {
    return uni.arrayBufferToBase64(buf)
  }
  return arrayBufferToBase64(buf)
}
