/** 百度短文本约 60 汉字 / 120 GBK；默认按 50 字切，算法需稳定以便续听 */
export function splitForTts(text: string, maxChars = 50): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const sentences = normalized
    .split(/(?<=[。！？；!?;\n])/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf = ''

  const pushBuf = () => {
    if (buf) {
      chunks.push(buf)
      buf = ''
    }
  }

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      pushBuf()
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars))
      }
      continue
    }
    if ((buf + sentence).length > maxChars) {
      pushBuf()
      buf = sentence
    } else {
      buf += sentence
    }
  }
  pushBuf()
  return chunks.filter((c) => /[\u4e00-\u9fffA-Za-z0-9]/.test(c))
}
