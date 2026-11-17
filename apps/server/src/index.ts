import cors from 'cors'
import express from 'express'
import { CATEGORIES, RANK_TABS, SOURCE_ID, SOURCE_NAME } from './lanhaizw/constants'
import {
  getCategoryNovels,
  getChapterContent,
  getNovelChapters,
  getNovelDetail,
  getRankNovels,
  searchNovels,
  verifyContentCaptcha,
  verifySearchCaptcha,
} from './lanhaizw/service'

const PORT = Number(process.env.PORT || 8787)
const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

function sendError(res: express.Response, e: unknown, status = 502) {
  res.status(status).json({ error: e instanceof Error ? e.message : String(e) })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, source: SOURCE_ID, name: SOURCE_NAME })
})

app.get('/api/meta', (_req, res) => {
  res.json({ sourceId: SOURCE_ID, sourceName: SOURCE_NAME, categories: CATEGORIES, rankTabs: RANK_TABS })
})

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '')
    const result = await searchNovels(q)
    res.json(result)
  } catch (e) {
    sendError(res, e)
  }
})

app.post('/api/search/verify', async (req, res) => {
  try {
    const ticket = String(req.body?.ticket || '')
    const code = String(req.body?.code || '')
    const result = await verifySearchCaptcha(ticket, code)
    res.json(result)
  } catch (e) {
    sendError(res, e, 400)
  }
})

app.get('/api/books/:bookId', async (req, res) => {
  try {
    const book = await getNovelDetail(decodeURIComponent(req.params.bookId))
    res.json({ book })
  } catch (e) {
    sendError(res, e)
  }
})

app.get('/api/books/:bookId/chapters', async (req, res) => {
  try {
    const chapters = await getNovelChapters(decodeURIComponent(req.params.bookId))
    res.json({ chapters })
  } catch (e) {
    sendError(res, e)
  }
})

app.get('/api/chapters/:chapterId/content', async (req, res) => {
  try {
    const result = await getChapterContent(decodeURIComponent(req.params.chapterId))
    res.json(result)
  } catch (e) {
    sendError(res, e)
  }
})

app.post('/api/chapters/verify', async (req, res) => {
  try {
    const ticket = String(req.body?.ticket || '')
    const code = String(req.body?.code || '')
    const result = await verifyContentCaptcha(ticket, code)
    res.json(result)
  } catch (e) {
    sendError(res, e, 400)
  }
})

app.get('/api/rank', async (req, res) => {
  try {
    const path = String(req.query.path || '/rank/')
    const items = await getRankNovels(path)
    res.json({ items })
  } catch (e) {
    sendError(res, e)
  }
})

app.get('/api/categories/:categoryId', async (req, res) => {
  try {
    const page = Number(req.query.page || 1) || 1
    const items = await getCategoryNovels(req.params.categoryId, page)
    res.json({ items })
  } catch (e) {
    sendError(res, e)
  }
})

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[my-novel-server] lanhaizw proxy on http://0.0.0.0:${PORT}`)
})
