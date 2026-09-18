import React, { useEffect, useState, useRef } from 'react'
import { ADMIN_PASSWORD, DEFAULTS_REPISA, C, apiFetch, fmtDate, fmt, styles } from './utils.js'
import { precioRepisa, cargarTablaPrecios, TABLA_PRECIOS } from './preciosRepisas.js'

function repisaPorDefecto(tabla) {
  const { l, p, a } = DEFAULTS_REPISA
  return { ...DEFAULTS_REPISA, id: Date.now(), v: precioRepisa({ largoM: l, profM: p, altoM: a }, tabla) ?? 0 }
}

function SelectOrFree({ options, value, onChange, step = 0.01 }) {
  const [libre, setLibre] = useState(() => !options.includes(Number(value)))
  const strOptions = options.map(String)
  function handleSelect(e) {
    if (e.target.value === '__libre__') { setLibre(true) }
    else { setLibre(false); onChange(parseFloat(e.target.value)) }
  }
  const sel = {
    padding: '7px 6px', border: '1.5px solid ' + C.border, borderRadius: 7,
    fontSize: 13, width: '100%', fontFamily: 'inherit', background: '#FAFAFA', outline: 'none',
  }
  if (!libre) return (
    <select value={strOptions.includes(String(value)) ? String(value) : '__libre__'} onChange={handleSelect} style={sel}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__libre__">Otro...</option>
    </select>
  )
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input type="number" value={value} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...sel, width: '70%' }} autoFocus />
      <button type="button" onClick={() => setLibre(false)}
        style={{ fontSize: 11, padding: '0 6px', border: '1.5px solid ' + C.border, borderRadius: 7, background: C.bg, cursor: 'pointer', color: C.textSub, whiteSpace: 'nowrap' }}>
        Lista
      </button>
    </div>
  )
}

// El configurador 3D. En local sale por el mismo origen (vite proxea /embed, /configurador y
// /assets); en produccion es otro dominio y se apunta con VITE_REPISAS_3D_URL.
// Si falta en un build de produccion el iframe cargaria este mismo sitio, que no sirve el
// configurador: la tarjeta quedaria rota sin explicar por que. Mejor decirlo.
const FALTA_URL_3D = import.meta.env.PROD && !import.meta.env.VITE_REPISAS_3D_URL
const REPISAS_3D_URL = (import.meta.env.VITE_REPISAS_3D_URL || window.location.origin).replace(/\/$/, '')
const REPISAS_3D_ORIGIN = new URL(REPISAS_3D_URL).origin
const PROTOCOL = '1'

function url3d(path, extra = {}) {
  const url = new URL(path, REPISAS_3D_URL)
  url.searchParams.set('parentOrigin', window.location.origin)
  url.searchParams.set('protocolVersion', PROTOCOL)
  for (const [clave, valor] of Object.entries(extra)) url.searchParams.set(clave, valor)
  return url.toString()
}

function bytesABase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
  }
  return btoa(binario)
}

