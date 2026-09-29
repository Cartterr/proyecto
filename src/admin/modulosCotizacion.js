import { precioRepisa } from './preciosRepisas.js'

export function filasDeModulos(modulos, anteriores, tabla) {
  return modulos.map((m, i) => {
    const metros = cm => Number((cm / 100).toFixed(6))
    const medidas = { largoM: metros(m.lengthCm), profM: metros(m.depthCm), altoM: metros(m.heightCm) }
    const previo = anteriores.find(r => r.sourceModuleId && r.sourceModuleId === m.sourceModuleId)
    const mismo = previo && previo.modelId === m.modelId && previo.l === medidas.largoM && previo.p === medidas.profM && previo.a === medidas.altoM && previo.n === m.levels
    return {
      id: m.sourceModuleId || `modulo-${i}`, sourceModuleId: m.sourceModuleId,
      kind: m.kind || 'shelf', modelId: m.modelId, label: m.label,
      l: medidas.largoM, p: medidas.profM, a: medidas.altoM, n: m.levels, u: m.units,
      v: mismo ? previo.v : m.kind === 'rack' ? 0 : precioRepisa(medidas, tabla) ?? 0,
    }
  })
}

export const productoCotizacion = r => ({ largo: r.l, prof: r.p, alto: r.a, niveles: r.n, unidades: r.u, valor: r.v, kind: r.kind, modelId: r.modelId, label: r.label, sourceModuleId: r.sourceModuleId })
