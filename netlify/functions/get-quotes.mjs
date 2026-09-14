// netlify/functions/get-quotes.mjs
import { google } from 'googleapis'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'
const SHEET_ID       = process.env.GOOGLE_SHEET_ID
const SHEET_NAME     = 'Cotizaciones'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders }
  if (event.headers['x-admin-password'] !== ADMIN_PASSWORD)
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'No autorizado' }) }

  try {
    if (!SHEET_ID) return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, quotes: [] }) }

    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const sheets = google.sheets({ version: 'v4', auth })

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:U` })
    const rows = res.data.values || []
    if (rows.length <= 1) return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, quotes: [] }) }

    const quotes = rows.slice(1).map(r => ({
      cotNum:         r[0]  || '',
      nombre:         r[1]  || '',
      email:          r[2]  || '',
      telefono:       r[3]  || '',
      direccion:      r[4]  || '',
      fechaVisita:    r[5]  || '',
      subtotal:       r[6]  || '',
      iva:            r[7]  || '',
      total:          r[8]  || '',
      status:         r[9]  || 'por confirmar',
      motivoRechazo:  r[10] || '',
      notas:          r[11] || '',
      repisas:        (() => { try { return JSON.parse(r[12] || '[]') } catch { return [] } })(),
      adicionales:    (() => { try { return JSON.parse(r[13] || '{}') } catch { return {} } })(),
      creado:         r[14] || '',
      pdfUrl:         r[15] || '',
      visitId:        r[16] || '',
      quote3dId:      r[17] || '',
      quoteVersion:   r[18] || '',
      configurationSha256: r[19] || '',
      pdfSha256:      r[20] || '',
    }))

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, quotes }) }
  } catch (err) {
    console.error('get-quotes error:', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: String(err) }) }
  }
}
