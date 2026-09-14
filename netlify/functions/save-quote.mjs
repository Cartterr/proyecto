// netlify/functions/save-quote.mjs
import { google } from 'googleapis'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'
const SHEET_ID       = process.env.GOOGLE_SHEET_ID
const SHEET_NAME     = 'Cotizaciones'

// Las columnas A-P se preservan para compatibilidad; Q-U agregan trazabilidad 3D inmutable.
const HEADERS = ['N° Cot','Nombre','Email','Teléfono','Dirección','Fecha Visita','Subtotal','IVA','Total','Estado','Motivo Rechazo','Notas','Repisas (JSON)','Adicionales (JSON)','Creado','PDF URL','Visit ID','Quote 3D ID','Version','Configuration SHA-256','PDF SHA-256']

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders }
  if (event.headers['x-admin-password'] !== ADMIN_PASSWORD)
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'No autorizado' }) }

  try {
    if (!SHEET_ID) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GOOGLE_SHEET_ID no configurado' }) }

    const {
      cotNum, nombre, email, telefono, direccion, fechaVisita,
      subtotal, iva, total, status = 'por confirmar',
      motivoRechazo = '', notas = '',
      repisas = [], adicionales = {},
      pdfUrl = '', visitId = '', quote3dId = '', quoteVersion = '',
      configurationSha256 = '', pdfSha256 = '',
    } = JSON.parse(event.body || '{}')

    if (!cotNum || !nombre)
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Faltan parámetros' }) }

    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const sheets = google.sheets({ version: 'v4', auth })

    // Mantener el encabezado completo; no altera filas historicas.
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1:U1`, valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })

    // Buscar fila existente
    const all = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:A` }).catch(() => ({ data: { values: [] } }))
    const rows = all.data.values || []
    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(cotNum)) { rowIndex = i + 1; break }
    }

    const createdAt = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })

    if (rowIndex > 0) {
      // Preservar createdAt y pdfUrl existente si no viene nueva
      const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${rowIndex}:U${rowIndex}` }).catch(() => ({ data: { values: [] } }))
      const existingRow = existing.data.values?.[0] || []
      const existingCreado = existingRow[14] || createdAt
      const finalPdfUrl = pdfUrl || existingRow[15] || ''
      const row = [
        String(cotNum), nombre, email || '', telefono || '', direccion || '',
        fechaVisita || '', subtotal || '', iva || '', total || '',
        status, motivoRechazo, notas,
        JSON.stringify(repisas), JSON.stringify(adicionales),
        existingCreado, finalPdfUrl, visitId, quote3dId, quoteVersion, configurationSha256, pdfSha256,
      ]
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${rowIndex}:U${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [row] } })
    } else {
      const row = [
        String(cotNum), nombre, email || '', telefono || '', direccion || '',
        fechaVisita || '', subtotal || '', iva || '', total || '',
        status, motivoRechazo, notas,
        JSON.stringify(repisas), JSON.stringify(adicionales),
        createdAt, pdfUrl, visitId, quote3dId, quoteVersion, configurationSha256, pdfSha256,
      ]
      await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1`, valueInputOption: 'RAW', requestBody: { values: [row] } })
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('save-quote error:', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: String(err) }) }
  }
}
