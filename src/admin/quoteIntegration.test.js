import test from 'node:test'
import assert from 'node:assert/strict'
import { completedVisitSnapshot, measurementPayload, miniErpQuoteRecord, priceSerializedPlan, restoredQuoteState } from './quoteIntegration.js'

test('preloads known visit data without re-entry', () => {
  const visit = completedVisitSnapshot({ id: 'visit-1', nombre: 'Cliente Prueba', direccion: 'Direccion Prueba', comuna: 'Comuna Prueba', email: 'test@example.test' })
  assert.equal(visit.status, 'completed')
  assert.equal(visit.customer.name, 'Cliente Prueba')
  assert.equal(visit.customer.email, 'test@example.test')
})

test('uses an explicitly edited comuna instead of the stale visit value', () => {
  const visit = completedVisitSnapshot({ id: 'visit-1', nombre: 'Cliente Prueba', direccion: 'Direccion Prueba', comuna: 'Comuna Original' }, 'Comuna Editada')
  assert.equal(visit.customer.comuna, 'Comuna Editada')
})

test('normalizes available measurements', () => {
  assert.deepEqual(measurementPayload({ projectName: 'Prueba', wallACm: '240', wallBAndECm: '200', wallCCm: '0', wallDCm: '0', roomHeightCm: '250', shape: 'single-wall', wallSelection: 'A', depthCm: '48' }), {
    projectName: 'Prueba', wallACm: 240, wallBAndECm: 200, wallCCm: 0, wallDCm: 0,
    roomHeightCm: 250, shape: 'single-wall', wallSelection: 'A', depthCm: 48,
  })
})

test('reports missing measurements with user-facing labels', () => {
  assert.throws(() => measurementPayload({}), /nombre del proyecto, muro A, muros B\/E, altura, forma, muros con repisas, profundidad/)
})

test('prices modules and services from exact controlled catalog rows', () => {
  const priced = priceSerializedPlan({ modules: [{ id: 'module-1', lengthCm: 200, depthCm: 48, heightCm: 200, levels: [{ enabled: true }, { enabled: true }] }] }, {
    version: 'TEST', currency: 'CLP', ivaBasisPoints: 1900,
    modules: [{ id: 'm-1', label: 'Modulo prueba', lengthCm: 200, depthCm: 48, heightCm: 200, levels: 2, unitPriceNetClp: 100000 }],
    services: [{ id: 's-1', label: 'Servicio prueba', unitPriceNetClp: 20000 }],
  }, [{ catalogItemId: 's-1', quantity: 1 }])
  assert.deepEqual(priced.totals, { subtotalNetClp: 120000, ivaBasisPoints: 1900, ivaClp: 22800, totalClp: 142800 })
  assert.equal(priced.lines.length, 2)
})

test('rejects an unpriced module instead of inventing a value', () => {
  assert.throws(() => priceSerializedPlan({ modules: [{ id: 'x', lengthCm: 157, depthCm: 68, heightCm: 200, levels: [{ enabled: true }] }] }, {
    version: 'TEST', currency: 'CLP', ivaBasisPoints: 1900, modules: [], services: [],
  }), /No hay precio controlado/)
})

test('mirrors the saved immutable identifiers into the mini ERP record', () => {
  const record = miniErpQuoteRecord({
    quoteId: 'quote-1', quoteNumber: 'QUOTE-1-V1', version: 1,
    visit: { id: 'visit-1', customer: { name: 'Cliente Prueba', address: 'Direccion', comuna: 'Comuna' } },
    lines: [{ kind: 'module', catalogItemId: 'm', sourceModuleId: 'module-1', description: 'Modulo', quantity: 1, unitPriceNetClp: 100000, totalNetClp: 100000 }],
    totals: { subtotalNetClp: 100000, ivaClp: 19000, totalClp: 119000 },
    configuration: { sha256: 'config-hash' }, pdf: { url: '/quote.pdf', sha256: 'pdf-hash' },
  })
  assert.equal(record.visitId, 'visit-1')
  assert.equal(record.quoteVersion, 1)
  assert.equal(record.configurationSha256, 'config-hash')
})

test('restores the exact saved quote version including service quantities and totals', () => {
  const savedCatalog = { version: 'SAVED' }
  const state = restoredQuoteState({
    quoteId: 'quote-1', version: 1,
    configuration: { project: { projectName: 'Version 1' } },
    catalog: savedCatalog,
    serviceSelections: [{ catalogItemId: 'service-1', quantity: 1 }],
    lines: [{ kind: 'service', catalogItemId: 'service-1', quantity: 1, totalNetClp: 20000 }],
    totals: { subtotalNetClp: 120000, ivaBasisPoints: 1900, ivaClp: 22800, totalClp: 142800 },
  }, { version: 'CURRENT' })
  assert.equal(state.quoteId, 'quote-1')
  assert.equal(state.project.projectName, 'Version 1')
  assert.equal(state.catalog, savedCatalog)
  assert.deepEqual(state.serviceQty, { 'service-1': 1 })
  assert.equal(state.calculation.totals.totalClp, 142800)
})
