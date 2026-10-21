/* Full, scrollable weight tables, preserving every original model value. */
window.WeightMatrixView = (() => {
  'use strict';
  const cache = new Map();
  let active = null;
  const label = (layer, column) => layer === 1 ? `H${column + 1}` : `数字 ${column}`;
  const display = value => value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(2) : value.toFixed(4);

  function createRecord(options) {
    const {matrix, layer, sourceId} = options;
    const rows = matrix.length, columns = matrix[0].length;
    const table = document.createElement('table');
    table.className = 'full-weight-table';
    table.setAttribute('aria-label', `W${layer} 全部 ${rows} 行 ${columns} 列权重`);
    table.style.setProperty('--matrix-cols', columns);
    let html = '<colgroup><col class="matrix-index-col">';
    for (let c = 0; c < columns; c++) html += '<col>';
    html += '</colgroup><thead><tr><th class="matrix-corner" scope="col">i / j</th>';
    for (let c = 0; c < columns; c++) html += `<th scope="col" data-column="${c}"><button type="button" title="第 ${c+1} 列">${label(layer,c)}</button></th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += `<tr><th scope="row" class="matrix-row-index">${r+1}</th>`;
      for (let c = 0; c < columns; c++) {
        const value = matrix[r][c];
        html += `<td data-row="${r}" data-column="${c}" title="W${layer}[${r+1},${c+1}] = ${value}">${display(value)}</td>`;
      }
      html += '</tr>';
    }
    table.innerHTML = html + '</tbody>';
    const record = {table, matrix, layer, sourceId, rows, columns, row:-1, column:-1,
      density:'compact', left:0, top:0};
    table.addEventListener('click', event => {
      const cell = event.target.closest('[data-column]');
      if (cell && active?.record === record) active.onSelect(+cell.dataset.column,
        cell.dataset.row === undefined ? null : +cell.dataset.row);
    });
    return record;
  }
  function fitHeight() {
    if (!active || !active.host.isConnected) return;
    let viewport;
    try {viewport=window.parent.innerHeight;} catch {viewport=window.screen.availHeight;}
    // Use the outer viewport, since vh in a self-sizing iframe can grow recursively.
    const height=Math.max(340,Math.min(1050,viewport-145));
    active.host.style.setProperty('--matrix-height',`${height}px`);
  }
  function mount(host, options) {
    let record=cache.get(options.layer);
    if(!record || record.sourceId!==options.sourceId) {record=createRecord(options);cache.set(options.layer,record);}
    active={host,record,onSelect:options.onSelect};
    host.innerHTML=`<div class="matrix-view-toolbar"><strong>完整数值</strong><label for="matrix-density">字号 <select id="matrix-density"><option value="compact">紧凑</option><option value="clear">清晰</option></select></label><span>全部 ${record.rows} × ${record.columns} = ${(record.rows*record.columns).toLocaleString()} 个权重</span></div><div id="matrix-scroll" class="matrix-scroll" tabindex="0" role="region" aria-label="W${options.layer} 完整矩阵，可上下左右滚动"></div><div id="matrix-visible-range" class="matrix-visible-range" aria-live="off"></div><div id="matrix-value" class="matrix-value">悬停查看精确权重，点击数值可联动乘加。</div>`;
    const scroll=host.querySelector('#matrix-scroll'); scroll.appendChild(record.table);
    scroll.dataset.density=record.density;
    scroll.scrollLeft=record.left;scroll.scrollTop=record.top;
    scroll.addEventListener('scroll',()=>{record.left=scroll.scrollLeft;record.top=scroll.scrollTop;updateRange();});
    scroll.addEventListener('pointerover',event=>{
      const cell=event.target.closest('td[data-row]');
      if(cell) showValue(+cell.dataset.row,+cell.dataset.column);
    });
    host.querySelector('#matrix-density').value=record.density;
    host.querySelector('#matrix-density').onchange=event=>{
      record.density=event.target.value;scroll.dataset.density=record.density;
      setSelection(record.row,record.column,{followRow:true,followColumn:true});
    };
    fitHeight();setSelection(options.row,options.column,{followColumn:true});
  }
  function setSelection(row,column,{followRow=false,followColumn=false}={}) {
    if(!active)return;
    const {record,host}=active, table=record.table, body=table.tBodies[0];
    if(record.row>=0)body.rows[record.row].classList.remove('matrix-active-row');
    if(record.column>=0){table.querySelectorAll('col')[record.column+1].classList.remove('matrix-active-column');table.tHead.rows[0].cells[record.column+1].classList.remove('matrix-active-column');}
    if(record.row>=0&&record.column>=0)body.rows[record.row].cells[record.column+1].classList.remove('matrix-active-cell');
    record.row=row;record.column=column;
    body.rows[row].classList.add('matrix-active-row');
    table.querySelectorAll('col')[column+1].classList.add('matrix-active-column');
    table.tHead.rows[0].cells[column+1].classList.add('matrix-active-column');
    const cell=body.rows[row].cells[column+1];cell.classList.add('matrix-active-cell');
    const scroll=host.querySelector('#matrix-scroll');
    if(followColumn){const left=cell.offsetLeft;if(left<scroll.scrollLeft+42||left+cell.offsetWidth>scroll.scrollLeft+scroll.clientWidth)scroll.scrollLeft=Math.max(0,left-scroll.clientWidth/2);}
    if(followRow){const top=cell.offsetTop;if(top<scroll.scrollTop+24||top+cell.offsetHeight>scroll.scrollTop+scroll.clientHeight)scroll.scrollTop=Math.max(0,top-scroll.clientHeight/2);}
    updateRange();
  }
  function updateRange() {
    if(!active)return;
    const {host,record}=active, output=host.querySelector('#matrix-visible-range');
    const scroll=host.querySelector('#matrix-scroll'), rowHeight=record.table.tBodies[0].rows[0].getBoundingClientRect().height || 16;
    const columnWidth=record.table.tBodies[0].rows[0].cells[1].getBoundingClientRect().width || 48;
    const headerHeight=record.table.tHead.getBoundingClientRect().height || 24;
    const r1=Math.min(record.rows,Math.floor(scroll.scrollTop/rowHeight)+1), r2=Math.min(record.rows,Math.ceil((scroll.scrollTop+scroll.clientHeight-headerHeight)/rowHeight));
    const c1=Math.min(record.columns,Math.floor(scroll.scrollLeft/columnWidth)+1), c2=Math.min(record.columns,Math.ceil((scroll.scrollLeft+scroll.clientWidth-42)/columnWidth));
    output.textContent=`当前可见：行 ${r1}–${Math.max(r1,r2)} / ${record.rows}，列 ${c1}–${Math.max(c1,c2)} / ${record.columns}。右侧上下滚动，底部左右滚动。`;
  }
  function showValue(row,column) {
    if(!active)return;
    const {host,record}=active;
    host.querySelector('#matrix-value').textContent=`W${record.layer===1?'₁':'₂'}[${row+1}, ${column+1}] = ${record.matrix[row][column]} · ${label(record.layer,column)}`;
  }
  window.addEventListener('resize',()=>{fitHeight();updateRange();});
  return {mount,setSelection};
})();
