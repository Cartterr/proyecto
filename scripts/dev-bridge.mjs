import http from 'node:http'
import { handler as quoteHandler } from '../netlify/functions/repisas-3d-quote.mjs'

const port = Number(process.env.LOCAL_BRIDGE_PORT || 8899)

const server = http.createServer(async (request, response) => {
  if (!request.url?.startsWith('/.netlify/functions/repisas-3d-quote')) {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Ruta local no encontrada' }))
    return
  }
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const result = await quoteHandler({
    httpMethod: request.method,
    headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(',') : value || ''])),
    body: Buffer.concat(chunks).toString('utf8'),
  })
  response.writeHead(result.statusCode, result.headers)
  response.end(result.body || '')
})

server.listen(port, '127.0.0.1', () => process.stdout.write(`Local quote bridge ready on http://127.0.0.1:${port}\n`))
