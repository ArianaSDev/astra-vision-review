import {validateScene,safePNGPath,sha256,MAX_FILE_BYTES} from './manifest.js';
export const DEFAULT_EXTENT = Object.freeze({width:1280,height:576});
export const REVIEWERS = ['R1','R2','R3','TEST'];
export function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
export function point(x,y,t,extent=DEFAULT_EXTENT){return {x:clamp((x-t.x)/t.scale,0,extent.width),y:clamp((y-t.y)/t.scale,0,extent.height)};}
export function rectangle(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
export function validBox(b,extent=DEFAULT_EXTENT){return ['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.width>=1&&b.height>=1&&b.x+b.width<=extent.width&&b.y+b.height<=extent.height;}
export function pngDimensions(bytes){
  const a=new Uint8Array(bytes),v=new DataView(a.buffer,a.byteOffset,a.byteLength);
  if(a.length<33||[137,80,78,71,13,10,26,10].some((x,i)=>a[i]!==x)||v.getUint32(8)!==13||String.fromCharCode(...a.slice(12,16))!=='IHDR')throw Error('Arquivo não é um PNG válido.');
  return {width:v.getUint32(16),height:v.getUint32(20)};
}
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export async function extractPNG(buffer,path){
  if(!safePNGPath(path)||buffer.byteLength>MAX_FILE_BYTES)throw Error('Caminho PNG ou tamanho ZIP inválido.');
  const a=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
  for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===a.length){end=i;break;}
  if(end<0)throw Error('ZIP inválido ou truncado.');
  const n=v.getUint16(end+10,true),start=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||n===65535||v.getUint16(end+8,true)!==n||start+size!==end)throw Error('ZIP multipartes ou ZIP64 não suportado. Use o PNG da cena.');
  let p=start,candidates=[];
  for(let i=0;i<n;i++){
    if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Diretório ZIP inválido.');
    const nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true);
    if(p+46+nl+el+cl>start+size)throw Error('Diretório ZIP truncado.');
    const name=new TextDecoder().decode(a.slice(p+46,p+46+nl));
    if(name===path)candidates.push({name,flags:v.getUint16(p+8,true),method:v.getUint16(p+10,true),crc:v.getUint32(p+16,true),compressed:v.getUint32(p+20,true),length:v.getUint32(p+24,true),offset:v.getUint32(p+42,true)});
    p+=46+nl+el+cl;
  }
  if(candidates.length!==1)throw Error(candidates.length?'Entrada PNG duplicada; selecione o arquivo exato.':'Caminho PNG esperado não encontrado no ZIP.');
  if(p!==start+size)throw Error('Diretório ZIP inconsistente.');
  const e=candidates[0],o=e.offset;
  if(e.flags&1)throw Error('ZIP protegido por senha não suportado.');
  if(e.length>20*1024*1024||o+30>start||v.getUint32(o,true)!==0x04034b50)throw Error('Entrada PNG inválida ou maior que 20 MB.');
  const localNameLength=v.getUint16(o+26,true),begin=o+30+localNameLength+v.getUint16(o+28,true);
  if(begin>start||new TextDecoder().decode(a.slice(o+30,o+30+localNameLength))!==e.name||v.getUint16(o+6,true)!==e.flags||v.getUint16(o+8,true)!==e.method)throw Error('Cabeçalho local ZIP inconsistente.');
  if(!(e.flags&8)&&(v.getUint32(o+14,true)!==e.crc||v.getUint32(o+18,true)!==e.compressed||v.getUint32(o+22,true)!==e.length))throw Error('Tamanhos ou CRC do cabeçalho local ZIP inconsistentes.');
  if(begin+e.compressed>start)throw Error('Entrada PNG truncada.');
  let bytes=a.slice(begin,begin+e.compressed);
  if(e.method===8){
    let decoder;try{decoder=new DecompressionStream('deflate-raw');}catch{throw Error('Este navegador não descompacta DEFLATE. Escolha o PNG da cena extraído no aparelho.');}
    const reader=new Blob([bytes]).stream().pipeThrough(decoder).getReader();let chunks=[],total=0;
    while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>e.length||total>20*1024*1024){await reader.cancel();throw Error('Tamanho descompactado inválido.');}chunks.push(value);}
    bytes=new Uint8Array(total);let k=0;for(const chunk of chunks){bytes.set(chunk,k);k+=chunk.length;}
  }else if(e.method!==0)throw Error('Compressão ZIP não suportada. Escolha o PNG da cena.');
  if(bytes.length!==e.length||crc32(bytes)!==e.crc)throw Error('Integridade CRC-32 do PNG no ZIP não confere.');
  return {bytes,path:e.name};
}
// This signature binds a manual conference to this region's current annotation.
// It is an equality check, not a confidence score or a detector result.
export function regionSignature(b){return JSON.stringify([b.id,b.category,b.x,b.y,b.width,b.height,b.certainty,b.note??'']);}
export function invalidateRegion(b){b.conference={status:'pending'};return b;}
export function conferRegion(b,decision,reviewer,extent=DEFAULT_EXTENT){
  if(!validBox(b,extent)||!REVIEWERS.includes(reviewer)||!['keep','indeterminate'].includes(decision))throw Error('Conferência de região inválida.');
  b.conference={status:'reviewed',decision,reviewer,reviewedAt:new Date().toISOString(),annotationSignature:regionSignature(b)};
  return b;
}
export function regionConferred(b,reviewer){const c=b.conference;return c?.status==='reviewed'&&['keep','indeterminate'].includes(c.decision)&&c.reviewer===reviewer&&REVIEWERS.includes(reviewer)&&Number.isFinite(Date.parse(c.reviewedAt))&&c.annotationSignature===regionSignature(b);}
export function conferenceSummary(boxes,reviewer,emptySceneExamined=false){
  const reviewed=boxes.filter(b=>regionConferred(b,reviewer));
  return {status:REVIEWERS.includes(reviewer)&&(boxes.length?reviewed.length===boxes.length:emptySceneExamined===true)?'complete':'pending',method:'manual_individual_visual',requiredRegions:boxes.length,reviewedRegions:reviewed.length,emptySceneExamined:boxes.length===0&&emptySceneExamined===true,indeterminateRegionIds:reviewed.filter(b=>b.conference.decision==='indeterminate').map(b=>b.id)};
}
export function restoreRegions(previous,current){
  // Undo never resurrects a conference of a changed/restored region.
  // Unchanged regions keep their most recent conference.
  return previous.map(b=>{const live=current.find(c=>c.id===b.id);return live&&regionSignature(live)===regionSignature(b)?{...b,conference:live.conference}:invalidateRegion({...b});});
}
export function contextWindow(b,extent=DEFAULT_EXTENT){
  // Display-only padding: gives neighboring pixels, never suggests annotation size.
  const w=Math.min(extent.width,Math.max(256,b.width+2*Math.max(80,b.width*.6))),h=Math.min(extent.height,Math.max(192,b.height+2*Math.max(80,b.height*.6)));
  return {x:clamp(b.x+b.width/2-w/2,0,extent.width-w),y:clamp(b.y+b.height/2-h/2,0,extent.height-h),width:w,height:h};
}

