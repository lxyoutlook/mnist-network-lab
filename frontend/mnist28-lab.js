/* Independent 784-input demo; the Excel model and its lesson remain separate. */
window.Mnist28Lab = (() => {
  'use strict';
  const $=id=>document.getElementById(`mnist28-${id}`),NS='http://www.w3.org/2000/svg';
  const stageNames=['784 灰度输入','隐藏层 1 · ReLU','隐藏层 2 · ReLU','输出得分','Softmax'];
  let model,onChange,result,pixels=Array(784).fill(0),history=[],tool='pen',drawing=false,last=null,stage=4,timer=null,frame=null;
  let inputPixels=Array(784).fill(0);
  const selected=[0,0,0],fmt=v=>Number(v).toFixed(5);
  function stop(){clearInterval(timer);timer=null;if($('play'))$('play').textContent='播放流程';}
  function notify(){onChange({pixels:inputPixels.slice(),raw_pixels:pixels.slice(),probabilities:result.probabilities.slice()});}
  function remember(){history.push(pixels.slice());if(history.length>50)history.shift();}
  function replace(next,save=true){if(save)remember();pixels=next.slice();stop();stage=4;update();notify();}
  function setTool(value){tool=value;for(const id of ['pen','eraser']){$(id).classList.toggle('selected',id===value);$(id).setAttribute('aria-pressed',String(id===value));}}
  function point(event){const rect=$('board').getBoundingClientRect();return [(event.clientX-rect.left)/rect.width*28-.5,(event.clientY-rect.top)/rect.height*28-.5];}
  function paint(event){
    const p=point(event);Mnist28Net.paint(pixels,last||p,p,+$('radius').value,+$('opacity').value,tool==='eraser');last=p;
    if(frame===null)frame=requestAnimationFrame(()=>{frame=null;update();});
  }
  function initialize(options){
    model=options.model;onChange=options.onChange;
    const host=document.getElementById('mnist28-demo');
    host.innerHTML=`<div class="mnist28-workspace"><section class="panel mnist28-input" aria-labelledby="mnist28-title"><div class="mnist28-input-body"><div class="mnist28-drawing"><div id="mnist28-board" class="mnist28-board" role="group" aria-label="28×28 灰度手写画板，784 个真实输入格"></div><div class="board-meta"><span>28 × 28 · 784 个输入 · 灰度 0–255</span><span id="mnist28-ink"></span></div></div><div class="mnist28-controls"><div class="eyebrow">01 / 输入</div><h2 id="mnist28-title">28×28 灰度笔画</h2><p class="muted">柔边画笔保留灰度，逐格对应 784 个输入。</p><div class="tools"><button id="mnist28-pen" class="selected" aria-pressed="true">画笔</button><button id="mnist28-eraser" aria-pressed="false">橡皮</button><button id="mnist28-undo">撤销</button><button id="mnist28-clear">清空</button></div><label class="mnist28-slider" for="mnist28-radius">笔宽 <input id="mnist28-radius" type="range" min="0.7" max="2.5" value="1.2" step="0.1"><span id="mnist28-radius-value">2.4 格</span></label><label class="mnist28-slider" for="mnist28-opacity">浓度 <input id="mnist28-opacity" type="range" min="0.1" max="1" value="1" step="0.05"><span id="mnist28-opacity-value">100%</span></label><div id="mnist28-prediction" class="prediction" aria-live="polite"></div></div></div></section><section class="panel flow-panel" aria-labelledby="mnist28-flow-title"><div class="panel-head"><div><div class="eyebrow">02 / 前向传播</div><h2 id="mnist28-flow-title">784 → 256 → 128 → 10</h2></div><span class="model-tag">235,146 个真实参数 · ReLU + Softmax</span></div><p class="mnist28-score">留出集复测：<b>${(model.evaluation.accuracy*100).toFixed(2)}%</b>（${model.evaluation.correct.toLocaleString()} / ${model.evaluation.total.toLocaleString()}）· 按作者随机分层规则划分，非官方固定测试集。<a href="${model.source.url}/tree/${model.source.commit}" target="_blank" rel="noopener noreferrer">GitHub 权重来源</a></p><div id="mnist28-stages" class="stages" role="group" aria-label="MNIST 模型计算阶段"></div><div class="playback"><button id="mnist28-play" class="primary">播放流程</button><button id="mnist28-next">下一步</button><button id="mnist28-restart">回到输入</button><label for="mnist28-speed">速度</label><select id="mnist28-speed"><option value="1800">慢</option><option value="950" selected>中</option><option value="450">快</option></select></div><div class="diagram-wrap"><svg id="mnist28-network" viewBox="0 0 1200 420" role="group" aria-label="MNIST全连接网络：784个输入、第一隐藏层256个神经元、第二隐藏层128个神经元和10个输出"></svg></div><div class="mnist28-selection"><label for="mnist28-neuron1">隐藏层 1 <select id="mnist28-neuron1"></select></label><label for="mnist28-neuron2">隐藏层 2 <select id="mnist28-neuron2"></select></label><label for="mnist28-digit">输出 <select id="mnist28-digit"></select></label></div><div class="legend"><span><i class="line positive"></i>正权重</span><span><i class="line negative"></i>负权重</span><span>全部 784 / 256 / 128 / 10 个节点均显示。连线展开当前选中节点。</span></div><div id="mnist28-detail" class="stage-detail" aria-live="polite"></div></section></div>`;
    for(let i=0;i<784;i++){
      if(i%28===0){const row=document.createElement('div');row.className='mnist28-row';row.setAttribute('role','group');row.setAttribute('aria-label',`MNIST 画板第 ${Math.floor(i/28)+1} 行`);$('board').appendChild(row);}
      const button=document.createElement('button');button.type='button';button.className='pixel';button.dataset.index=i;
      button.onclick=event=>{if(event.detail===0){remember();pixels[i]=pixels[i]>0?0:1;stop();stage=4;update();notify();}};
      $('board').lastElementChild.appendChild(button);
    }
    $('board').onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();$('board').setPointerCapture(event.pointerId);remember();stop();stage=4;drawing=true;last=null;paint(event);};
    $('board').onpointermove=event=>{if(drawing)paint(event);};
    function finish(){if(!drawing)return;drawing=false;last=null;if(frame!==null){cancelAnimationFrame(frame);frame=null;}update();notify();}
    for(const name of ['pointerup','pointercancel','lostpointercapture'])$('board').addEventListener(name,finish);
    $('pen').onclick=()=>setTool('pen');$('eraser').onclick=()=>setTool('eraser');
    $('undo').onclick=()=>{if(history.length)replace(history.pop(),false);};
    $('clear').onclick=()=>replace(Array(784).fill(0));
    $('radius').oninput=()=>{$('radius-value').textContent=`${(+$('radius').value*2).toFixed(1)} 格`;};
    $('opacity').oninput=()=>{$('opacity-value').textContent=`${Math.round(+$('opacity').value*100)}%`;};
    stageNames.forEach((name,i)=>{const button=document.createElement('button');button.type='button';button.className='stage';button.textContent=`${i+1}. ${name}`;button.onclick=()=>{stop();stage=i;render();};$('stages').appendChild(button);});
    $('play').onclick=()=>{if(timer){stop();return;}if(stage>=4)stage=0;render();$('play').textContent='暂停';timer=setInterval(()=>{stage++;if(stage>=4){stage=4;stop();}render();},+$('speed').value);};
    $('next').onclick=()=>{stop();stage=(stage+1)%5;render();};$('restart').onclick=()=>{stop();stage=0;render();};
    $('speed').onchange=()=>{if(timer){stop();$('play').click();}};
    [256,128,10].forEach((count,l)=>{const selector=$(l===2?'digit':`neuron${l+1}`);for(let j=0;j<count;j++)selector.add(new Option(l===2?`数字 ${j}`:`H${l+1}·${j+1}`,String(j)));selector.onchange=()=>{selected[l]=+selector.value;render();};});
    update();
  }
  function update(){
    inputPixels=Mnist28Net.center(pixels);
    result=Mnist28Net.forward(inputPixels,model);selected[2]=result.prediction;
    [...$('board').querySelectorAll('.pixel')].forEach((button,i)=>{
      const value=pixels[i],gray=Math.round(value*255);button.style.backgroundColor=`rgb(${Math.round(246-value*209)},${Math.round(248-value*192)},${Math.round(253-value*158)})`;
      button.setAttribute('aria-label',`MNIST 第 ${Math.floor(i/28)+1} 行，第 ${i%28+1} 列，灰度 ${gray}`);button.setAttribute('aria-pressed',String(value>0));button.title=`x${i+1} = ${gray}/255 = ${value.toFixed(6)}`;
    });
    const ink=pixels.filter(v=>v>0).length,gray=pixels.filter(v=>v>0&&v<1).length;
    $('ink').textContent=`${ink} 个笔画格 · ${gray} 个含灰度`;$('undo').disabled=history.length===0;
    $('prediction').classList.toggle('blank',result.blank);
    $('prediction').innerHTML=result.blank?'<div class="muted">空白画板 · 尚无笔画</div><span class="result">—</span><div class="hint">空白仍有模型概率，不视为有效识别。</div>':`<div class="muted">当前预测</div><div><span class="result">${result.prediction}</span><span class="prob">${(result.probabilities[result.prediction]*100).toFixed(2)}%</span></div><div class="hint">模型概率不等于识别准确率</div>`;
    render();
  }
  function el(tag,attrs,text,parent=$('network')){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
  function render(){
    if(!result)return;
    [...$('stages').children].forEach((b,i)=>{b.classList.toggle('current',i===stage);b.classList.toggle('done',i<stage);b.setAttribute('aria-pressed',String(i===stage));});
    const svg=$('network');svg.replaceChildren();
    const input=i=>[12+i%28*5.5,145+Math.floor(i/28)*5.5];
    const position=(l,j)=>l===0?[300+j%16*20,84+Math.floor(j/16)*18]:l===1?[763+j%8*22,84+Math.floor(j/8)*18]:[1040,103+j*27];
    const titles=[[12,'输入 · 784','28×28 · x ∈ [0,1]'],[284,'隐藏层 1 · 256','W₁ 784×256 ＋ b₁ 256'],[744,'隐藏层 2 · 128','W₂ 256×128 ＋ b₂ 128'],[1022,'输出 · 10','W₃ 128×10 ＋ b₃ 10']];
    titles.forEach(([x,title,note])=>{el('text',{x,y:28,class:'layer-title'},title);el('text',{x,y:49,class:'layer-note'},note);});
    el('rect',{x:283,y:66,width:337,height:303,rx:7,class:'layer-box'});el('rect',{x:744,y:66,width:193,height:303,rx:7,class:'layer-box'});
    for(let l=0;l<3;l++)if(stage>=l+1){
      const values=l===0?inputPixels:result.layers[l-1].a,count=values.length,[tx,ty]=position(l,selected[l]);
      for(let i=0;i<count;i++){
        const [x,y]=l===0?input(i):position(l-1,i),w=model.layers[l].weights[i][selected[l]];
        const startX=x+(l===0?4.5:9),startY=y+(l===0?2:0),endX=tx-(l===2?15:9);
        el('path',{d:`M${startX},${startY} C${(startX+endX)/2},${startY} ${(startX+endX)/2},${ty} ${endX},${ty}`,fill:'none',stroke:w>=0?'#317b8b':'#d47b42','stroke-width':.6,opacity:values[i]>0?.13:.012,'data-layer':l+1});
      }
    }
    const inputGroup=el('g',{role:'group','aria-label':'28×28 灰度输入，全部 784 项'});
    let inputRow;
    for(let i=0;i<784;i++){
      if(i%28===0)inputRow=el('g',{role:'group','aria-label':`输入第 ${Math.floor(i/28)+1} 行`},undefined,inputGroup);
      const [x,y]=input(i),v=inputPixels[i];const node=el('rect',{x,y,width:4.5,height:4.5,fill:`rgb(${Math.round(237-v*200)},${Math.round(240-v*184)},${Math.round(246-v*151)})`,'data-input-index':i},undefined,inputRow);el('title',{},`x${i+1} = ${v.toFixed(6)}`,node);
    }
    for(let l=0;l<2;l++){
      const values=result.layers[l].a,max=Math.max(...values,1e-12);
      for(let j=0;j<values.length;j++){
        const [x,y]=position(l,j),active=stage>=l+1&&values[j]>0,alpha=values[j]/max;
        const group=el('g',{role:'button',tabindex:0,'aria-pressed':String(selected[l]===j),'aria-label':`MNIST 隐藏层 ${l+1} 神经元 ${j+1}，z=${fmt(result.layers[l].z[j])}，ReLU=${fmt(values[j])}`,'data-hidden-layer':l+1,'data-neuron':j,class:'node'});
        el('rect',{x:x-9,y:y-6,width:18,height:13,rx:2,fill:active?`rgb(${Math.round(100-alpha*45)},${Math.round(135-alpha*40)},${Math.round(215-alpha*20)})`:'#edf0f6',stroke:selected[l]===j?'#244bb6':'#d8e1ef','stroke-width':selected[l]===j?1.8:.4},undefined,group);
        el('text',{x,y:y+2.5,'text-anchor':'middle',class:`mnist28-node-label ${active?'active':''}`},String(j+1),group);
        el('title',{},`H${l+1}·${j+1}: z=${fmt(result.layers[l].z[j])}, ReLU=${fmt(values[j])}`,group);
        const choose=()=>{selected[l]=j;render();};group.onclick=choose;group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}};
      }
      el('text',{x:l===0?284:744,y:390,class:'layer-note'},stage>=l+1?`${values.length} 个全部显示 · ${values.filter(v=>v>0).length} 个激活`:`${values.length} 个全部显示 · ReLU`);
      $(`neuron${l+1}`).value=String(selected[l]);
    }
    for(let k=0;k<10;k++){
      const [x,y]=position(2,k),group=el('g',{role:'button',tabindex:0,class:'node','aria-label':`MNIST 输出数字 ${k}，概率 ${(100*result.probabilities[k]).toFixed(4)}%`,'aria-pressed':String(selected[2]===k)});
      el('rect',{x:x-15,y:y-10,width:170,height:23,rx:3,fill:selected[2]===k?'#edf1ff':'white'},undefined,group);el('text',{x,y:y+4},String(k),group);
      el('rect',{x:x+20,y:y-5,width:70,height:10,fill:'#edf0f6',rx:2},undefined,group);
      el('rect',{x:x+20,y:y-5,width:stage>=4?70*result.probabilities[k]:0,height:10,fill:k===result.prediction?'#3b61db':'#a4b5ec',rx:2},undefined,group);
      el('text',{x:x+97,y:y+4,class:'layer-note'},stage>=4?`${(result.probabilities[k]*100).toFixed(2)}%`:stage>=3?fmt(result.layers[2].z[k]):'—',group);
      const choose=()=>{selected[2]=k;render();};group.onclick=choose;group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}};
    }
    $('digit').value=String(selected[2]);
    const descriptions=[['784 个灰度值，逐格送入第一层',`图中为参与计算的 784 个灰度输入：x = 灰度 / 255；当前 ${inputPixels.filter(v=>v>0&&v<1).length} 个分量介于 0 与 1。W₁ 有 784×256 = 200,704 个权重。`],...Array.from({length:2},(_,l)=>{const j=selected[l],v=result.layers[l];return [`隐藏层 ${l+1} · 神经元 ${j+1}`,`Σ ${model.architecture[l]} 项乘积 = ${fmt(v.weighted[j])}；加偏置 ${fmt(model.layers[l].biases[j])} 得 z = ${fmt(v.z[j])}；ReLU(z) = ${fmt(v.a[j])}。`];}),[`数字 ${selected[2]} 的输出得分`,`Σ 128 项乘积 = ${fmt(result.layers[2].weighted[selected[2]])}；加偏置 ${fmt(model.layers[2].biases[selected[2]])} 得 z = ${fmt(result.layers[2].z[selected[2]])}。`],['Softmax：10 个得分变成分类概率',`z 先减最大值 ${fmt(Math.max(...result.layers[2].z))}，再取 exp 并除以指数总和。Σ p = ${result.probabilities.reduce((a,b)=>a+b,0).toFixed(6)}；${result.blank?'画板空白，不作有效识别':`最大概率对应数字 ${result.prediction}`}。`]];
    $('detail').innerHTML=`<strong>${descriptions[stage][0]}</strong><p>${descriptions[stage][1]}</p>`;
  }
  function show(){render();notify();}
  function hide(){stop();}
  return {initialize,show,hide};
})();
