import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Layout and palette follow Maxi's design (Cotizacion_1443, 25-09-2026), Letter size.
const C = { brown: '#5B3A28', ink: '#2E241C', body: '#4A3D2E', muted: '#8A7A66', faint: '#9A8B76', card: '#F4F2EB', line: '#E6E1D8', amber: '#FBEFDB', amberLine: '#D8A341', amberInk: '#8A5A12', head: '#F0E6DA' };
const L = 42, R = 570, W = R - L, FOOT = 745;
const money = value => '$' + Math.round(value).toLocaleString('es-CL');
const metres = value => value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
const services = [
  ['retiro_orden', 'Retiro y orden de artículos', 40000, 'Retiramos todo lo que tengas en el espacio y lo reordenamos una vez instaladas las repisas. Si no se contrata, el área debe estar despejada antes de la instalación.'],
  ['retiro_basura', 'Retiro de basura', 30000, 'Nos llevamos muebles, cajas, escombros y todo lo que ya no necesites, para que no tengas que preocuparte de desecharlo.'],
  ['cajas', 'Cajas organizadoras', 15000, 'Cajas plásticas apilables para mantener tus artículos protegidos y bien distribuidos entre los niveles.'],
  ['bici', 'Soporte de bicicleta/ski', 20000, 'Soportes anclados al muro para que tus artículos deportivos ocupen menos espacio en el suelo.'],
];
const faq = [
  ['¿Qué pasa si las medidas varían en terreno?', 'No hay problema: llevamos el material sobredimensionado para ajustarlo perfectamente a tu espacio al momento de instalar.'],
  ['¿Las repisas son desmontables?', 'Sí. Si te cambias de domicilio puedes llevártelas contigo; te ayudamos con el proceso de desmontaje.'],
  ['¿De qué material están hechas?', 'Terciado estructural de 18 mm (idéntico al de mueblería) y pino cepillado 2×2, pensado para resistir peso y humedad.'],
  ['¿Cuánto demora la instalación?', 'En promedio, entre 1 y 2 horas dependiendo del tamaño del proyecto.'],
  ['¿Necesitan conexión eléctrica?', 'No, trabajamos con herramientas inalámbricas.'],
  ['¿Qué medios de pago aceptan?', 'Transferencia, débito o crédito. Emitimos boleta o factura según lo que necesites.'],
];
function numeric(value, fallback = 0) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error('La cotización contiene un número inválido');
  return n;
}
function imageData(src, key) {
  if (!src) return undefined;
  if (typeof src !== 'string' || src.length > 8e6 || !/^data:image\/(png|jpeg);base64,/.test(src)) throw new Error(`Imagen ${key} inválida`);
  return Buffer.from(src.split(',')[1], 'base64');
}

