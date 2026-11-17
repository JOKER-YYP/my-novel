import { absUrl } from '../html'
import { CookieJar, fetchText } from './client'
import { BASE_URL } from './constants'

export async function passJsGate(html: string, referer: string, jar: CookieJar): Promise<boolean> {
  const c2 = html.match(/var\s+c2=["']([^"']+)["']/)?.[1]
  const jsSrc = html.match(/src=["']([^"']*nnxswnn[^"']+)["']/i)?.[1]
  if (!c2 || !jsSrc) return false

  const jsRes = await fetchText(absUrl(BASE_URL, jsSrc), { jar })
  const fn = jsRes.text.match(/function ajax\(xxyyu\)\{[\s\S]*?return temp\.toLowerCase\(\)\}/)?.[0]
  if (!fn) throw new Error('无法解析站点门禁脚本')
  // eslint-disable-next-line no-new-func
  const ajax = new Function(`${fn}; return ajax;`)() as (s: string) => string
  const path = ajax(c2)
  const challenge = await fetchText(absUrl(BASE_URL, path), { jar })
  return /^ok/i.test(challenge.text.trim())
}

export async function fetchWithGate(
  url: string,
  jar: CookieJar,
): Promise<{ text: string; url: string }> {
  let res = await fetchText(url, { jar })
  if (/var\s+c2=|内容正在载入/.test(res.text)) {
    const ok = await passJsGate(res.text, url, jar)
    if (!ok) throw new Error('站点 JS 门禁失败')
    res = await fetchText(url, { jar })
  }
  return { text: res.text, url }
}
