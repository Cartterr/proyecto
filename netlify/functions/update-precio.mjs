import { google } from 'googleapis';
import { resolvePriceUpdate } from './lib/price-update.mjs';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export async function handler(event) {
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Método no permitido' });
  if (event.headers?.['x-admin-password'] !== (process.env.ADMIN_PASSWORD || '2003')) return reply(401, { error: 'No autorizado' });
  try {
    let input;
    try { input = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'JSON inválido' }); }
    const spreadsheetId = process.env.PRECIOS_SHEET_ID;
    if (!spreadsheetId) throw new Error('Falta PRECIOS_SHEET_ID');
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const sheets = google.sheets({ version: 'v4', auth });
    const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Tabla de precios'!A2:G", valueRenderOption: 'UNFORMATTED_VALUE' });
    const tabla = (read.data.values || []).map((r, i) => ({ alto: Number(r[0]), prof: Number(r[2]), desde: Number(r[4]), hasta: Number(r[5]), precio: Number(r[6]), row: i + 2 }));
    const updated = resolvePriceUpdate(tabla, input);
    const range = `'Tabla de precios'!G${updated.row}`;
    await sheets.spreadsheets.values.update({ spreadsheetId, range, valueInputOption: 'RAW', requestBody: { values: [[updated.precio]] } });
    const verified = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'UNFORMATTED_VALUE' });
    if (Number(verified.data.values?.[0]?.[0]) !== updated.precio) throw new Error('No se pudo verificar el precio guardado. Recarga la tabla.');
    return reply(200, { ok: true, fila: updated });
  } catch (error) { return reply(error.status || 500, { error: error.message }); }
}
