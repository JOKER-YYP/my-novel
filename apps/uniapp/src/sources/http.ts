export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST'
  data?: Record<string, unknown> | string
  header?: Record<string, string>
  timeout?: number
  responseType?: 'text' | 'arraybuffer'
}

/** 把微信 request:fail 转成可读原因（真机常因未配合法域名） */
export function formatRequestFail(errMsg?: string): string {
  const raw = (errMsg || 'network error').trim()
  if (/url not in domain list|不在以下 request 合法域名|合法域名/i.test(raw)) {
    return '域名未加入 request 合法域名（真机需开调试，或在公众平台配置）'
  }
  if (/ssl|certificate|TLS|握手/i.test(raw)) {
    return 'HTTPS 证书校验失败'
  }
  if (/timeout|timed out|超时/i.test(raw)) {
    return '请求超时'
  }
  return raw
}

export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, timeout = 12000, responseType } = options
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data,
      header,
      timeout,
      responseType,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        const body = res.data as { error?: string } | string | undefined
        const detail =
          body && typeof body === 'object' && body.error
            ? body.error
            : typeof body === 'string' && body
              ? body.slice(0, 200)
              : ''
        reject(new Error(detail ? `HTTP ${res.statusCode}: ${detail}` : `HTTP ${res.statusCode}`))
      },
      fail: (err) => reject(new Error(formatRequestFail(err.errMsg))),
    })
  })
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
