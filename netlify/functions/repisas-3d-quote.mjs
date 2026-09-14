import { priceSerializedPlan } from '../../src/admin/quoteIntegration.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(statusCode, body) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function config() {
  const apiBaseUrl = process.env.REPISAS_3D_API_URL || (process.env.CONTEXT === 'dev' ? 'http://127.0.0.1:3000' : '')
  const embedBaseUrl = process.env.REPISAS_3D_PUBLIC_URL || (process.env.CONTEXT === 'dev' ? 'http://127.0.0.1:5173' : '')
  const apiKey = process.env.REPISAS_API_KEY || ''
  let catalog
  try { catalog = JSON.parse(process.env.REPISAS_QUOTE_CATALOG_JSON || '') } catch { catalog = null }
  if (!apiBaseUrl || !embedBaseUrl || !apiKey || !catalog) {
    throw new Error('Configura REPISAS_3D_API_URL, REPISAS_3D_PUBLIC_URL, REPISAS_API_KEY y REPISAS_QUOTE_CATALOG_JSON')
  }
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), embedBaseUrl: embedBaseUrl.replace(/\/$/, ''), apiKey, catalog }
}

async function request3d(cfg, path, options = {}) {
  const upstream = await fetch(`${cfg.apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, ...(options.headers || {}) },
  })
  const data = await upstream.json().catch(() => ({ error: `Servicio 3D respondio HTTP ${upstream.status}` }))
  if (!upstream.ok) throw new Error(data.error || data.message || `Servicio 3D respondio HTTP ${upstream.status}`)
  return data
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Metodo no permitido' })
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || event.headers['x-admin-password'] !== adminPassword) return response(401, { error: 'No autorizado' })

  try {
    const cfg = config()
    const body = JSON.parse(event.body || '{}')
    if (body.action === 'session') {
      const session = await request3d(cfg, `/v1/visits/${encodeURIComponent(body.visit.id)}/configurator-session`, {
        method: 'POST', body: JSON.stringify({ visit: body.visit, measurements: body.measurements }),
      })
      return response(200, { ok: true, ...session, catalog: cfg.catalog, embedBaseUrl: cfg.embedBaseUrl })
    }
    if (body.action === 'calculate') {
      const plan = await request3d(cfg, '/projects/plan', { method: 'POST', body: JSON.stringify({ project: body.project }) })
      return response(200, { ok: true, ...priceSerializedPlan(plan, cfg.catalog, body.serviceSelections || []) })
    }
    if (body.action === 'save') {
      const saved = await request3d(cfg, `/v1/visits/${encodeURIComponent(body.visit.id)}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          ...(body.quoteId ? { quoteId: body.quoteId } : {}),
          visit: body.visit, project: body.project, catalog: cfg.catalog,
          serviceSelections: body.serviceSelections || [], status: body.status || 'draft',
        }),
      })
      return response(200, { ok: true, quote: saved })
    }
    if (body.action === 'reopen') {
      const suffix = body.version ? `/versions/${Number(body.version)}` : ''
      const quote = await request3d(cfg, `/v1/quotes/${encodeURIComponent(body.quoteId)}${suffix}`)
      return response(200, { ok: true, quote, catalog: quote.catalog || cfg.catalog, embedBaseUrl: cfg.embedBaseUrl })
    }
    return response(400, { error: 'Accion no soportada' })
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : 'Fallo la integracion 3D' })
  }
}
