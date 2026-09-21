// TEST-ONLY controlled catalog for local testing.
// Prices are fictitious and exist only so the local flow can be exercised end to end.
const BASE_PRICE = 130000        // 243 x 48 x 200 cm, 4 niveles
const BASE = { L: 243, D: 48, H: 200, LV: 4 }

function round100(n) { return Math.round(n / 100) * 100 }

function priceFor(L, D, H, LV) {
  const value = BASE_PRICE * (L / BASE.L) * (LV / BASE.LV) * (D / BASE.D) * (H / BASE.H)
  return Math.max(1000, round100(value))
}

// Module lengths are continuous up to MAX_MODULE_CM (243) in the planner, so the grid is
// dense on length and covers the depth/height pairs the seeded visits can produce.
const LENGTHS = Array.from({ length: 244 - 60 }, (_, i) => 60 + i)   // 60..243 cm
const LEVELS = [1, 2, 3, 4, 5, 6]
// Only these combinations are reachable: depthCm is 28|38|48|68 and the shelf height derives
// from roomHeightCm 250|300|350 -> 200|250|300. Level count is bounded by the shelf height.
const DEPTHS = [28, 38, 48, 68]
const MAX_LEVELS_BY_HEIGHT = { 200: 4, 250: 5, 300: 6 }

export function buildCatalog(extraModules = []) {
  const modules = []
  const seen = new Set()
  const add = (L, D, H, LV) => {
    const id = `m-${L}x${D}x${H}-${LV}`
    if (seen.has(id)) return
    seen.add(id)
    modules.push({
      id,
      label: `Módulo ${L} × ${D} × ${H} cm, ${LV} ${LV === 1 ? 'nivel' : 'niveles'}`,
      lengthCm: L, depthCm: D, heightCm: H, levels: LV,
      unitPriceNetClp: priceFor(L, D, H, LV),
    })
  }
  // Exact modules observed in the seeded plans always price correctly.
  for (const m of extraModules) add(m.lengthCm, m.depthCm, m.heightCm, m.levels)
  for (const D of DEPTHS) {
    for (const [H, maxLevels] of Object.entries(MAX_LEVELS_BY_HEIGHT)) {
      for (const L of LENGTHS) {
        for (const LV of LEVELS) if (LV <= maxLevels) add(L, D, Number(H), LV)
      }
    }
  }

  return {
    version: 'TEST-ONLY-local-2026-09-16',
    currency: 'CLP',
    ivaBasisPoints: 1900,
    modules,
    services: [
      { id: 'svc-instalacion',  label: 'Instalación en domicilio',      unitPriceNetClp: 80000 },
      { id: 'svc-despacho',     label: 'Despacho Región Metropolitana', unitPriceNetClp: 25000 },
      { id: 'svc-anclaje',      label: 'Anclaje reforzado a muro',      unitPriceNetClp: 18000 },
      { id: 'svc-desarme',      label: 'Desarme de mueble existente',   unitPriceNetClp: 35000 },
      { id: 'svc-retiro',       label: 'Retiro de escombros',           unitPriceNetClp: 15000 },
    ],
  }
}
