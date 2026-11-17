import { CookieJar, request } from '../httpClient'
import { BASE_URL } from './constants'

/** 执行站点 nnxswnn 脚本中的扰乱 MD5，完成「内容正在载入」门禁 */
export async function passJsGate(html: string, referer: string, jar: CookieJar): Promise<boolean> {
  const c2 = html.match(/var\s+c2=["']([^"']+)["']/)?.[1]
  const jsSrc = html.match(/src=["']([^"']*nnxswnn[^"']+)["']/i)?.[1]
  if (!c2 || !jsSrc) return false

  const jsRes = await request(new URL(jsSrc, BASE_URL).href, {
    jar,
    headers: { Referer: referer },
  })
  const fn = jsRes.text.match(/function ajax\(xxyyu\)\{[\s\S]*?return temp\.toLowerCase\(\)\}/)?.[0]
  if (!fn) throw new Error('无法解析站点门禁脚本')
  // eslint-disable-next-line no-new-func
  const ajax = new Function(`${fn}; return ajax;`)() as (s: string) => string
  const path = ajax(c2)
  const challenge = await request(new URL(path, BASE_URL).href, {
    jar,
    headers: { Referer: referer },
  })
  return /^ok/i.test(challenge.text.trim())
}

export async function fetchWithGate(
  url: string,
  jar: CookieJar,
  referer?: string,
): Promise<{ text: string; buf: Buffer; url: string }> {
  let res = await request(url, {
    jar,
    headers: referer ? { Referer: referer } : {},
  })
  if (/var\s+c2=|内容正在载入/.test(res.text)) {
    const ok = await passJsGate(res.text, url, jar)
    if (!ok) throw new Error('站点 JS 门禁失败')
    res = await request(url, {
      jar,
      headers: referer ? { Referer: referer } : {},
    })
  }
  return { text: res.text, buf: res.buf, url }
}
