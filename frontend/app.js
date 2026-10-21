'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const names = ['输入像素', '加权求和', 'ReLU 激活', '输出得分', 'Softmax'];
let model, result, pixels = Array(144).fill(0), neuron = 0, digit = 0, stage = 4;
let tool = 'pen', drawing = false, lastIndex = null, strokeValue = 1, history = [];
let stageTimer = null, initialized = false, sequence = 0;
const fmt = (v, n = 5) => Math.abs(v) < 1e-12 ? '0' : Number(v).toFixed(n);
const signed = v => (v >= 0 ? '+' : '') + fmt(v);

function send(type, payload = {}) {
  window.parent.postMessage({isStreamlitMessage: true, type, ...payload}, '*');
}
let previousHeight = 0;
function resize() {
  const height = Math.ceil($('lab').getBoundingClientRect().height) + 2;
  if (Math.abs(height - previousHeight) > 2) {
    previousHeight = height;
    send('streamlit:setFrameHeight', {height});
  }
}
function sync() {
  send('streamlit:setComponentValue', {dataType: 'json', value: {
    mode:'full', pixels: pixels.slice(), probabilities: result.probabilities.slice(), sequence: ++sequence,
  }});
}
function saveHistory() {
  history.push(pixels.slice());
  if (history.length > 50) history.shift();
}
function stopStage() {
  clearInterval(stageTimer); stageTimer = null; $('play').textContent = '播放流程';
}
function changePixels(next, remember = true) {
  if (remember) saveHistory();
  stopStage();
  pixels = next.slice();
  stage = 4; update(); sync();
}
function setTool(next) {
  tool = next;
  for (const id of ['pen', 'eraser']) {
    $(id).classList.toggle('selected', id === next);
    $(id).setAttribute('aria-pressed', String(id === next));
  }
}
function setDemoMode(mode) {
  const large = mode === 'large';
  stopStage(); MatrixLesson.pause();
  $('excel-workspace').hidden = large;
  $('mnist28-demo').hidden = !large;
  $('matrix-lesson').hidden = large;
  $('status').hidden = large;
  for (const name of ['full', 'large']) {
    const selected = name === mode, tab = $(`tab-${name}`);
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
  }
  $('demo-content').setAttribute('aria-labelledby', `tab-${mode}`);
  if (large) Mnist28Lab.show();
  else {Mnist28Lab.hide(); MatrixLesson.update(true); sync();}
  resize();
}

