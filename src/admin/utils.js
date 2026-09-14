export const ADMIN_PASSWORD = '2003'
export const SESSION_KEY = 'dm_admin_auth'

export const VISIT_STATUS_LABELS = {
  agendada:           { label: 'Agendada',              color: '#3B82F6' },
  pendiente:          { label: 'Pendiente de declarar', color: '#F59E0B' },
  realizada:          { label: 'Realizada',             color: '#10B981' },
  realizada_cotizada: { label: 'Realizada y cotizada',  color: '#8B5CF6' },
  cancelada:          { label: 'Cancelada',             color: '#EF4444' },
  reagendar:          { label: 'Reagendar',             color: '#F97316' },
}

export const QUOTE_STATUS_LABELS = {
  'por confirmar': { label: 'Por confirmar', color: '#F59E0B' },
  'confirmada':    { label: 'Confirmada',    color: '#10B981' },
  'rechazada':     { label: 'Rechazada',     color: '#EF4444' },
}

export const SECTIONS = [
  { id: 'inicio',       label: 'Inicio',       icon: 'home'  },
  { id: 'visitas',      label: 'Visitas',      icon: 'calendar' },
  { id: 'cotizador',    label: 'Cotizar',      icon: 'doc'   },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: 'files' },
]

export const DEFAULTS_REPISA = { l: 2.43, p: 0.48, a: 2, n: 4, u: 1, v: 130000 }

export function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('es-CL', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'America/Santiago',
    }).format(new Date(iso))
  } catch { return iso }
}

export function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
    }).format(new Date(iso))
  } catch { return '' }
}

export function fmt(n) {
  return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': ADMIN_PASSWORD,
      ...(opts.headers || {}),
    },
  })
  return res.json()
}

// Design tokens
const C = {
  orange:      '#F47920',
  orangeDark:  '#D4600A',
  orangeLight: '#FFF4EC',
  bg:          '#F4F5F7',
  surface:     '#FFFFFF',
  border:      '#E8E8EC',
  text:        '#111827',
  textSub:     '#6B7280',
  textMuted:   '#9CA3AF',
  green:       '#10B981',
  red:         '#EF4444',
  yellow:      '#F59E0B',
  blue:        '#3B82F6',
  purple:      '#8B5CF6',
  sidebar:     '#18181B',
  sidebarHover:'#27272A',
}

export { C }

export const styles = {
  sectionTitle: {
    margin: 0, fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.3px',
  },
  card: {
    background: C.surface,
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 1px 4px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)',
  },
  cardLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.textMuted,
    textTransform: 'uppercase', marginBottom: 14,
  },
  tab: {
    padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`,
    background: C.surface, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: C.textSub, transition: 'all .15s',
  },
  tabActive: {
    background: C.orange, borderColor: C.orange, color: 'white',
    boxShadow: '0 2px 8px rgba(244,121,32,.35)',
  },
  btnPrimary: {
    background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
    color: 'white', border: 'none', borderRadius: 9, padding: '9px 20px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(244,121,32,.3)',
    transition: 'opacity .15s',
  },
  btnSecondary: {
    background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.textSub,
    cursor: 'pointer', transition: 'background .15s',
  },
  empty:    { textAlign: 'center', color: C.textMuted, fontSize: 14, padding: '48px 0' },
  errorBox: {
    background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10,
    padding: '12px 16px', color: '#B91C1C', fontSize: 13, marginBottom: 16,
  },
  detailGrid: {
    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 18px',
  },
  detailLabel: {
    color: C.textMuted, fontWeight: 700, fontSize: 10.5,
    textTransform: 'uppercase', letterSpacing: '.6px', alignSelf: 'center',
    whiteSpace: 'nowrap',
  },
  input: {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: `1.5px solid ${C.border}`, fontSize: 14,
    boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
    color: C.text, background: '#FAFAFA',
    transition: 'border-color .15s',
  },
  badge: (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 99,
    fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase',
    background: color + '18', color: color,
    border: `1px solid ${color}30`,
  }),
}
