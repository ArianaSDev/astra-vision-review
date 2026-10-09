export const MANIFEST_SCHEMA='astra-vision-review-manifest/0.1';
export const MAX_FILE_BYTES=100*1024*1024,MAX_PNG_BYTES=20*1024*1024,MAX_MANIFEST_BYTES=1024*1024;
const sceneKeys=['id','pngPath','width','height','pngBytes','sha256','frameIndex','timestampSeconds','timestamp','timingAuthority','limitations'];
function exactKeys(value,keys){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function text(v,max){return typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);}
export function safePNGPath(v){return text(v,512)&&!v.includes('\\')&&!v.startsWith('/')&&v.split('/').every(p=>p!=='.'&&p!=='..'&&p.length>0)&&/^[A-Za-z0-9_./-]+\.png$/.test(v);}
export function validateScene(s){
  if(!exactKeys(s,sceneKeys)||typeof s.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(s.id)||!safePNGPath(s.pngPath))throw Error('Identidade ou campos de cena inválidos. Anotações não são permitidas.');
  if(!['width','height'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=1&&s[k]<=4096)||!Number.isSafeInteger(s.pngBytes)||s.pngBytes<33||s.pngBytes>MAX_PNG_BYTES||typeof s.sha256!=='string'||!/^[a-f0-9]{64}$/.test(s.sha256))throw Error('Resolução, tamanho ou SHA-256 esperado inválidos.');
  const m=typeof s.timestamp==='string'&&s.timestamp.match(/^(\d{2,6}):([0-5]\d):([0-5]\d)\.(\d{3})$/);
  if(!Number.isSafeInteger(s.frameIndex)||s.frameIndex<0||!Number.isFinite(s.timestampSeconds)||s.timestampSeconds<0||!m||Math.abs(Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000-s.timestampSeconds)>1e-9||!text(s.timingAuthority,1000)||!Array.isArray(s.limitations)||s.limitations.length<1||s.limitations.length>20||!s.limitations.every(v=>text(v,1000)))throw Error('Metadados temporais, autoridade ou limitações inválidos.');
  return Object.freeze({...s,limitations:Object.freeze([...s.limitations])});
}
export function validateManifest(value){
  if(!exactKeys(value,['schema','scenes'])||value.schema!==MANIFEST_SCHEMA||!Array.isArray(value.scenes)||value.scenes.length<1||value.scenes.length>64)throw Error('Manifesto incompatível; somente schema e scenes são permitidos.');
  const scenes=value.scenes.map(validateScene);
  for(const key of ['id','pngPath'])if(new Set(scenes.map(s=>s[key])).size!==scenes.length)throw Error('Cena ou caminho PNG duplicado no manifesto.');
  if(new Set(scenes.map(s=>s.pngPath.split('/').at(-1))).size!==scenes.length)throw Error('Nomes PNG ambíguos no manifesto.');
  return Object.freeze({schema:MANIFEST_SCHEMA,scenes:Object.freeze(scenes)});
}
export async function sha256(bytes){if(!globalThis.crypto?.subtle)throw Error('SHA-256 indisponível. Use HTTPS ou localhost.');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
