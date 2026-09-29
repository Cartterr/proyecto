import test from 'node:test';
import assert from 'node:assert/strict';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { generateQuotePdf } from './quote-pdf.mjs';
test('rack description and own price appear in PDF; missing rack price is rejected',async()=>{
  const rack={kind:'rack',label:'Rack 6 cajas',largo:1.188288,prof:.653213,alto:1.332,niveles:3,unidades:1,valor:150000};
  const result=await generateQuotePdf({repisas:[rack]});
  assert.equal(result.total,178500);
  assert.ok((await pdf(result.bytes)).text.includes('Rack 6 cajas'));
  await assert.rejects(()=>generateQuotePdf({repisas:[{...rack,valor:0}]}),/precio neto/);
});
test('four pages, correct net/VAT totals and no placeholder photos',async()=>{
  const result=await generateQuotePdf({cot_num:1443,nombre:'CLIENTE PRUEBA',repisas:[{largo:2.4,prof:.48,alto:2,niveles:4,unidades:1,valor:110000},{largo:.72,prof:.68,alto:2,niveles:4,unidades:1,valor:70000}]});
  assert.equal(result.total,214200);
  const parsed=await pdf(result.bytes);
  assert.equal(parsed.numpages,4);
  for(const text of ['CLIENTE PRUEBA','214.200','Servicios adicionales','Galería de trabajos','Preguntas frecuentes']) assert.ok(parsed.text.includes(text),text);
  assert.ok(!parsed.text.includes('Sube aquí'));
});
test('all rows contribute to totals and long quotes paginate',async()=>{
  const repisas=Array.from({length:30},()=>({largo:1,prof:.48,alto:2,niveles:4,unidades:2,valor:50000}));
  const result=await generateQuotePdf({repisas});
  assert.equal(result.subtotal,3000000);
  assert.ok((await pdf(result.bytes)).numpages>4);
});
test('six rows still fit on page 1; eight move the summary to its own page',async()=>{
  const repisas=n=>Array.from({length:n},()=>({largo:1,prof:.48,alto:2,niveles:4,unidades:1,valor:50000}));
  assert.equal((await pdf((await generateQuotePdf({repisas:repisas(6)})).bytes)).numpages,4);
  assert.equal((await pdf((await generateQuotePdf({repisas:repisas(8)})).bytes)).numpages,5);
});
test('contracted services are listed and charged on page 1',async()=>{
  const result=await generateQuotePdf({repisas:[{largo:1,prof:.48,alto:2,niveles:4,unidades:1,valor:50000}],qty_retiro_basura:2});
  assert.equal(result.subtotal,110000);
  const firstPage=(await pdf(result.bytes)).text.split('Servicios adicionales')[0];
  assert.ok(firstPage.includes('Retiro de basura'));
});
test('rejects invalid figures and malformed image data',async()=>{
  await assert.rejects(()=>generateQuotePdf({repisas:[{valor:-10}]}));
  await assert.rejects(()=>generateQuotePdf({grafica3d:{top:'https://example.com/image.png'}}));
});
test('follows the handoff template: Lora/Poppins, metre format, fixed 48 h offer and payment link',async()=>{
  const result=await generateQuotePdf({cot_num:7,repisas:[{largo:2.4,prof:.48,alto:2,niveles:4,unidades:1,valor:110000}]});
  const {text}=await pdf(result.bytes);
  for(const t of ['2.40 m','0.48 m','2 m','Acéptala dentro de las próximas 48 horas','Hasta 3 cuotas sin interés.','Pagar cotización']) assert.ok(text.includes(t),t);
  const raw=result.bytes.toString('latin1');
  assert.ok(raw.includes('Poppins')&&raw.includes('Lora'),'fonts embedded');
  assert.ok(raw.includes('link.mercadopago.cl/repisasdonmaxi'),'payment link');
});
