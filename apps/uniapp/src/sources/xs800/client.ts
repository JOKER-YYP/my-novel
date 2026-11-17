import { formatRequestFail } from '../http'

let cachedWafCookie = ''
let wafCookieAt = 0
const WAF_TTL_MS = 4 * 60 * 1000

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractWafCookie(html: string): string {
  const m = html.match(/document\.cookie\s*=\s*['"](waf_challenge=[^;'"]+)/i)
  return m?.[1] || ''
}

function isChallenge(html: string) {
  return /Verifying your browser|Verification failed/i.test(html)
}

type RequestOpts = {
  method?: 'GET' | 'POST'
  referer?: string
  cookie?: string
  data?: Record<string, string>
  timeout?: number
}

function requestRaw(url: string, opts: RequestOpts = {}): Promise<{ status: number; body: string }> {
  const header: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  }
  if (opts.referer) header.Referer = opts.referer
  if (opts.cookie) header.Cookie = opts.cookie
  if (opts.data) {
    header['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    header.Origin = 'https://www.800xs.org'
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: opts.method || 'GET',
      data: opts.data,
      header,
      timeout: opts.timeout || 20000,
      // @ts-expect-error 部分端支持
      enableCookie: true,
      success: (res) => {
        resolve({
          status: res.statusCode || 0,
          body: typeof res.data === 'string' ? res.data : String(res.data ?? ''),
        })
      },
      fail: (err) => reject(new Error(formatRequestFail(err.errMsg))),
    })
  })
}

async function ensureWafCookie(force = false): Promise<string> {
  const now = Date.now()
  if (!force && cachedWafCookie && now - wafCookieAt < WAF_TTL_MS) return cachedWafCookie

  const res = await requestRaw('https://www.800xs.org/', { referer: 'https://www.800xs.org/' })
  const cookie = extractWafCookie(res.body)
  if (cookie) {
    cachedWafCookie = cookie
    wafCookieAt = now
    return cookie
  }
  if (!isChallenge(res.body) && res.status >= 200 && res.status < 300) {
    cachedWafCookie = ''
    wafCookieAt = now
    return ''
  }
  throw new Error('800小说人机验证失败')
}

/** 带动态 waf_challenge 的 HTML 请求 */
export async function getHtml(url: string, opts: RequestOpts = {}): Promise<string> {
  let cookie = await ensureWafCookie()
  let res = await requestRaw(url, { ...opts, cookie })
  if (!isChallenge(res.body) && res.status >= 200 && res.status < 300) return res.body

  cookie = await ensureWafCookie(true)
  await delay(250)
  res = await requestRaw(url, { ...opts, cookie })
  if (isChallenge(res.body)) throw new Error('800小说人机验证未通过，请稍后重试')
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
  return res.body
}

export async function postForm(url: string, fields: Record<string, string>, referer?: string) {
  return getHtml(url, { method: 'POST', data: fields, referer })
}