export async function verifyPNG(bytes,scene){
  validateScene(scene);
  if(bytes.byteLength!==scene.pngBytes)throw Error('Tamanho do PNG não corresponde ao manifesto.');
  const dimensions=pngDimensions(bytes);
  if(dimensions.width!==scene.width||dimensions.height!==scene.height)throw Error(`Resolução ${dimensions.width} × ${dimensions.height}; exigida ${scene.width} × ${scene.height}. Nenhuma escala foi aplicada.`);
  const hash=await sha256(bytes);
  if(hash!==scene.sha256)throw Error('SHA-256 não corresponde à cena selecionada.');
  return {...dimensions,sha256:hash,pngBytes:bytes.byteLength};
}
export function exportReview({reviewer,scene,manifestSource,source,boxes,coverage,notes='',emptySceneExamined=false}){
  validateScene(scene);
  if(!REVIEWERS.includes(reviewer)||!source||source.sceneId!==scene.id||source.width!==scene.width||source.height!==scene.height||source.pngBytes!==scene.pngBytes||source.sha256!==scene.sha256||source.filename!==scene.pngPath.split('/').at(-1)||!['png','zip'].includes(source.containerType)||(source.containerType==='zip'?source.zipEntry!==scene.pngPath:source.zipEntry!==null))throw Error('Revisor, cena ou imagem não verificados.');
  if(!manifestSource||typeof manifestSource.filename!=='string'||!Number.isSafeInteger(manifestSource.bytes)||manifestSource.bytes<1||! /^[a-f0-9]{64}$/.test(manifestSource.sha256))throw Error('Proveniência do manifesto ausente.');
  if(!['complete','partial','inadequate'].includes(coverage))throw Error('Informe a cobertura da cena.');
  if(!Array.isArray(boxes)||new Set(boxes.map(b=>b.id)).size!==boxes.length||!boxes.every(b=>typeof b.id==='string'&&/^B[1-9][0-9]*$/.test(b.id)&&validBox(b,scene)&&['visible_body','IGNORE'].includes(b.category)&&['supported','approximate'].includes(b.certainty)&&typeof b.note==='string'&&b.note.length<=1000)||typeof notes!=='string'||notes.length>6000)throw Error('Caixa ou observação inválida.');
  const conference=conferenceSummary(boxes,reviewer,emptySceneExamined);
  if(conference.status!=='complete')throw Error(boxes.length?'Confira individualmente todas as regiões, incluindo IGNORE, antes de exportar.':'Confirme explicitamente que a cena foi examinada sem caixas.');
  return {schema:'astra-vision-review/0.3',status:'provisional_unvalidated',canonicalGroundTruth:false,trainingAuthorized:false,blindPass:true,reviewer,session:{sceneId:scene.id,pngSha256:source.sha256,reviewer},scene:{id:scene.id,frameIndex:scene.frameIndex,timestampSeconds:scene.timestampSeconds,timestamp:scene.timestamp,width:scene.width,height:scene.height,timingAuthority:scene.timingAuthority,limitations:[...scene.limitations]},manifestSource:{...manifestSource},source:{...source},coordinateSystem:{origin:'top-left',units:'original-image-pixels',format:'xywh',extent:'visible-region-only'},coverage,notes,conference,boxes:boxes.map(b=>({...b,conference:{...b.conference},xyxy:[b.x,b.y,b.x+b.width,b.y+b.height]})),createdAt:new Date().toISOString(),limitations:['Source PNG verified against a user-selected local manifest; this does not authenticate its author or independently verify video timing.','Hidden contours and identities are not established.','Human review required before metrics or canonical ground truth.','Conference records the reviewer decision, not independent validation; indeterminate regions are not reliable boundary references.']};
}
