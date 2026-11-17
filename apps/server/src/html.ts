export function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

export function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

export function absUrl(base: string, href: string): string {
  if (!href) return base
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) {
    const proto = base.match(/^(https?:)/i)?.[1] || 'https:'
    return `${proto}${href}`
  }
  const m = base.match(/^(https?:\/\/[^/?#]+)/i)
  const origin = m?.[1] || base.replace(/\/+$/, '')
  if (href.startsWith('/')) return `${origin}${href}`
  const basePath = base.replace(/^(https?:\/\/[^/?#]+)/i, '').replace(/[?#].*$/, '')
  const dir = basePath.includes('/') ? basePath.replace(/[^/]*$/, '') : '/'
  return `${origin}${dir}${href}`
}

export function matchAll(html: string, re: RegExp): RegExpMatchArray[] {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  return [...html.matchAll(new RegExp(re.source, flags))]
}
