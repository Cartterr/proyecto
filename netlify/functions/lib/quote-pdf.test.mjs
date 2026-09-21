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
test('five pages, correct net/VAT totals and no placeholder photos',async()=>{
  const result=await generateQuotePdf({cot_num:1443,nombre:'CLIENTE PRUEBA',repisas:[{largo:2.4,prof:.48,alto:2,niveles:4,unidades:1,valor:110000},{largo:.72,prof:.68,alto:2,niveles:4,unidades:1,valor:70000}]});
  assert.equal(result.total,214200);
  const parsed=await pdf(result.bytes);
  assert.equal(parsed.numpages,5);
  for(const text of ['CLIENTE PRUEBA','214.200','Simulación del proyecto','Galería de trabajos','Preguntas frecuentes']) assert.ok(parsed.text.includes(text),text);
  assert.ok(!parsed.text.includes('Sube aquí'));
});
test('all rows contribute to totals and long quotes paginate',async()=>{
  const repisas=Array.from({length:30},()=>({largo:1,prof:.48,alto:2,niveles:4,unidades:2,valor:50000}));
  const result=await generateQuotePdf({repisas});
  assert.equal(result.subtotal,3000000);
  assert.ok((await pdf(result.bytes)).numpages>5);
});
test('five rows move the summary to a new page before payment details can overlap the footer',async()=>{
  const repisas=Array.from({length:5},()=>({largo:1,prof:.48,alto:2,niveles:4,unidades:1,valor:50000}));
  const result=await generateQuotePdf({repisas});
  assert.equal((await pdf(result.bytes)).numpages,6);
});
test('rejects invalid figures and malformed image data',async()=>{
  await assert.rejects(()=>generateQuotePdf({repisas:[{valor:-10}]}));
  await assert.rejects(()=>generateQuotePdf({grafica3d:{top:'https://example.com/image.png'}}));
});
