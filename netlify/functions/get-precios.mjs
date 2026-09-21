// netlify/functions/get-precios.mjs
// Lee la tabla de precios de repisas desde la planilla de Google que mantiene el cliente.
// Esa planilla es la fuente de verdad: si suben los precios de la madera, el cliente edita
// ahi y la cotizacion queda al dia sin tocar el codigo.
import { google } from 'googleapis'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'
const SHEET_ID       = process.env.PRECIOS_SHEET_ID
const RANGE          = "'Tabla de precios'!A2:G"

// Columnas: Alto (cm) | Niveles | Profundidad (cm) | Laterales | Largo desde | Largo hasta | Precio
// "Profundidad" es el fondo util (ancho del terciado); la profundidad total de la cotizacion
// son 8 cm mas. Niveles y Laterales quedan fuera: el primero lo determina el alto y el segundo
// ya viene incluido en el precio.
function filaValida(fila) {
  return fila.every(n => Number.isFinite(n)) && fila[2] <= fila[3]
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders }
  if (event.headers['x-admin-password'] !== ADMIN_PASSWORD)
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'No autorizado' }) }

  try {
    if (!SHEET_ID) throw new Error('Falta PRECIOS_SHEET_ID')

    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const sheets = google.sheets({ version: 'v4', auth })

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueRenderOption: 'UNFORMATTED_VALUE', // con el formato de moneda llegarian como "$40.000"
    })

    const tabla = (res.data.values || [])
      .map(r => [Number(r[0]), Number(r[2]), Number(r[4]), Number(r[5]), Number(r[6])])
      .filter(filaValida)
      .map(([alto, prof, desde, hasta, precio]) => ({ alto, prof, desde, hasta, precio }))

    if (!tabla.length) throw new Error('La planilla de precios no devolvio ninguna fila utilizable')

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, tabla }) }
  } catch (err) {
    console.error('get-precios error:', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err.message || err) }) }
  }
}
