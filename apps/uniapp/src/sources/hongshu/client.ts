import { formatRequestFail } from '../http'

function toQuery(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

function parseMaybeJson<T>(raw: unknown): T {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      throw new Error(raw.slice(0, 120) || '接口返回异常')
    }
  }
  return raw as T
}

export function getHtml(url: string, referer?: string): Promise<string> {
  const header: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  }
  if (referer) header.Referer = referer
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      header,
      timeout: 20000,
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

/** 触屏站搜索为 JSONP：callback({...}) */
export function getJsonp<T = unknown>(
  url: string,
  fields: Record<string, string | number>,
  referer?: string,
  callbackName = 'cb',
): Promise<T> {
  const qs = toQuery({ ...fields, callback: callbackName })
  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`
  const header: Record<string, string> = { Accept: '*/*' }
  if (referer) header.Referer = referer
  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method: 'GET',
      header,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const raw = typeof res.data === 'string' ? res.data : String(res.data ?? '')
        const m = raw.match(new RegExp(`^${callbackName}\\(([\\s\\S]*)\\)\\s*;?\\s*$`))
        const jsonText = m?.[1] || raw
        try {
          resolve(JSON.parse(jsonText) as T)
        } catch {
          reject(new Error(raw.slice(0, 120) || 'JSONP 解析失败'))
        }
      },
      fail: (err) => reject(new Error(formatRequestFail(err.errMsg))),
    })
  })
}

export function postForm<T = unknown>(
  url: string,
  fields: Record<string, string | number>,
  referer?: string,
): Promise<T> {
  const header: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (referer) header.Referer = referer
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'POST',
      // 微信端对 object 会按 form 编码；比手写 string 更稳
      data: fields,
      header,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        try {
          resolve(parseMaybeJson<T>(res.data))
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      },
      fail: (err) => reject(new Error(formatRequestFail(err.errMsg))),
    })
  })
}