// Binary teaching patterns. These are examples, not a validation dataset.
const patterns = [
 ['00111100','01100110','11000011','11000011','11000011','11000011','01100110','00111100'],
 ['00011000','00111000','01111000','00011000','00011000','00011000','00011000','01111110'],
 ['00111100','01100110','00000110','00001100','00011000','00110000','01100000','01111110'],
 ['00111100','01100110','00000110','00011100','00000110','00000110','01100110','00111100'],
 ['00001100','00011100','00101100','01101100','11001100','11111110','00001100','00001100'],
 ['01111110','01100000','01100000','01111100','00000110','00000110','01100110','00111100'],
 ['00111100','01100000','11000000','11111100','11000110','11000110','01100110','00111100'],
 ['01111110','00000110','00001100','00011000','00011000','00110000','00110000','00110000'],
 ['00111100','01100110','01100110','00111100','01100110','11000011','01100110','00111100'],
 ['00111100','01100110','11000110','01111110','00000110','00000110','00001100','00111000'],
];
function example(k) {
  const p = Array(144).fill(0);
  patterns[k].forEach((row, r) => [...row].forEach((v, c) => {p[(r + 2) * 12 + c + 2] = +v;}));
  return p;
}
function pixelIndex(event) {
  const rect = $('board').getBoundingClientRect();
  const c = Math.floor((event.clientX - rect.left) / rect.width * 12);
  const r = Math.floor((event.clientY - rect.top) / rect.height * 12);
  return r >= 0 && r < 12 && c >= 0 && c < 12 ? r * 12 + c : null;
}
function paint(index) {
  if (index === null) return;
  // Interpolate cells so a fast pointer cannot leave holes in a stroke.
  if (lastIndex !== null) {
    const x0 = lastIndex % 12, y0 = Math.floor(lastIndex / 12);
    const dx = index % 12 - x0, dy = Math.floor(index / 12) - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let t = 0; t <= n; t++) {
      const k = Math.round(y0 + dy * t / Math.max(1, n)) * 12 + Math.round(x0 + dx * t / Math.max(1, n));
      pixels[k] = strokeValue;
    }
  }
  pixels[index] = strokeValue; lastIndex = index; update();
}
function initialize(mnistModel) {
  for (const mode of ['full', 'large']) {
    const tab = $(`tab-${mode}`);
    tab.onclick = () => setDemoMode(mode);
    tab.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'full' : event.key === 'End' ? 'large' : mode === 'full' ? 'large' : 'full';
      setDemoMode(next); $(`tab-${next}`).focus();
    };
  }
  const board = $('board');
  for (let i = 0; i < 144; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pixel'; b.dataset.index = i;
    b.setAttribute('aria-label', `第 ${Math.floor(i / 12) + 1} 行，第 ${i % 12 + 1} 列`);
    b.addEventListener('click', event => {
      if (event.detail === 0) { // Keyboard activation, pointer input is handled below.
        saveHistory(); pixels[i] = tool === 'eraser' ? 0 : 1 - pixels[i];
        stopStage(); stage = 4; update(); sync();
      }
    });
    board.appendChild(b);
  }
  board.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); board.setPointerCapture(event.pointerId);
    saveHistory(); drawing = true; lastIndex = null; stopStage(); stage = 4;
    const i = pixelIndex(event); strokeValue = tool === 'eraser' ? 0 : i === null ? 1 : 1 - pixels[i]; paint(i);
  });
  board.addEventListener('pointermove', event => {if (drawing) paint(pixelIndex(event));});
  function endStroke() {if (drawing) {drawing = false; lastIndex = null; sync();}}
  board.addEventListener('pointerup', endStroke); board.addEventListener('pointercancel', endStroke);
  board.addEventListener('lostpointercapture', endStroke);
  $('pen').onclick = () => setTool('pen'); $('eraser').onclick = () => setTool('eraser');
  $('clear').onclick = () => { $('sample').value = ''; changePixels(Array(144).fill(0)); };
  $('undo').onclick = () => {if (history.length) changePixels(history.pop(), false);};
  patterns.forEach((_, k) => $('sample').add(new Option(`数字 ${k} · 教学笔画`, String(k))));
  $('sample').onchange = () => {if ($('sample').value !== '') changePixels(example(+$('sample').value));};
  names.forEach((name, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'stage';
    b.textContent = `${i + 1}. ${name}`; b.onclick = () => {stopStage(); stage = i; renderFlow();}; $('stages').appendChild(b);
  });
  $('play').onclick = () => {
    if (stageTimer) {stopStage(); return;}
    if (stage >= 4) stage = 0;
    renderFlow(); $('play').textContent = '暂停';
    stageTimer = setInterval(() => {stage++; if (stage >= 4) {stage = 4; stopStage();} renderFlow();}, +$('speed').value);
  };
  $('next').onclick = () => {stopStage(); stage = (stage + 1) % 5; renderFlow();};
  $('restart').onclick = () => {stopStage(); stage = 0; renderFlow();};
  $('speed').onchange = () => {if (stageTimer) {stopStage(); $('play').click();}};
  new ResizeObserver(resize).observe($('lab'));
  window.addEventListener('resize', resize);
  MatrixLesson.initialize({getState: () => ({model, result, pixels, neuron, digit}),
    chooseNeuron, chooseDigit});
  Mnist28Lab.initialize({model:mnistModel,onChange:event=>{
    send('streamlit:setComponentValue',{dataType:'json',value:{...event,mode:'large',sequence:++sequence}});
  }});
}
function chooseNeuron(j) {
  neuron = j; renderFlow(); MatrixLesson.update();
}
function chooseDigit(k) {
  digit = k; renderFlow(); MatrixLesson.update();
}
function update() {
  if (!model) return;
  result = MnistNet.forward(pixels, model);
  [...$('board').children].forEach((b, i) => {
    b.classList.toggle('on', pixels[i] === 1); b.setAttribute('aria-pressed', String(!!pixels[i]));
  });
  $('undo').disabled = history.length === 0;
  $('ink-count').textContent = `${pixels.reduce((a, b) => a + b, 0)} 个笔画像素`;
  const prediction = $('prediction'); prediction.classList.toggle('blank', result.blank);
  prediction.innerHTML = result.blank ?
    `<div class="muted">空白画板 · 尚无笔画</div><div><span class="result">—</span></div><div class="hint">原模型仍输出 ${result.prediction}：${(result.probabilities[result.prediction] * 100).toFixed(2)}%。这不表示识别到了数字。</div>` :
    `<div class="muted">当前预测</div><div><span class="result">${result.prediction}</span><span class="prob">${(result.probabilities[result.prediction] * 100).toFixed(2)}%</span></div><div class="hint">模型概率 · 修改笔画即重新计算</div>`;
  renderFlow(); MatrixLesson.update(true);
  $('status').textContent = '原 Excel 参数 · 19,850 个权重和偏置 · 所有 144 / 128 / 10 个节点都使用真实计算值';
  resize();
}
function svgEl(tag, attrs, text, parent = $('network')) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e); return e;
}
function renderFlow() {
  [...$('stages').children].forEach((b, i) => {
    b.classList.toggle('current', i === stage); b.classList.toggle('done', i < stage);
    b.setAttribute('aria-pressed', String(i === stage));
  });
  const svg = $('network'); svg.replaceChildren();
  svgEl('text', {x:12, y:30, class:'layer-title'}, '输入层 · 144');
  svgEl('text', {x:336, y:30, class:'layer-title'}, '隐藏层 · 128 个神经元');
  svgEl('text', {x:794, y:30, class:'layer-title'}, '输出层 · 10');
  svgEl('text', {x:12, y:52, class:'layer-note'}, 'x₁–x₁₄₄ · 12×12 按行展开');
  svgEl('text', {x:336, y:52, class:'layer-note'}, '仅一个隐藏层；网格仅为排版，每格一个神经元');
  svgEl('text', {x:794, y:52, class:'layer-note'}, '数字 0–9');
  svgEl('rect', {x:329,y:73,width:367,height:272,rx:8,class:'layer-box'});
  const ip = i => [16 + i % 12 * 14, 140 + Math.floor(i / 12) * 14];
  const hp = j => [358 + j % 8 * 44, 86 + Math.floor(j / 8) * 16];
  const op = k => [810, 120 + k * 22];
  const selectedPos = hp(neuron), selectedOut = op(digit);
  if (stage >= 1) {
    const maxWeight = Math.max(...model.w1.map(row => Math.abs(row[neuron])), 1e-12);
    for (let i = 0; i < 144; i++) {
      const [x, y] = ip(i), w = model.w1[i][neuron];
      svgEl('path', {d:`M${x+9},${y+5} C235,${y+5} 275,${selectedPos[1]} ${selectedPos[0]-19},${selectedPos[1]}`,
        fill:'none', stroke:w >= 0 ? '#317b8b' : '#d47b42', 'stroke-width':pixels[i] ? .6 + Math.abs(w) / maxWeight * 1.2 : .5,
        opacity:pixels[i] ? .35 : .035, 'data-connection-layer':1});
    }
  }
  if (stage >= 3) {
    for (let j = 0; j < 128; j++) {
      const [x, y] = hp(j), w = model.w2[j][digit];
      svgEl('path', {d:`M${x+19},${y} C725,${y} 752,${selectedOut[1]} ${selectedOut[0]-15},${selectedOut[1]}`,
        fill:'none',stroke:w >= 0 ? '#317b8b' : '#d47b42','stroke-width':j === neuron ? 2 : .6,
        opacity:result.h[j] > 0 ? j === neuron ? .85 : .12 : .025, 'data-connection-layer':2});
    }
  }
  for (let i = 0; i < 144; i++) {
    const [x,y] = ip(i), node = svgEl('rect', {x,y,width:10,height:10,rx:1,fill:pixels[i] ? '#354c84' : '#e9edf5','data-input-index':i});
    svgEl('title', {}, `x${i+1} = ${pixels[i]}`, node);
  }
  const maxH = Math.max(...result.h, 1e-12);
  for (let j = 0; j < 128; j++) {
    const [cx,cy] = hp(j), a = result.h[j] / maxH;
    const fill = stage < 2 ? '#e9edf5' : result.h[j] === 0 ? '#edf0f6' : `rgb(${115-a*60},${147-a*51},${222-a*13})`;
    const node = svgEl('g', {class:'node',tabindex:0,role:'button','data-hidden-index':j,
      'aria-pressed':String(j === neuron),'aria-label':`隐藏神经元 H${j+1}，z=${fmt(result.z1[j])}，ReLU=${fmt(result.h[j])}`});
    svgEl('rect', {x:cx-19,y:cy-7,width:38,height:14,rx:3,fill,stroke:j === neuron ? '#2949a5' : '#d5deee','stroke-width':j === neuron ? 2 : .7},undefined,node);
    svgEl('text', {x:cx,y:cy+3,'text-anchor':'middle',class:`hidden-label ${stage >= 2 && result.h[j] > 0 ? 'active' : ''}`},`H${j+1}`,node);
    svgEl('title', {}, `H${j+1}: z=${fmt(result.z1[j])}, ReLU=${fmt(result.h[j])}`, node);
    node.onclick = () => chooseNeuron(j);
    node.onkeydown = event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); node.onclick();}};
  }
  const active = result.h.filter(v => v > 0).length;
  svgEl('text', {x:336,y:366,class:'layer-note'}, stage >= 2 ? `128 个全部显示 · ${active} 个激活，${128-active} 个为 0` : '128 个全部显示 · 每个神经元各有 144 个输入权重和 1 个偏置');
  svgEl('text', {x:12,y:84,class:'layer-note'}, 'W₁：144 × 128');
  svgEl('text', {x:12,y:104,class:'layer-note'}, '18,432 个权重 ＋ 128 个偏置');
  svgEl('text', {x:794,y:72,class:'layer-note'}, 'W₂：128 × 10');
  svgEl('text', {x:794,y:90,class:'layer-note'}, '1,280 权重 ＋ 10 偏置');
  svgEl('text', {x:12,y:318,class:'layer-note'}, `选中 H${neuron+1}：`);
  svgEl('text', {x:12,y:337,class:'layer-note'}, stage >= 1 ? `z = ${fmt(result.z1[neuron])}` : 'z = xW₁ + b₁');
  svgEl('text', {x:12,y:356,class:'layer-note'}, stage >= 2 ? `ReLU(z) = ${fmt(result.h[neuron])}` : 'h = max(0, z)');
  for (let k = 0; k < 10; k++) {
    const [x,y] = op(k), group = svgEl('g', {class:'node',tabindex:0,role:'button','data-output-index':k,'aria-pressed':String(k === digit),'aria-label':`输出数字 ${k}`});
    svgEl('rect', {x:x-15,y:y-10,width:200,height:21,rx:4,stroke:k === digit ? '#a9b8ee' : 'none',fill:k === digit ? '#edf1ff' : 'white'}, undefined, group);
    svgEl('text', {x,y:y+4,'font-weight':k === result.prediction ? 650 : 400}, String(k), group);
    svgEl('rect', {x:x+24,y:y-5,width:89,height:10,rx:2,fill:'#edf0f6'},undefined,group);
    svgEl('rect', {x:x+24,y:y-5,width:stage >= 4 ? 89*result.probabilities[k] : 0,height:10,rx:2,fill:k === result.prediction ? '#3b61db' : '#a4b5ec'},undefined,group);
    svgEl('text',{x:x+123,y:y+4,style:'font-size:11px'},stage >= 4 ? `${(100*result.probabilities[k]).toFixed(2)}%` : stage >= 3 ? fmt(result.logits[k],3) : '—',group);
    group.onclick = () => chooseDigit(k);
    group.onkeydown = event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); group.onclick();}};
  }
  const weightedSum = result.weighted1[neuron];
  const messages = [
    ['把笔画变成 144 个数', `第 1 行到第 12 行依次展开，黑格为 1，空格为 0。当前共有 ${pixels.reduce((a,b)=>a+b,0)} 个 1。`],
    [`H${neuron+1}：先加权求和，再加偏置`, `Σ(xᵢ × wᵢ) = ${fmt(weightedSum)}；加偏置 ${signed(model.b1[neuron])}，得到 z = ${fmt(result.z1[neuron])}。`],
    [`H${neuron+1}：ReLU 保留正值`, `h = max(0, ${fmt(result.z1[neuron])}) = ${fmt(result.h[neuron])}。全部 128 个神经元中，${active} 个输出大于 0。`],
    [`数字 ${digit}：128 项贡献形成一个得分`, `z = Σ(hⱼ × vⱼ) + b = ${fmt(result.logits[digit])}。得分可以为负，还不是概率。`],
    ['Softmax：把 10 个得分变成概率', `先减去最大得分 ${fmt(Math.max(...result.logits))}，再取指数并归一化。10 个概率之和 = ${result.probabilities.reduce((a,b)=>a+b,0).toFixed(6)}。`],
  ];
  $('stage-detail').innerHTML = `<strong>${messages[stage][0]}</strong><p>${messages[stage][1]}</p>`;
}
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.type !== 'streamlit:render') return;
  const args = event.data.args;
  if (!args?.model) return;
  model = args.model;
  if (!initialized) {
    initialize(args.mnist_model); initialized = true; update(); sync();
  }
  resize();
});
send('streamlit:componentReady', {apiVersion:1});
