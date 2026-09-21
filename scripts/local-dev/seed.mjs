// Local-only seed data for the mini ERP. Nothing here touches Google Calendar/Sheets.
const TZ = '-03:00'

function iso(day, time) { return `2026-09-${String(day).padStart(2, '0')}T${time}:00${TZ}` }

export const SEED_VISITS = [
  {
    id: 'visit-local-001', nombre: 'Alejandro de Jesús Moreno Tapia',
    email: 'alejandro.moreno@example.cl', celular: '+56 9 8123 4567',
    direccion: 'Av. Los Leones 1420, depto 703', comuna: 'Providencia',
    start: iso(6, '10:00'), end: iso(6, '11:00'),
    notas: 'Closet principal, cliente quiere 4 niveles.',
    status: 'realizada',
    measurements: { projectName: 'Closet principal Moreno', wallACm: 240, wallBAndECm: 200, wallCCm: 80, wallDCm: 80, roomHeightCm: 250, shape: 'single-wall', wallSelection: 'A', depthCm: 48 },
  },
  {
    id: 'visit-local-002', nombre: 'Carolina Fuentes Vergara',
    email: 'carolina.fuentes@example.cl', celular: '+56 9 7654 3210',
    direccion: 'Pasaje Los Aromos 355', comuna: 'Ñuñoa',
    start: iso(7, '12:30'), end: iso(7, '13:30'),
    notas: 'Walk-in closet en L, dos muros.',
    status: 'realizada',
    measurements: { projectName: 'Walk-in Fuentes', wallACm: 220, wallBAndECm: 200, wallCCm: 90, wallDCm: 90, roomHeightCm: 300, shape: 'L', wallSelection: 'A+B', depthCm: 38 },
  },
  {
    id: 'visit-local-003', nombre: 'Rodrigo Palma Soto',
    email: 'rodrigo.palma@example.cl', celular: '+56 9 5544 3322',
    direccion: 'Camino El Alba 9021', comuna: 'Las Condes',
    start: iso(8, '16:00'), end: iso(8, '17:00'),
    notas: 'Repisas de despensa, profundidad menor.',
    status: 'realizada',
    measurements: { projectName: 'Despensa Palma', wallACm: 180, wallBAndECm: 150, wallCCm: 60, wallDCm: 60, roomHeightCm: 250, shape: 'single-wall', wallSelection: 'A', depthCm: 28 },
  },
  {
    id: 'visit-local-004', nombre: 'María José Contreras Lillo',
    email: 'mj.contreras@example.cl', celular: '+56 9 2211 8899',
    direccion: 'Los Militares 5400, of. 12', comuna: 'Vitacura',
    start: iso(12, '11:00'), end: iso(12, '12:00'),
    notas: 'Agendada, aún sin realizar.',
    status: 'agendada',
    measurements: { projectName: 'Oficina Contreras', wallACm: 260, wallBAndECm: 210, wallCCm: 80, wallDCm: 80, roomHeightCm: 250, shape: 'single-wall', wallSelection: 'A', depthCm: 48 },
  },
  {
    id: 'visit-local-005', nombre: 'Sebastián Núñez Riquelme',
    email: 'sebastian.nunez@example.cl', celular: '+56 9 3344 5566',
    direccion: 'Gran Avenida 8120', comuna: 'La Cisterna',
    start: iso(13, '09:30'), end: iso(13, '10:30'),
    notas: 'Pendiente de declarar resultado.',
    status: 'pendiente',
    measurements: { projectName: 'Bodega Núñez', wallACm: 200, wallBAndECm: 180, wallCCm: 70, wallDCm: 70, roomHeightCm: 350, shape: 'single-wall', wallSelection: 'A', depthCm: 68 },
  },
]

export function visitToApiShape(v) {
  return {
    id: v.id,
    summary: `Visita — ${v.nombre} (${v.comuna})`,
    start: v.start, end: v.end,
    email: v.email, celular: v.celular,
    direccion: v.direccion, comuna: v.comuna,
    notas: v.notas,
    measurements: v.measurements,
    slotKey: `${v.start}|${v.id}`,
    nombre: v.nombre,
    status: v.status,
  }
}

export const SEED_QUOTES = [
  {
    cotNum: '1476', nombre: 'Patricia Herrera Bravo', email: 'patricia.herrera@example.cl',
    telefono: '+56 9 9090 1010', direccion: 'Irarrázaval 2900', fechaVisita: iso(1, '10:00'),
    subtotal: 210000, iva: 39900, total: 249900, status: 'confirmada', motivoRechazo: '',
    notas: 'Cotización histórica de ejemplo.',
    repisas: [{ descripcion: 'Módulo 243 × 48 × 200 cm, 4 niveles', unidades: 1, valor: 130000, total: 130000 }],
    adicionales: { 'svc-instalacion': { descripcion: 'Instalación', cantidad: 1, precio: 80000 } },
    creado: '01-09-2026 10:12:00', pdfUrl: '', visitId: '', quote3dId: '', quoteVersion: '',
    configurationSha256: '', pdfSha256: '',
  },
  {
    cotNum: '1477', nombre: 'Ignacio Vera Salas', email: 'ignacio.vera@example.cl',
    telefono: '+56 9 4455 6677', direccion: 'Manquehue Sur 520', fechaVisita: iso(3, '15:00'),
    subtotal: 140000, iva: 26600, total: 166600, status: 'por confirmar', motivoRechazo: '',
    notas: 'Esperando respuesta del cliente.',
    repisas: [{ descripcion: 'Módulo 180 × 40 × 200 cm, 4 niveles', unidades: 1, valor: 140000, total: 140000 }],
    adicionales: {}, creado: '03-09-2026 15:40:00', pdfUrl: '', visitId: '', quote3dId: '',
    quoteVersion: '', configurationSha256: '', pdfSha256: '',
  },
]

export const SEED_INSTALLATIONS = [
  {
    id: 'inst-local-001', nombre: 'Patricia Herrera Bravo', cotNum: '1476',
    email: 'patricia.herrera@example.cl', summary: 'Instalación — Patricia Herrera Bravo (Ñuñoa)',
    start: iso(20, '09:00'), end: iso(20, '13:00'), link: '',
    telefono: '+56 9 9090 1010', direccion: 'Irarrázaval 2900',
    subtotalRepisas: 130000, subtotalAdicionales: 80000, total: 249900,
    estado: 'confirmada', motivoCancelacion: '', pago: 'Pendiente',
    ajusteMonto: 0, ajusteNota: '', adicionalesJSON: '',
  },
]
