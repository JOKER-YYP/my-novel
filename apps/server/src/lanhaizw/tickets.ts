import { CookieJar } from '../httpClient'

export type SearchTicket = {
  kind: 'search'
  jar: CookieJar
  resultUrl: string
  actyzm: string
  button: string
  createdAt: number
}

export type ContentTicket = {
  kind: 'content'
  jar: CookieJar
  chapterUrl: string
  rdyzm: string
  button: string
  createdAt: number
}

type Ticket = SearchTicket | ContentTicket

const store = new Map<string, Ticket>()
const TTL_MS = 5 * 60 * 1000

function purge() {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k)
  }
}

export function saveTicket(ticket: Ticket): string {
  purge()
  const id = `${ticket.kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  store.set(id, ticket)
  return id
}

export function takeTicket<T extends Ticket['kind']>(
  id: string,
  kind: T,
): Extract<Ticket, { kind: T }> | undefined {
  purge()
  const t = store.get(id)
  if (!t || t.kind !== kind) return undefined
  store.delete(id)
  return t as Extract<Ticket, { kind: T }>
}

export function peekTicket<T extends Ticket['kind']>(
  id: string,
  kind: T,
): Extract<Ticket, { kind: T }> | undefined {
  purge()
  const t = store.get(id)
  if (!t || t.kind !== kind) return undefined
  return t as Extract<Ticket, { kind: T }>
}
