// Random-access ZIP32 reader: never calls arrayBuffer() on the whole archive.
// Only the bounded directory and the explicitly selected member are materialized.
import {crc32} from './core.js';
export const ZIP_LIMITS = Object.freeze({archive:512*1024*1024,directory:8*1024*1024,entries:10000,png:20*1024*1024});
const decoder=new TextDecoder('utf-8',{fatal:true});
async function read(file,start,end){
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>file.size)throw Error('Intervalo ZIP inválido.');
  const bytes=new Uint8Array(await file.slice(start,end).arrayBuffer());
  if(bytes.length!==end-start)throw Error('ZIP truncado.');
  return bytes;
}
export async function indexZip(file){
  if(file.size<22||file.size>ZIP_LIMITS.archive)throw Error('ZIP deve ter até 512 MiB.');
  const base=Math.max(0,file.size-65557),tail=await read(file,base,file.size),v=new DataView(tail.buffer);
  let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===tail.length){end=i;break;}
  if(end<0)throw Error('ZIP inválido ou truncado.');
  const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count||count===65535||offset===0xffffffff||size===0xffffffff)throw Error('ZIP64 ou multipartes não suportado. Abra o PNG local.');
  if(count>ZIP_LIMITS.entries||size>ZIP_LIMITS.directory||offset+size!==base+end)throw Error('Diretório ZIP inválido ou acima do limite.');
  const central=await read(file,offset,offset+size),c=new DataView(central.buffer),entries=[];let p=0;
  for(let i=0;i<count;i++){
    if(p+46>size||c.getUint32(p,true)!==0x02014b50)throw Error('Diretório ZIP truncado.');
    const nl=c.getUint16(p+28,true),el=c.getUint16(p+30,true),cl=c.getUint16(p+32,true);
    if(p+46+nl+el+cl>size||c.getUint16(p+34,true))throw Error('Entrada ZIP inválida.');
    const name=decoder.decode(central.subarray(p+46,p+46+nl));
    entries.push(Object.freeze({name,flags:c.getUint16(p+8,true),method:c.getUint16(p+10,true),crc:c.getUint32(p+16,true),compressed:c.getUint32(p+20,true),length:c.getUint32(p+24,true),offset:c.getUint32(p+42,true)}));
    p+=46+nl+el+cl;
  }
  if(p!==size)throw Error('Diretório ZIP com conteúdo inesperado.');
  return Object.freeze({file,directoryOffset:offset,entries:Object.freeze(entries)});
}
export function selectZipEntry(index,filename,exactPath=null){
  const candidates=index.entries.filter(e=>exactPath?e.name===exactPath:e.name.split(/[\\/]/).pop()===filename);
  if(candidates.length!==1)throw Error(candidates.length?'PNG duplicado no ZIP; informe o caminho exato no catálogo.':'PNG autorizado não encontrado neste ZIP.');
  return candidates[0];
}
export async function readZipEntry(index,entry){
  if(!index.entries.includes(entry))throw Error('Entrada não pertence ao ZIP selecionado.');
  const e=entry;
  if(e.flags&1)throw Error('ZIP criptografado não suportado.');
  if(![0,8].includes(e.method)||e.length>ZIP_LIMITS.png||e.compressed>ZIP_LIMITS.png+1024*1024||e.offset===0xffffffff)throw Error('Compressão ou tamanho de PNG não suportado.');
  const header=await read(index.file,e.offset,e.offset+30),h=new DataView(header.buffer);
  if(h.getUint32(0,true)!==0x04034b50||h.getUint16(6,true)!==e.flags||h.getUint16(8,true)!==e.method)throw Error('Cabeçalho local ZIP divergente.');
  const nl=h.getUint16(26,true),begin=e.offset+30+nl+h.getUint16(28,true);
  if(begin+e.compressed>index.directoryOffset)throw Error('PNG ZIP truncado.');
  if(decoder.decode(await read(index.file,e.offset+30,e.offset+30+nl))!==e.name)throw Error('Nome local ZIP divergente.');
  let bytes;
  if(e.method===0){bytes=await read(index.file,begin,begin+e.compressed);}
  else{
    let ds;try{ds=new DecompressionStream('deflate-raw');}catch{throw Error('Este navegador não suporta DEFLATE. Extraia o PNG manualmente no aparelho.');}
    const reader=index.file.slice(begin,begin+e.compressed).stream().pipeThrough(ds).getReader(),chunks=[];let total=0;
    try{
      while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>e.length||total>ZIP_LIMITS.png)throw Error('Tamanho descompactado acima do limite.');chunks.push(value);}
    }catch(error){await reader.cancel().catch(()=>{});throw error;}
    finally{reader.releaseLock();}
    bytes=new Uint8Array(total);let p=0;for(const chunk of chunks){bytes.set(chunk,p);p+=chunk.length;}
  }
  if(bytes.length!==e.length||crc32(bytes)!==e.crc)throw Error('Integridade CRC-32 do PNG no ZIP não confere.');
  return {bytes,path:e.name};
}
