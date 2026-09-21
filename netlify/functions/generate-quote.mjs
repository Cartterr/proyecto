import { generateQuotePdf } from './lib/quote-pdf.mjs'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-password', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
// ── Handler ───────────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Método no permitido' }) }

  const pwd = event.headers['x-admin-password']
  if (pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'No autorizado' }) }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const { bytes: pdfBytes, subtotal, iva, total } = await generateQuotePdf(data)

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cotizacion.pdf"`,
        'x-subtotal': String(subtotal),
        'x-iva': String(iva),
        'x-total': String(total),
      },
      body: pdfBytes.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('generate-quote error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
