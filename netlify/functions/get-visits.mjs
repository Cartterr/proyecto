// netlify/functions/get-visits.mjs
// Devuelve todas las visitas agendadas desde Google Calendar
import { google } from 'googleapis'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2003'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
  }

  // Auth simple
  const pwd = event.headers['x-admin-password']
  if (pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'No autorizado' }) }
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })
    const sheets   = google.sheets({ version: 'v4', auth: oAuth2Client })

    // Traer eventos desde 3 meses atrás hasta 6 meses adelante
    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setMonth(timeMin.getMonth() - 3)
    const timeMax = new Date(now)
    timeMax.setMonth(timeMax.getMonth() + 6)

    // Leer statuses de Sheets en paralelo
    const [list, sheetRes] = await Promise.all([
      calendar.events.list({
        calendarId: process.env.CALENDAR_ID,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 500,
        sharedExtendedProperty: 'created_by=agendador-netlify',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Visitas!A:H',
      }).catch(() => ({ data: { values: [] } })),
    ])

    // Mapa visitId -> status desde Sheets (columna A=id, H=status)
    const statusMap = {}
    for (const row of (sheetRes.data.values || [])) {
      if (row[0] && row[7]) statusMap[row[0]] = row[7]
    }

    const visits = (list.data.items || []).map(ev => {
      const desc = ev.description || ''
      const get = (label) => {
        const m = desc.match(new RegExp(`${label}:\\s*(.+)`))
        return m ? m[1].trim() : ''
      }
      let measurements
      try {
        const encoded = ev.extendedProperties?.private?.measurements_json || ev.extendedProperties?.shared?.measurements_json
        measurements = encoded ? JSON.parse(encoded) : undefined
      } catch { measurements = undefined }
      return {
        id: ev.id,
        summary: ev.summary || '',
        start: ev.start?.dateTime || ev.start?.date || '',
        end: ev.end?.dateTime || ev.end?.date || '',
        email: get('Email'),
        celular: get('Celular'),
        direccion: get('Dirección'),
        comuna: get('Comuna'),
        notas: get('Notas') === '(sin notas)' ? '' : get('Notas'),
        ...(measurements ? { measurements } : {}),
        slotKey: ev.extendedProperties?.shared?.slot_key || '',
        nombre: ev.summary?.match(/Visita — (.+?) \(/)?.[1] || ev.summary || '',
        status: statusMap[ev.id] || 'agendada',
      }
    })

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, visits }),
    }
  } catch (err) {
    console.error('get-visits error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: String(err) }),
    }
  }
}
