import PDFDocument from 'pdfkit';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = { paper: '#FBF7EE', ink: '#534633', muted: '#8D7A61', orange: '#BC641C', line: '#DFCFB3', box: '#F3EAD8' };
const money = value => '$' + Math.round(value).toLocaleString('es-CL');
const services = [
  ['retiro_orden', 'Retiro y orden de artículos', 40000, 'Retiramos tus artículos y los reordenamos después de instalar las repisas. Sin este servicio, el espacio debe estar despejado.'],
  ['retiro_basura', 'Retiro de basura', 30000, 'Retiramos muebles, cajas y artículos que ya no necesitas. Consulta el alcance y la disponibilidad según tu comuna.'],
  ['cajas', 'Cajas organizadoras', 15000, 'Cajas apilables para mantener tus artículos protegidos y ordenados entre los niveles.'],
  ['bici', 'Soporte de bicicleta/ski', 20000, 'Soportes anclados al muro para aprovechar el espacio y despejar el suelo.'],
];
function numeric(value, fallback = 0) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error('La cotización contiene un número inválido');
  return n;
}

// Deterministic page geometry. No network, browser or office installation is required.
export async function generateQuotePdf(data, { now = new Date(), functionsDir = join(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'netlify/functions') } = {}) {
  const rows = (data.repisas || [data.repisa1, data.repisa2].filter(Boolean)).map(r => ({
    largo: numeric(r.largo), prof: numeric(r.prof), alto: numeric(r.alto), niveles: numeric(r.niveles), unidades: numeric(r.unidades), valor: numeric(r.valor),
  }));
  if (rows.length > 100) throw new Error('Máximo 100 repisas por cotización');
  const extras = services.map(([key, title, price, description]) => ({ key, title, description, qty: numeric(data[`qty_${key}`]), price: numeric(data[`precio_${key}`], price) }));
  const subtotal = rows.reduce((s,r) => s + r.unidades*r.valor, 0) + extras.reduce((s,r) => s+r.qty*r.price, 0);
  const iva = Math.round(subtotal * .19), total = subtotal + iva;
  const zip = await JSZip.loadAsync(readFileSync(join(functionsDir, 'cotizacion.xlsx')));
  const asset = async name => zip.file(`xl/media/${name}`)?.async('nodebuffer');
  const [logo, gallery, servicePhoto, boxes] = await Promise.all(['image1.png','image6.jpeg','image3.jpeg','image5.jpeg'].map(asset));
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, autoFirstPage: false, info: { Title: `Cotización ${data.cot_num || ''} - Don Maxi`, Author: 'Don Maxi' } });
  // Reuse one embedded image resource for every crop, instead of duplicating JPEG bytes.
  const galleryImage = doc.openImage(gallery);
  const serviceImage = doc.openImage(servicePhoto);
  const chunks = [];
  const complete = new Promise((resolve,reject) => { doc.on('data',c=>chunks.push(c)); doc.on('end',()=>resolve(Buffer.concat(chunks))); doc.on('error',reject); });
  const text = (value,x,y,w=515,size=10,color=C.ink,font='Helvetica') => doc.font(font).fontSize(size).fillColor(color).text(String(value ?? ''), x,y,{width:w,height:100,lineGap:3});
  const rule = y => doc.moveTo(40,y).lineTo(555,y).strokeColor(C.line).lineWidth(.6).stroke();
  const fit = (bytes,x,y,w,h) => { if(bytes) doc.image(bytes,x,y,{fit:[w,h],align:'center',valign:'center'}); };
  function page(title, subtitle) {
    doc.addPage(); doc.rect(0,0,595.28,841.89).fill(C.paper);
    fit(logo,40,34,120,44); text(`COTIZACIÓN N.º ${data.cot_num || ''}`,390,47,165,9,C.muted,'Helvetica-Bold'); rule(92);
    if(title) text(title,40,108,515,23,C.orange,'Times-Bold');
    if(subtitle) text(subtitle,40,141,515,10,C.muted);
  }
  page();
  const date = new Intl.DateTimeFormat('es-CL',{ timeZone:'America/Santiago' });
  text(`Emitida ${date.format(now)} · Válida hasta ${date.format(new Date(now.getTime()+7*86400000))}`,280,73,275,8,C.muted);
  for(const [i,[label,value]] of [['CLIENTE',data.nombre],['TELÉFONO',data.telefono],['DIRECCIÓN',data.direccion],['EMAIL',data.email]].entries()) {
    const x=40+(i%2)*265,y=112+Math.floor(i/2)*59;
    text(label,x,y,245,8,C.muted,'Helvetica-Bold'); text(value || '-',x,y+17,245,11);
  }
  let y=243;
  function tableHeader() {
    text('Repisas',40,y,515,18,C.orange,'Times-Bold'); y+=30;
    doc.rect(40,y-5,515,25).fill(C.box);
    ['LARGO','PROFUND.','ALTO','NIVELES','UDS.','VALOR','TOTAL'].forEach((v,i)=>text(v,[46,118,191,252,320,377,465][i],y,80,8,C.muted,'Helvetica-Bold')); y+=28;
  }
  tableHeader();
  for(const r of rows) {
    if(y>660) { page('Repisas (continuación)'); y=166; tableHeader(); }
    [r.largo+' m',r.prof+' m',r.alto+' m',r.niveles,r.unidades,money(r.valor),money(r.valor*r.unidades)].forEach((v,i)=>text(v,[46,118,191,252,320,377,465][i],y,87,10));
    y+=30;rule(y-8);
  }
  if(y>425) { page('Resumen de cotización'); y=167; }
  y+=15;text('Servicios adicionales',40,y,515,17,C.orange,'Times-Bold');y+=29;
  for(const r of extras) { text(r.title,46,y,280,10);text(r.qty,325,y,40);text(money(r.price),378,y,85);text(money(r.qty*r.price),465,y,90);y+=28; }
  y+=17;rule(y);y+=16;
  text('CONDICIONES DE COMPRA',40,y,285,8,C.muted,'Helvetica-Bold');
  text('Puede abonar un 50% antes de la instalación, o pagar el total al finalizar el trabajo. Garantía de 5 años sobre estructura e instalación.',40,y+19,285,10);
  [['Subtotal neto',subtotal],['IVA (19%)',iva],['TOTAL',total]].forEach(([label,value],i)=>{text(label,355,y+i*28,110,10,C.ink,i===2?'Helvetica-Bold':'Helvetica');text(money(value),465,y+i*28,90,11,C.ink,i===2?'Helvetica-Bold':'Helvetica');});
  y+=110;
  text('TRANSFERENCIA',40,y,235,8,C.muted,'Helvetica-Bold');
  text('Don Maxi SPA\n77.386.684-8\nBanco BCI · Cta. Corriente 13702807\nrepisasdonmaxi@gmail.com',40,y+17,250,10);
  text('MEDIOS DE PAGO',320,y,235,8,C.muted,'Helvetica-Bold');
  text('Transferencia, débito o crédito hasta en 3 cuotas sin interés.',320,y+17,235,10);
  // A payment link is included only when an explicit valid HTTPS URL is supplied.
  if(data.payment_url && /^https:\/\//.test(data.payment_url)) doc.fontSize(10).fillColor(C.orange).text('Pagar cotización',320,y+65,{link:data.payment_url,underline:true});

  page('Simulación del proyecto','Referencia 3D. Las medidas finales se ajustan en terreno.');
  const frames=[['isometric','VISTA ISOMÉTRICA',40,195,250,250*280/342],['top','PLANTA',305,195,250,250*280/342],['entrance','VISTA DESDE LA ENTRADA',40,439,515,515*420/704]];
  for(const [key,label,x,fy,w,h] of frames) {
    text(label,x,fy-20,w,8,C.muted,'Helvetica-Bold');doc.roundedRect(x,fy,w,h,7).fill(C.box);
    const src=data.grafica3d?.[key];
    if(src) {
      if(typeof src!=='string' || src.length>8e6 || !/^data:image\/(png|jpeg);base64,/.test(src)) throw new Error(`Imagen ${key} inválida`);
      fit(Buffer.from(src.split(',')[1],'base64'),x,fy,w,h);
    } else text('Vista no disponible',x+15,fy+h/2-5,w-30,10,C.muted);
  }
  page('Servicios adicionales','Puedes sumarlos a tu cotización si los necesitas.');
  extras.forEach((r,i)=>{const sy=185+i*140;doc.roundedRect(40,sy,515,125,8).fill(C.box);text(r.title,55,sy+18,290,14,C.orange,'Helvetica-Bold');text(r.description,55,sy+47,290,10);});
  // Crop only the photo regions of the existing montage, keeping equal fixed frames.
  for (const [sourceY, targetY] of [[15,200],[472,340],[929,620]]) {
    const scale = 98 / 407;
    doc.save().rect(425,targetY,98,98).clip();
    doc.image(serviceImage,425-573*scale,targetY-sourceY*scale,{width:1080*scale});doc.restore();
  }
  doc.save().rect(417,480,120,98).clip();
  doc.image(boxes,417-35*.24,480-200*.24,{width:1080*.24});doc.restore();
  page('Galería de trabajos','Algunos proyectos que hemos instalado.');
  const galleryRegions = [[65,162,306],[448,86,184],[708,162,306],[126,560,184],[387,285,306],[769,560,184],[65,759,306],[387,881,306],[708,758,306]];
  galleryRegions.forEach(([sx,sy,size],i)=>{
    const x=40+(i%3)*176,y=185+Math.floor(i/3)*181,side=163,scale=side/size;
    doc.save().roundedRect(x,y,side,side,6).clip();
    doc.image(galleryImage,x-sx*scale,y-sy*scale,{width:1080*scale});doc.restore();
  });
  doc.fontSize(10).fillColor(C.orange).text('Ver portafolio completo: www.donmaxi.cl/galeria',40,761,{link:'https://www.donmaxi.cl/galeria'});
  page('Preguntas frecuentes');
  const faq=[
    ['¿Qué pasa si las medidas varían en terreno?','Llevamos el material sobredimensionado para ajustarlo a tu espacio al momento de instalar.'],
    ['¿Las repisas son desmontables?','Sí. Si te cambias de domicilio puedes llevártelas; te ayudamos con el desmontaje.'],
    ['¿De qué material están hechas?','Terciado estructural de 18 mm y pino cepillado 2×2.'],
    ['¿Cuánto demora la instalación?','En promedio, entre 1 y 2 horas, dependiendo del tamaño del proyecto.'],
    ['¿Necesitan conexión eléctrica?','No, trabajamos con herramientas inalámbricas.'],
    ['¿Qué medios de pago aceptan?','Transferencia, débito o crédito. Emitimos boleta o factura según lo que necesites.'],
  ];
  faq.forEach(([q,a],i)=>{const fy=175+i*94;text(q,40,fy,515,13,C.ink,'Helvetica-Bold');text(a,40,fy+26,515,11);});
  const count=doc.bufferedPageRange().count;
  for(let i=0;i<count;i++){doc.switchToPage(i);rule(790);text('Don Maxi · Optimiza tu espacio',40,802,400,8,C.muted);text(`${i+1} de ${count}`,505,802,50,8,C.muted);}
  doc.end();
  return { bytes: await complete, subtotal, iva, total };
}
