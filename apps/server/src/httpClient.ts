import http from 'http'
import https from 'https'
import { URL } from 'url'
import iconv from 'iconv-lite'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class CookieJar {
  private map = new Map<string, string>()

  setFromHeader(setCookie: string[] | string | undefined) {
    const list = !setCookie ? [] : Array.isArray(setCookie) ? setCookie : [setCookie]
    for (const c of list) {
      const m = String(c).match(/^([^=]+)=([^;]*)/)
      if (m) this.map.set(m[1], m[2])
    }
  }

  header(): string | undefined {
    if (!this.map.size) return undefined
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  clear() {
    this.map.clear()
  }
}

export function encodeFormGbk(fields: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (parts.length) parts.push(Buffer.from('&'))
    const enc = (s: string) =>
      Buffer.concat(
        [...iconv.encode(s, 'gbk')].map((b) => {
          const ch = String.fromCharCode(b)
          if (/[A-Za-z0-9\-_.!~*'()]/.test(ch)) return Buffer.from(ch)
          return Buffer.from(`%${b.toString(16).toUpperCase().padStart(2, '0')}`)
        }),
      )
    parts.push(enc(k), Buffer.from('='), enc(v))
  }
  return Buffer.concat(parts)
}

export interface HttpResult {
  status: number
  headers: http.IncomingHttpHeaders
  buf: Buffer
  text: string
  location?: string
  url: string
}

function decodeBody(buf: Buffer): string {
  const head = buf.slice(0, 800).toString('latin1')
  if (/charset\s*=\s*gb/i.test(head)) return iconv.decode(buf, 'gbk')
  const utf = buf.toString('utf8')
  if (/作者|搜索|蓝海|章节|验证/.test(utf)) return utf
  return iconv.decode(buf, 'gbk')
}

export function request(
  url: string,
  opts: {
    method?: 'GET' | 'POST'
    body?: Buffer | string
    headers?: Record<string, string>
    jar?: CookieJar
    follow?: boolean
    redirects?: number
    timeoutMs?: number
  } = {},
): Promise<HttpResult> {
  const {
    method = 'GET',
    body,
    headers = {},
    jar,
    follow = true,
    redirects = 0,
    timeoutMs = 25000,
  } = opts
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('too many redirects'))
    const u = new URL(url)
    const bodyBuf = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(body)
    const cookie = jar?.header()
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
          ...headers,
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        jar?.setFromHeader(res.headers['set-cookie'])
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const buf = Buffer.concat(chunks)
          const loc = res.headers.location
            ? new URL(res.headers.location, url).href
            : undefined
          if (follow && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
            request(loc, { method: 'GET', headers, jar, follow, redirects: redirects + 1, timeoutMs })
              .then(resolve, reject)
            return
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buf,
            text: decodeBody(buf),
            location: loc,
            url,
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`timeout ${timeoutMs}ms`))
    })
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}
