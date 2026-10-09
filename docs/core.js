export const SCENE = Object.freeze({id:'C05', frameIndex:23835, timestampSeconds:794.5, timestamp:'00:13:14.500', width:1280, height:576});
export const REVIEWERS = ['R1','R2','R3','TEST'];
export function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
export function point(x,y,t){return {x:clamp((x-t.x)/t.scale,0,SCENE.width),y:clamp((y-t.y)/t.scale,0,SCENE.height)};}
export function rectangle(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
export function validBox(b){return ['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.width>=1&&b.height>=1&&b.x+b.width<=1280&&b.y+b.height<=576;}
export function pngDimensions(bytes){
  const a=new Uint8Array(bytes),v=new DataView(a.buffer,a.byteOffset,a.byteLength);
  if(a.length<33||[137,80,78,71,13,10,26,10].some((x,i)=>a[i]!==x)||v.getUint32(8)!==13||String.fromCharCode(...a.slice(12,16))!=='IHDR')throw Error('Arquivo não é um PNG válido.');
  return {width:v.getUint32(16),height:v.getUint32(20)};
}
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export async function extractC05(buffer){
  const a=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
  for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===a.length){end=i;break;}
  if(end<0)throw Error('ZIP inválido ou truncado.');
  const n=v.getUint16(end+10,true),start=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||n===65535||start+size>end)throw Error('ZIP multipartes ou ZIP64 não suportado. Use o PNG C05.');
  let p=start,candidates=[];
  for(let i=0;i<n;i++){
    if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Diretório ZIP inválido.');
    const nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true);
    if(p+46+nl+el+cl>start+size)throw Error('Diretório ZIP truncado.');
    const name=new TextDecoder().decode(a.slice(p+46,p+46+nl));
    if(name.split(/[\\/]/).pop()==='C05_frame_23835.png')candidates.push({name,flags:v.getUint16(p+8,true),method:v.getUint16(p+10,true),crc:v.getUint32(p+16,true),compressed:v.getUint32(p+20,true),length:v.getUint32(p+24,true),offset:v.getUint32(p+42,true)});
    p+=46+nl+el+cl;
  }
  if(candidates.length!==1)throw Error(candidates.length?'Mais de um C05 encontrado; selecione o PNG exato.':'C05_frame_23835.png não encontrado no ZIP.');
  const e=candidates[0],o=e.offset;
  if(e.flags&1)throw Error('ZIP protegido por senha não suportado.');
  if(e.length>20*1024*1024||o+30>start||v.getUint32(o,true)!==0x04034b50)throw Error('Entrada C05 inválida ou maior que 20 MB.');
  const begin=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true);
  if(begin+e.compressed>start)throw Error('Entrada C05 truncada.');
  let bytes=a.slice(begin,begin+e.compressed);
  if(e.method===8){
    let decoder;try{decoder=new DecompressionStream('deflate-raw');}catch{throw Error('Este navegador não descompacta DEFLATE. Escolha o PNG C05 extraído no aparelho.');}
    const reader=new Blob([bytes]).stream().pipeThrough(decoder).getReader();let chunks=[],total=0;
    while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>e.length||total>20*1024*1024){await reader.cancel();throw Error('Tamanho descompactado inválido.');}chunks.push(value);}
    bytes=new Uint8Array(total);let k=0;for(const chunk of chunks){bytes.set(chunk,k);k+=chunk.length;}
  }else if(e.method!==0)throw Error('Compressão ZIP não suportada. Escolha o PNG C05.');
  if(bytes.length!==e.length||crc32(bytes)!==e.crc)throw Error('Integridade CRC-32 do PNG no ZIP não confere.');
  return {bytes,path:e.name};
}
export function exportReview({reviewer,source,boxes,coverage,notes}){
  if(!REVIEWERS.includes(reviewer)||!source||source.width!==1280||source.height!==576||! /^[a-f0-9]{64}$/.test(source.sha256))throw Error('Revisor ou imagem não verificados.');
  if(!['complete','partial','inadequate'].includes(coverage))throw Error('Informe a cobertura da cena.');
  if(!boxes.every(b=>validBox(b)&&['visible_body','IGNORE'].includes(b.category)&&['supported','approximate'].includes(b.certainty)))throw Error('Caixa inválida.');
  return {schema:'astra-vision-review/0.1',status:'provisional_unvalidated',canonicalGroundTruth:false,blindPass:true,reviewer,scene:{...SCENE,timingAuthority:'scene filename and supplied frame index; not reverified from source video'},source:{...source},coordinateSystem:{origin:'top-left',units:'original-image-pixels',format:'xywh',extent:'visible-region-only'},coverage,notes,boxes:boxes.map(b=>({...b,xyxy:[b.x,b.y,b.x+b.width,b.y+b.height]})),createdAt:new Date().toISOString(),limitations:['Derived 1280×576 PNG; hidden contours and identities are not established.','Human review required before metrics or canonical ground truth.']};
}
