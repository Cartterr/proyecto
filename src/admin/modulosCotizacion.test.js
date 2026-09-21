import test from 'node:test'
import assert from 'node:assert/strict'
import { filasDeModulos, productoCotizacion } from './modulosCotizacion.js'
const rack = {sourceModuleId:'r1',kind:'rack',modelId:'rack-1x3',label:'Rack 3 cajas',lengthCm:61.4644,depthCm:65.3213,heightCm:133.2,levels:3,units:1}
test('rack pricing is manual, survives synchronization, and resets when changing model',()=>{
  const [row]=filasDeModulos([rack],[],[])
  assert.equal(row.v,0)
  assert.equal(filasDeModulos([rack],[{...row,v:120000}],[])[0].v,120000)
  assert.equal(filasDeModulos([{...rack,modelId:'rack-2x3'}],[{...row,v:120000}],[])[0].v,0)
  assert.deepEqual(filasDeModulos([], [row], []),[])
  assert.equal(productoCotizacion(row).label,rack.label)
  assert.equal(productoCotizacion(row).kind,'rack')
})
