/* Usage: node tests/test_js_parity.cjs
 * Covers the browser arithmetic independently of rendering and Streamlit.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const model = JSON.parse(fs.readFileSync(path.join(root, 'data/model.json'), 'utf8'));
const reference = JSON.parse(fs.readFileSync(path.join(root, 'data/excel_reference.json'), 'utf8'));
const net = require('../frontend/network.js');
const actual = net.forward(reference.pixels, model);
let maximum = 0;
for (const [key, expected] of [['h', reference.hidden], ['logits', reference.logits], ['probabilities', reference.probabilities]]) {
  actual[key].forEach((v, i) => {maximum = Math.max(maximum, Math.abs(v - expected[i])); assert.ok(Math.abs(v - expected[i]) < 1e-12);});
}
assert.equal(actual.prediction, 1);
assert.equal(actual.blank, true);
for (const x of [Array(144).fill(1), Array.from({length:144}, (_,i)=>i%2), Array.from({length:144},(_,i)=>+(i%13===0))]) {
  const r = net.forward(x, model);
  assert.ok(Math.abs(r.probabilities.reduce((a,b)=>a+b,0)-1)<1e-12);
  for (let j=0;j<128;j++) {
    const weighted = net.contributions(x,model,j).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(weighted-r.weighted1[j]) < 1e-12);
    const sum = weighted + model.b1[j];
    assert.ok(Math.abs(sum-r.z1[j]) < 1e-12);
  }
  for (let k=0;k<10;k++) {
    const weighted = net.outputContributions(r,model,k).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(weighted-r.weighted2[k]) < 1e-12);
    const sum = weighted + model.b2[k];
    assert.ok(Math.abs(sum-r.logits[k]) < 1e-11);
  }
}
assert.throws(()=>net.forward(Array(143).fill(0),model));
assert.throws(()=>net.forward(Array(144).fill(NaN),model));
console.log(`Browser engine: Excel golden values and contribution traces passed. Max Excel difference: ${maximum}`);
