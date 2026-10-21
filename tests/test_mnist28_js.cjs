const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
const net=require('../frontend/mnist28-network.js'),model=read('mnist28.json'),samples=read('mnist28_samples.json'),references=read('mnist28_reference.json');
let maximum=0;
for(const expected of references){
  const x=samples[expected.sample_index].pixels.map(v=>v/255),actual=net.forward(x,model);
  assert.equal(actual.prediction,expected.prediction);
  actual.layers.forEach((layer,l)=>['weighted','z','a'].forEach(key=>layer[key].forEach((v,j)=>{
    const error=Math.abs(v-expected.layers[l][key][j]);maximum=Math.max(maximum,error);assert.ok(error<1e-10);
  })));
}
const brush=Array(784).fill(0);net.paint(brush,[5,13],[22,13],1.2,.7);
assert.ok(brush.some(v=>v>0&&v<1));assert.ok(brush.every(v=>v>=0&&v<=.7+1/255));
assert.ok(brush[13*28+14]>0&&brush[14*28+14]>0&&brush[12*28+14]>0);
assert.equal(brush[11*28+14],0);const before=brush.slice();net.paint(brush,[5,13],[22,13],2,1,true);
assert.ok(brush.reduce((a,b)=>a+b,0)<before.reduce((a,b)=>a+b,0));
const stroke=Array(784).fill(0);net.paint(stroke,[0,1],[4,10],1.1,1);
const centered=net.center(stroke),mass=centered.reduce((a,b)=>a+b,0);
const cx=centered.reduce((a,v,i)=>a+v*(i%28),0)/mass,cy=centered.reduce((a,v,i)=>a+v*Math.floor(i/28),0)/mass;
assert.ok(Math.abs(cx-13.5)<=.6&&Math.abs(cy-13.5)<=.6);
assert.ok(centered.every(v=>v>=0&&v<=1));assert.deepEqual(net.center(Array(784).fill(0)),Array(784).fill(0));
assert.throws(()=>net.forward(Array(784).fill(1.01),model));
const freehand=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/freehand_regressions.json'),'utf8'));
for(const item of freehand){
  const raw=item.pixels.map(v=>v/255),saved=raw.slice(),prepared=net.center(raw);
  assert.deepEqual(raw,saved);
  assert.deepEqual(prepared.map(v=>Math.round(v*255)),item.prepared_pixels);
  const r=net.forward(prepared,model);assert.equal(r.prediction,item.label);assert.ok(r.probabilities[item.label]>.9);
}
console.log(`MNIST28: 20 raw-weight references, every layer and neuron, grayscale brush, eraser and centering passed. Max difference ${maximum}`);
console.log('Reported freehand 6/9 pass after the same input adaptation; raw drawings remain unchanged.');
