import test from 'node:test'
import assert from 'node:assert/strict'
import { TABLA_PRECIOS, precioRepisa, cargarTablaPrecios } from './preciosRepisas.js'

test('avisa cuando los precios vienen del respaldo y no de la planilla', async () => {
  const dePlanilla = [{ alto: 200, prof: 40, desde: 50, hasta: 243, precio: 123000 }]
  assert.deepEqual(
    await cargarTablaPrecios(async () => ({ ok: true, tabla: dePlanilla })),
    { tabla: dePlanilla, respaldo: false })

  for (const respuesta of [
    () => Promise.reject(new Error('sin red')),
    async () => ({ ok: false, error: 'Falta PRECIOS_SHEET_ID' }),
    async () => ({ ok: true, tabla: [] }),
  ]) {
    const resultado = await cargarTablaPrecios(respuesta)
    assert.equal(resultado.respaldo, true, 'una planilla que no responde tiene que avisarse')
    assert.equal(resultado.tabla, TABLA_PRECIOS)
  }
})

const LARGO_MIN = 50
const LARGO_MAX = 243

test('los rangos de largo cubren 50-243 cm sin huecos ni solapes', () => {
  const grupos = new Map()
  for (const fila of TABLA_PRECIOS) {
    const clave = `${fila.alto}/${fila.prof}`
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(fila)
  }
  assert.equal(grupos.size, 12, '3 altos x 4 profundidades')

  for (const [clave, filas] of grupos) {
    filas.sort((a, b) => a.desde - b.desde)
    assert.equal(filas[0].desde, LARGO_MIN, `${clave}: parte en ${LARGO_MIN} cm`)
    assert.equal(filas.at(-1).hasta, LARGO_MAX, `${clave}: llega a ${LARGO_MAX} cm`)
    for (let i = 1; i < filas.length; i++) {
      assert.equal(filas[i].desde, filas[i - 1].hasta + 1, `${clave}: corte en ${filas[i].desde} cm`)
    }
  }
})

test('traduce la profundidad total de la cotizacion al fondo util de la tabla', () => {
  // 0.48 m totales = 40 cm de terciado + 8 cm de pilares.
  assert.equal(precioRepisa({ largoM: 2.43, profM: 0.48, altoM: 2 }), 110000)
  assert.equal(precioRepisa({ largoM: 1.0, profM: 0.28, altoM: 2.5 }), 60000)
  assert.equal(precioRepisa({ largoM: 1.5, profM: 0.68, altoM: 3 }), 170000)
})

test('respeta los bordes del rango', () => {
  assert.equal(precioRepisa({ largoM: 0.88, profM: 0.28, altoM: 2 }), 40000)
  assert.equal(precioRepisa({ largoM: 0.89, profM: 0.28, altoM: 2 }), 50000)
})

test('usa la tabla que le pasen, no el respaldo del bundle', () => {
  const dePlanilla = [{ alto: 200, prof: 40, desde: 194, hasta: 243, precio: 999000 }]
  assert.equal(precioRepisa({ largoM: 2.43, profM: 0.48, altoM: 2 }, dePlanilla), 999000)
  assert.equal(precioRepisa({ largoM: 1.0, profM: 0.48, altoM: 2 }, dePlanilla), null)
})

test('devuelve null en vez de inventar un precio fuera de la tabla', () => {
  assert.equal(precioRepisa({ largoM: 2.6, profM: 0.48, altoM: 2 }), null, 'largo sobre 2.43 m')
  assert.equal(precioRepisa({ largoM: 0.4, profM: 0.48, altoM: 2 }), null, 'largo bajo 0.5 m')
  assert.equal(precioRepisa({ largoM: 1.5, profM: 0.58, altoM: 2 }), null, 'profundidad no estandar')
  assert.equal(precioRepisa({ largoM: 1.5, profM: 0.48, altoM: 2.2 }), null, 'alto no estandar')
})
