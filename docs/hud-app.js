import {pngDimensions} from './core.js';
import {indexZip,selectZipEntry,readZipEntry,ZIP_LIMITS} from './zip.js';
import {HUD_STATES,validateCatalog,validateField,sha256,newReview,makeFirstReading,appendFirstReading,exportHud} from './hud.js';
import {openHudStore} from './hud-storage.js';
import {fitImage,zoomImage,downloadJSON} from './viewport.js';

const $=id=>document.getElementById(id),canvas=$('hud-canvas'),ctx=canvas.getContext('2d');
let catalog=null,catalogHash=null,review=null,store=null,saved=[],files=[],archives=[],image=null,source=null,openedAt=null,loading=false,transform={scale:1,x:0,y:0},minimum=1;
const pointers=new Map();let gesture=null;
const status=message=>{$('hud-status').textContent=message;};
let activeCaseIndex=0;
const item=()=>catalog?.cases[activeCaseIndex];
const reading=()=>review?.readings.find(r=>r.captureId===item()?.captureId);
const fieldIds=['state','value','notes','justification'];
function conditions(){return {device:$('hud-device').value,environment:$('hud-environment').value,priorExposure:$('hud-exposure').value,noAssistance:$('hud-no-assistance').checked};}
function update(){
  for(const id of ['hud-catalog','hud-files','hud-case','hud-start','hud-resume','hud-resume-list'])$(id).disabled=loading;
  $('hud-start').disabled=loading||!catalog||!store||!!review;
  $('hud-files').disabled=loading||!review;$('hud-case').disabled=loading||!review;
  $('hud-save').disabled=loading||!source||!review||!!reading();
  $('hud-export').disabled=loading||!review;
  $('hud-progress').textContent=review?`${review.readings.length}/50 leituras seladas · 40 gameplay e 10 controles no catálogo · sessões correlacionadas`:'Nenhuma revisão HUD iniciada.';
  const locked=loading||!!reading()||!source;
  for(const name of ['gold','clock'])for(const id of fieldIds)$(`hud-${name}-${id}`).disabled=locked||(id==='value'&&$(`hud-${name}-state`).value!=='VALUE');
  for(const name of ['gold','clock'])$(`hud-${name}-justification`).required=!!$(`hud-${name}-state`).value&&$(`hud-${name}-state`).value!=='VALUE';
  $('hud-exposure').disabled=locked;$('hud-no-assistance').disabled=locked;
  $('hud-device').disabled=loading||!!review;$('hud-environment').disabled=loading||!!review;
}
function resetFields(){
  for(const name of ['gold','clock'])for(const key of fieldIds)$(`hud-${name}-${key}`).value='';
  $('hud-exposure').value='';$('hud-no-assistance').checked=false;
}
function hasDraft(){return source&&!reading()&&['gold','clock'].some(n=>fieldIds.some(k=>$(`hud-${n}-${k}`).value));}
function formFields(){
  const fields={};
  for(const [name,label] of [['gold','ouro'],['clock','relógio']]){
    const get=key=>$(`hud-${name}-${key}`).value;
    fields[name]={state:get('state'),value:get('state')==='VALUE'?get('value'):null,notes:get('notes'),justification:get('justification')};
    try{validateField(fields[name],label);}catch(e){
      const target=$(`hud-${name}-${/justificativa/i.test(e.message)?'justification':get('state')==='VALUE'?'value':'state'}`);
      target.focus();throw Error(`${label==='ouro'?'Ouro':'Relógio'}: ${e.message}`);
    }
  }
  return fields;
}
async function busy(action){if(loading)return;loading=true;update();try{await action();}catch(e){status(e.message);}finally{loading=false;update();}}
function populateCases(){
  $('hud-case').replaceChildren();
  catalog.cases.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${i+1} · ${c.captureId} · sessão ${c.sessionId}`;$('hud-case').append(o);});
  $('hud-case').value='0';activeCaseIndex=0;previousCase='0';
}
function render(){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,3);if(!w||!h)return;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  if(image){ctx.drawImage(image,transform.x,transform.y,813*transform.scale,366*transform.scale);$('hud-zoom').textContent=`${Math.round(transform.scale/minimum*100)}%`;}
}
function fit(){if(!image)return;transform=fitImage(813,366,canvas.clientWidth,canvas.clientHeight);minimum=transform.scale;render();}
function zoom(factor,anchor={x:canvas.clientWidth/2,y:canvas.clientHeight/2}){if(!image)return;transform=zoomImage(transform,factor,anchor,minimum);render();}
function local(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{
  if(!image)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));
  const points=[...pointers.values()];
  if(points.length===1)gesture={transform:{...transform},start:points[0]};
  else if(points.length===2)gesture={transform:{...transform},start:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance:Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y))};
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;e.preventDefault();pointers.set(e.pointerId,local(e));const p=[...pointers.values()];
  if(p.length===1){transform={...gesture.transform,x:gesture.transform.x+p[0].x-gesture.start.x,y:gesture.transform.y+p[0].y-gesture.start.y};}
  else if(p.length===2&&gesture.distance){const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};transform=zoomImage(gesture.transform,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/gesture.distance,gesture.start,minimum);transform.x+=mid.x-gesture.start.x;transform.y+=mid.y-gesture.start.y;}
  render();
});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);gesture=pointers.size===1?{transform:{...transform},start:[...pointers.values()][0]}:null;});
canvas.addEventListener('wheel',e=>{if(image){e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,local(e));}},{passive:false});
$('hud-in').onclick=()=>zoom(1.4);$('hud-out').onclick=()=>zoom(1/1.4);$('hud-fit').onclick=fit;
$('hud-expand').onclick=()=>{$('hud-viewport').classList.toggle('expanded');fit();};
new ResizeObserver(()=>{if(image)fit();}).observe($('hud-viewport'));

async function loadCase(){
  image=null;source=null;openedAt=null;pointers.clear();gesture=null;resetFields();render();$('hud-provenance').textContent='PNG ainda não verificado.';
  const c=item();if(!c)return;
  const direct=files.filter(f=>f.name===c.filename),matches=[];
  for(const a of archives){const list=a.entries.filter(e=>c.zipEntry?e.name===c.zipEntry:e.name.split(/[\\/]/).pop()===c.filename);for(const entry of list)matches.push({index:a,entry});}
  if(direct.length+matches.length!==1)throw Error(direct.length+matches.length?'Mais de uma origem para este caso; selecione somente o acervo necessário.':'Selecione o PNG ou o ZIP local que contém este caso.');
  let bytes,container,entry=null;
  if(direct.length){if(direct[0].size>ZIP_LIMITS.png)throw Error('PNG acima de 20 MiB.');bytes=new Uint8Array(await direct[0].arrayBuffer());container=direct[0].name;}
  else{const match=matches[0],result=await readZipEntry(match.index,match.entry);bytes=result.bytes;entry=result.path;container=match.index.file.name;}
  const dimensions=pngDimensions(bytes);if(dimensions.width!==813||dimensions.height!==366)throw Error('Exigido PNG original 813 × 366; nenhuma escala é aplicada ao arquivo.');
  const hash=await sha256(bytes);if(hash!==c.sha256)throw Error('SHA-256 diverge do catálogo autorizado. Este caso não pode ser avaliado.');
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));let decoded;
  try{decoded=new Image();decoded.src=url;await decoded.decode();if(decoded.naturalWidth!==813||decoded.naturalHeight!==366)throw Error('Dimensões decodificadas divergentes.');}finally{URL.revokeObjectURL(url);}
  source={filename:c.filename,sha256:hash,pngBytes:bytes.length,...dimensions,containerFilename:container,zipEntry:entry,provenance:'OWNER selected local original; unchanged bytes; display-only zoom'};
  openedAt=new Date().toISOString();image=decoded;fit();$('hud-provenance').textContent=JSON.stringify({captureId:c.captureId,sessionId:c.sessionId,...source},null,2);
  if(reading()){status('Primeira leitura já selada e preservada. Respostas anteriores não são reapresentadas; os campos estão bloqueados.');}
  else status('PNG verificado. Examine os pixels e registre sua leitura sem consultar referências.');
}
async function refreshSaved(){saved=await store.list();$('hud-resume-list').replaceChildren();for(const r of saved){if(r.schema!=='astra-vision-review/hud-1')continue;const o=document.createElement('option');o.value=r.reviewId;o.textContent=`${r.datasetId} · ${r.createdAt} · ${r.readings.length}/50`;$('hud-resume-list').append(o);}}
$('review-workflow').addEventListener('change',async()=>{
  const hud=$('review-workflow').value==='hud';$('box-workflow').hidden=hud;$('hud-workflow').hidden=!hud;
  $('workflow-title').textContent=hud?'HUD · OWNER':'C05';$('workflow-description').textContent=hud?'Leitura humana local · exposição declarada por caso':'Primeira passagem cega · referências provisórias';
  if(hud&&!store)await busy(async()=>{store=await openHudStore();await refreshSaved();status('Revisão OWNER local. Importe somente o catálogo de identidades dos 50 casos.');});
  if(hud)fit();
});
$('hud-catalog').addEventListener('change',()=>busy(async()=>{
  const f=$('hud-catalog').files[0];$('hud-catalog').value='';if(!f)return;
  if(review)throw Error('Retome a revisão existente; não é permitido substituir seu catálogo.');
  if(f.size>256*1024)throw Error('Catálogo acima de 256 KiB.');
  catalog=null;catalogHash=null;
  const bytes=await f.arrayBuffer(),candidate=validateCatalog(JSON.parse(new TextDecoder().decode(bytes)));
  catalog=candidate;catalogHash=await sha256(bytes);populateCases();status('Catálogo validado: 50 identidades; nenhuma resposta foi importada.');
}));
$('hud-start').onclick=()=>busy(async()=>{
  if(!catalog||!store)return;
  if(saved.some(r=>r.catalogSha256===catalogHash||r.datasetId===catalog.datasetId))throw Error('Já existe uma primeira passagem para este conjunto. Use Retomar.');
  const c=conditions();if(!c.device.trim()||!c.environment.trim())throw Error('Informe aparelho e condições da avaliação antes de iniciar.');
  const candidate=newReview(catalog,catalogHash,{device:c.device,environment:c.environment});await store.create(candidate);review=candidate;await refreshSaved();status('Passagem criada localmente. Selecione seus PNGs ou ZIPs; não há envio.');
});
$('hud-resume').onclick=()=>busy(async()=>{
  if(hasDraft()&&!confirm('Descartar os campos ainda não selados e retomar outra passagem?'))return;
  const candidate=saved.find(r=>r.reviewId===$('hud-resume-list').value);if(!candidate)throw Error('Nenhuma passagem local selecionada.');
  const validated=validateCatalog(candidate.catalog);review=structuredClone(candidate);catalog=validated;catalogHash=candidate.catalogSha256;
  files=[];archives=[];image=null;source=null;resetFields();render();populateCases();$('hud-device').value=review.conditions.device;$('hud-environment').value=review.conditions.environment;
  status('Passagem retomada. Selecione novamente os arquivos originais locais para conferir seus hashes.');
});
$('hud-files').addEventListener('change',()=>busy(async()=>{
  if(hasDraft()&&!confirm('Trocar a origem descarta campos ainda não selados. Continuar?'))return;
  image=null;source=null;resetFields();render();files=[];archives=[];
  const selected=[...$('hud-files').files];$('hud-files').value='';
  if(selected.length>60)throw Error('Selecione somente os arquivos necessários a esta passagem.');
  for(const f of selected){
    if(/fanny/i.test(f.name))throw Error('Holdout excluído. Não selecione este arquivo.');
    if(/\.zip$/i.test(f.name))archives.push(await indexZip(f));
    else if(catalog.cases.some(c=>c.filename===f.name))files.push(f);
    else throw Error('Arquivo fora do catálogo autorizado.');
  }
  await loadCase();
}));
let previousCase='0';
$('hud-case').addEventListener('change',()=>{
  if(hasDraft()&&!confirm('Descartar campos ainda não selados e trocar de caso?')){$('hud-case').value=previousCase;return;}
  previousCase=$('hud-case').value;activeCaseIndex=Number(previousCase);return busy(loadCase);
});
for(const n of ['gold','clock'])$('hud-'+n+'-state').addEventListener('change',()=>{if($(`hud-${n}-state`).value!=='VALUE')$(`hud-${n}-value`).value='';update();});
$('hud-save').onclick=()=>busy(async()=>{
  if(!review||!source||reading())throw Error('Caso não verificado ou primeira leitura já selada.');
  const fields=formFields();
  const r=makeFirstReading({caseInfo:item(),source,conditions:conditions(),...fields,openedAt});
  r.readingSha256=await sha256(new TextEncoder().encode(JSON.stringify(r)));
  appendFirstReading(review,r);await store.append(review.reviewId,r);await refreshSaved();review=saved.find(v=>v.reviewId===review.reviewId);status('Primeira leitura selada no navegador. Exporte um backup JSON privado.');
});
$('hud-export').onclick=()=>busy(async()=>{if(!review)return;if(hasDraft())formFields();downloadJSON(exportHud(review),`review-hud-OWNER-${review.reviewId}.json`);status('JSON privado gerado localmente. Confira Downloads; não envie ao repositório.');});
for(const name of ['gold','clock']){for(const state of HUD_STATES){const o=document.createElement('option');o.value=state;o.textContent=state;$(`hud-${name}-state`).append(o);}}
window.addEventListener('beforeunload',e=>{if(hasDraft()){e.preventDefault();e.returnValue='';}});
update();
