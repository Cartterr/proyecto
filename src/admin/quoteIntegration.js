const REQUIRED_CUSTOMER_FIELDS = ['nombre', 'direccion', 'comuna']

export function completedVisitSnapshot(visit, comunaOverride = '') {
  if (!visit?.id) throw new Error('Selecciona una visita realizada')
  const customer = {
    id: String(visit.customerId || `calendar-${visit.id}`),
    name: String(visit.nombre || '').trim(),
    address: String(visit.direccion || '').trim(),
    comuna: String(comunaOverride || visit.comuna || '').trim(),
    ...(visit.celular || visit.telefono ? { phone: String(visit.celular || visit.telefono).trim() } : {}),
    ...(visit.email ? { email: String(visit.email).trim() } : {}),
  }
  const missing = REQUIRED_CUSTOMER_FIELDS.filter(field => !customer[field === 'nombre' ? 'name' : field === 'direccion' ? 'address' : field])
  if (missing.length) throw new Error(`Faltan datos de la visita: ${missing.join(', ')}`)
  return { id: String(visit.id), status: 'completed', customer }
}

export function measurementPayload(values) {
  const required = ['projectName', 'wallACm', 'wallBAndECm', 'roomHeightCm', 'shape', 'wallSelection', 'depthCm']
  const missing = required.filter(key => values?.[key] === '' || values?.[key] === undefined || values?.[key] === null)
  const labels = {
    projectName: 'nombre del proyecto', wallACm: 'muro A', wallBAndECm: 'muros B/E',
    roomHeightCm: 'altura', shape: 'forma', wallSelection: 'muros con repisas', depthCm: 'profundidad',
  }
  if (missing.length) throw new Error(`Faltan medidas: ${missing.map(key => labels[key] || key).join(', ')}`)
  return {
    projectName: String(values.projectName).trim(),
    wallACm: Number(values.wallACm),
    wallBAndECm: Number(values.wallBAndECm),
    wallCCm: Number(values.wallCCm || 0),
    wallDCm: Number(values.wallDCm || 0),
    roomHeightCm: Number(values.roomHeightCm),
    shape: values.shape,
    wallSelection: values.wallSelection,
    depthCm: Number(values.depthCm),
  }
}

export function restoredQuoteState(savedQuote, fallbackCatalog = null) {
  if (!savedQuote?.quoteId || !savedQuote?.configuration?.project) {
    throw new Error('La version guardada no contiene una configuracion valida')
  }
  const serviceQty = Object.fromEntries((savedQuote.serviceSelections || [])
    .filter(selection => selection?.catalogItemId && Number(selection.quantity) > 0)
    .map(selection => [selection.catalogItemId, Number(selection.quantity)]))
  return {
    quoteId: savedQuote.quoteId,
    project: savedQuote.configuration.project,
    catalog: savedQuote.catalog || fallbackCatalog,
    serviceQty,
    calculation: { lines: savedQuote.lines || [], totals: savedQuote.totals },
  }
}

function sameDimension(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.01
}

export function priceSerializedPlan(plan, catalog, selections = []) {
  if (!catalog?.version || catalog.currency !== 'CLP' || !Array.isArray(catalog.modules)) {
    throw new Error('El catalogo controlado no esta configurado')
  }
  const moduleLines = (plan?.modules || []).map(module => {
    const levels = (module.levels || []).filter(level => level.enabled).length
    const item = catalog.modules.find(candidate =>
      sameDimension(candidate.lengthCm, module.lengthCm) &&
      sameDimension(candidate.depthCm, module.depthCm) &&
      sameDimension(candidate.heightCm, module.heightCm) &&
      Number(candidate.levels) === levels
    )
    if (!item) {
      throw new Error(`No hay precio controlado para modulo ${module.lengthCm} x ${module.depthCm} x ${module.heightCm} cm, ${levels} niveles`)
    }
    return {
      kind: 'module', catalogItemId: item.id, sourceModuleId: module.id,
      description: item.label, quantity: 1,
      unitPriceNetClp: Number(item.unitPriceNetClp), totalNetClp: Number(item.unitPriceNetClp),
    }
  })
  const serviceLines = selections.filter(selection => Number(selection.quantity) > 0).map(selection => {
    const item = (catalog.services || []).find(candidate => candidate.id === selection.catalogItemId)
    if (!item) throw new Error(`Servicio no encontrado en catalogo ${catalog.version}: ${selection.catalogItemId}`)
    const quantity = Number(selection.quantity)
    return {
      kind: 'service', catalogItemId: item.id, description: item.label, quantity,
      unitPriceNetClp: Number(item.unitPriceNetClp), totalNetClp: Number(item.unitPriceNetClp) * quantity,
    }
  })
  const lines = [...moduleLines, ...serviceLines]
  const subtotalNetClp = lines.reduce((sum, line) => sum + line.totalNetClp, 0)
  const ivaBasisPoints = Number(catalog.ivaBasisPoints)
  const ivaClp = Math.round(subtotalNetClp * ivaBasisPoints / 10000)
  return { lines, totals: { subtotalNetClp, ivaBasisPoints, ivaClp, totalClp: subtotalNetClp + ivaClp } }
}

export function miniErpQuoteRecord(savedQuote) {
  const modules = savedQuote.lines.filter(line => line.kind === 'module')
  const services = savedQuote.lines.filter(line => line.kind === 'service')
  return {
    cotNum: savedQuote.quoteNumber,
    nombre: savedQuote.visit.customer.name,
    email: savedQuote.visit.customer.email || '',
    telefono: savedQuote.visit.customer.phone || '',
    direccion: savedQuote.visit.customer.address,
    fechaVisita: '',
    subtotal: savedQuote.totals.subtotalNetClp,
    iva: savedQuote.totals.ivaClp,
    total: savedQuote.totals.totalClp,
    status: 'por confirmar',
    notas: `Cotizacion 3D version ${savedQuote.version}`,
    repisas: modules.map(line => ({
      sourceModuleId: line.sourceModuleId, descripcion: line.description,
      unidades: line.quantity, valor: line.unitPriceNetClp, total: line.totalNetClp,
    })),
    adicionales: Object.fromEntries(services.map(line => [line.catalogItemId, {
      descripcion: line.description, cantidad: line.quantity, precio: line.unitPriceNetClp,
    }])),
    pdfUrl: savedQuote.pdf.url,
    visitId: savedQuote.visit.id,
    quote3dId: savedQuote.quoteId,
    quoteVersion: savedQuote.version,
    configurationSha256: savedQuote.configuration.sha256,
    pdfSha256: savedQuote.pdf.sha256,
  }
}
