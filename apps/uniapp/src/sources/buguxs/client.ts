import { formatRequestFail } from '../http'
import { CLEARANCE_COOKIE } from './constants'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getHtml(
  url: string,
  opts: { referer?: string; cookie?: string; timeout?: number } = {},
): Promise<string> {
  const header: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  }
  if (opts.referer) header.Referer = opts.referer
  if (opts.cookie) header.Cookie = opts.cookie

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      header,
      timeout: opts.timeout || 20000,
      // @ts-expect-error 部分端支持
      enableCookie: true,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(typeof res.data === 'string' ? res.data : String(res.data ?? ''))
          return
        }
        reject(new Error(`HTTP ${res.statusCode}`))
      },
      fail: (err) => reject(new Error(formatRequestFail(err.errMsg))),
    })
  })
}

function isChallenge(html: string) {
  return /正在检查您的浏览器|__sc_clearance/i.test(html)
}

/** 搜索页有简易 Cloudflare 等待页：带 clearance cookie 再请求即可 */
export async function getHtmlWithClearance(
  url: string,
  referer = 'https://www.buguxs.com/',
): Promise<string> {
  let html = await getHtml(url, { referer, cookie: CLEARANCE_COOKIE })
  if (!isChallenge(html)) return html
  await delay(1100)
  html = await getHtml(url, { referer, cookie: CLEARANCE_COOKIE })
  if (isChallenge(html)) throw new Error('搜索人机验证未通过，请稍后重试')
  return html
}
