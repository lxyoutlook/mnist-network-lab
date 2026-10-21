/* Guided, shape-explicit matrix calculation. Every displayed number comes from the current model. */
window.MatrixLesson = (() => {
  'use strict';
  const el = id => document.getElementById(id);
  const titles = ['展平成向量', '第一层矩阵乘法', '第一层加偏置', 'ReLU 激活', '第二层矩阵乘法', '第二层加偏置', 'Softmax 概率', '选出分类'];
  const shapes = ['12×12 → 1×144', '144 → 128', '128 + 128', '128 → 128', '128 → 10', '10 + 10', '10 → 10', '10 → 1 个类别'];
  let api, ready = false, step = 0, focus = 0, dotCount = 144, softPhase = 2;
  let playTimer = null, detailTimer = null, detailMode = '', signature = '';
  const number = (v, digits = 5) => v === 0 ? '0' : Math.abs(v) < 0.0001 ? v.toExponential(3) : v.toFixed(digits);
  const percent = v => v === 0 ? '0%' : v < 0.000001 ? `${(v * 100).toExponential(3)}%` : `${(v * 100).toFixed(4)}%`;
  const sub = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[+d]);
  const token = (symbol, label, shape, output = false) => `<div class="tensor-token ${output ? 'output' : ''}"><b>${symbol}</b><span>${label}</span><em>${shape}</em></div>`;
  const op = sign => `<span class="tensor-op">${sign}</span>`;

  function stopDetail() {clearInterval(detailTimer); detailTimer = null; detailMode = '';}
  function stopPlay() {clearInterval(playTimer); playTimer = null; el('lesson-play').textContent = '连续播放 8 步';}
  function go(next, automatic = false) {
    if (!automatic) stopPlay();
    stopDetail(); step = Math.max(0, Math.min(7, next));
    dotCount = step === 4 ? 128 : 144; softPhase = 2;
    render();
  }
  function initialize(config) {
    api = config; ready = true;
    titles.forEach((title, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'lesson-step';
      button.innerHTML = `${i + 1}. ${title}<small>${shapes[i]}</small>`;
      button.onclick = () => go(i); el('lesson-steps').appendChild(button);
    });
    el('lesson-prev').onclick = () => go(step - 1);
    el('lesson-next').onclick = () => go(step + 1);
    el('lesson-play').onclick = () => {
      if (playTimer) {stopPlay(); return;}
      go(0, true); el('lesson-play').textContent = '暂停连续播放';
      playTimer = setInterval(() => {
        if (step >= 7) {stopPlay(); return;}
        go(step + 1, true); if (step === 7) stopPlay();
      }, +el('lesson-speed').value);
    };
    el('lesson-speed').onchange = () => {if (playTimer) {stopPlay(); el('lesson-play').click();}};
  }
  function update(inputChanged = false) {
    if (!ready || el('matrix-lesson').hidden || !api.getState().result) return;
    const current = api.getState();
    const nextSignature = current.pixels.join('');
    if (inputChanged && signature !== nextSignature) {
      stopPlay(); stopDetail(); dotCount = step === 4 ? 128 : 144;
      focus = current.pixels.findIndex(Boolean); if (focus < 0) focus = 0;
    }
    signature = nextSignature; render();
  }

  function vector(id, label, values, prefix, selected, kind, options = {}) {
    const cells = values.map((v, i) => {
      const binary = options.binary, clipped = options.before && options.before[i] < 0;
      return `<button type="button" class="vector-cell ${binary ? 'binary' : ''} ${binary && v ? 'ink' : ''} ${clipped ? 'clipped' : ''} ${i === selected ? 'selected' : ''}" data-kind="${kind}" data-index="${i}" title="${prefix}${i + (kind === 'digit' ? 0 : 1)} = ${v}"><small>${prefix}${sub(i + (kind === 'digit' ? 0 : 1))}</small><strong>${binary ? v : number(v)}</strong></button>`;
    }).join('');
    return `<div class="lesson-vector-block"><div class="lesson-vector-caption"><strong>${label}</strong><small>1×${values.length} · 全部 ${values.length} 项${values.length > 10 ? '，可横向滚动' : ''}</small></div><div id="${id}" class="vector-strip">${cells}</div></div>`;
  }
  function followVector(id, index) {
    const strip = el(id); if (!strip) return;
    const item = strip.children[index]; if (!item) return;
    strip.scrollLeft = Math.max(0, item.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + item.offsetWidth / 2);
  }
  function highlightVector(id, index) {
    const strip = el(id); if (!strip) return;
    [...strip.children].forEach((item, i) => item.classList.toggle('selected', i === index));
    followVector(id, index);
  }
  function selector(id, count, selected, prefix, zeroBased = false) {
    return `<select id="${id}">${Array.from({length: count}, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${prefix}${zeroBased ? i : i + 1}</option>`).join('')}</select>`;
  }
  function bindVectors() {
    el('lesson-content').querySelectorAll('.vector-cell').forEach(item => {
      item.onclick = () => {
        stopDetail(); const index = +item.dataset.index;
        if (item.dataset.kind === 'pixel') {focus = index; if (step === 0) updateFlatten(); else {dotCount = index + 1; renderDotPartial(true);}}
        else if (item.dataset.kind === 'hidden') {if(step===4&&item.parentElement.id==='multiply-input')dotCount=index+1;api.chooseNeuron(index);}
        else api.chooseDigit(index);
      };
    });
  }
  function equation() {
    const x = token('x', '输入行向量', '1×144'), w1 = token('W₁', '第一层权重矩阵', '144×128');
    const s1 = token('s₁', '第一层乘法结果', '1×128', true), b1 = token('b₁', '第一层偏置', '1×128');
    const z1 = token('z₁', '激活前的结果', '1×128', true), h = token('h', '隐藏层输出', '1×128', true);
    const w2 = token('W₂', '第二层权重矩阵', '128×10'), s2 = token('s₂', '第二层乘法结果', '1×10', true);
    const b2 = token('b₂', '第二层偏置', '1×10'), z2 = token('z₂', '10 个分类得分', '1×10', true), p = token('p', '10 个类别概率', '1×10', true);
    return [
      token('I', '01 的手写画板', '12×12') + op('→') + token('按行展开', '只改变排列方式', '144 个值不变') + op('→') + x,
      x + op('×') + w1 + op('=') + s1,
      s1 + op('+') + b1 + op('=') + z1,
      z1 + op('→') + token('max(0,z)', '每一项分别处理', '负数变 0') + op('→') + h,
      h + op('×') + w2 + op('=') + s2,
      s2 + op('+') + b2 + op('=') + z2,
      z2 + op('→') + token('Softmax', '指数 + 归一化', '概率之和 = 1') + op('→') + p,
      p + op('→') + token('argmax', '取最大概率的位置', '位置对应数字 0–9') + op('→') + token('ŷ', '最终分类', '1 个数字', true),
    ][step];
  }
  function render() {
    if (!ready || !api.getState().result) return;
    const s = api.getState();
    el('lesson-progress').textContent = `第 ${step + 1} / 8 步`;
    [...el('lesson-steps').children].forEach((b, i) => {
      b.classList.toggle('current', i === step); b.classList.toggle('complete', i < step);
      b.setAttribute('aria-current', i === step ? 'step' : 'false');
    });
    el('lesson-prev').disabled = step === 0; el('lesson-next').disabled = step === 7;
    el('lesson-equation').innerHTML = equation();
    const explanation = [
      '先把 01 的画板写成一个数值矩阵 I。<strong>逐行从左到右读取</strong>：第 1 行成为 x₁…x₁₂，第 2 行成为 x₁₃…x₂₄，直到第 12 行。数值始终是 0 或 1。',
      '矩阵乘法的规则是<strong>输入的一整行 × 权重矩阵的一整列，得到一个数</strong>。x 有 144 项，W₁ 每列也有 144 项；对 128 列各做一次点积，得到 128 个数。此步还没有加偏置。',
      '把上一页的 128 个乘法结果，与 128 个偏置<strong>按位置相加</strong>。s₁ 的第 j 项加 b₁ 的第 j 项，得到 z₁ 的第 j 项；向量长度仍为 128。',
      '对 z₁ 的每一项分别计算 <strong>hⱼ = max(0, z₁ⱼ)</strong>：负数置 0，正数保留原值。得到的 h 就是第二层真正接收的输入。',
      '这次把上一页的 <strong>128 维 h × 128×10 的 W₂</strong>。每一列对应一个数字：第 1 列是 0，第 10 列是 9。128 次乘加得到一个数字的 s₂ 得分；10 列得到 10 个数。',
      '将 10 个乘法结果与第二层的 10 个偏置<strong>逐项相加</strong>，得到 z₂。这 10 个数称为 logits（分类得分），可以为负，还不是概率。',
      '对 10 个 z₂ 得分<strong>先减最大值，再取指数，最后除以指数总和</strong>。指数都为正，归一化后得到 10 个非负概率，总和为 1。减最大值提高数值稳定性，不改变数学上的概率。',
      'Softmax 得到的是一个 <strong>10 维概率向量</strong>。再用 argmax 找到最大概率的位置，按固定顺序 [0,1,2,3,4,5,6,7,8,9] 映射到最终数字。',
    ];
    el('lesson-explanation').innerHTML = explanation[step];
    if (step === 0) renderFlatten(s);
    else if (step === 1 || step === 4) renderMultiply();
    else if (step === 2 || step === 5) renderBias(s);
    else if (step === 3) renderRelu(s);
    else if (step === 6) renderSoftmax(s);
    else renderClassify(s);
    const transitions = [
      '本步产出 <b>x [1×144]</b> → 下一步把这个 x 乘以 <b>W₁ [144×128]</b>。',
      '本步产出 <b>s₁ [1×128]</b> → 下一步加上 <b>b₁ [1×128]</b>；每个神经元各加一个偏置。',
      '本步产出 <b>z₁ [1×128]</b> → 下一步对这 128 个数分别应用 <b>ReLU</b>。',
      '本步产出 <b>h [1×128]</b> → 下一步把 h 乘以 <b>W₂ [128×10]</b>。',
      '本步产出 <b>s₂ [1×10]</b> → 下一步加上 <b>b₂ [1×10]</b>。',
      '本步产出 <b>z₂ [1×10]</b> → 下一步用 <b>Softmax</b> 得到概率。',
      '本步产出 <b>p [1×10]</b> → 下一步取 <b>argmax(p)</b>，得到最终分类。',
      `本次完整链：<b>I → x → xW₁ → +b₁ → ReLU → hW₂ → +b₂ → Softmax → ${s.result.prediction}</b>。${s.result.blank ? '当前输入为空白；这里保留原模型的强制分类结果，不能当作有效识别。' : ''}`,
    ];
    el('lesson-handoff').innerHTML = transitions[step];
    bindVectors();
    if (step === 1 || step === 4) renderDotPartial();
  }

  function renderFlatten(s) {
    let source = '<span class="axis">行/列</span>';
    for (let c = 0; c < 12; c++) source += `<span class="axis">${c + 1}</span>`;
    for (let r = 0; r < 12; r++) {
      source += `<span class="axis">${r + 1}</span>`;
      for (let c = 0; c < 12; c++) {
        const i = r * 12 + c;
        source += `<button type="button" class="source-cell ${s.pixels[i] ? 'ink' : ''}" data-pixel="${i}" title="I[${r+1},${c+1}] → x${i+1}">${s.pixels[i]}</button>`;
      }
    }
    el('lesson-content').innerHTML = `<div class="flatten-layout"><div><h3>I：与 01 完全相同的 12×12 数值</h3><div class="source-numeric">${source}</div></div><div class="flatten-detail"><h3>按行展开，不做缩放，也不丢掉像素</h3><div class="row-order">第 1 行 → <b>x₁…x₁₂</b><br>第 2 行 → <b>x₁₃…x₂₄</b><br>…<br>第 12 行 → <b>x₁₃₃…x₁₄₄</b></div><div id="flatten-mapping" class="mapping-example"></div><div class="inline-controls"><button id="flatten-play">${detailMode === 'flatten' ? '暂停展开' : '播放 144 项展开'}</button><label for="flatten-position">查看像素</label>${selector('flatten-position',144,focus,'x')}</div><p class="footnote">点击左侧像素或下方向量分量，查看它们的一一对应；绘画仍在 01 进行。</p></div></div>` + vector('flatten-vector','本步输出 x：真正的 1×144 行向量',s.pixels,'x',focus,'pixel',{binary:true});
    el('lesson-content').querySelectorAll('[data-pixel]').forEach(b => {b.onclick = () => {stopDetail(); focus = +b.dataset.pixel; updateFlatten();};});
    el('flatten-position').onchange = () => {stopDetail(); focus = +el('flatten-position').value; updateFlatten();};
    el('flatten-play').onclick = () => {
      if (detailTimer) {stopDetail(); el('flatten-play').textContent = '播放 144 项展开'; return;}
      focus = 0; detailMode = 'flatten'; el('flatten-play').textContent = '暂停展开'; updateFlatten();
      detailTimer = setInterval(() => {focus++; if (focus >= 143) {focus = 143; stopDetail(); el('flatten-play').textContent = '播放 144 项展开';} updateFlatten();},65);
    };
    updateFlatten();
  }
  function updateFlatten() {
    const s = api.getState(), r = Math.floor(focus / 12), c = focus % 12;
    el('flatten-position').value = String(focus);
    el('flatten-mapping').innerHTML = `I[${r+1}, ${c+1}] = ${s.pixels[focus]} &nbsp; → &nbsp; x${sub(focus+1)} = ${s.pixels[focus]}<small>向量序号 = 12 × (${r+1} − 1) + ${c+1} = ${focus+1}</small>`;
    el('lesson-content').querySelectorAll('[data-pixel]').forEach(b => {const i=+b.dataset.pixel;b.classList.toggle('active-row',Math.floor(i/12)===r);b.classList.toggle('focus',i===focus);});
    highlightVector('flatten-vector',focus);
  }

  function dotData() {
    const s = api.getState(), first = step === 1;
    const left = first ? s.pixels : s.result.h, matrix = first ? s.model.w1 : s.model.w2;
    const column = first ? s.neuron : s.digit, products = left.map((v,i)=>v*matrix[i][column]);
    const prefix = [0]; products.forEach(v=>prefix.push(prefix[prefix.length-1]+v));
    return {s,first,left,matrix,column,products,prefix,output:first?s.result.weighted1:s.result.weighted2};
  }
  function renderMultiply() {
    const d = dotData(), n = d.left.length;
    dotCount = Math.min(dotCount,n);
    const target = d.first ? `H${d.column+1}` : `数字 ${d.column}`;
    el('lesson-content').innerHTML = `<div class="input-origin">输入来源：${d.first?'第 1 步展开的 x，保持同样的 144 项顺序。':'第 4 步 ReLU 产生的 h，包含全部 128 个隐藏层输出。'}</div>` +
      vector('multiply-input',d.first?'输入 x [1×144]':'输入 h [1×128]',d.left,d.first?'x':'h',Math.max(0,dotCount-1),d.first?'pixel':'hidden',{binary:d.first})+
      `<div class="inline-controls"><label for="matrix-target">选中 W${d.first?'₁':'₂'} 的一列</label>${selector('matrix-target',d.output.length,d.column,d.first?'H':'数字 ',!d.first)}<span class="muted">这一列 → 结果向量中的 ${target}</span></div><div class="matrix-workbench"><div class="matrix-expanse"><h3>W${d.first?'₁':'₂'}：${n} 行 × ${d.output.length} 列，每列对应一个输出</h3><div id="matrix-window" class="full-matrix-host"></div></div><div class="dot-calc"><h3>输入整行 × 当前列 → 一个数</h3><div class="dot-big">s${d.first?'₁':'₂'}[${d.first?d.column+1:'数字 '+d.column}] = <span>Σ<sub>i=1</sub><sup>${n}</sup></span> ( ${d.first?'xᵢ × W₁[i,':'hᵢ × W₂[i,'}${d.column+1}] )</div><div class="inline-controls"><button id="matrix-dot-play">${detailMode==='dot'?'暂停乘加':'播放这一列的乘加'}</button><span id="matrix-dot-count"></span></div><input id="matrix-dot-index" type="range" aria-label="矩阵点积累计项数" min="0" max="${n}" value="${dotCount}"><div class="calculation-line"><span id="dot-left-label">当前输入</span><b id="dot-left-value"></b></div><div class="calculation-line"><span id="dot-weight-label">对应权重</span><b id="dot-weight-value"></b></div><div class="calculation-line"><span>当前项的乘积</span><b id="dot-product"></b></div><div class="calculation-line"><span id="dot-prefix-label">累计</span><b id="dot-prefix"></b></div><div id="dot-final" class="dot-final"></div><p class="dot-note">只慢放当前这一列；其余列显示完整结果。下一步才加偏置。</p></div></div>`+
      vector('multiply-output',d.first?'本步输出 s₁：128 个点积，分别对应 H1…H128':'本步输出 s₂：10 个点积，分别对应数字 0…9',d.output,d.first?'s₁,':'s₂,',d.column,d.first?'hidden':'digit');
    WeightMatrixView.mount(el('matrix-window'), {matrix:d.matrix, layer:d.first?1:2,
      sourceId:d.s.model.metadata.source_sha256, row:Math.max(0,dotCount-1), column:d.column,
      onSelect:(column,row)=>{stopDetail();if(row!==null)dotCount=row+1;d.first?api.chooseNeuron(column):api.chooseDigit(column);
        if(row!==null)WeightMatrixView.setSelection(row,column,{followRow:true,followColumn:true});}});
    el('matrix-target').onchange = () => {stopDetail(); d.first?api.chooseNeuron(+el('matrix-target').value):api.chooseDigit(+el('matrix-target').value);};
    el('matrix-dot-index').oninput = () => {stopDetail();dotCount=+el('matrix-dot-index').value;el('matrix-dot-play').textContent='播放这一列的乘加';renderDotPartial(true);};
    el('matrix-dot-play').onclick = () => {
      if (detailTimer) {stopDetail();el('matrix-dot-play').textContent='播放这一列的乘加';return;}
      dotCount=0;detailMode='dot';el('matrix-dot-play').textContent='暂停乘加';renderDotPartial(true);
      detailTimer=setInterval(()=>{dotCount++;if(dotCount>=n){dotCount=n;stopDetail();el('matrix-dot-play').textContent='播放这一列的乘加';}renderDotPartial(true);},75);
    };
  }
  function renderDotPartial(followMatrix = false) {
    if (step!==1&&step!==4) return;
    const d=dotData(), i=Math.max(0,dotCount-1), n=d.left.length;
    el('matrix-dot-index').value=String(dotCount);el('matrix-dot-count').textContent=`已累加 ${dotCount} / ${n} 项`;
    WeightMatrixView.setSelection(i,d.column,{followRow:followMatrix,followColumn:followMatrix});
    const prefix=dotCount?d.prefix[dotCount]:0;
    el('dot-left-label').textContent=dotCount?`${d.first?'x':'h'}${sub(i+1)}（第 ${i+1} 项）`:'当前输入';
    el('dot-left-value').textContent=dotCount?number(d.left[i]):'—';
    el('dot-weight-label').textContent=`W${d.first?'₁':'₂'}[${i+1}, ${d.column+1}]`;
    el('dot-weight-value').textContent=dotCount?number(d.matrix[i][d.column],7):'—';
    el('dot-product').textContent=dotCount?`${number(d.left[i],3)} × ${number(d.matrix[i][d.column],5)} = ${number(d.products[i],7)}`:'尚未开始';
    el('dot-prefix-label').textContent=`前 ${dotCount} 项之和`;
    el('dot-prefix').textContent=number(prefix,7);
    el('dot-final').innerHTML=dotCount===n?`本列完成：<b>s${d.first?'₁':'₂'}[${d.first?d.column+1:'数字 '+d.column}] = ${number(d.output[d.column],7)}</b>`:'当前显示的是部分和，尚未完成这一列。';
    highlightVector('multiply-input',i);highlightVector('multiply-output',d.column);
    const outputCell=el('multiply-output').children[d.column];
    outputCell.querySelector('strong').textContent=number(dotCount===n?d.output[d.column]:prefix);
    outputCell.querySelector('small').textContent=dotCount===n?`${d.first?'s₁,':'s₂,'}${sub(d.first?d.column+1:d.column)}`:'部分和';
    outputCell.title=dotCount===n?`${d.first?'s₁,':'s₂,'}${d.first?d.column+1:d.column} = ${d.output[d.column]}`:`前 ${dotCount} 项的部分和 = ${prefix}`;
  }

  function renderBias(s) {
    const first=step===2, a=first?s.result.weighted1:s.result.weighted2, b=first?s.model.b1:s.model.b2;
    const z=first?s.result.z1:s.result.logits, index=first?s.neuron:s.digit, kind=first?'hidden':'digit';
    const suffix=first?'₁':'₂';
    el('lesson-content').innerHTML=vector('bias-input',`上一步的 s${suffix}`,a,`s${suffix},`,index,kind)+
      vector('bias-value',`固定模型参数 b${suffix}：一项对应一个偏置`,b,`b${suffix},`,index,kind)+
      `<div class="element-check">选中第 ${index+1} 项${first?'（H'+(index+1)+'）':'（数字 '+index+'）'}：<b>${number(a[index],7)} + (${number(b[index],7)}) = ${number(z[index],7)}</b><br>其余 ${a.length-1} 项也按同样的位置分别相加。</div>`+
      vector('bias-output',`本步输出 z${suffix}：长度仍为 ${z.length}`,z,`z${suffix},`,index,kind);
    ['bias-input','bias-value','bias-output'].forEach(id=>followVector(id,index));
  }
  function renderRelu(s) {
    const n=s.neuron, pre=s.result.z1, h=s.result.h;
    el('lesson-content').innerHTML=vector('relu-before','上一步的 z₁：128 个激活前数值',pre,'z₁,',n,'hidden')+
      `<div class="element-check">选中 H${n+1}：<b>h${sub(n+1)} = max(0, ${number(pre[n],7)}) = ${number(h[n],7)}</b><br>${pre[n]<0?'这一项为负数，所以被置为 0。':'这一项非负，所以保持原值。'}</div>`+
      vector('relu-after','本步输出 h：128 个实际送入第二层的数值',h,'h',n,'hidden',{before:pre})+
      `<div class="relu-counts"><span><strong>${pre.filter(v=>v<0).length}</strong> 个负数置 0（浅橙色）</span><span><strong>${pre.filter(v=>v>0).length}</strong> 个正数保留</span><span><strong>${pre.filter(v=>v===0).length}</strong> 个原本就是 0</span></div>`;
    followVector('relu-before',n);followVector('relu-after',n);
  }
  function renderSoftmax(s) {
    const max=Math.max(...s.result.logits);
    const phaseNames=['① 每项减去最大值','② 对每项取 exp','③ 除以 exp 总和'];
    el('lesson-content').innerHTML=vector('softmax-input','上一步的 z₂：对应数字 0…9 的 10 个得分',s.result.logits,'z₂,',s.digit,'digit')+
      `<div class="phase-tabs">${phaseNames.map((name,i)=>`<button data-phase="${i}" class="${softPhase===i?'selected':''}">${name}</button>`).join('')}<button id="softmax-play">${detailMode==='softmax'?'暂停 Softmax':'逐步播放 Softmax'}</button></div><div class="softmax-common"><span>共同减去的最大值 m = <b>${number(max,7)}</b></span><span id="softmax-denominator" ${softPhase<2?'hidden':''}>共同的分母 S = Σ exp(z₂−m) = <b>${number(s.result.denominator,8)}</b></span></div><div class="lesson-table-scroll"><table id="lesson-softmax-table"><thead><tr><th>数字</th><th>输入得分 z₂</th><th>① z₂ − m</th><th>② exp(z₂ − m)</th><th>③ exp ÷ S = 概率</th></tr></thead><tbody>${s.result.logits.map((v,k)=>`<tr data-digit="${k}" class="${k===s.digit?'highlight':''}"><td>${k}${k===s.result.prediction?' · 最大概率':''}</td><td>${number(v,7)}</td><td>${number(v-max,7)}</td><td class="${softPhase<1?'hidden-phase':''}">${softPhase>=1?number(s.result.exponentials[k],8):'下一步计算'}</td><td class="${softPhase<2?'hidden-phase':''}">${softPhase>=2?percent(s.result.probabilities[k]):'下一步计算'}</td></tr>`).join('')}</tbody></table></div><p class="softmax-label">${softPhase===0?'先把最大得分平移为 0，其余得分相对平移，尚未变成概率。':softPhase===1?'指数已经全部为正。将这 10 个指数相加，下一步用同一个分母归一化。':`归一化完成：Σ p = ${s.result.probabilities.reduce((a,b)=>a+b,0).toFixed(10)}。表格使用科学计数法保留很小的非零概率。`}</p>`+
      (softPhase===2?vector('softmax-output','本步输出 p：10 个概率，顺序仍为数字 0…9',s.result.probabilities,'p',s.digit,'digit'):'');
    el('lesson-content').querySelectorAll('[data-phase]').forEach(b=>{b.onclick=()=>{stopDetail();softPhase=+b.dataset.phase;render();};});
    el('lesson-content').querySelectorAll('tr[data-digit]').forEach(row=>{row.onclick=()=>api.chooseDigit(+row.dataset.digit);});
    el('softmax-play').onclick=()=>{
      if(detailTimer){stopDetail();el('softmax-play').textContent='逐步播放 Softmax';return;}
      softPhase=0;detailMode='softmax';render();
      detailTimer=setInterval(()=>{softPhase++;if(softPhase>=2){softPhase=2;stopDetail();}render();},1400);
    };
  }
  function renderClassify(s) {
    const k=s.result.prediction;
    el('lesson-content').innerHTML=vector('classify-input','上一步的概率向量 p',s.result.probabilities,'p',k,'digit')+
      `<div class="classify-summary"><span class="classify-number">${k}</span><div><p><strong>argmax(p) = ${k}</strong>，对应数字 ${k}，概率 ${percent(s.result.probabilities[k])}。</p><p class="muted">${s.result.blank?'当前画板是空白。这是原模型的强制分类输出，不表示有效识别。':'取最大概率的位置完成分类；不是把 10 个概率相加来决定类别。'}</p></div></div><div class="class-bars">${s.result.probabilities.map((p,i)=>`<div class="class-bar-row ${i===k?'winner':''}"><span>数字 ${i}</span><div class="class-bar-track"><i style="width:${p*100}%"></i></div><span class="bar-prob">${percent(p)}</span></div>`).join('')}</div><div class="element-check">完整公式：<b>p = Softmax(max(0, xW₁ + b₁)W₂ + b₂)</b><br>分类：<b>ŷ = argmax(p)</b>。所有中间向量都来自上面各步的同一次计算。</div>`;
  }
  function pause() {stopPlay(); stopDetail();}
  return {initialize, update, pause};
})();
