import React, { useEffect, useMemo, useRef, useState } from 'react'
import { C, apiFetch, fmt, fmtDate, styles } from './utils.js'
import { completedVisitSnapshot, measurementPayload, miniErpQuoteRecord, restoredQuoteState } from './quoteIntegration.js'

const emptyMeasurements = {
  projectName: '', wallACm: '', wallBAndECm: '', wallCCm: 0, wallDCm: 0,
  roomHeightCm: '', shape: 'single-wall', wallSelection: 'A', depthCm: '',
}
const DEMO_QUOTES_KEY = 'dm_demo_3d_quotes'
const FUNCTIONS_BASE_URL = (import.meta.env.VITE_FUNCTIONS_BASE_URL || '').replace(/\/$/, '')

const demoVisit = {
  id: 'visit-demo-local-001', status: 'realizada', nombre: 'Cliente de Prueba',
  email: 'cliente@example.test', celular: '+56 9 0000 0000',
  direccion: 'Direccion de Prueba 123', comuna: 'Comuna de Prueba',
  start: '2026-09-08T10:00:00-03:00',
  measurements: {
    projectName: 'Cotizacion local de prueba', wallACm: 240, wallBAndECm: 200,
    wallCCm: 80, wallDCm: 80, roomHeightCm: 250,
    shape: 'single-wall', wallSelection: 'A', depthCm: 48,
  },
}

