import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePriceUpdate } from './price-update.mjs';
import { handler } from '../update-precio.mjs';
const row={alto:200,prof:40,desde:194,hasta:243,precio:110000};
const input={...row,precioAnterior:110000,precio:120000};
test('targets one commercial range and preserves other columns',()=>{
  assert.deepEqual(resolvePriceUpdate([{...row,row:19}],input),{...row,row:19,precio:120000});
  assert.equal(row.precio,110000);
});
test('rejects stale, missing and ambiguous ranges',()=>{
  for(const table of [[],[row,row],[{...row,precio:130000}]]) assert.throws(()=>resolvePriceUpdate(table,input),{status:409});
});
test('rejects negative, nonfinite, fractional and string prices',()=>{
  for(const precio of [-1,0,NaN,Infinity,1.2,'120000']) assert.throws(()=>resolvePriceUpdate([row],{...input,precio}),{status:400});
});
test('write route requires POST and authenticated administrator',async()=>{
  assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,405);
  assert.equal((await handler({httpMethod:'POST',headers:{}})).statusCode,401);
});
