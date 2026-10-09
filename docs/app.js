import {SCENE,clamp,point,rectangle,validBox,pngDimensions,extractC05,exportReview} from './core.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let image=null,source=null,boxes=[],selected=null,reviewer='',mode='visible_body',transform={x:0,y:0,scale:1},fitScale=1,history=[],gesture=null,pointers=new Map(),serial=0,busy=false;
const message=text=>$('status').textContent=text;
const current=()=>boxes.find(b=>b.id===selected);
const snapshot=()=>JSON.stringify(boxes);
function remember(){history.push(snapshot());if(history.length>50)history.shift();}
function clean(){boxes=[];selected=null;history=[];serial=0;$('notes').value='';$('coverage').value='';$('ack').checked=false;update();}
function update(){
  $('count').textContent=boxes.length;$('boxes').replaceChildren();
  for(const b of boxes){const row=document.createElement('div');row.className='box-row'+(b.id===selected?' selected':'');const text=document.createElement('span');text.textContent=`${b.id} · ${b.category==='IGNORE'?'IGNORE':'Corpo visível'} · ${b.certainty==='supported'?'sustentada':'aproximada'} · (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) ${b.width.toFixed(1)} × ${b.height.toFixed(1)}`;const button=document.createElement('button');button.textContent='Ajustar';button.addEventListener('click',()=>{selected=b.id;setMode('select');update();});row.append(text,button);$('boxes').append(row);}
  const b=current();$('selection').disabled=!b;for(const k of ['x','y','width','height'])$(k).value=b?Math.round(b[k]*10)/10:'';$('certainty').value=b?.certainty||'supported';$('boxnote').value=b?.note||'';
  $('undo').disabled=!history.length||busy;$('export').disabled=!source||!reviewer||!$('coverage').value||!$('ack').checked||busy;render();
}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===value)));}
function fit(){if(!image)return;fitScale=Math.min(canvas.clientWidth/SCENE.width,canvas.clientHeight/SCENE.height);transform={scale:fitScale,x:(canvas.clientWidth-SCENE.width*fitScale)/2,y:(canvas.clientHeight-SCENE.height*fitScale)/2};render();}
function render(){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,3);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!image)return;
  ctx.save();ctx.translate(transform.x,transform.y);ctx.scale(transform.scale,transform.scale);ctx.drawImage(image,0,0,1280,576);
  const all=[...boxes];if(gesture?.type==='draw')all.push({...rectangle(gesture.start,gesture.end),category:mode});
  for(const b of all){const color=b.category==='IGNORE'?'#ffbd6b':'#72e0cf';ctx.lineWidth=2/transform.scale;ctx.strokeStyle=color;ctx.fillStyle=b.category==='IGNORE'?'#ffbd6b22':'#72e0cf18';ctx.setLineDash(b.category==='IGNORE'?[7/transform.scale,5/transform.scale]:[]);ctx.fillRect(b.x,b.y,b.width,b.height);ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.setLineDash([]);if(b.id){ctx.font=`${13/transform.scale}px system-ui`;ctx.fillStyle='#07111f';const tw=ctx.measureText(b.id).width;const ly=Math.max(0,b.y-20/transform.scale);ctx.fillRect(b.x,ly,tw+8/transform.scale,20/transform.scale);ctx.fillStyle=color;ctx.fillText(b.id,b.x+4/transform.scale,ly+15/transform.scale);}if(b.id===selected){for(const p of corners(b)){ctx.fillStyle=color;ctx.fillRect(p.x-6/transform.scale,p.y-6/transform.scale,12/transform.scale,12/transform.scale);}}}
  ctx.restore();$('zoom').textContent=`${Math.round(transform.scale/fitScale*100)}%`;
}
function corners(b){return [{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];}
function local(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function midpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function zoom(factor,anchor={x:canvas.clientWidth/2,y:canvas.clientHeight/2}){if(!image)return;const s=clamp(transform.scale*factor,fitScale,fitScale*12),k=s/transform.scale;transform={scale:s,x:anchor.x-(anchor.x-transform.x)*k,y:anchor.y-(anchor.y-transform.y)*k};render();}
canvas.addEventListener('pointerdown',e=>{
  if(!image||!reviewer||busy){message(!reviewer?'Selecione um revisor antes de anotar.':'Abra a imagem antes de anotar.');return;}e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=local(e);pointers.set(e.pointerId,p);
  if(pointers.size===2){if(gesture?.before)boxes=JSON.parse(gesture.before);const [a,b]=[...pointers.values()],m=midpoint(a,b);gesture={type:'pinch',distance:Math.max(1,distance(a,b)),start:m,transform:{...transform}};update();return;}
  if(pointers.size>2)return;
  const q=point(p.x,p.y,transform);if(mode==='pan'){gesture={type:'pan',start:p,transform:{...transform}};return;}
  if(mode==='select'){
    const active=current();let handle=active?corners(active).findIndex(c=>distance(c,q)<20/transform.scale):-1;
    const b=handle>=0?active:[...boxes].reverse().find(b=>q.x>=b.x&&q.x<=b.x+b.width&&q.y>=b.y&&q.y<=b.y+b.height);
    selected=b?.id||null;if(b)gesture={type:handle>=0?'resize':'move',handle,start:q,box:{...b},before:snapshot()};update();return;
  }
  if(p.x<transform.x||p.y<transform.y||p.x>transform.x+1280*transform.scale||p.y>transform.y+576*transform.scale)return;
  gesture={type:'draw',start:q,end:q,before:snapshot()};render();
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;e.preventDefault();const p=local(e);pointers.set(e.pointerId,p);if(!gesture)return;
  if(gesture.type==='pinch'&&pointers.size>=2){const [a,b]=[...pointers.values()],m=midpoint(a,b),old=gesture.transform;const s=clamp(old.scale*distance(a,b)/gesture.distance,fitScale,fitScale*12),k=s/old.scale;transform={scale:s,x:m.x-(gesture.start.x-old.x)*k,y:m.y-(gesture.start.y-old.y)*k};render();return;}
  if(gesture.type==='pan'){transform.x=gesture.transform.x+p.x-gesture.start.x;transform.y=gesture.transform.y+p.y-gesture.start.y;render();return;}
  const q=point(p.x,p.y,transform);
  if(gesture.type==='draw'){gesture.end=q;render();return;}
  const b=current();if(!b)return;
  if(gesture.type==='move'){b.x=clamp(gesture.box.x+q.x-gesture.start.x,0,1280-b.width);b.y=clamp(gesture.box.y+q.y-gesture.start.y,0,576-b.height);}
  else if(gesture.type==='resize'){const opposite=corners(gesture.box)[(gesture.handle+2)%4],r=rectangle(opposite,q);if(validBox(r))Object.assign(b,r);}
  render();
});
function endPointer(e){
  if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);
  if(gesture?.type==='pinch'){if(pointers.size===1){gesture={type:'pan',start:[...pointers.values()][0],transform:{...transform}};}else gesture=null;return;}
  if(e.type==='pointercancel'){if(gesture?.before)boxes=JSON.parse(gesture.before);gesture=null;update();return;}
  if(gesture?.type==='draw'){const b=rectangle(gesture.start,gesture.end);if(validBox(b)&&b.width*transform.scale>=4&&b.height*transform.scale>=4){remember();const id=`B${++serial}`;boxes.push({id,category:mode,...b,certainty:'approximate',note:''});selected=id;}}
  else if(gesture?.before&&snapshot()!==gesture.before){history.push(gesture.before);if(history.length>50)history.shift();}
  gesture=null;update();
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('wheel',e=>{if(!image)return;e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,local(e));},{passive:false});
$('reviewer').addEventListener('change',()=>{if((boxes.length||$('notes').value||$('coverage').value)&&!confirm('Trocar de revisor limpa a revisão atual. Exporte antes se quiser preservá-la. Continuar?')){$('reviewer').value=reviewer;return;}reviewer=$('reviewer').value;gesture=null;pointers.clear();clean();});
$('file').addEventListener('change',async()=>{
  const file=$('file').files[0];$('file').value='';if(!file)return;if((boxes.length||$('notes').value)&&!confirm('Abrir outro arquivo limpa a revisão atual. Continuar?'))return;
  busy=true;$('file').disabled=true;source=null;image=null;gesture=null;pointers.clear();clean();$('empty').hidden=false;message('Verificando arquivo local…');let url;
  try{
    if(file.size>100*1024*1024)throw Error('Arquivo maior que 100 MB. Selecione o PNG C05.');
    let bytes=new Uint8Array(await file.arrayBuffer()),path=null;const zip=/\.zip$/i.test(file.name);
    if(zip){const result=await extractC05(bytes.buffer);bytes=result.bytes;path=result.path;}else if(file.name!=='C05_frame_23835.png')throw Error('Selecione exatamente C05_frame_23835.png.');
    if(bytes.length>20*1024*1024)throw Error('PNG maior que 20 MB.');
    const dimensions=pngDimensions(bytes);if(dimensions.width!==1280||dimensions.height!==576)throw Error(`Resolução ${dimensions.width} × ${dimensions.height}; exigida 1280 × 576. Nenhuma escala foi aplicada.`);
    if(!crypto.subtle)throw Error('SHA-256 indisponível. Abra a aplicação pelo endereço HTTPS publicado.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));const decoded=new Image();decoded.src=url;await decoded.decode();if(decoded.naturalWidth!==1280||decoded.naturalHeight!==576)throw Error('Dimensões decodificadas não conferem.');
    image=decoded;source={filename:'C05_frame_23835.png',containerFilename:file.name,containerType:zip?'zip':'png',zipEntry:path,pngBytes:bytes.length,sha256:hash,...dimensions,provenance:'User-selected local file; PNG bytes unchanged; no video verification or remote transfer.'};$('provenance').textContent=JSON.stringify(source,null,2);$('empty').hidden=true;fit();message('C05 verificado · 1280 × 576 · SHA-256 calculado.');
  }catch(error){message(error.message);$('provenance').textContent='Imagem não verificada.';}finally{if(url)URL.revokeObjectURL(url);busy=false;$('file').disabled=false;update();}
});
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));
$('in').onclick=()=>zoom(1.4);$('out').onclick=()=>zoom(1/1.4);$('fit').onclick=fit;
$('undo').onclick=()=>{if(history.length){boxes=JSON.parse(history.pop());selected=null;update();}};
$('delete').onclick=()=>{if(!current())return;remember();boxes=boxes.filter(b=>b.id!==selected);selected=null;update();};
$('apply').onclick=()=>{const b=current();if(!b)return;const r=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number($(k).value)]));if(!validBox(r)){message('Coordenadas inválidas: mantenha a caixa dentro de 1280 × 576, com largura e altura ≥ 1.');return;}remember();Object.assign(b,r,{certainty:$('certainty').value,note:$('boxnote').value});update();message('Ajustes aplicados em pixels originais.');};
for(const id of ['coverage','ack'])$(id).addEventListener('change',update);
$('export').onclick=()=>{try{const data=exportReview({reviewer,source,boxes,coverage:$('coverage').value,notes:$('notes').value});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`review-C05-${reviewer}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message('JSON gerado localmente. Confira o arquivo em Downloads/Arquivos do aparelho.');}catch(error){message(error.message);}};
new ResizeObserver(()=>{if(image)fit();else render();}).observe($('viewport'));update();
