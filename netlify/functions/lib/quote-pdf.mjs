import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Geometry, texts and palette follow Maxi's handoff (cotizador.zip, 25-09-2026:
// plantilla_cotizacion.html + datos_ejemplo.json), measured in points from his rendered PDF. Letter size.
const C = { accent: '#5B3A29', ink: '#2E241C', body: '#4A3D2E', sub: '#6B5B47', muted: '#8A7A66', faint: '#9A8B76', card: '#F5F2EC', cardLine: '#ECE6DC', frame: '#E7E1D8', rowLine: '#EDE9E2', head: '#F0E6DA', amber: '#FBF0DC', amberLine: '#D9A441', amberInk: '#8A5A12' };
const L = 42, R = 570, W = R - L, FOOT = 751.8;
const F = { serif: 'Lora-Bold', sans: 'Poppins', bold: 'Poppins-Bold' };
const money = value => '$' + Math.round(value).toLocaleString('es-CL');
const metres = value => (Number.isInteger(value) ? String(value) : value.toFixed(2)) + ' m';
const MARCA = { razonSocial: 'Don Maxi SPA', rut: '77.386.684-8', banco: 'Banco BCI', tipoCuenta: 'Corriente', numeroCuenta: '13702807', rating: '5.0', resenas: '231', linkPago: 'https://link.mercadopago.cl/repisasdonmaxi', galeriaUrl: 'www.donmaxi.cl/galeria' };
const CONDICIONES = 'Puede abonar un 50% antes de la instalación, o pagar el total al finalizar el trabajo. Garantía de 5 años sobre estructura e instalación.';
const services = [
  ['retiro_orden', 'Retiro y orden de artículos', 40000, 'Retiramos todo lo que tengas en el espacio y lo reordenamos una vez instaladas las repisas. Si no se contrata, el área debe estar despejada antes de la instalación.'],
  ['retiro_basura', 'Retiro de basura', 30000, 'Nos llevamos muebles, cajas, escombros y todo lo que ya no necesites, para que no tengas que preocuparte de desecharlo.'],
  ['cajas', 'Cajas organizadoras', 15000, 'Cajas plásticas apilables para mantener tus artículos protegidos y bien distribuidos entre los niveles.'],
  ['bici', 'Soporte de bicicleta/ski', 20000, 'Soportes anclados al muro para que tus artículos deportivos ocupen menos espacio en el suelo.'],
];
const faq = [
  ['¿Qué pasa si las medidas varían en terreno?', 'No hay problema: llevamos el material sobredimensionado para ajustarlo perfectamente a tu espacio al momento de instalar.'],
  ['¿Las repisas son desmontables?', 'Sí. Si te cambias de domicilio puedes llevártelas contigo — te ayudamos con el proceso de desmontaje.'],
  ['¿De qué material están hechas?', 'Terciado estructural de 18mm (idéntico al de mueblería) y pino cepillado 2×2, pensado para resistir peso y humedad.'],
  ['¿Cuánto demora la instalación?', 'En promedio, entre 1 y 2 horas dependiendo del tamaño del proyecto.'],
  ['¿Necesitan conexión eléctrica?', 'No, trabajamos con herramientas inalámbricas.'],
  ['¿Qué medios de pago aceptan?', 'Transferencia, débito o crédito. Emitimos boleta o factura según lo que necesites.'],
];
const FOOTER_MATERIAL = 'Terciado estructural 18mm y pino cepillado · Instalación sin conexión eléctrica';
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
  // Lora and Poppins are what Maxi's PDF renders with (SIL OFL, licences next to the files).
  doc.registerFont(F.serif, asset('fonts/Lora-Bold.ttf'));
  doc.registerFont(F.sans, asset('fonts/Poppins-Regular.ttf'));
  doc.registerFont(F.bold, asset('fonts/Poppins-Bold.ttf'));
  const chunks = [];
  const complete = new Promise((resolve, reject) => { doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const text = (value, x, y, w, size, color = C.body, font = F.sans, opts = {}) =>
    doc.font(font).fontSize(size).fillColor(color).text(String(value ?? ''), x, y, { width: w, lineGap: 0, ...opts });
  const widthOf = (value, size, font = F.sans, opts = {}) => doc.font(font).fontSize(size).widthOfString(String(value ?? ''), opts);
  const LABEL = { characterSpacing: .74 };
  const label = (value, x, y, w = 200, color = C.muted, align = 'left') => text(value.toUpperCase(), x, y, w, 6.75, color, F.bold, { ...LABEL, align, lineBreak: false });
  const rule = (y, color = C.frame, x0 = L, x1 = R) => doc.moveTo(x0, y).lineTo(x1, y).strokeColor(color).lineWidth(.75).stroke();
  const box = (x, y, w, h, fill, stroke, r = 7.5) => { doc.roundedRect(x, y, w, h, r); stroke ? doc.lineWidth(.75).fillAndStroke(fill, stroke) : doc.fill(fill); };
  const fit = (bytes, x, y, w, h) => doc.image(bytes, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  // Lora and Poppins have no ★, ⏰ or → glyphs (Maxi's render borrowed them from fallback fonts): drawn as vectors.
  const star = (x, y, s, color) => {
    const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .2 : s * .5; return [x + s / 2 + r * Math.cos(a), y + s / 2 + r * Math.sin(a)]; });
    doc.polygon(...pts).fill(color);
  };
  const clock = (x, y, s, color) => {
    doc.circle(x + s / 2, y + s / 2, s * .42).lineWidth(1).stroke(color);
    doc.moveTo(x + s / 2, y + s * .28).lineTo(x + s / 2, y + s / 2).lineTo(x + s * .68, y + s * .6).lineWidth(1).stroke(color);
  };
  const arrow = (x, y, s, color) => {
    doc.moveTo(x, y + s / 2).lineTo(x + s * .8, y + s / 2).moveTo(x + s * .5, y + s * .25).lineTo(x + s * .8, y + s / 2).lineTo(x + s * .5, y + s * .75).lineWidth(1).stroke(color);
  };
  // Text with a drawn glyph between two parts, laid out as one run.
  function withIcon(before, icon, after, x, y, size, color, font, align = 'left', w = W) {
    // Like a glyph in the run: a thin space on each side that touches text.
    const s = size * 1.05, pad = size * .28, padBefore = before && !before.endsWith('(') ? pad : 0, iconW = padBefore + s + (after ? pad : 0);
    const total = widthOf(before, size, font) + iconW + widthOf(after, size, font);
    let cx = align === 'center' ? x + (w - total) / 2 : align === 'right' ? x + w - total : x;
    if (before) { text(before, cx, y, total, size, color, font, { lineBreak: false }); cx += widthOf(before, size, font) + padBefore; }
    icon(cx, y + size * .08, s, color);
    cx += s + (after ? pad : 0);
    if (after) text(after, cx, y, total, size, color, font, { lineBreak: false });
  }
  const footers = [];
  function page(footer, title, subtitle, titleSize = 18) {
    doc.addPage();
    footers.push(footer);
    if (title === undefined) return;
    fit(logo, L, 30, 50.5, 19.5);
    label(`Cotización N.º ${data.cot_num || ''}`, 330, 35, R - 330, C.muted, 'right');
    rule(60);
    if (title) text(title, L, 71.2, W, titleSize, C.accent, F.serif);
    if (subtitle) text(subtitle, L, 97.3, W, 9.75, C.sub);
  }
  const fecha = d => new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d).filter(p => p.type !== 'literal').map(p => p.value).join('/');

  // Page 1: header, drawings, client, items and payment.
  page(`${FOOTER_MATERIAL} · Ver servicios adicionales en pág. 2`);
  fit(logo, L, 26.8, 62, 24);
  text(`Cotización N.º ${data.cot_num || ''}`, 330, 25.5, R - 330, 12, C.accent, F.serif, { align: 'right' });
  text(`Válida hasta ${fecha(new Date(now.getTime() + 7 * 86400000))}`, 330, 41.6, R - 330, 7.5, C.muted, F.sans, { align: 'right' });
  box(L, 60.4, W, 28.8, C.accent, undefined, 6);
  withIcon('Repisas Don Maxi — N.º 1 en Google (', star, `${MARCA.rating} · ${MARCA.resenas} reseñas)`, L, 68.7, 9.75, '#FFFFFF', F.bold, 'center');
  // Drawings give up to 110 pt of height so a quote of about six rows still ends on page 1.
  const tableHeight = rows.reduce((h, r) => h + 23.85 + (r.kind === 'rack' ? 13 : 0), 0) + extras.filter(r => r.qty > 0).length * 23.85;
  const shrink = Math.min(110, Math.max(0, tableHeight - 47.7));
  // Maxi's frames: 227 x 283 pt isometric and 160 x 283 pt plan, centred. The plan frame follows the
  // plan's own proportions (a long bodega is narrow, a square one wide); the isometric takes the rest.
  const images = Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v && doc.openImage(v)]));
  const imgH = 270 - shrink;
  const planW = Math.round(Math.min(200, Math.max(148, (images.top ? images.top.width / images.top.height : .55) * imgH + 13)) * 10) / 10;
  const isoW = 402.8 - 15 - planW, isoX = (612 - 402.8) / 2;
  for (const [key, title, x, w] of [['isometric', 'Vista isométrica', isoX, isoW], ['top', 'Planta y medidas', isoX + isoW + 15, planW]]) {
    label(title, x, 97.4, w, C.muted, 'center');
    box(x, 110.6, w, 282.8 - shrink, '#FFFFFF', C.frame, 10.5);
    if (images[key]) fit(images[key], x + 6.5, 117, w - 13, imgH);
    else text('Vista no disponible', x, 248 - shrink / 2, w, 9, C.faint, F.sans, { align: 'center' });
  }
  // Client fields are spread like the template's flex row: each as wide as its content, equal gaps.
  const client = [['Cliente', data.nombre], ['Dirección', data.direccion], ['Teléfono', data.telefono], ['Correo', data.email]]
    .map(([title, value]) => ({ title, value: String(value || '-').slice(0, 60), w: Math.max(widthOf(title.toUpperCase(), 6.75, F.bold, LABEL), widthOf(value || '-', 10.5, F.bold)) }));
  const used = client.reduce((s, c) => s + c.w, 0);
  // Long values would overflow the row; they share the width proportionally instead.
  const scale = Math.min(1, (W - 3 * 13.5) / used), gapX = used * scale < W ? (W - used * scale) / 3 : 13.5;
  let cx = L;
  for (const c of client) {
    const w = c.w * scale;
    label(c.title, cx, 407.1 - shrink, w + 2);
    text(c.value, cx, 419.9 - shrink, w + 2, 10.5, C.ink, F.bold, { ellipsis: true, height: 14, lineBreak: false });
    cx += w + gapX;
  }
  // Column x positions; VALOR and TOTAL are right-aligned to their end.
  const col = { largo: 52.5, prof: 150.9, alto: 226.5, niveles: 287.1, uds: 355.2, valorEnd: 483.8, totalEnd: 559.5 };
  let y = 457.6 - shrink;
  function tableHeader() {
    // Rounded on top only, like the template (border-radius 8px 8px 0 0).
    doc.roundedRect(L, y, W, 19.9, 6).fill(C.accent);
    doc.rect(L, y + 10, W, 9.9).fill(C.accent);
    [['Largo', col.largo], ['Profund.', col.prof], ['Alto', col.alto], ['Niveles', col.niveles], ['Uds.', col.uds]].forEach(([t, x]) => label(t, x, y + 5.2, 70, C.head));
    label('Valor', col.valorEnd - 80, y + 5.2, 80, C.head, 'right');
    label('Total', col.totalEnd - 80, y + 5.2, 80, C.head, 'right');
    y += 19.9;
  }
  function row(cells, value, units, heading) {
    if (y > 640) { page(FOOTER_MATERIAL, 'Detalle (continuación)'); y = 120; tableHeader(); }
    if (heading) { text(heading, col.largo, y + 5.3, 420, 8.6, C.ink, F.bold); y += 13; }
    cells.forEach(([v, x]) => text(v, x, y + 5.3, 80, 9, C.ink, F.sans, { lineBreak: false }));
    text(money(value), col.valorEnd - 100, y + 5.3, 100, 9, C.ink, F.sans, { align: 'right' });
    text(money(value * units), col.totalEnd - 100, y + 5.3, 100, 9, C.ink, F.bold, { align: 'right' });
    y += 23.85; rule(y, C.rowLine);
  }
  tableHeader();
  for (const r of rows)
    row([[metres(r.largo), col.largo], [metres(r.prof), col.prof], [metres(r.alto), col.alto], [r.niveles, col.niveles], [r.unidades, col.uds]], r.valor, r.unidades, r.kind === 'rack' ? `${r.label} · cajas incluidas` : undefined);
  // Contracted services are charged, so they are listed with the items (the handoff's README: "agréguenlo como una fila más").
  for (const r of extras.filter(r => r.qty > 0)) row([[r.title, col.largo], [r.qty, col.uds]], r.price, r.qty);

  if (y > 540) { page(FOOTER_MATERIAL, 'Resumen de cotización'); y = 110; }
  y += 33.5;
  box(L, y, 357, 58.4, C.card, C.cardLine);
  label('Condiciones', 54.8, y + 10.9, 200, C.accent);
  text(CONDICIONES, 54.8, y + 24, 320, 8.25, C.body);
  text('Subtotal', 412.5, y, 80, 8.62, C.sub); text(money(subtotal), 470, y, 100, 8.62, C.sub, F.sans, { align: 'right' });
  text('IVA', 412.5, y + 15, 80, 8.62, C.sub); text(money(iva), 470, y + 15, 100, 8.62, C.sub, F.sans, { align: 'right' });
  box(412.5, y + 31.6, R - 412.5, 26.8, C.accent, undefined, 6);
  text('TOTAL', 421.5, y + 41.8, 60, 7.5, '#FFFFFF');
  text(money(total), 450, y + 36.9, 111, 12.75, '#FFFFFF', F.serif, { align: 'right' });
  y += 66.7;
  box(L, y, W, 32.5, C.amber, C.amberLine);
  withIcon('', clock, 'Acéptala dentro de las próximas 48 horas y obtén 10% de descuento adicional', L, y + 11, 9, C.amberInk, F.bold, 'center');
  y += 40.8;
  box(L, y, W, 77.3, C.card, C.cardLine);
  label('Transferencia', 56.2, y + 15.2);
  text(`${MARCA.razonSocial} · ${MARCA.rut}\n${MARCA.banco} Cta. ${MARCA.tipoCuenta} ${MARCA.numeroCuenta}`, 56.2, y + 29.2, 240, 8.62, C.body, F.sans, { lineGap: 1.5 });
  doc.moveTo(306, y + 12).lineTo(306, y + 65).strokeColor(C.frame).lineWidth(.75).stroke();
  // Maxi's Mercado Pago link unless the caller supplies another valid HTTPS URL.
  const payUrl = typeof data.payment_url === 'string' && /^https:\/\//.test(data.payment_url) ? data.payment_url : MARCA.linkPago;
  label('Link de pago', 319.9, y + 15.2);
  text('Hasta 3 cuotas sin interés.', 319.9, y + 28.8, 230, 8.62, C.body);
  withIcon('Pagar cotización', arrow, '', 319.9, y + 45.4, 9.38, C.accent, F.bold, 'left', 230);
  doc.link(319.9, y + 44, 95, 14, payUrl);

  // Page 2: optional services, gross prices shown next to net.
  page('Consulta disponibilidad de cada servicio según tu comuna', 'Servicios adicionales', 'Puedes sumarlos a tu cotización si los necesitas. Precio neto y total con IVA incluido.');
  extras.forEach((r, i) => {
    const cy = 121.4 + i * 132;
    box(L, cy, W, 121.5, C.card, undefined, 9);
    // The text column is centred in the card, so a longer description starts higher.
    const ty = cy + (121.5 - 32.6 - doc.font(F.sans).fontSize(9).heightOfString(r.description, { width: 336, lineGap: .45 })) / 2;
    text(r.title, 55.5, ty, 250, 12, C.ink, F.serif);
    text(`neto ${money(r.price)}`, 291.5, ty + 3.8, 100, 7.88, C.muted, F.sans, { align: 'right' });
    text(money(Math.round(r.price * 1.19)), 291.5, ty + 14.9, 100, 12.75, C.accent, F.serif, { align: 'right' });
    text(r.description, 55.5, ty + 32.6, 336, 9, C.sub, F.sans, { lineGap: .45 });
    doc.save().roundedRect(406.5, cy + 12, 150, 97.5, 7.5).clip();
    doc.image(asset(`servicio-${r.key}.jpg`), 406.5, cy + 12, { cover: [150, 97.5], align: 'center', valign: 'center' });
    doc.restore();
  });

  // Page 3: gallery.
  page('Terciado estructural 18mm y pino cepillado 2×2', 'Galería de trabajos', 'Algunos proyectos que hemos instalado.');
  withIcon('Ver portafolio completo', arrow, MARCA.galeriaUrl, 300, 98.3, 9, C.accent, F.bold, 'right', R - 300);
  doc.link(330, 97, R - 330, 13, `https://${MARCA.galeriaUrl}`);
  doc.save().roundedRect(63, 124.6, 486, 607.4, 6).clip();
  fit(asset('galeria.jpg'), 63, 124.6, 486, 607.4);
  doc.restore();

  // Page 4: FAQ.
  page('¿Otra duda? Escríbenos por WhatsApp', 'Preguntas frecuentes', undefined, 16.5);
  y = 102.9;
  for (const [q, a] of faq) {
    text(q, L, y, W, 10.12, C.ink, F.serif);
    text(a, L, y + 17.4, W, 9, C.sub, F.sans, { lineGap: .45 });
    y = doc.y + 9; rule(y, C.rowLine); y += 10.5;
  }

  const count = doc.bufferedPageRange().count;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(i); rule(FOOT);
    text(footers[i], L, FOOT + 6, 480, 7.88, C.faint, F.sans, { lineBreak: false });
    text(`${i + 1} de ${count}`, 500, FOOT + 6, R - 500, 7.88, C.faint, F.sans, { align: 'right', lineBreak: false });
  }
  doc.end();
  return { bytes: await complete, subtotal, iva, total };
}
