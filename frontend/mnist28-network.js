/* Pure inference and grayscale brush operations. No downloaded code executes. */
(function(root) {
  'use strict';
  const clip = v => Math.max(0, Math.min(1, v));
  function forward(pixels, model) {
    if (!Array.isArray(pixels) || pixels.length !== 784 || pixels.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error('Expected 784 grayscale values in [0,1]');
    let a = pixels;
    const layers = model.layers.map((layer, index) => {
      const weighted = Array(layer.biases.length).fill(0);
      for (let i = 0; i < a.length; i++) for (let j = 0; j < weighted.length; j++) weighted[j] += a[i] * layer.weights[i][j];
      const z = weighted.map((v,j) => v + layer.biases[j]);
      if (index === model.layers.length - 1) {
        const max = Math.max(...z), exp = z.map(v => Math.exp(v - max)), sum = exp.reduce((x,y) => x+y,0);
        a = exp.map(v => v/sum);
      } else a = z.map(v => Math.max(0,v));
      return {weighted, z, a};
    });
    return {layers, probabilities:a, prediction:a.indexOf(Math.max(...a)), blank:!pixels.some(Boolean)};
  }
  function paint(pixels, from, to, radius=1.2, opacity=1, erase=false) {
    const dx=to[0]-from[0],dy=to[1]-from[1],length=dx*dx+dy*dy;
    for(let row=0;row<28;row++)for(let col=0;col<28;col++) {
      const t=length ? clip(((col-from[0])*dx+(row-from[1])*dy)/length) : 0;
      const distance=Math.hypot(col-from[0]-t*dx,row-from[1]-t*dy);
      const strength=clip(radius+.5-distance)*opacity, i=row*28+col;
      if(strength>0) pixels[i]=Math.round(255*(erase ? pixels[i]*(1-strength) : Math.max(pixels[i],strength)))/255;
    }
    return pixels;
  }
  // Preserve the drawing; the network diagram shows the centered model input.
  function center(pixels) {
    const ink=pixels.map((v,i)=>v>.02?i:-1).filter(i=>i>=0);
    if(!ink.length)return pixels.slice();
    const xs=ink.map(i=>i%28),ys=ink.map(i=>Math.floor(i/28));
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left+1,height=Math.max(...ys)-top+1;
    const scale=20/Math.max(width,height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    const out=Array(784).fill(0),ox=Math.floor((28-w)/2),oy=Math.floor((28-h)/2);
    const get=(x,y)=>pixels[Math.max(top,Math.min(top+height-1,y))*28+Math.max(left,Math.min(left+width-1,x))];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const sx=left+(x+.5)*width/w-.5,sy=top+(y+.5)*height/h-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      out[(y+oy)*28+x+ox]=clip((1-fx)*(1-fy)*get(ix,iy)+fx*(1-fy)*get(ix+1,iy)+(1-fx)*fy*get(ix,iy+1)+fx*fy*get(ix+1,iy+1));
    }
    const mass=out.reduce((a,b)=>a+b,0),cx=out.reduce((a,v,i)=>a+v*(i%28),0)/mass,cy=out.reduce((a,v,i)=>a+v*Math.floor(i/28),0)/mass;
    const tx=Math.round(13.5-cx),ty=Math.round(13.5-cy),shifted=Array(784).fill(0);
    for(let y=0;y<28;y++)for(let x=0;x<28;x++)if(x+tx>=0&&x+tx<28&&y+ty>=0&&y+ty<28)shifted[(y+ty)*28+x+tx]=Math.round(out[y*28+x]*255)/255;
    return shifted;
  }
  const api={forward,paint,center};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Mnist28Net=api;
})(typeof window==='undefined'?globalThis:window);