// Deterministic page geometry. No network, browser or office installation is required.
export async function generateQuotePdf(data, { now = new Date(), functionsDir = join(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'netlify/functions') } = {}) {
  const rows = (data.repisas || [data.repisa1, data.repisa2].filter(Boolean)).map(r => ({
    kind: r.kind, label: String(r.label || 'Rack completo').slice(0, 90),
    largo: numeric(r.largo), prof: numeric(r.prof), alto: numeric(r.alto), niveles: numeric(r.niveles), unidades: numeric(r.unidades), valor: numeric(r.valor),
  }));
  if (rows.length > 100) throw new Error('Máximo 100 repisas por cotización');
  if (rows.some(r => r.kind === 'rack' && (!Number.isSafeInteger(r.valor) || r.valor <= 0))) throw new Error('Cada rack requiere un precio neto entero positivo');
  const extras = services.map(([key, title, price, description]) => ({ key, title, description, qty: numeric(data[`qty_${key}`]), price: numeric(data[`precio_${key}`], price) }));
  const views = { isometric: imageData(data.grafica3d?.isometric, 'isometric'), top: imageData(data.grafica3d?.top, 'top') };
  const subtotal = rows.reduce((s, r) => s + r.unidades * r.valor, 0) + extras.reduce((s, r) => s + r.qty * r.price, 0);
  const iva = Math.round(subtotal * .19), total = subtotal + iva;
  const asset = name => readFileSync(join(functionsDir, 'quote-assets', name));
  const logo = asset('logo.png');

  const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true, autoFirstPage: false, info: { Title: `Cotización ${data.cot_num || ''} - Don Maxi`, Author: 'Don Maxi' } });
  const chunks = [];
  const complete = new Promise((resolve, reject) => { doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const text = (value, x, y, w, size, color = C.body, font = 'Helvetica', opts = {}) =>
    doc.font(font).fontSize(size).fillColor(color).text(String(value ?? ''), x, y, { width: w, lineGap: 2, ...opts });
  const label = (value, x, y, w = 200, color = C.muted, align = 'left') => text(value.toUpperCase(), x, y, w, 6.8, color, 'Helvetica-Bold', { characterSpacing: .8, align, lineBreak: false });
  const rule = (y, x0 = L, x1 = R) => doc.moveTo(x0, y).lineTo(x1, y).strokeColor(C.line).lineWidth(.6).stroke();
  const card = (x, y, w, h, fill = C.card, stroke = C.line) => doc.roundedRect(x, y, w, h, 7).fillAndStroke(fill, stroke);
  const fit = (bytes, x, y, w, h) => doc.image(bytes, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  const footers = [];
  function page(footer, title, subtitle) {
    doc.addPage();
    footers.push(footer);
    if (title === undefined) return;
    fit(logo, L, 28, 54, 22);
    label(`Cotización N.º ${data.cot_num || ''}`, 330, 36, R - 330, C.muted, 'right');
    rule(60);
    if (title) text(title, L, 76, W, 18, C.brown, 'Times-Bold');
    if (subtitle) text(subtitle, L, 101, W, 9, C.body);
  }
  const date = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  // Page 1: header, drawings, client, items and payment.
  page('Terciado estructural 18 mm y pino cepillado · Instalación sin conexión eléctrica · Ver servicios adicionales en pág. 2');
  fit(logo, L, 27, 62, 24);
  text(`Cotización N.º ${data.cot_num || ''}`, 330, 26, R - 330, 16, C.brown, 'Times-Bold', { align: 'right' });
  text(`Emitida ${date.format(now)} · Válida hasta ${date.format(new Date(now.getTime() + 7 * 86400000))}`, 330, 46, R - 330, 7.5, C.muted, 'Helvetica', { align: 'right' });
  doc.roundedRect(L, 60, W, 28, 6).fill(C.brown);
  text('Repisas Don Maxi — N.º 1 en Google (5,0 estrellas · 231 reseñas)', L, 69, W, 9.8, '#FFFFFF', 'Helvetica-Bold', { align: 'center' });
  // Drawings give up to 110 pt of height so a quote of about six rows still ends on page 1.
  const tableHeight = rows.reduce((h, r) => h + 23.5 + (r.kind === 'rack' ? 13 : 0), 0) + extras.filter(r => r.qty > 0).length * 23.5;
  const shrink = Math.min(110, Math.max(0, tableHeight - 47));
  // The plan frame follows the plan's own proportions (a long bodega is narrow, a square one wide);
  // the isometric frame takes the rest of a fixed 402 pt band.
  const images = Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v && doc.openImage(v)]));
  const planW = Math.round(Math.min(200, Math.max(148, (images.top ? images.top.width / images.top.height : .5) * (270 - shrink) + 12)));
  const isoW = 402 - planW - 16, isoX = 105;
  for (const [key, title, x, w] of [['isometric', 'Vista isométrica', isoX, isoW], ['top', 'Planta y medidas', isoX + isoW + 16, planW]]) {
    label(title, x, 100, w, C.muted, 'center');
    card(x, 111, w, 282 - shrink, '#FFFFFF');
    if (images[key]) fit(images[key], x + 6, 117, w - 12, 270 - shrink);
    else text('Vista no disponible', x, 248 - shrink / 2, w, 9, C.faint, 'Helvetica', { align: 'center' });
  }
  const client = [['Cliente', data.nombre, L, 118], ['Dirección', data.direccion, 170, 150], ['Teléfono', data.telefono, 330, 76], ['Correo', data.email, 414, R - 414]];
  for (const [title, value, x, w] of client) {
    label(title, x, 408 - shrink, w);
    text(value || '-', x, 421 - shrink, w, 10.5, C.ink, 'Helvetica-Bold', { ellipsis: true, height: 26, lineGap: 0 });
  }
  // Column x positions; VALOR and TOTAL are right-aligned to their end.
  const col = { largo: 52, prof: 150, alto: 226, niveles: 287, uds: 355, valorEnd: 483, totalEnd: 560 };
  let y = 452 - shrink;
  function tableHeader() {
    doc.roundedRect(L, y, W, 20, 5).fill(C.brown);
    [['Largo', col.largo], ['Profund.', col.prof], ['Alto', col.alto], ['Niveles', col.niveles], ['Uds.', col.uds]].forEach(([t, x]) => label(t, x, y + 7, 70, C.head));
    label('Valor neto', col.valorEnd - 80, y + 7, 80, C.head, 'right');
    label('Total', col.totalEnd - 80, y + 7, 80, C.head, 'right');
    y += 20;
  }
  function row(cells, value, units, heading) {
    if (y > 640) { page('Terciado estructural 18 mm y pino cepillado · Instalación sin conexión eléctrica', 'Detalle (continuación)'); y = 120; tableHeader(); }
    if (heading) { text(heading, col.largo, y + 7, 420, 8.6, C.ink, 'Helvetica-Bold'); y += 13; }
    cells.forEach(([v, x]) => text(v, x, y + 7, 80, 9, C.ink, 'Helvetica', { lineBreak: false }));
    text(money(value), col.valorEnd - 100, y + 7, 100, 9, C.ink, 'Helvetica', { align: 'right' });
    text(money(value * units), col.totalEnd - 100, y + 7, 100, 9, C.ink, 'Helvetica-Bold', { align: 'right' });
    y += 23.5; rule(y);
  }
  tableHeader();
  for (const r of rows)
    row([[metres(r.largo), col.largo], [metres(r.prof), col.prof], [metres(r.alto), col.alto], [r.niveles, col.niveles], [r.unidades, col.uds]], r.valor, r.unidades, r.kind === 'rack' ? `${r.label} · cajas incluidas` : undefined);
  // Contracted services are part of the total, so they are listed with the items.
  for (const r of extras.filter(r => r.qty > 0)) row([[r.title, col.largo], [r.qty, col.uds]], r.price, r.qty);

  if (y > 540) { page('Terciado estructural 18 mm y pino cepillado · Instalación sin conexión eléctrica', 'Resumen de cotización'); y = 110; }
  y += 14;
  card(L, y, 356, 62);
  label('Condiciones', 60, y + 14);
  text('Puede abonar un 50% antes de la instalación, o pagar el total al finalizar el trabajo. Garantía de 5 años sobre estructura e instalación.', 60, y + 28, 320, 8.6, C.body);
  text('Subtotal', 412, y + 2, 80, 8.6, C.body); text(money(subtotal), 470, y + 2, 100, 8.6, C.body, 'Helvetica', { align: 'right' });
  text('IVA (19%)', 412, y + 18, 80, 8.6, C.body); text(money(iva), 470, y + 18, 100, 8.6, C.body, 'Helvetica', { align: 'right' });
  doc.roundedRect(412, y + 34, R - 412, 28, 6).fill(C.brown);
  text('TOTAL', 424, y + 45, 60, 7.5, '#FFFFFF');
  text(money(total), 460, y + 40, 100, 14, '#FFFFFF', 'Times-Bold', { align: 'right' });
  y += 76;
  // A date instead of "48 horas": the PDF is often read days after it is sent.
  const limit = new Date(now.getTime() + 48 * 3600000), deadline = `${date.format(limit)} a las ${time.format(limit)}`;
  doc.roundedRect(L, y, W, 30, 7).fillAndStroke(C.amber, C.amberLine);
  text(`Acéptala dentro de 48 horas (hasta el ${deadline}) y obtén 10% de descuento adicional`, L, y + 10, W, 9, C.amberInk, 'Helvetica-Bold', { align: 'center' });
  y += 42;
  card(L, y, W, 68);
  label('Transferencia', 60, y + 16);
  text('Don Maxi SPA · 77.386.684-8\nBanco BCI Cta. Corriente 13702807\nrepisasdonmaxi@gmail.com', 60, y + 30, 250, 8.6, C.body);
  doc.moveTo(305, y + 14).lineTo(305, y + 54).strokeColor(C.line).lineWidth(.6).stroke();
  // A payment link is included only when an explicit valid HTTPS URL is supplied.
  const payUrl = typeof data.payment_url === 'string' && /^https:\/\//.test(data.payment_url) ? data.payment_url : undefined;
  label(payUrl ? 'Link de pago' : 'Otros medios de pago', 322, y + 16);
  text('Débito o crédito, hasta 3 cuotas sin interés.', 322, y + 30, 230, 8.6, C.body);
  if (payUrl) text('Pagar cotización »', 322, y + 46, 230, 9, C.ink, 'Helvetica-Bold', { link: payUrl, underline: true });

  // Page 2: optional services, gross prices shown next to net.
  page('Consulta disponibilidad de cada servicio según tu comuna', 'Servicios adicionales', 'Puedes sumarlos a tu cotización si los necesitas. Precio neto y total con IVA incluido.');
  extras.forEach((r, i) => {
    const cy = 125 + i * 150;
    card(L, cy, W, 136);
    text(r.title, 58, cy + 30, 240, 12.8, C.ink, 'Times-Bold');
    text(`neto ${money(r.price)}`, 290, cy + 30, 100, 7.9, C.muted, 'Helvetica', { align: 'right' });
    text(money(Math.round(r.price * 1.19)), 290, cy + 41, 100, 12.8, C.brown, 'Times-Bold', { align: 'right' });
    text(r.description, 58, cy + 62, 330, 9, C.body);
    doc.save().roundedRect(406, cy + 12, 150, 112, 6).clip();
    doc.image(asset(`servicio-${r.key}.jpg`), 406, cy + 12, { cover: [150, 112], align: 'center', valign: 'center' });
    doc.restore();
  });

  // Page 3: gallery.
  page('Terciado estructural 18 mm y pino cepillado 2×2', 'Galería de trabajos', 'Algunos proyectos que hemos instalado.');
  text('Ver portafolio completo » www.donmaxi.cl/galeria', 300, 103, R - 300, 9, C.brown, 'Helvetica-Bold', { align: 'right', link: 'https://www.donmaxi.cl/galeria' });
  fit(asset('galeria.jpg'), L, 130, W, 600);

  // Page 4: FAQ.
  page('¿Otra duda? Escríbenos por WhatsApp', 'Preguntas frecuentes');
  y = 112;
  for (const [q, a] of faq) {
    text(q, L, y, W, 10.5, C.ink, 'Times-Bold');
    text(a, L, y + 17, W, 9, C.body);
    y = doc.y + 12; rule(y); y += 12;
  }

  const count = doc.bufferedPageRange().count;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(i); rule(FOOT);
    text(footers[i], L, FOOT + 9, 460, 7.9, C.faint, 'Helvetica', { lineBreak: false });
    text(`${i + 1} de ${count}`, 500, FOOT + 9, R - 500, 7.9, C.faint, 'Helvetica', { align: 'right', lineBreak: false });
  }
  doc.end();
  return { bytes: await complete, subtotal, iva, total };
}
