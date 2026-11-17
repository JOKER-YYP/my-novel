/** 红薯正文：base64 + XXTEA(hs_decrypt) + utf8 */

function long2str(v: number[], w: boolean): string | null {
  const vl = v.length
  let n = (vl - 1) << 2
  if (w) {
    const m = v[vl - 1]
    if (m == null || m < n - 3 || m > n) return null
    n = m
  }
  const parts: string[] = []
  for (let i = 0; i < vl; i++) {
    const x = v[i] >>> 0
    parts.push(
      String.fromCharCode(x & 0xff, (x >>> 8) & 0xff, (x >>> 16) & 0xff, (x >>> 24) & 0xff),
    )
  }
  const s = parts.join('')
  return w ? s.substring(0, n) : s
}

function str2long(s: string, w: boolean): number[] {
  const l = s.length
  const v: number[] = []
  for (let i = 0; i < l; i += 4) {
    v[i >> 2] =
      (s.charCodeAt(i) || 0) |
      ((s.charCodeAt(i + 1) || 0) << 8) |
      ((s.charCodeAt(i + 2) || 0) << 16) |
      ((s.charCodeAt(i + 3) || 0) << 24)
  }
  if (w) v.push(l)
  return v
}

function hsDecrypt(str: string, key: string): string {
  if (!str) return ''
  const v = str2long(str, false)
  const k = str2long(key, false)
  while (k.length < 4) k.push(0)
  const n = v.length - 1
  if (n < 1) return ''
  let z = v[n] >>> 0
  let y = v[0] >>> 0
  const delta = 0x9e3779b9
  let q = Math.floor(6 + 52 / (n + 1))
  let sum = (q * delta) >>> 0
  while (sum !== 0) {
    const e = (sum >>> 2) & 3
    let p = 0
    for (p = n; p > 0; p--) {
      z = v[p - 1] >>> 0
      const mx =
        ((((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^
          ((sum ^ y) + (k[(p & 3) ^ e]! ^ z))) >>>
        0
      y = v[p] = (v[p]! - mx) >>> 0
    }
    z = v[n] >>> 0
    const mx =
      ((((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^
        ((sum ^ y) + (k[(p & 3) ^ e]! ^ z))) >>>
      0
    y = v[0] = (v[0]! - mx) >>> 0
    sum = (sum - delta) >>> 0
  }
  return long2str(v, true) || ''
}

function base64ToBinary(str: string): string {
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, '')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < clean.length; ) {
    const enc1 = chars.indexOf(clean.charAt(i++))
    const enc2 = chars.indexOf(clean.charAt(i++))
    const enc3 = chars.indexOf(clean.charAt(i++))
    const enc4 = chars.indexOf(clean.charAt(i++))
    const chr1 = (enc1 << 2) | (enc2 >> 4)
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    const chr3 = ((enc3 & 3) << 6) | enc4
    out += String.fromCharCode(chr1)
    if (enc3 !== 64 && enc3 !== -1) out += String.fromCharCode(chr2)
    if (enc4 !== 64 && enc4 !== -1) out += String.fromCharCode(chr3)
  }
  return out
}

function binaryToUtf8(str: string): string {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes)
  }
  let out = ''
  let i = 0
  while (i < str.length) {
    const c = str.charCodeAt(i++)
    if (c < 0x80) out += String.fromCharCode(c)
    else if (c >> 5 === 0x06) {
      const c2 = str.charCodeAt(i++)
      out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f))
    } else if (c >> 4 === 0x0e) {
      const c2 = str.charCodeAt(i++)
      const c3 = str.charCodeAt(i++)
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f))
    }
  }
  return out
}

export function decryptChapterContent(encryptedBase64: string, key: string): string {
  const binary = base64ToBinary(encryptedBase64)
  return binaryToUtf8(hsDecrypt(binary, String(key)))
}