function fieldStyle(extra = {}) {
  return { ...styles.input, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', ...extra }
}

function EmbedConfigurator({ session, project, onProject }) {
  const frameRef = useRef(null)
  const projectRef = useRef(project)
  projectRef.current = project
  const embedOrigin = useMemo(() => new URL(session.embedBaseUrl).origin, [session.embedBaseUrl])
  const source = useMemo(() => {
    const url = new URL(session.embed.path, session.embedBaseUrl)
    url.searchParams.set('mode', 'editor')
    url.searchParams.set('parentOrigin', window.location.origin)
    url.searchParams.set('protocolVersion', session.embed.protocolVersion || '1')
    return url.toString()
  }, [session])

  function sendProject() {
    frameRef.current?.contentWindow?.postMessage({
      type: 'repisas:load-project', version: session.embed.protocolVersion || '1',
      requestId: crypto.randomUUID(), payload: { project: projectRef.current },
    }, embedOrigin)
  }

  useEffect(() => {
    function receive(event) {
      if (event.origin !== embedOrigin || event.source !== frameRef.current?.contentWindow) return
      const message = event.data
      if (message?.version !== (session.embed.protocolVersion || '1')) return
      if (message.type === 'repisas:ready') sendProject()
      if ((message.type === 'repisas:project-loaded' || message.type === 'repisas:project-changed') && message.payload?.project) onProject(message.payload.project)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [embedOrigin, session.embed.protocolVersion, onProject])

  return <iframe ref={frameRef} src={source} onLoad={sendProject} title="Configurador Repisas 3D"
    style={{ width: '100%', minHeight: 580, border: '1px solid ' + C.border, borderRadius: 10, background: 'white' }} />
}

export default function PorCotizarSection({ statuses, visitaSeleccionada, allVisits, onVisitCotizada }) {
  const demoEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1'
  // allVisits is only hydrated once the Visitas section has been opened, so cotizar looked empty
  // for anyone who landed here first. Load the visits directly when that list is still empty.
  const [ownVisits, setOwnVisits] = useState([])
  useEffect(() => {
    if (allVisits.length) return undefined
    let cancelled = false
    apiFetch('/.netlify/functions/get-visits')
      .then(data => { if (!cancelled && data?.ok) setOwnVisits(data.visits || []) })
      .catch(() => { /* la seccion Visitas mostrara el error de carga */ })
    return () => { cancelled = true }
  }, [allVisits.length])
  const visitPool = allVisits.length ? allVisits : ownVisits
  const realizadas = useMemo(() => {
    const source = visitPool.filter(v => statuses[v.id] === 'realizada' || v.status === 'realizada')
    return demoEnabled && !source.some(v => v.id === demoVisit.id) ? [demoVisit, ...source] : source
  }, [visitPool, statuses, demoEnabled])
  // Una cotizacion puede nacer de una visita realizada o de un ingreso manual, para los casos
  // en que el cliente llega sin visita previa. Ambos caminos usan el mismo configurador 3D.
  const [mode, setMode] = useState('visita')
  const [manualCliente, setManualCliente] = useState({ nombre: '', email: '', celular: '', direccion: '', comuna: '' })
  const [manualVisitId] = useState(() => `manual-${crypto.randomUUID()}`)
  const [selectedVisit, setSelectedVisit] = useState(visitaSeleccionada || null)
  const [comuna, setComuna] = useState(visitaSeleccionada?.comuna || '')
  const [measurements, setMeasurements] = useState({ ...emptyMeasurements, ...(visitaSeleccionada?.measurements || {}) })
  const [session, setSession] = useState(null)
  const [project, setProject] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [serviceQty, setServiceQty] = useState({})
  const [calculation, setCalculation] = useState(null)
  const [savedQuote, setSavedQuote] = useState(null)
  const [quoteId, setQuoteId] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (visitaSeleccionada) selectVisit(visitaSeleccionada) }, [visitaSeleccionada])

  const manualVisit = useMemo(() => ({
    id: manualVisitId, status: 'realizada', start: '',
    nombre: manualCliente.nombre, email: manualCliente.email, celular: manualCliente.celular,
    direccion: manualCliente.direccion, comuna: manualCliente.comuna,
  }), [manualVisitId, manualCliente])

  const activeVisit = mode === 'visita' ? selectedVisit : manualVisit
  const activeComuna = mode === 'visita' ? comuna : manualCliente.comuna
  const manualReady = Boolean(manualCliente.nombre.trim() && manualCliente.direccion.trim() && manualCliente.comuna.trim())
  const readyForMeasurements = mode === 'visita' ? Boolean(selectedVisit) : manualReady

  function resetFlow() {
    setSession(null); setProject(null); setCatalog(null); setCalculation(null)
    setSavedQuote(null); setQuoteId(null); setError('')
  }

  function changeMode(next) {
    if (next === mode) return
    setMode(next); resetFlow()
    setMeasurements({ ...emptyMeasurements })
  }

  function selectVisit(visit) {
    setSelectedVisit(visit); setComuna(visit.comuna || '')
    setMeasurements({ ...emptyMeasurements, projectName: `Cotizacion ${visit.nombre || ''}`.trim(), ...(visit.measurements || {}) })
    resetFlow()
  }

  function services() {
    return Object.entries(serviceQty).filter(([, quantity]) => Number(quantity) > 0)
      .map(([catalogItemId, quantity]) => ({ catalogItemId, quantity: Number(quantity) }))
  }

  async function callIntegration(body) {
    const data = await apiFetch(`${FUNCTIONS_BASE_URL}/.netlify/functions/repisas-3d-quote`, { method: 'POST', body: JSON.stringify(body) })
    if (!data.ok) throw new Error(data.error || 'Fallo la integracion con Repisas 3D')
    return data
  }

  async function startConfigurator() {
    setBusy('session'); setError(''); setSavedQuote(null)
    try {
      const visit = completedVisitSnapshot(activeVisit, activeComuna)
      const normalizedMeasurements = measurementPayload(measurements)
      const data = await callIntegration({ action: 'session', visit, measurements: normalizedMeasurements })
      setSession(data); setProject(data.project); setCatalog(data.catalog)
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }

  useEffect(() => {
    if (!project || !catalog) return
    const timer = setTimeout(async () => {
      try {
        const data = await callIntegration({ action: 'calculate', project, serviceSelections: services() })
        setCalculation({ lines: data.lines, totals: data.totals }); setError('')
      } catch (e) { setCalculation(null); setError(e.message) }
    }, 250)
    return () => clearTimeout(timer)
  }, [project, catalog, serviceQty])

  async function saveQuote() {
    if (!project || !calculation) return
    setBusy('save'); setError('')
    try {
      const visit = completedVisitSnapshot(activeVisit, activeComuna)
      const data = await callIntegration({ action: 'save', quoteId, visit, project, serviceSelections: services(), status: 'draft' })
      const quote = data.quote
      setSavedQuote(quote); setQuoteId(quote.quoteId)
      const mirror = miniErpQuoteRecord(quote)
      mirror.fechaVisita = (mode === 'visita' ? selectedVisit?.start : '') || ''
      if (demoEnabled && mode === 'visita' && selectedVisit.id === demoVisit.id) {
        const existing = JSON.parse(localStorage.getItem(DEMO_QUOTES_KEY) || '[]')
        localStorage.setItem(DEMO_QUOTES_KEY, JSON.stringify([mirror, ...existing.filter(item => item.cotNum !== mirror.cotNum)]))
      } else {
        const stored = await apiFetch('/.netlify/functions/save-quote', { method: 'POST', body: JSON.stringify(mirror) })
        if (!stored.ok) throw new Error(stored.error || 'La cotizacion 3D se guardo, pero no pudo asociarse al mini ERP')
        // Una cotizacion manual no tiene visita agendada, asi que no hay estado que actualizar.
        if (mode === 'visita') {
          const visitUpdate = await apiFetch('/.netlify/functions/update-visit-status', {
            method: 'POST', body: JSON.stringify({
              visitId: selectedVisit.id, nombre: selectedVisit.nombre, fecha: fmtDate(selectedVisit.start), hora: '',
              email: selectedVisit.email || '', celular: selectedVisit.celular || '', direccion: selectedVisit.direccion || '',
              status: 'realizada_cotizada', notas: selectedVisit.notas || '',
            }),
          })
          if (!visitUpdate.ok) throw new Error(visitUpdate.error || 'La cotizacion se guardo, pero no se pudo actualizar la visita')
        }
      }
      if (mode === 'visita') onVisitCotizada?.(selectedVisit.id, 'realizada_cotizada')
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }

  async function reopenSaved() {
    if (!savedQuote) return
    setBusy('reopen'); setError('')
    try {
      const data = await callIntegration({ action: 'reopen', quoteId: savedQuote.quoteId, version: savedQuote.version })
      const restored = restoredQuoteState(data.quote, data.catalog)
      setSavedQuote(data.quote); setQuoteId(restored.quoteId); setProject(restored.project)
      setCatalog(restored.catalog); setServiceQty(restored.serviceQty); setCalculation(restored.calculation)
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }

  return <div data-testid="visit-3d-quote-flow">
    <h2 style={styles.sectionTitle}>Cotizar en 3D</h2>
    <p style={{ color: C.textSub, fontSize: 13 }}>Desde una visita realizada se reutilizan los datos conocidos del cliente; sin visita se ingresan a mano. Los precios e IVA provienen exclusivamente del catalogo controlado del servidor.</p>

    <section style={{ ...styles.card, marginBottom: 14 }}>
      <div style={styles.cardLabel}>1. Origen de la cotizacion</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => changeMode('visita')} style={{ ...styles.tab, ...(mode === 'visita' ? styles.tabActive : {}) }}>Desde visita</button>
        <button onClick={() => changeMode('manual')} style={{ ...styles.tab, ...(mode === 'manual' ? styles.tabActive : {}) }}>Ingreso manual</button>
      </div>

      {mode === 'visita' && <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {realizadas.map(visit => <button key={visit.id} onClick={() => selectVisit(visit)} style={{ ...styles.tab, ...(selectedVisit?.id === visit.id ? styles.tabActive : {}) }}>{visit.nombre} · {fmtDate(visit.start)}</button>)}
        </div>
        {!realizadas.length && <p style={{ color: C.textMuted }}>No hay visitas realizadas disponibles. Usa <strong>Ingreso manual</strong> para cotizar sin visita.</p>}
        {selectedVisit && <div style={{ ...styles.detailGrid, marginTop: 14 }}>
          <span style={styles.detailLabel}>Cliente</span><span>{selectedVisit.nombre}</span>
          <span style={styles.detailLabel}>Email</span><span>{selectedVisit.email || 'No disponible'}</span>
          <span style={styles.detailLabel}>Celular</span><span>{selectedVisit.celular || 'No disponible'}</span>
          <span style={styles.detailLabel}>Direccion</span><span>{selectedVisit.direccion || 'No disponible'}</span>
          <label style={styles.detailLabel} htmlFor="quote-comuna">Comuna</label>
          <input id="quote-comuna" value={comuna} onChange={e => setComuna(e.target.value)} placeholder="Dato requerido si la visita no lo incluye" style={fieldStyle()} />
        </div>}
      </>}

      {mode === 'manual' && <div data-testid="manual-customer-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        {[
          ['nombre', 'Nombre', 'Nombre completo', true],
          ['direccion', 'Direccion', 'Calle, numero, depto', true],
          ['comuna', 'Comuna', 'Comuna', true],
          ['email', 'Email', 'correo@ejemplo.com', false],
          ['celular', 'Celular', '+56 9 XXXX XXXX', false],
        ].map(([key, label, placeholder, required]) => (
          <label key={key} style={{ fontSize: 12, color: C.textSub }}>
            {label}{required ? ' *' : ''}
            <input value={manualCliente[key]} placeholder={placeholder}
              onChange={e => setManualCliente(prev => ({ ...prev, [key]: e.target.value }))}
              style={fieldStyle({ marginTop: 4, width: '100%' })} />
          </label>
        ))}
        {!manualReady && <p style={{ gridColumn: '1 / -1', color: C.textMuted, fontSize: 12, margin: 0 }}>Nombre, direccion y comuna son obligatorios para continuar.</p>}
      </div>}
    </section>

    {readyForMeasurements && <section style={{ ...styles.card, marginBottom: 14 }}>
      <div style={styles.cardLabel}>2. Medidas disponibles</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        {[['projectName','Nombre del proyecto','text'],['wallACm','Muro A (cm)','number'],['wallBAndECm','Muros B/E (cm)','number'],['wallCCm','Muro C (cm)','number'],['wallDCm','Muro D (cm)','number']].map(([key,label,type]) => <label key={key} style={{ fontSize: 12, color: C.textSub }}>{label}<input type={type} value={measurements[key]} onChange={e => setMeasurements(v => ({ ...v, [key]: e.target.value }))} style={fieldStyle({ marginTop: 4, width: '100%' })} /></label>)}
        <label style={{ fontSize: 12, color: C.textSub }}>Altura<select value={measurements.roomHeightCm} onChange={e => setMeasurements(v => ({ ...v, roomHeightCm: e.target.value }))} style={fieldStyle({ marginTop: 4, width: '100%' })}><option value="">Seleccionar</option>{[250,300,350].map(v => <option key={v} value={v}>{v} cm</option>)}</select></label>
        <label style={{ fontSize: 12, color: C.textSub }}>Profundidad<select value={measurements.depthCm} onChange={e => setMeasurements(v => ({ ...v, depthCm: e.target.value }))} style={fieldStyle({ marginTop: 4, width: '100%' })}><option value="">Seleccionar</option>{[28,38,48,68].map(v => <option key={v} value={v}>{v} cm</option>)}</select></label>
        <label style={{ fontSize: 12, color: C.textSub }}>Forma<select value={measurements.shape} onChange={e => setMeasurements(v => ({ ...v, shape: e.target.value }))} style={fieldStyle({ marginTop: 4, width: '100%' })}><option value="single-wall">Un muro</option><option value="L">L</option><option value="U">U</option></select></label>
        <label style={{ fontSize: 12, color: C.textSub }}>Muros con repisas<select value={measurements.wallSelection} onChange={e => setMeasurements(v => ({ ...v, wallSelection: e.target.value }))} style={fieldStyle({ marginTop: 4, width: '100%' })}><option value="A">A</option><option value="A+B">A+B</option><option value="A+E">A+E</option></select></label>
      </div>
      <button onClick={startConfigurator} disabled={!!busy} style={{ ...styles.btnPrimary, marginTop: 14 }}>{busy === 'session' ? 'Preparando...' : 'Abrir configurador 3D'}</button>
    </section>}

    {session && project && <>
      <section style={{ ...styles.card, marginBottom: 14 }}><div style={styles.cardLabel}>3. Configuracion exacta</div><EmbedConfigurator session={session} project={project} onProject={setProject} /></section>
      <section style={{ ...styles.card, marginBottom: 14 }}><div style={styles.cardLabel}>4. Servicios adicionales</div>
        {(catalog?.services || []).length ? catalog.services.map(service => <div key={service.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(70px, 90px) minmax(90px, 120px)', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span>{service.label}</span><input aria-label={`Cantidad ${service.label}`} type="number" min="0" step="1" value={serviceQty[service.id] || 0} onChange={e => setServiceQty(q => ({ ...q, [service.id]: Math.max(0, Number(e.target.value) || 0) }))} style={fieldStyle()} /><strong>{fmt(service.unitPriceNetClp)}</strong>
        </div>) : <p style={{ color: C.textMuted }}>El catalogo no contiene servicios adicionales.</p>}
      </section>
    </>}

    {calculation && <section style={{ ...styles.card, marginBottom: 14 }} data-testid="controlled-quote-totals">
      <div style={styles.cardLabel}>5. Lineas y totales controlados · Catalogo {catalog.version}</div>
      {calculation.lines.map((line, index) => <div key={`${line.catalogItemId}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(50px, 70px) minmax(90px, 120px)', gap: 8, padding: '6px 0', borderBottom: '1px solid ' + C.border }}><span style={{ overflowWrap: 'anywhere' }}>{line.description}</span><span>x {line.quantity}</span><strong style={{ textAlign: 'right' }}>{fmt(line.totalNetClp)}</strong></div>)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginTop: 12 }}><span>Subtotal neto</span><strong>{fmt(calculation.totals.subtotalNetClp)}</strong><span>IVA ({calculation.totals.ivaBasisPoints / 100}%)</span><strong>{fmt(calculation.totals.ivaClp)}</strong><span style={{ fontSize: 18, color: C.orangeDark }}>Total</span><strong style={{ fontSize: 18, color: C.orangeDark }}>{fmt(calculation.totals.totalClp)}</strong></div>
      <button onClick={saveQuote} disabled={!!busy} style={{ ...styles.btnPrimary, width: '100%', marginTop: 14 }}>{busy === 'save' ? 'Guardando y generando PDF...' : quoteId ? 'Guardar nueva version y generar PDF' : 'Guardar cotizacion y generar PDF'}</button>
    </section>}

    {savedQuote && <section style={{ ...styles.card, borderLeft: '4px solid ' + C.green }} data-testid="saved-quote-result">
      <div style={styles.cardLabel}>Cotizacion asociada</div><p><strong>{savedQuote.quoteNumber}</strong> · Version {savedQuote.version} · Estado: {savedQuote.status}</p>
      <p style={{ fontSize: 12, color: C.textMuted }}>Visita {savedQuote.visit.id} · Configuracion {savedQuote.configuration.sha256.slice(0, 12)} · PDF {savedQuote.pdf.sha256.slice(0, 12)}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a href={savedQuote.pdf.url} target="_blank" rel="noreferrer" style={styles.btnPrimary}>Abrir PDF de 2 paginas</a><button onClick={reopenSaved} disabled={!!busy} style={styles.btnSecondary}>{busy === 'reopen' ? 'Reabriendo...' : 'Reabrir esta version'}</button></div>
    </section>}
    {error && <div style={{ ...styles.errorBox, marginTop: 14 }} role="alert">{error}</div>}
  </div>
}
