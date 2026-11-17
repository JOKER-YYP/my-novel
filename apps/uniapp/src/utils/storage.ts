export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key)
    if (raw === '' || raw === undefined || raw === null) return fallback
    if (typeof raw === 'string') return JSON.parse(raw) as T
    return raw as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  uni.setStorageSync(key, value)
}