// Visor en vivo + modal a pantalla completa con el configurador entero.
// El proyecto viaja por postMessage: la ventana chica lo muestra, el modal lo edita.
function Grafica3D({ project, onProject, onModulos, frameRef }) {
  const [ampliado, setAmpliado] = useState(false)
  const modalRef = useRef(null)
  const projectRef = useRef(project)
  projectRef.current = project
  // El escuchador se registra una sola vez, asi que no puede cerrar sobre las funciones de
  // este render: onModulos arrastra la tabla de precios, y congelarla dejaba las filas del 3D
  // valorizadas con el respaldo del bundle en vez de la planilla del cliente.
  const avisar = useRef({ onProject, onModulos })
  avisar.current = { onProject, onModulos }
  // Ventana que origino el ultimo cambio. A esa no se le devuelve el proyecto: el configurador
  // avisa 'project-changed' cada vez que su estado cambia, incluido al recibir 'load-project',
  // asi que devolverselo lo haria rebotar sin fin.
  const origenRef = useRef(null)

  function enviarProyectoA(ventana) {
    if (!projectRef.current || !ventana) return
    ventana.postMessage({
      type: 'repisas:load-project', version: PROTOCOL,
      requestId: crypto.randomUUID(), payload: { project: projectRef.current },
    }, REPISAS_3D_ORIGIN)
  }
  const enviarProyecto = frame => enviarProyectoA(frame?.contentWindow)

  useEffect(() => {
    function recibir(event) {
      if (event.origin !== REPISAS_3D_ORIGIN) return
      const msg = event.data
      if (msg?.version !== PROTOCOL) return
      // Cada vista (miniatura y modal) avisa cuando monta; ahi recien tiene sentido mandarle
      // el proyecto. Se le contesta a la que aviso, no a una fija.
      if (msg.type === 'repisas:ready') enviarProyectoA(event.source)
      // Solo los cambios reales entran al estado. 'project-loaded' es el acuse de recibo de lo
      // que acabamos de mandar: tomarlo como cambio reenvia el proyecto en bucle infinito.
      if (msg.type === 'repisas:project-changed' && msg.payload?.project) {
        origenRef.current = event.source
        avisar.current.onProject(msg.payload.project)
      }
      // El acuse si trae los modulos ya planificados, que es con lo que se arma la tabla.
      if (msg.type === 'repisas:project-loaded' && msg.payload?.modules) avisar.current.onModulos(msg.payload.modules)
    }
    window.addEventListener('message', recibir)
    return () => window.removeEventListener('message', recibir)
  }, [])

  // Las dos vistas se mantienen al dia con el proyecto, venga de donde venga (el modal, una
  // cotizacion recuperada, una precarga desde la visita), menos la que lo acaba de mandar.
  useEffect(() => {
    if (!project) return
    const origen = origenRef.current
    origenRef.current = null
    for (const frame of [frameRef.current, modalRef.current]) {
      if (frame?.contentWindow && frame.contentWindow !== origen) enviarProyecto(frame)
    }
  }, [project])

  useEffect(() => {
    if (!ampliado) return undefined
    function cerrarConEsc(e) { if (e.key === 'Escape') setAmpliado(false) }
    window.addEventListener('keydown', cerrarConEsc)
    return () => window.removeEventListener('keydown', cerrarConEsc)
  }, [ampliado])

  const botonEsquina = {
    position: 'absolute', top: 10, right: 10, zIndex: 2, cursor: 'pointer',
    background: 'white', border: '1.5px solid ' + C.border, borderRadius: 8,
    padding: '6px 12px', fontSize: 12, fontWeight: 700, color: C.textSub, fontFamily: 'inherit',
  }

  return (
    <div style={{ ...styles.card, marginBottom: 14 }}>
      <div style={styles.cardLabel}>Grafica 3D</div>
      {FALTA_URL_3D ? (
        <div style={{ padding: '14px 12px', borderRadius: 9, border: '1.5px dashed ' + C.border, color: C.textMuted, fontSize: 13 }}>
          Falta configurar <strong>VITE_REPISAS_3D_URL</strong> con la direccion del servicio
          Repisas 3D. Sin eso la cotizacion se genera igual, pero sin la pagina de graficas.
        </div>
      ) : (
      <div style={{ position: 'relative' }}>
        {/* Al reiniciar la cotizacion el proyecto se va a null; remontar el iframe borra la
            lamina anterior, que si no se queda pegada mostrando la bodega del cliente pasado. */}
        <iframe key={project ? 'con-proyecto' : 'sin-proyecto'}
          ref={frameRef} src={url3d('/embed', { mode: 'quote' })} title="Vista 3D de la cotizacion"
          onLoad={() => enviarProyecto(frameRef.current)}
          style={{ width: '100%', height: 560, border: '1.5px solid ' + C.border, borderRadius: 10, background: 'white', display: 'block' }} />
        <button type="button" onClick={() => setAmpliado(true)} style={botonEsquina}>Pantalla completa</button>
      </div>
      )}
      {!FALTA_URL_3D && !project && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>
          Abre pantalla completa para armar la bodega. Lo que dibujes ahi aparece aca y va como pagina 2 del PDF.
        </div>
      )}

      {ampliado && (
        <div onClick={e => { if (e.target === e.currentTarget) setAmpliado(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,16,12,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'dmFade .18s ease-out',
          }}>
          <style>{'@keyframes dmFade{from{opacity:0}to{opacity:1}}'}</style>
          <div style={{ position: 'relative', width: '92vw', height: '90vh', background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
            <iframe ref={modalRef} src={url3d('/configurador')} title="Configurador Repisas 3D"
              onLoad={() => enviarProyecto(modalRef.current)}
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            <button type="button" onClick={() => setAmpliado(false)} aria-label="Cerrar"
              style={{ ...botonEsquina, width: 34, height: 34, padding: 0, borderRadius: '50%', fontSize: 17, lineHeight: '30px' }}>
              x
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const STORAGE_KEY = 'dm_cotizador_state'
const COT_NUM_KEY = 'dm_cot_num'
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null } }
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
function getCotNum() { return parseInt(localStorage.getItem(COT_NUM_KEY) || '1421') }
function setCotNumStorage(n) { localStorage.setItem(COT_NUM_KEY, String(n)) }

export default function PorCotizarSection({ statuses, visitaSeleccionada, allVisits, onVisitCotizada }) {
  const realizadas = allVisits.filter(v => statuses[v.id] === 'realizada')
  const saved = loadState()

  const [mode, setMode]                   = useState(saved?.mode || 'visita')
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [manualCliente, setManualCliente] = useState(saved?.manualCliente || { nombre: '', email: '', celular: '', direccion: '' })
  const [cotNum, setCotNum]               = useState(getCotNum)
  const [tablaPrecios, setTablaPrecios]   = useState(TABLA_PRECIOS)
  const [preciosDeRespaldo, setPreciosDeRespaldo] = useState(false)
  const [repisas, setRepisas]             = useState(saved?.repisas || [repisaPorDefecto(TABLA_PRECIOS)])
  const [adNombres, setAdNombres]         = useState(saved?.adNombres || {
    retiro_orden: 'Retiro y orden de articulos',
    retiro_basura: 'Retiro de basura',
    cajas: 'Cajas organizadoras',
    bici: 'Soporte bicicleta / ski',
  })
  const [adicionales, setAdicionales]     = useState(saved?.adicionales || {
    qty_retiro_orden: 0,  precio_retiro_orden: 40000,
    qty_retiro_basura: 0, precio_retiro_basura: 30000,
    qty_cajas: 0,         precio_cajas: 15000,
    qty_bici: 0,          precio_bici: 20000,
  })
  // Proyecto que se arma en el configurador 3D. Va como pagina 2 del PDF.
  // No se guarda en localStorage a proposito: vale solo para esta cotizacion.
  const [project3d, setProject3d] = useState(null)
  const frame3dRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [pdfUrl, setPdfUrl]         = useState(null)
  const [pdfBlob, setPdfBlob]       = useState(null)
  const [totalInfo, setTotalInfo]   = useState(saved?.totalInfo || { subtotal: 0, iva: 0, total: 0 })
  const [autoSaved, setAutoSaved]   = useState(false)
  const [error, setError]           = useState('')
  const [editingNombre, setEditingNombre] = useState(null)

  useEffect(() => {
    if (visitaSeleccionada) { setMode('visita'); setSelectedVisit(visitaSeleccionada) }
  }, [visitaSeleccionada])

  // La planilla del cliente manda. Hasta que responda se usa el respaldo del bundle.
  useEffect(() => {
    cargarTablaPrecios(apiFetch).then(({ tabla, respaldo }) => {
      setTablaPrecios(tabla)
      setPreciosDeRespaldo(respaldo)
    })
  }, [])

  useEffect(() => {
    saveState({ mode, manualCliente, repisas, adNombres, adicionales, totalInfo })
  }, [mode, manualCliente, repisas, adNombres, adicionales, totalInfo])

  function resetCotizador() {
    const newNum = getCotNum()
    setMode('visita')
    setManualCliente({ nombre: '', email: '', celular: '', direccion: '' })
    setCotNum(newNum)
    setRepisas([repisaPorDefecto(tablaPrecios)])
    setAdNombres({ retiro_orden: 'Retiro y orden de articulos', retiro_basura: 'Retiro de basura', cajas: 'Cajas organizadoras', bici: 'Soporte bicicleta / ski' })
    setAdicionales({ qty_retiro_orden: 0, precio_retiro_orden: 40000, qty_retiro_basura: 0, precio_retiro_basura: 30000, qty_cajas: 0, precio_cajas: 15000, qty_bici: 0, precio_bici: 20000 })
    setTotalInfo({ subtotal: 0, iva: 0, total: 0 })
    setProject3d(null)
    setPdfUrl(null); setPdfBlob(null); setAutoSaved(false); setError('')
    setSelectedVisit(null); saveState({})
  }

  function calcTotales() {
    const totRep = repisas.reduce((s, r) => s + (r.u || 0) * (r.v || 0), 0)
    const totAd  = ['retiro_orden','retiro_basura','cajas','bici']
      .reduce((s, k) => s + (adicionales['qty_' + k] || 0) * (adicionales['precio_' + k] || 0), 0)
    const subtotal = totRep + totAd
    const iva = Math.round(subtotal * 0.19)
    return { subtotal, iva, total: subtotal + iva }
  }

  const totales = calcTotales()

  function addRepisa() {
    if (repisas.length >= 4) return
    setRepisas(prev => [...prev, repisaPorDefecto(tablaPrecios)])
  }
  function updRep(id, field, val) {
    setRepisas(prev => prev.map(r => {
      if (r.id !== id) return r
      const next = { ...r, [field]: parseFloat(String(val).replace(',', '.')) || 0 }
      // El valor sale solo de la tabla al cambiar las medidas. Si se edita a mano manda lo
      // escrito, y vale solo para esta cotizacion: la tabla no se toca.
      if (field !== 'v') next.v = precioRepisa({ largoM: next.l, profM: next.p, altoM: next.a }, tablaPrecios) ?? 0
      return next
    }))
  }
  function removeRepisa(id) { setRepisas(prev => prev.filter(r => r.id !== id)) }

  // La gráfica 3D manda sobre las medidas: cada módulo del plano es una fila, y el valor sale
  // de la tabla de precios. Es lo que pidió el cliente en la reunión (04:27 y 22:32).
  // El largo del PDF va en metros, el configurador trabaja en centímetros.
  function filasDesde3d(modulos) {
    if (!modulos?.length) return
    setRepisas(modulos.slice(0, 4).map((m, i) => {
      const medidas = { largoM: m.lengthCm / 100, profM: m.depthCm / 100, altoM: m.heightCm / 100 }
      return {
        id: Date.now() + i,
        l: medidas.largoM, p: medidas.profM, a: medidas.altoM,
        n: m.levels, u: m.units,
        v: precioRepisa(medidas, tablaPrecios) ?? 0,
      }
    }))
  }

  const cliente = mode === 'visita' ? (selectedVisit || {}) : manualCliente

  // Medida de cada recuadro de la hoja Grafica3D, al doble para que no se vea pixelada.
  // Se piden con estas proporciones para que entren sin deformarse.
  const VISTAS_PDF = [
    { view: 'isometric', width: 760, height: 558 },
    { view: 'top', width: 556, height: 558 },
    { view: 'entrance', width: 1316, height: 616 },
  ]

  // Le pide al visor las tres vistas que van en la pagina 2, cada una por separado: en la
  // plantilla van en recuadros distintos y con su titulo en una celda, no dentro de la imagen.
  function pedirGrafica3d() {
    const frame = frame3dRef.current
    if (!project3d || !frame?.contentWindow) return Promise.resolve(null)
    const requestId = crypto.randomUUID()
    return new Promise(resolve => {
      function terminar(valor) { clearTimeout(reloj); window.removeEventListener('message', escuchar); resolve(valor) }
      const reloj = setTimeout(() => terminar(null), 30000)
      function escuchar(event) {
        const msg = event.data
        if (event.origin !== REPISAS_3D_ORIGIN || msg?.requestId !== requestId) return
        if (msg.type === 'repisas:export-complete' && msg.payload?.images) {
          terminar(Object.fromEntries(msg.payload.images.map(i => [i.view, bytesABase64(i.bytes)])))
        }
        if (msg.type === 'repisas:error') terminar(null)
      }
      window.addEventListener('message', escuchar)
      frame.contentWindow.postMessage({
        type: 'repisas:export-request', version: PROTOCOL, requestId,
        payload: { kind: 'quote-views', views: VISTAS_PDF },
      }, REPISAS_3D_ORIGIN)
    })
  }

  async function handleGenerar() {
    if (mode === 'visita' && !selectedVisit) return
    if (mode === 'manual' && !manualCliente.nombre.trim()) return setError('Ingresa el nombre del cliente')
    setGenerating(true); setError(''); setPdfUrl(null); setAutoSaved(false)

    const grafica3d = await pedirGrafica3d()
    if (project3d && !grafica3d) setError('No se pudo generar la vista 3D: la cotizacion sale sin esa pagina')

    const t = calcTotales()
    setTotalInfo(t)

    const payload = {
      cot_num:   cotNum,
      nombre:    (cliente.nombre || '').toUpperCase(),
      direccion: (cliente.direccion || '').toUpperCase(),
      rut: '',
      telefono:  cliente.celular || cliente.telefono || '',
      email:     (cliente.email || '').toUpperCase(),
      repisas:   repisas.map(r => ({ largo: r.l, prof: r.p, alto: r.a, niveles: r.n, unidades: r.u, valor: r.v })),
      ...adicionales,
      ...(grafica3d ? { grafica3d } : {}),
    }

    try {
      const res = await fetch('/.netlify/functions/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'HTTP ' + res.status) }

      const finalTotals = {
        subtotal: parseInt(res.headers.get('x-subtotal') || '0'),
        iva:      parseInt(res.headers.get('x-iva')      || '0'),
        total:    parseInt(res.headers.get('x-total')    || '0'),
      }
      setTotalInfo(finalTotals)

      const blob = await res.blob()
      setPdfBlob(blob); setPdfUrl(URL.createObjectURL(blob))

      const next = cotNum + 1; setCotNum(next); setCotNumStorage(next)

      // Subir PDF a Drive
      let uploadedPdfUrl = ''
      try {
        const pdfBase64ToUpload = await blob.arrayBuffer().then(buf =>
          btoa(String.fromCharCode(...new Uint8Array(buf)))
        )
        const nombreInicial = (cliente.nombre || 'cliente').split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        const pdfFileName = 'Cotizacion ' + nombreInicial + ' - Repisas Don Maxi.pdf'
        const uploadRes = await apiFetch('/.netlify/functions/upload-pdf', {
          method: 'POST',
          body: JSON.stringify({ pdfBase64: pdfBase64ToUpload, fileName: pdfFileName, cotNum }),
        })
        if (uploadRes.ok) uploadedPdfUrl = uploadRes.viewUrl || ''
      } catch (e) { console.warn('upload-pdf error:', e.message) }

      // Guardar cotizacion
      await apiFetch('/.netlify/functions/save-quote', {
        method: 'POST',
        body: JSON.stringify({
          cotNum,
          nombre:      cliente.nombre || '',
          email:       cliente.email || '',
          telefono:    cliente.celular || cliente.telefono || '',
          direccion:   cliente.direccion || '',
          fechaVisita: mode === 'visita' ? (selectedVisit?.start || '') : '',
          subtotal:    finalTotals.subtotal,
          iva:         finalTotals.iva,
          total:       finalTotals.total,
          notas: '', status: 'por confirmar',
          repisas:     repisas.map(r => ({ largo: r.l, prof: r.p, alto: r.a, niveles: r.n, unidades: r.u, valor: r.v })),
          adicionales,
          pdfUrl:      uploadedPdfUrl,
        }),
      })

      // Si vino de visita, marcarla como realizada_cotizada
      if (mode === 'visita' && selectedVisit) {
        try {
          await apiFetch('/.netlify/functions/update-visit-status', {
            method: 'POST',
            body: JSON.stringify({
              visitId:   selectedVisit.id,
              nombre:    selectedVisit.nombre,
              fecha:     fmtDate(selectedVisit.start),
              hora:      '',
              email:     selectedVisit.email || '',
              celular:   selectedVisit.celular || '',
              direccion: selectedVisit.direccion || '',
              status:    'realizada_cotizada',
              notas:     selectedVisit.notas || '',
            }),
          })
          onVisitCotizada?.(selectedVisit.id, 'realizada_cotizada')
        } catch (e) { console.warn('No se pudo actualizar estado de visita:', e.message) }
      }

      setAutoSaved(true)
    } catch (e) { setError(e.message) }
    finally { setGenerating(false) }
  }

  function handleDescargar() {
    if (!pdfBlob) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = 'Cotizacion ' + (cliente.nombre || 'cliente') + ' - Repisas Don Maxi.pdf'
    a.click()
  }

  const inputStyle = {
    padding: '7px 6px', border: '1.5px solid ' + C.border, borderRadius: 7,
    fontSize: 13, textAlign: 'center', width: '100%', fontFamily: 'inherit',
    background: '#FAFAFA', outline: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={styles.sectionTitle}>Cotizar</h2>
        <button onClick={resetCotizador} style={{ ...styles.btnSecondary, fontSize: 12 }}>Reiniciar</button>
      </div>

      {/* Origen */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Origen de la cotizacion</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode('visita')} style={{ ...styles.tab, ...(mode === 'visita' ? styles.tabActive : {}) }}>Desde visita</button>
          <button onClick={() => setMode('manual')} style={{ ...styles.tab, ...(mode === 'manual' ? styles.tabActive : {}) }}>Ingreso manual</button>
        </div>

        {mode === 'visita' && (
          realizadas.length === 0
            ? <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>No hay visitas marcadas como Realizadas aun.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {realizadas.map(v => (
                  <button key={v.id} onClick={() => setSelectedVisit(v)} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1.5px solid ' + (selectedVisit?.id === v.id ? C.orange : C.border),
                    background: selectedVisit?.id === v.id ? C.orangeLight : C.surface,
                    color: selectedVisit?.id === v.id ? C.orangeDark : C.textSub, transition: 'all .15s',
                  }}>{v.nombre} &middot; {fmtDate(v.start)}</button>
                ))}
              </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { key: 'nombre',    label: 'Nombre',    full: true, placeholder: 'Nombre completo' },
              { key: 'email',     label: 'Email',     placeholder: 'correo@ejemplo.com' },
              { key: 'celular',   label: 'Celular',   placeholder: '+56 9 XXXX XXXX' },
              { key: 'direccion', label: 'Direccion', full: true, placeholder: 'Direccion' },
            ].map(({ key, label, full, placeholder }) => (
              <div key={key} style={{ gridColumn: full ? '1 / -1' : undefined }}>
                <label style={{ ...styles.detailLabel, display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={manualCliente[key]}
                  onChange={e => setManualCliente(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ ...styles.input, fontSize: 13, padding: '8px 10px' }} />
              </div>
            ))}
          </div>
        )}

        {mode === 'visita' && selectedVisit && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + C.border, ...styles.detailGrid }}>
            {selectedVisit.email     && <><span style={styles.detailLabel}>Email</span><span style={{ fontSize: 13 }}>{selectedVisit.email}</span></>}
            {selectedVisit.celular   && <><span style={styles.detailLabel}>Celular</span><span style={{ fontSize: 13 }}>{selectedVisit.celular}</span></>}
            {selectedVisit.direccion && <><span style={styles.detailLabel}>Direccion</span><span style={{ fontSize: 13 }}>{selectedVisit.direccion}</span></>}
          </div>
        )}
      </div>

      {/* Numero de cotizacion */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Numero de Cotizacion</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textSub }}>N</span>
          <input type="number" value={cotNum}
            onChange={e => { const v = parseInt(e.target.value) || 0; setCotNum(v); setCotNumStorage(v) }}
            style={{ width: 100, padding: '8px 10px', borderRadius: 9, border: '1.5px solid ' + C.border, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', background: '#FAFAFA', outline: 'none' }} />
          <span style={{ color: C.textMuted, fontSize: 12 }}>Se incrementa automaticamente al generar</span>
        </div>
      </div>

      {/* Repisas */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Repisas</div>
        {preciosDeRespaldo && (
          <div style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 8, background: '#FFF6F6', border: '1.5px solid #D9534F', color: '#A33', fontSize: 12 }}>
            No se pudo leer la planilla de precios. Estos valores vienen del respaldo del sistema
            y pueden estar desactualizados: revisalos antes de enviar la cotizacion.
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ background: C.sidebar }}>
                {['Largo (m)', 'Prof. (m)', 'Alto (m)', 'Niveles', 'Unidades', 'Valor ($)', 'Total', ''].map(h => (
                  <th key={h} style={{ padding: '9px 8px', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.7)', textAlign: 'center', letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repisas.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <td style={{ padding: '5px 4px' }}>
                    <input type="number" value={r.l} step="0.01" onChange={e => updRep(r.id, 'l', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '5px 4px', minWidth: 90 }}>
                    <SelectOrFree options={[0.28,0.38,0.48,0.68]} value={r.p} onChange={v => updRep(r.id, 'p', v)} step={0.01} />
                  </td>
                  <td style={{ padding: '5px 4px', minWidth: 90 }}>
                    <SelectOrFree options={[2,2.5,3]} value={r.a} onChange={v => updRep(r.id, 'a', v)} step={0.1} />
                  </td>
                  <td style={{ padding: '5px 4px', minWidth: 80 }}>
                    <SelectOrFree options={[4,5,6]} value={r.n} onChange={v => updRep(r.id, 'n', v)} step={1} />
                  </td>
                  <td style={{ padding: '5px 4px' }}>
                    <input type="number" value={r.u} step="1" min="1" onChange={e => updRep(r.id, 'u', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '5px 4px' }}>
                    <input type="number" value={r.v} step="1000" onChange={e => updRep(r.id, 'v', e.target.value)}
                      title={r.v ? '' : 'Esa combinacion de medidas no esta en la tabla de precios: ingresa el valor a mano'}
                      style={r.v ? inputStyle : { ...inputStyle, borderColor: '#D9534F', background: '#FFF6F6' }} />
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: C.orangeDark, whiteSpace: 'nowrap' }}>{fmt(r.u * r.v)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                    {repisas.length > 1 && (
                      <button onClick={() => removeRepisa(r.id)}
                        style={{ background: 'none', border: '1.5px solid ' + C.border, borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: C.textMuted, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {repisas.length < 4 && (
          <button onClick={addRepisa}
            style={{ marginTop: 10, width: '100%', background: 'none', border: '2px dashed ' + C.orange + '60', color: C.orange, padding: '9px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            + Agregar repisa
          </button>
        )}
      </div>

      <Grafica3D project={project3d} onProject={setProject3d} onModulos={filasDesde3d} frameRef={frame3dRef} />

      {/* Adicionales */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Adicionales</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 90px', gap: '8px 10px', alignItems: 'center', fontSize: 13 }}>
          {['Servicio', 'Cant.', 'Precio unit.', 'Total'].map(h => (
            <span key={h} style={{ fontWeight: 700, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: .8, textAlign: h !== 'Servicio' ? 'center' : 'left' }}>{h}</span>
          ))}
          {['retiro_orden','retiro_basura','cajas','bici'].map(key => {
            const q = adicionales['qty_' + key] || 0
            const p = adicionales['precio_' + key] || 0
            const isEditingThis = editingNombre === key
            return (
              <React.Fragment key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isEditingThis
                    ? <input value={adNombres[key]} autoFocus
                        onChange={e => setAdNombres(prev => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => setEditingNombre(null)}
                        onKeyDown={e => e.key === 'Enter' && setEditingNombre(null)}
                        style={{ ...styles.input, fontSize: 13, padding: '5px 8px' }} />
                    : <span style={{ color: C.text, fontSize: 13 }}>{adNombres[key]}</span>
                  }
                  {!isEditingThis && (
                    <button type="button" onClick={() => setEditingNombre(key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2, display: 'flex', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                </div>
                <input type="number" value={q} min="0"
                  onChange={e => setAdicionales(prev => ({ ...prev, ['qty_' + key]: parseInt(e.target.value) || 0 }))}
                  style={inputStyle} />
                <input type="number" value={p} min="0" step="1000"
                  onChange={e => setAdicionales(prev => ({ ...prev, ['precio_' + key]: parseInt(e.target.value) || 0 }))}
                  style={inputStyle} />
                <span style={{ textAlign: 'center', color: q > 0 ? C.orangeDark : C.textMuted, fontSize: 13, fontWeight: q > 0 ? 700 : 400 }}>{fmt(q * p)}</span>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Totales */}
      <div style={{ ...styles.card, marginBottom: 20, background: C.orangeLight, border: '1px solid ' + C.orange + '30' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['Subtotal neto', totales.subtotal], ['IVA (19%)', totales.iva]].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: C.textSub }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.orange + '40', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: C.orangeDark }}>
            <span>Total</span><span>{fmt(totales.total)}</span>
          </div>
        </div>
      </div>

      {error && <div style={{ ...styles.errorBox, marginBottom: 14 }}>{error}</div>}

      <button onClick={handleGenerar}
        disabled={generating || (mode === 'visita' && !selectedVisit) || (mode === 'manual' && !manualCliente.nombre.trim())}
        style={{
          ...styles.btnPrimary, width: '100%', padding: '15px', fontSize: 15, borderRadius: 12, marginBottom: 14,
          opacity: (generating || (mode === 'visita' && !selectedVisit) || (mode === 'manual' && !manualCliente.nombre.trim())) ? .55 : 1,
        }}>
        {generating ? 'Generando PDF...' : 'Generar Cotizacion PDF'}
      </button>

      {pdfUrl && (
        <div style={{ ...styles.card, borderLeft: '4px solid ' + C.green }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontWeight: 700, color: autoSaved ? C.green : C.orange, marginBottom: 2, marginTop: 0 }}>
                {autoSaved ? 'PDF generado y guardado' : 'PDF generado'}
              </p>
              <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>Total: {fmt(totalInfo.total)}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleDescargar} style={styles.btnSecondary}>Descargar</button>
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                style={{ ...styles.btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Ver PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
