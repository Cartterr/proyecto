// Local-only functions backend for the mini ERP.
// Replaces the Google Calendar / Google Sheets backed Netlify functions with a JSON file on
// disk, so the admin can be exercised locally without touching the client's production data.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildCatalog } from './catalog.mjs'
import { SEED_VISITS, SEED_QUOTES, SEED_INSTALLATIONS, visitToApiShape } from './seed.mjs'
import { TABLA_PRECIOS } from '../../src/admin/preciosRepisas.js'
import { resolvePriceUpdate } from '../../netlify/functions/lib/price-update.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(here, 'data.json')
const PORT = Number(process.env.LOCAL_API_PORT || 8899)
const PUBLIC_URL = process.env.LOCAL_PUBLIC_URL || 'http://127.0.0.1:5176'

// Prices, visits and PDFs are local. Do not load production Google credentials.
// generate-quote busca la plantilla en LAMBDA_TASK_ROOT/netlify/functions; en local es el repo.
process.env.LAMBDA_TASK_ROOT = process.env.LAMBDA_TASK_ROOT || path.join(here, '../..')

process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'
process.env.REPISAS_3D_API_URL = process.env.REPISAS_3D_API_URL || 'http://127.0.0.1:3000'
process.env.REPISAS_3D_PUBLIC_URL = PUBLIC_URL
process.env.REPISAS_API_KEY = process.env.REPISAS_API_KEY || 'local-dev-key'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { /* fall through to seed */ }
  }
  const fresh = {
    visits: SEED_VISITS.map(visitToApiShape),
    visitStatuses: Object.fromEntries(SEED_VISITS.map(v => [v.id, v.status])),
    quotes: SEED_QUOTES,
    installations: SEED_INSTALLATIONS,
  }
  saveData(fresh)
  return fresh
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)) }

let db = loadData()
db.precios ||= structuredClone(TABLA_PRECIOS)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

function send(res, code, body) { res.writeHead(code, CORS); res.end(JSON.stringify(body)) }

// The real integration handler is reused verbatim so the PR's own code path is what runs.
let quoteHandler
async function getQuoteHandler() {
  if (!quoteHandler) {
    process.env.REPISAS_QUOTE_CATALOG_JSON = JSON.stringify(buildCatalog())
    ;({ handler: quoteHandler } = await import('../../netlify/functions/repisas-3d-quote.mjs'))
  }
  return quoteHandler
}

const routes = {
  'upload-pdf': body => {
    const bytes = Buffer.from(body.pdfBase64 || '', 'base64')
    if (bytes.subarray(0, 4).toString() !== '%PDF') throw Object.assign(new Error('PDF inválido'), { status: 400 })
    const id = randomUUID()
    fs.mkdirSync(path.join(here, 'pdfs'), { recursive: true })
    fs.writeFileSync(path.join(here, 'pdfs', `${id}.pdf`), bytes)
    return { ok: true, local: true, viewUrl: `${PUBLIC_URL}/.netlify/functions/local-pdf?id=${id}` }
  },
  'get-precios': () => ({ ok: true, tabla: db.precios, local: true }),
  'update-precio': body => {
    const updated = resolvePriceUpdate(db.precios, body)
    db.precios = db.precios.map(r => r.alto === updated.alto && r.prof === updated.prof && r.desde === updated.desde && r.hasta === updated.hasta ? updated : r)
    saveData(db)
    return { ok: true, fila: updated, local: true }
  },
  'get-visits': () => ({
    ok: true,
    visits: db.visits.map(v => ({ ...v, status: db.visitStatuses[v.id] || v.status || 'agendada' })),
  }),
  'get-quotes': () => ({ ok: true, quotes: db.quotes }),
  'get-installations': () => ({ ok: true, installations: db.installations }),
  'get-sales': () => ({ ok: true, installations: db.installations }),
  'update-visit-status': (body) => {
    if (!body.visitId || !body.status) return { ok: false, error: 'Faltan parámetros' }
    db.visitStatuses[body.visitId] = body.status
    const visit = db.visits.find(v => v.id === body.visitId)
    if (visit) { visit.status = body.status; if (body.notas !== undefined) visit.notas = body.notas }
    saveData(db)
    return { ok: true }
  },
  'save-quote': (body) => {
    if (!body.cotNum || !body.nombre) return { ok: false, error: 'Faltan parámetros' }
    const creado = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
    const idx = db.quotes.findIndex(q => String(q.cotNum) === String(body.cotNum))
    const record = { ...body, cotNum: String(body.cotNum), creado: idx >= 0 ? db.quotes[idx].creado : creado }
    if (idx >= 0) db.quotes[idx] = { ...db.quotes[idx], ...record }
    else db.quotes.unshift(record)
    saveData(db)
    return { ok: true }
  },
  'delete-quote': (body) => {
    db.quotes = db.quotes.filter(q => String(q.cotNum) !== String(body.cotNum))
    saveData(db)
    return { ok: true }
  },
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }

  const url = new URL(req.url, 'http://localhost')
  const name = url.pathname.replace('/.netlify/functions/', '')
  if (!url.pathname.startsWith('/.netlify/functions/')) return send(res, 404, { error: 'Ruta local no encontrada' })

  // Loopback-only mock downloads; random identifiers, no production or cloud storage.
  if (name === 'local-pdf' && req.method === 'GET') {
    const id = url.searchParams.get('id') || ''
    if (!/^[a-f0-9-]{36}$/.test(id)) return send(res, 400, { error: 'ID inválido' })
    const file = path.join(here, 'pdfs', `${id}.pdf`)
    if (!fs.existsSync(file)) return send(res, 404, { error: 'PDF no encontrado' })
    res.writeHead(200, { 'Content-Type': 'application/pdf' })
    return res.end(fs.readFileSync(file))
  }

  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return send(res, 401, { error: 'No autorizado' })

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')

  try {
    // Estas rutas corren el handler real de la PR / de produccion, no una version local.
    const handlerReal = name === 'repisas-3d-quote' ? await getQuoteHandler()
      : name === 'generate-quote' ? (await import('../../netlify/functions/generate-quote.mjs')).handler
      : null
    if (handlerReal) {
      const result = await handlerReal({
        httpMethod: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v || '')])),
        body: raw,
      })
      res.writeHead(result.statusCode, { ...CORS, ...(result.headers || {}) })
      // El PDF viaja en base64: Netlify lo decodifica en produccion, aca hay que hacerlo.
      return res.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : (result.body || ''))
    }

    const route = routes[name]
    if (!route) return send(res, 404, { ok: false, error: `Sin backend local para ${name}` })
    if (name === 'update-precio' && req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' })
    const body = raw ? JSON.parse(raw) : {}
    return send(res, 200, route(body))
  } catch (error) {
    console.error(`[local-api] ${name} failed:`, error)
    return send(res, error.status || 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-api] listening on http://127.0.0.1:${PORT}`)
  console.log(`[local-api] visits seeded: ${db.visits.length} (realizadas: ${db.visits.filter(v => (db.visitStatuses[v.id] || v.status) === 'realizada').length})`)
  console.log(`[local-api] quotes seeded: ${db.quotes.length}`)
  console.log(`[local-api] 3D API: ${process.env.REPISAS_3D_API_URL} | embed base: ${process.env.REPISAS_3D_PUBLIC_URL}`)
})
