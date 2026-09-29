import React, { useEffect, useState, useCallback } from 'react'
import { QUOTE_STATUS_LABELS, C, apiFetch, fmt, fmtDate, styles, DEFAULTS_REPISA } from './utils.js'

const MOTIVOS_RECHAZO = ['Precio alto', 'Sin respuesta', 'Eligio otro proveedor', 'Otro']

function Badge({ status }) {
  const s = QUOTE_STATUS_LABELS[status] || QUOTE_STATUS_LABELS['por confirmar']
  return <span style={styles.badge(s.color)}>{s.label}</span>
}

function driveFileId(url) {
  if (!url) return ''
  const m = url.match(/\/d\/([^/]+)/)
  return m ? m[1] : ''
}

export default function CotizacionesSection() {
  const [quotes, setQuotes]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [tab, setTab]                   = useState('por confirmar')
  const [updating, setUpdating]         = useState(null)
  const [expanded, setExpanded]         = useState(null)
  const [rechazandoId, setRechazandoId] = useState(null)
  const [motivoSelec, setMotivoSelec]   = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [editRepisas, setEditRepisas]   = useState([])
  const [editAd, setEditAd]             = useState({})
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(null)
  const [confirmDel, setConfirmDel]     = useState(null)
  const [buscar, setBuscar]             = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const quotesData = await apiFetch('/.netlify/functions/get-quotes')
      if (quotesData.ok) setQuotes(quotesData.quotes)
      else setError(quotesData.error || 'Error')
    } catch { setError('No se pudo conectar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(quote, newStatus, motivo) {
    setUpdating(quote.cotNum)
    try {
      await apiFetch('/.netlify/functions/save-quote', {
        method: 'POST',
        body: JSON.stringify({ ...quote, status: newStatus, motivoRechazo: motivo || '' }),
      })
      setQuotes(prev => prev.map(q => q.cotNum === quote.cotNum
        ? { ...q, status: newStatus, motivoRechazo: motivo || '' } : q))
    } catch { alert('Error al actualizar') }
    finally { setUpdating(null) }
  }

  async function handleDelete(cotNum) {
    setDeleting(cotNum)
    try {
      await apiFetch('/.netlify/functions/delete-quote', { method: 'POST', body: JSON.stringify({ cotNum }) })
      setQuotes(prev => prev.filter(q => q.cotNum !== cotNum))
      setConfirmDel(null); setExpanded(null)
    } catch { alert('Error al borrar') }
    finally { setDeleting(null) }
  }

  function startEditing(quote) {
    setEditingId(quote.cotNum)
    setEditRepisas(quote.repisas && quote.repisas.length
      ? quote.repisas.map((r, i) => ({ ...r, id: i }))
      : [{ ...DEFAULTS_REPISA, id: 0 }])
    setEditAd(quote.adicionales || {})
  }

  async function saveEdit(quote) {
    if (editRepisas.some(r => r.kind === 'rack' && (!Number.isSafeInteger(r.valor) || r.valor <= 0))) return alert('Ingresa un precio neto entero positivo para cada rack.')
    setSaving(true)
    try {
      await apiFetch('/.netlify/functions/save-quote', {
        method: 'POST',
        body: JSON.stringify({ ...quote, repisas: editRepisas, adicionales: editAd }),
      })
      setQuotes(prev => prev.map(q => q.cotNum === quote.cotNum
        ? { ...q, repisas: editRepisas, adicionales: editAd } : q))
      setEditingId(null)
    } catch (e) { alert('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  const TABS = [
    { key: 'por confirmar', label: 'Por confirmar', color: C.yellow },
    { key: 'confirmada',    label: 'Confirmadas',   color: C.green  },
    { key: 'rechazada',     label: 'Rechazadas',    color: C.red    },
  ]

  const counts = {
    'por confirmar': quotes.filter(q => q.status === 'por confirmar').length,
    'confirmada':    quotes.filter(q => q.status === 'confirmada').length,
    'rechazada':     quotes.filter(q => q.status === 'rechazada').length,
  }

  const bq = buscar.trim().toLowerCase()
  const filtered = quotes
    .filter(q => q.status === tab)
    .filter(q => !bq || (q.nombre || '').toLowerCase().includes(bq))
    .sort((a, b) => new Date(b.creado || 0) - new Date(a.creado || 0))

  const canEdit = tab === 'por confirmar' || tab === 'confirmada'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={styles.sectionTitle}>Cotizaciones</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre..."
            style={{ ...styles.input, width: 190, padding: '7px 12px', fontSize: 13 }}
          />
          <button onClick={load} style={styles.btnSecondary}>Actualizar</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            ...styles.tab,
            ...(tab === t.key ? { background: t.color, borderColor: t.color, color: 'white', boxShadow: '0 2px 8px ' + t.color + '40' } : {}),
          }}>
            {t.label}
            <span style={{
              marginLeft: 7, padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: tab === t.key ? 'rgba(255,255,255,.25)' : C.bg,
              color: tab === t.key ? 'white' : C.textMuted,
            }}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {loading && <div style={styles.empty}>Cargando cotizaciones...</div>}
      {error   && <div style={styles.errorBox}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={styles.empty}>
          {buscar ? 'Sin resultados para "' + buscar + '".' : 'No hay cotizaciones en esta seccion.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(q => {
          const isExp  = expanded === q.cotNum
          const isEdit = editingId === q.cotNum
          const isUpd  = updating === q.cotNum
          const borderColor = QUOTE_STATUS_LABELS[q.status]?.color || C.border

          return (
            <div key={q.cotNum} style={{ ...styles.card, borderLeft: '3px solid ' + borderColor }}>
              {/* Header */}
              <div
                onClick={() => !isEdit && setExpanded(isExp ? null : q.cotNum)}
                style={{ cursor: isEdit ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{q.nombre}</span>
                    <Badge status={q.status} />
                  </div>
                  <div style={{ fontSize: 13, color: C.textSub }}>
                    <span style={{ marginRight: 8, color: C.textMuted, fontWeight: 600 }}>N{q.cotNum}</span>
                    <span style={{ fontWeight: 700, color: C.orangeDark }}>{fmt(q.total)}</span>
                    {q.direccion && <span style={{ marginLeft: 10, color: C.textMuted }}>{q.direccion}</span>}
                  </div>
                </div>
                {!isEdit && (
                  <div style={{ color: C.textMuted, transition: 'transform .2s', transform: isExp ? 'rotate(180deg)' : 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                )}
              </div>

              {/* Formulario de edicion */}
              {isEdit && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid ' + C.border }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Repisas</div>
                  {editRepisas.map((r, i) => (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 8 }}>
                      {r.kind === 'rack' && <strong style={{gridColumn:'1 / -1',fontSize:12}}>{r.label} · cajas incluidas · medidas fijas</strong>}
                      {['largo','prof','alto','niveles','unidades','valor'].map(field => (
                        <div key={field}>
                          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2, textTransform: 'uppercase' }}>{field}</div>
                          <input
                            type="number"
                            readOnly={r.kind === 'rack' && field !== 'valor'}
                            value={r[field] ?? r[field[0]] ?? 0}
                            style={{ ...styles.input, padding: '5px 6px', fontSize: 12 }}
                            onChange={e => setEditRepisas(prev => prev.map((x, j) => j === i ? { ...x, [field]: parseFloat(e.target.value) || 0 } : x))}
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8, marginTop: 12, letterSpacing: 1 }}>Adicionales</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 80px 120px', gap: '6px 12px', alignItems: 'center', fontSize: 13 }}>
                    {['retiro_orden','retiro_basura','cajas','bici'].map(k => (
                      <React.Fragment key={k}>
                        <span style={{ color: C.textSub }}>{k.replace(/_/g,' ')}</span>
                        <input type="number" value={editAd['qty_'+k] || 0}
                          style={{ ...styles.input, padding: '5px', fontSize: 12, textAlign: 'center' }}
                          onChange={e => setEditAd(prev => ({ ...prev, ['qty_'+k]: parseInt(e.target.value)||0 }))} />
                        <input type="number" value={editAd['precio_'+k] || 0} step={1000}
                          style={{ ...styles.input, padding: '5px', fontSize: 12, textAlign: 'center' }}
                          onChange={e => setEditAd(prev => ({ ...prev, ['precio_'+k]: parseInt(e.target.value)||0 }))} />
                      </React.Fragment>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => saveEdit(q)} disabled={saving}
                      style={{ ...styles.btnPrimary, fontSize: 13 }}>
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => setEditingId(null)} style={styles.btnSecondary}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Detalle expandido */}
              {isExp && !isEdit && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid ' + C.border }}>
                  {/* Info del cliente */}
                  <div style={{ ...styles.detailGrid, marginBottom: 14 }}>
                    {q.email    && <><span style={styles.detailLabel}>Email</span><span style={{ fontSize: 13 }}>{q.email}</span></>}
                    {q.telefono && <><span style={styles.detailLabel}>Tel</span><span style={{ fontSize: 13 }}>{q.telefono}</span></>}
                    {q.fechaVisita && <><span style={styles.detailLabel}>Visita</span><span style={{ fontSize: 13 }}>{fmtDate(q.fechaVisita)}</span></>}
                    {q.subtotal > 0 && <><span style={styles.detailLabel}>Subtotal</span><span style={{ fontSize: 13 }}>{fmt(q.subtotal)}</span></>}
                    {q.iva      > 0 && <><span style={styles.detailLabel}>IVA</span><span style={{ fontSize: 13 }}>{fmt(q.iva)}</span></>}
                    {q.total    > 0 && <><span style={styles.detailLabel}>Total</span><span style={{ fontSize: 13, fontWeight: 700, color: C.orangeDark }}>{fmt(q.total)}</span></>}
                    {q.motivoRechazo && <><span style={styles.detailLabel}>Motivo</span><span style={{ fontSize: 13, color: C.red }}>{q.motivoRechazo}</span></>}
                  </div>

                  {/* PDF */}
                  {q.pdfUrl && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <a href={q.pdfUrl} target="_blank" rel="noreferrer"
                        style={{ ...styles.btnPrimary, fontSize: 12, padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Ver PDF
                      </a>
                      <a href={'https://drive.google.com/uc?export=download&id=' + driveFileId(q.pdfUrl)}
                        style={{ ...styles.btnSecondary, fontSize: 12, padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Descargar
                      </a>
                    </div>
                  )}

                  {/* Cambio de estado */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: rechazandoId === q.cotNum ? 10 : 0 }}>
                    <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>Estado</span>
                    {Object.entries(QUOTE_STATUS_LABELS).map(([key, val]) => (
                      <button key={key}
                        onClick={() => {
                          if (key === 'rechazada') { setRechazandoId(q.cotNum); setMotivoSelec('') }
                          else updateStatus(q, key)
                        }}
                        disabled={isUpd || q.status === key}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: q.status === key ? 'default' : 'pointer',
                          border: '1.5px solid ' + (q.status === key ? val.color : C.border),
                          background: q.status === key ? val.color + '18' : C.surface,
                          color: q.status === key ? val.color : C.textSub,
                          opacity: isUpd ? .5 : 1,
                        }}>
                        {val.label}
                      </button>
                    ))}
                    {canEdit && (
                      <button onClick={() => startEditing(q)}
                        style={{ ...styles.btnSecondary, fontSize: 12, padding: '6px 14px', marginLeft: 4 }}>
                        Editar
                      </button>
                    )}
                  </div>

                  {/* Motivo de rechazo */}
                  {rechazandoId === q.cotNum && (
                    <div style={{ background: C.red + '0A', border: '1px solid ' + C.red + '30', borderRadius: 10, padding: 14, marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 10 }}>Motivo del rechazo (opcional)</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {MOTIVOS_RECHAZO.map(m => (
                          <button key={m} onClick={() => setMotivoSelec(m)} style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            border: '1.5px solid ' + (motivoSelec === m ? C.red : C.border),
                            background: motivoSelec === m ? C.red + '18' : C.surface,
                            color: motivoSelec === m ? C.red : C.textSub,
                          }}>{m}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { updateStatus(q, 'rechazada', motivoSelec); setRechazandoId(null) }}
                          style={{ ...styles.btnPrimary, fontSize: 12, padding: '7px 16px', background: C.red, boxShadow: 'none' }}>
                          Confirmar rechazo
                        </button>
                        <button onClick={() => setRechazandoId(null)} style={styles.btnSecondary}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {/* Eliminar */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
                    {confirmDel === q.cotNum ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>Confirmar eliminacion?</span>
                        <button onClick={() => handleDelete(q.cotNum)} disabled={deleting === q.cotNum}
                          style={{ ...styles.btnPrimary, background: C.red, boxShadow: 'none', fontSize: 12, padding: '6px 14px' }}>
                          {deleting === q.cotNum ? 'Borrando...' : 'Si, borrar'}
                        </button>
                        <button onClick={() => setConfirmDel(null)} style={{ ...styles.btnSecondary, fontSize: 12, padding: '6px 14px' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(q.cotNum)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, fontWeight: 600, padding: 0 }}>
                        Eliminar cotizacion
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
