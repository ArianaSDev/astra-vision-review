import {validateManifest,MAX_MANIFEST_BYTES,MAX_FILE_BYTES,sha256} from './manifest.js';
import {DEFAULT_EXTENT,clamp,point,rectangle,validBox,pngDimensions,extractPNG,verifyPNG,exportReview,regionSignature,invalidateRegion,conferRegion,regionConferred,conferenceSummary,restoreRegions,contextWindow} from './core.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let image=null,source=null,boxes=[],selected=null,reviewer='',mode='visible_body',transform={x:0,y:0,scale:1},fitScale=1,history=[],gesture=null,pointers=new Map(),serial=0,busy=false,reviewingId=null;
let manifest=null,manifestSource=null,scene=null,operation=0,exportedState=null,editorKey=null,editorBaseline=null;
const extent=()=>scene||DEFAULT_EXTENT;
const message=text=>$('status').textContent=text;
const current=()=>boxes.find(b=>b.id===selected);
const snapshot=()=>JSON.stringify(boxes);
function remember(){history.push(snapshot());if(history.length>50)history.shift();}
function clean(){exportedState=null;editorKey=null;editorBaseline=null;setMode('visible_body');reviewingId=null;$('empty-scene').checked=false;boxes=[];selected=null;history=[];serial=0;$('notes').value='';$('coverage').value='';$('ack').checked=false;update();}
function update(){
  $('count').textContent=boxes.length;$('boxes').replaceChildren();
  for(const b of boxes){const row=document.createElement('div');row.className='box-row'+(b.id===selected?' selected':'');const text=document.createElement('span');text.textContent=`${b.id} · ${b.category==='IGNORE'?'IGNORE':'Corpo visível'} · ${b.certainty==='supported'?'sustentada':'aproximada'} · ${regionConferred(b,reviewer)?(b.conference.decision==='indeterminate'?'conferida: indeterminável':'conferida'):'conferência pendente'} · (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) ${b.width.toFixed(1)} × ${b.height.toFixed(1)}`;const button=document.createElement('button');button.textContent='Ajustar';button.addEventListener('click',()=>{selected=b.id;setMode('select');update();});row.append(text,button);$('boxes').append(row);}
  const b=current();$('selection').disabled=!b||busy;const key=b?regionSignature(b):null;if(key!==editorKey){for(const k of ['x','y','width','height'])$(k).value=b?Math.round(b[k]*10)/10:'';$('certainty').value=b?.certainty||'supported';$('boxnote').value=b?.note||'';editorKey=key;editorBaseline=editorValues();}
  for(const id of ['coverage','notes','ack'])$(id).disabled=busy;document.querySelectorAll('[data-mode]').forEach(el=>el.disabled=busy);$('manifest').disabled=busy;$('scene').disabled=!manifest;$('file').disabled=!scene||busy;$('undo').disabled=!history.length||busy;updateConference();$('export').disabled=!source||!reviewer||!$('coverage').value||!$('ack').checked||busy||!!gesture||conferenceSummary(boxes,reviewer,$('empty-scene').checked).status!=='complete';render();
}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===value)));}
function drawConferenceView(el,b,view){
  const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio||1,3),c=el.getContext('2d');el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const scale=Math.min(w/view.width,h/view.height),x=(w-view.width*scale)/2,y=(h-view.height*scale)/2;
  c.drawImage(image,view.x,view.y,view.width,view.height,x,y,view.width*scale,view.height*scale);
  c.strokeStyle=b.category==='IGNORE'?'#ffbd6b':'#72e0cf';c.lineWidth=2;c.setLineDash(b.category==='IGNORE'?[7,5]:[]);c.strokeRect(x+(b.x-view.x)*scale,y+(b.y-view.y)*scale,b.width*scale,b.height*scale);
}
function updateConference(){
  const summary=conferenceSummary(boxes,reviewer,$('empty-scene').checked),b=boxes.find(b=>b.id===reviewingId);
  $('conference-progress').textContent=boxes.length?`${summary.reviewedRegions} de ${boxes.length} regiões conferidas, incluindo IGNORE.`:($('empty-scene').checked?'Passagem com zero caixas confirmada.':'Zero caixas: confirme explicitamente o exame da cena.');
  $('review-start').disabled=!source||!reviewer||!boxes.length||busy||!!gesture;
  $('empty-scene-label').hidden=boxes.length>0;$('empty-scene').disabled=!source||!reviewer||busy;
  const active=!!(image&&source&&reviewer&&b&&!busy);$('region-review').hidden=!active;
  for(const id of ['review-keep','review-adjust','review-indeterminate','review-prev','review-next','review-close'])$(id).disabled=!active||!!gesture;
  if(!active)return;
  $('review-title').textContent=`${b.id} · ${b.category==='IGNORE'?'IGNORE':'Corpo visível'}`;
  $('review-state').textContent=regionConferred(b,reviewer)?(b.conference.decision==='indeterminate'?'Conferida: limites registrados como não determináveis com segurança.':'Conferida: caixa mantida, com a incerteza informada.'): 'Conferência pendente. A vista ampliada não altera as coordenadas.';
  drawConferenceView($('review-crop'),b,contextWindow(b,extent()));drawConferenceView($('review-overview'),b,{x:0,y:0,width:scene.width,height:scene.height});
}
function openReview(){
  if(!image||!reviewer||!boxes.length||busy||gesture)return;
  const pending=boxes.find(b=>b.id===reviewingId&&!regionConferred(b,reviewer))||boxes.find(b=>!regionConferred(b,reviewer));
  reviewingId=(pending||current()||boxes[0]).id;update();$('region-review').scrollIntoView({block:'start',behavior:'smooth'});
}
function changeReview(delta){const i=boxes.findIndex(b=>b.id===reviewingId);if(i<0)return;reviewingId=boxes[(i+delta+boxes.length)%boxes.length].id;update();}
function confirmDisplayed(decision){
  const b=boxes.find(b=>b.id===reviewingId);if(!b||!source||!reviewer||busy||gesture||$('region-review').hidden)return;
  conferRegion(b,decision,reviewer,extent());const next=boxes.find(candidate=>!regionConferred(candidate,reviewer));if(next)reviewingId=next.id;update();
  message(next?'Decisão registrada. Examine a próxima região.':'Conferência individual concluída. O resultado continua provisório.');
}
function fit(){if(!image)return;fitScale=Math.min(canvas.clientWidth/scene.width,canvas.clientHeight/scene.height);transform={scale:fitScale,x:(canvas.clientWidth-scene.width*fitScale)/2,y:(canvas.clientHeight-scene.height*fitScale)/2};render();}
function render(){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,3);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!image)return;
  ctx.save();ctx.translate(transform.x,transform.y);ctx.scale(transform.scale,transform.scale);ctx.drawImage(image,0,0,scene.width,scene.height);
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
  if(!image||!reviewer||busy){message(!reviewer?'Selecione um revisor antes de anotar.':'Abra a imagem antes de anotar.');return;}e.preventDefault();$('export').disabled=true;canvas.setPointerCapture(e.pointerId);const p=local(e);pointers.set(e.pointerId,p);
  if(pointers.size===2){if(gesture?.before)boxes=JSON.parse(gesture.before);const [a,b]=[...pointers.values()],m=midpoint(a,b);gesture={type:'pinch',distance:Math.max(1,distance(a,b)),start:m,transform:{...transform}};update();return;}
  if(pointers.size>2)return;
  const q=point(p.x,p.y,transform,extent());if(mode==='pan'){gesture={type:'pan',start:p,transform:{...transform}};return;}
  if(mode==='select'){
    const active=current();let handle=active?corners(active).findIndex(c=>distance(c,q)<20/transform.scale):-1;
    const b=handle>=0?active:[...boxes].reverse().find(b=>q.x>=b.x&&q.x<=b.x+b.width&&q.y>=b.y&&q.y<=b.y+b.height);
    selected=b?.id||null;if(b)gesture={type:handle>=0?'resize':'move',handle,start:q,box:{...b},before:snapshot()};update();return;
  }
  if(p.x<transform.x||p.y<transform.y||p.x>transform.x+scene.width*transform.scale||p.y>transform.y+scene.height*transform.scale)return;
  gesture={type:'draw',start:q,end:q,before:snapshot()};render();
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;e.preventDefault();const p=local(e);pointers.set(e.pointerId,p);if(!gesture)return;
  if(gesture.type==='pinch'&&pointers.size>=2){const [a,b]=[...pointers.values()],m=midpoint(a,b),old=gesture.transform;const s=clamp(old.scale*distance(a,b)/gesture.distance,fitScale,fitScale*12),k=s/old.scale;transform={scale:s,x:m.x-(gesture.start.x-old.x)*k,y:m.y-(gesture.start.y-old.y)*k};render();return;}
  if(gesture.type==='pan'){transform.x=gesture.transform.x+p.x-gesture.start.x;transform.y=gesture.transform.y+p.y-gesture.start.y;render();return;}
  const q=point(p.x,p.y,transform,extent());
  if(gesture.type==='draw'){gesture.end=q;render();return;}
  const b=current();if(!b)return;
  if(gesture.type==='move'){b.x=clamp(gesture.box.x+q.x-gesture.start.x,0,scene.width-b.width);b.y=clamp(gesture.box.y+q.y-gesture.start.y,0,scene.height-b.height);}
  else if(gesture.type==='resize'){const opposite=corners(gesture.box)[(gesture.handle+2)%4],r=rectangle(opposite,q);if(validBox(r,extent()))Object.assign(b,r);}
  render();
});
function endPointer(e){
  if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);
  if(gesture?.type==='pinch'){if(pointers.size===1){gesture={type:'pan',start:[...pointers.values()][0],transform:{...transform}};}else gesture=null;update();return;}
  if(e.type==='pointercancel'){if(gesture?.before)boxes=JSON.parse(gesture.before);gesture=null;update();return;}
  if(gesture?.type==='draw'){const b=rectangle(gesture.start,gesture.end);if(validBox(b,extent())&&b.width*transform.scale>=4&&b.height*transform.scale>=4){remember();const id=`B${++serial}`;boxes.push(invalidateRegion({id,category:mode,...b,certainty:'approximate',note:''}));$('empty-scene').checked=false;selected=id;}}
  else if(gesture?.before&&snapshot()!==gesture.before){if(current())invalidateRegion(current());history.push(gesture.before);if(history.length>50)history.shift();}
  gesture=null;update();
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('wheel',e=>{if(!image)return;e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,local(e));},{passive:false});
function editorValues(){return ['x','y','width','height','certainty','boxnote'].map(k=>String($(k).value));}
function pendingEditor(){return !!current()&&JSON.stringify(editorValues())!==JSON.stringify(editorBaseline);}
function reviewState(){return JSON.stringify({boxes,notes:$('notes').value,coverage:$('coverage').value,ack:$('ack').checked,empty:$('empty-scene').checked,editor:pendingEditor()?editorValues():null});}
function dirty(){return !!gesture||pendingEditor()||(exportedState!==null?reviewState()!==exportedState:!!(boxes.length||history.length||$('notes').value||$('coverage').value||$('ack').checked||$('empty-scene').checked));}
function allowDiscard(){return !dirty()||confirm('Esta sessão tem estado não exportado, incluindo campos e conferências. Descartar e continuar?');}
function cancelImport(){operation++;busy=false;gesture=null;pointers.clear();}
function clearImage(){source=null;image=null;$('empty').hidden=false;$('provenance').textContent='Imagem não verificada.';transform={x:0,y:0,scale:1};fitScale=1;clean();}
function showScene(){ $('scene-label').textContent=scene?.id||'Nenhuma cena';canvas.setAttribute('aria-label','Imagem da cena e caixas provisórias');message(scene?`Cena ${scene.id} · abra o PNG esperado ou ZIP local.`:'Carregue um manifesto local validado.');}
$('reviewer').addEventListener('change',()=>{
  const next=$('reviewer').value;if(next===reviewer)return;
  if(!allowDiscard()){$('reviewer').value=reviewer;return;}
  cancelImport();reviewer=next;clean();update();
});
$('scene').addEventListener('change',()=>{
  const next=manifest?.scenes.find(s=>s.id===$('scene').value)||null;
  if(next===scene)return;if(!allowDiscard()){$('scene').value=scene?.id||'';return;}
  cancelImport();scene=next;clearImage();showScene();
});
$('manifest').addEventListener('change',async()=>{
  const file=$('manifest').files[0];$('manifest').value='';if(!file)return;
  if(!allowDiscard())return;
  cancelImport();const token=++operation;busy=true;update();const startedState=reviewState();message('Validando manifesto local…');
  try{
    if(file.size>MAX_MANIFEST_BYTES)throw Error('Manifesto maior que 1 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());if(token!==operation)return;
    const parsed=validateManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    const hash=await sha256(bytes);if(token!==operation)return;if(reviewState()!==startedState)throw Error('Estado alterado durante carregamento; manifesto não aplicado.');
    manifest=parsed;manifestSource={filename:file.name,bytes:bytes.length,sha256:hash,schema:parsed.schema};scene=null;
    $('scene').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione uma cena…';$('scene').append(placeholder);
    for(const item of manifest.scenes){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.id;$('scene').append(opt);}
    $('scene').value='';clearImage();showScene();
  }catch(error){if(token===operation)message(error.message);}
  finally{if(token===operation){busy=false;update();}}
});
$('file').addEventListener('change',async()=>{
  const file=$('file').files[0];$('file').value='';if(!file||!scene)return;if(!allowDiscard())return;
  cancelImport();const token=++operation,expected=scene,binding=manifestSource;busy=true;clearImage();const startedState=reviewState();message('Verificando arquivo local contra o manifesto…');let url;
  try{
    if(file.size>MAX_FILE_BYTES)throw Error('Arquivo maior que 100 MB. Selecione o PNG da cena.');
    let bytes=new Uint8Array(await file.arrayBuffer()),path=null;const zip=/\.zip$/i.test(file.name);if(token!==operation)return;
    if(zip){const result=await extractPNG(bytes.buffer,expected.pngPath);bytes=result.bytes;path=result.path;}else if(file.name!==expected.pngPath.split('/').at(-1))throw Error('Nome PNG não corresponde à cena selecionada.');
    if(token!==operation)return;
    const verified=await verifyPNG(bytes,expected);if(token!==operation)return;
    url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));const decoded=new Image();decoded.src=url;await decoded.decode();if(token!==operation||scene!==expected||manifestSource!==binding)return;
    if(reviewState()!==startedState)throw Error('Estado alterado durante carregamento; imagem não aplicada.');
    if(decoded.naturalWidth!==expected.width||decoded.naturalHeight!==expected.height)throw Error('Dimensões decodificadas não conferem.');
    image=decoded;source={sceneId:expected.id,filename:expected.pngPath.split('/').at(-1),containerFilename:file.name,containerType:zip?'zip':'png',zipEntry:path,...verified,provenance:'User-selected local PNG bytes verified against local manifest; no upload or independent video verification.'};$('provenance').textContent=JSON.stringify({scene:expected,manifestSource:binding,source},null,2);$('empty').hidden=true;fit();message(`Cena ${expected.id} verificada · ${expected.width} × ${expected.height} · SHA-256 corresponde.`);
  }catch(error){if(token===operation){message(error.message);$('provenance').textContent='Imagem não verificada.';}}
  finally{if(url)URL.revokeObjectURL(url);if(token===operation){busy=false;update();}}
});
window.addEventListener('beforeunload',event=>{if(dirty()||busy){event.preventDefault();event.returnValue='';}});
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));
$('in').onclick=()=>zoom(1.4);$('out').onclick=()=>zoom(1/1.4);$('fit').onclick=fit;
$('undo').onclick=()=>{if(!busy&&!gesture&&history.length){boxes=restoreRegions(JSON.parse(history.pop()),boxes);$('empty-scene').checked=false;selected=null;update();}};
$('delete').onclick=()=>{if(busy||gesture||!current())return;remember();boxes=boxes.filter(b=>b.id!==selected);$('empty-scene').checked=false;selected=null;update();};
$('apply').onclick=()=>{const b=current();if(busy||gesture||!b)return;const r=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number($(k).value)]));if(!validBox(r,extent())){message('Coordenadas inválidas: mantenha a caixa dentro da imagem original, com largura e altura ≥ 1.');return;}const before=regionSignature(b);remember();Object.assign(b,r,{certainty:$('certainty').value,note:$('boxnote').value});if(regionSignature(b)!==before)invalidateRegion(b);update();message('Ajustes aplicados em pixels originais.');};
for(const id of ['coverage','ack','empty-scene'])$(id).addEventListener('change',update);
$('export').onclick=()=>{try{if(busy||gesture||!$('ack').checked)throw Error('Conclua a edição e confirme esta passagem independente.');if(pendingEditor())throw Error('Aplique ou descarte os campos de ajuste pendentes antes de exportar.');const data=exportReview({reviewer,scene,manifestSource,source,boxes,coverage:$('coverage').value,notes:$('notes').value,emptySceneExamined:$('empty-scene').checked});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`review-${scene.id}-${reviewer}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();exportedState=reviewState();setTimeout(()=>URL.revokeObjectURL(url),30000);message('JSON gerado localmente. Confira o arquivo em Downloads/Arquivos do aparelho.');}catch(error){message(error.message);}};
$('review-start').onclick=openReview;
$('review-keep').onclick=()=>confirmDisplayed('keep');$('review-indeterminate').onclick=()=>confirmDisplayed('indeterminate');
$('review-prev').onclick=()=>changeReview(-1);$('review-next').onclick=()=>changeReview(1);
$('review-close').onclick=()=>{reviewingId=null;update();};
$('review-adjust').onclick=()=>{
  const b=boxes.find(b=>b.id===reviewingId);if(!b||busy||gesture)return;
  invalidateRegion(b);selected=b.id;setMode('select');reviewingId=null;
  const view=contextWindow(b,extent()),scale=clamp(Math.min(canvas.clientWidth/view.width,canvas.clientHeight/view.height),fitScale,fitScale*12);
  transform={scale,x:canvas.clientWidth/2-(b.x+b.width/2)*scale,y:canvas.clientHeight/2-(b.y+b.height/2)*scale};update();
  canvas.scrollIntoView({block:'center',behavior:'smooth'});message('Ajuste esta região e use Conferir caixas novamente. As demais conferências foram preservadas.');
};
new ResizeObserver(()=>{if(image)fit();else render();updateConference();}).observe($('viewport'));update();
