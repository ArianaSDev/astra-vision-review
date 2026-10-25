// Human-only HUD review contract. No OCR, predictions, reference values or GT.
export const HUD_SCHEMA='astra-vision-review/hud-1';
export const HUD_STATES=Object.freeze(['VALUE','ABSENT','NOT_EVALUABLE','UNKNOWN']);
const HASH=/^[a-f0-9]{64}$/;
const clone=value=>JSON.parse(JSON.stringify(value));
function text(value,label,max=2000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Informe ${label}.`);return value;}
function onlyKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Catálogo deve conter somente metadados autorizados, sem respostas ou previsões.');}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function validateCatalog(raw){
  onlyKeys(raw,['schema','datasetId','cases']);
  if(raw.schema!=='astra-hud-catalog/1'||!Array.isArray(raw.cases)||raw.cases.length!==50)throw Error('O catálogo deve identificar exatamente os 50 casos autorizados.');
  text(raw.datasetId,'identificador do conjunto',160);
  const ids=new Set(),hashes=new Set(),sessions=new Map();let gameplay=0,control=0;
  const cases=raw.cases.map(item=>{
    onlyKeys(item,['captureId','sessionId','filename','sha256','kind','zipEntry']);
    text(item.captureId,'captureId',160);text(item.sessionId,'sessionId',160);text(item.filename,'nome original',255);
    if(ids.has(item.captureId)||hashes.has(item.sha256)||!HASH.test(item.sha256)||!['gameplay','control'].includes(item.kind)||!item.filename.endsWith('.png')||/[\\/\x00]/.test(item.filename)||/fanny/i.test(JSON.stringify(item)))throw Error('Identidade, grupo, hash, duplicata ou exclusão inválida no catálogo.');
    if(item.zipEntry!==undefined&&(typeof item.zipEntry!=='string'||item.zipEntry.length>1024||item.zipEntry.includes('\\')||item.zipEntry.startsWith('/')||item.zipEntry.split('/').some(p=>p==='..'||!p)||item.zipEntry.split('/').pop()!==item.filename))throw Error('Caminho ZIP inválido no catálogo.');
    ids.add(item.captureId);hashes.add(item.sha256);
    const s=sessions.get(item.sessionId)||{gameplay:0,control:0};s[item.kind]++;sessions.set(item.sessionId,s);
    if(item.kind==='gameplay')gameplay++;else control++;
    return {...item};
  });
  if(gameplay!==40||control!==10||sessions.size!==10||[...sessions.values()].some(s=>s.gameplay!==4||s.control!==1))throw Error('Exigidos dez grupos de sessão, cada um com quatro gameplay e um controle.');
  return {schema:raw.schema,datasetId:raw.datasetId,cases};
}
export function validateField(field,label='campo HUD'){
  onlyKeys(field,['state','value','notes','justification']);
  if(!HUD_STATES.includes(field.state))throw Error('Selecione um estado para cada campo.');
  if(typeof field.notes!=='string'||field.notes.length>2000)throw Error('Observação inválida.');
  if(typeof field.justification!=='string'||field.justification.length>2000)throw Error(`Justificativa de ${label} inválida.`);
  if(field.state==='VALUE')text(field.value,'valor lido manualmente',64);
  else{
    if(field.value!==null)throw Error('Valor manual permitido somente em VALUE.');
    text(field.justification,`a justificativa de ${label}`);
  }
  return clone(field);
}
export function validateReadingFields(reading){
  validateField(reading.gold,'ouro');validateField(reading.clock,'relógio');
}
export function makeFirstReading({caseInfo,source,conditions,gold,clock,openedAt,now=new Date().toISOString()}){
  if(source.sha256!==caseInfo.sha256||source.filename!==caseInfo.filename||source.width!==813||source.height!==366)throw Error('O PNG original ainda não foi verificado para este caso.');
  if(!Number.isFinite(Date.parse(openedAt))||!Number.isFinite(Date.parse(now))||Date.parse(now)<Date.parse(openedAt))throw Error('Instante da leitura inválido.');
  text(conditions.device,'aparelho da revisão',200);text(conditions.environment,'condições da avaliação');
  if(!['not_consulted','previously_exposed','unknown'].includes(conditions.priorExposure)||conditions.noAssistance!==true)throw Error('Declare exposição anterior e ausência de consulta durante a leitura.');
  return {captureId:caseInfo.captureId,sessionId:caseInfo.sessionId,kind:caseInfo.kind,
    reviewer:'OWNER',pass:'first_reading',openedAt,sealedAt:now,source:clone(source),conditions:clone(conditions),
    gold:validateField(gold,'ouro'),clock:validateField(clock,'relógio'),authority:'human_reading_pending_independent_audit',canonicalGroundTruth:false};
}
export function newReview(catalog,catalogSha256,conditions){
  if(!HASH.test(catalogSha256))throw Error('Catálogo sem SHA-256.');
  return {schema:HUD_SCHEMA,reviewId:crypto.randomUUID(),datasetId:catalog.datasetId,catalogSha256,
    catalog:clone(catalog),reviewer:'OWNER',conditions:clone(conditions),createdAt:new Date().toISOString(),readings:[],
    canonicalGroundTruth:false,statisticalIndependence:'NOT_ESTABLISHED; four gameplay frames share each session',
    authority:'human_certification_record_pending_audit'};
}
export function appendFirstReading(review,reading){
  const expected=review.catalog.cases.find(c=>c.captureId===reading.captureId);
  if(!expected||expected.sessionId!==reading.sessionId||expected.kind!==reading.kind||expected.sha256!==reading.source.sha256||expected.filename!==reading.source.filename||reading.reviewer!=='OWNER'||reading.canonicalGroundTruth!==false)throw Error('Leitura não corresponde ao catálogo desta passagem.');
  if(review.readings.some(r=>r.captureId===reading.captureId))throw Error('A primeira leitura já está selada; não pode ser substituída.');
  validateReadingFields(reading);
  return {...clone(review),readings:[...clone(review.readings),clone(reading)]};
}
export function exportHud(review){
  for(const reading of review.readings){
    try{validateReadingFields(reading);}catch(e){throw Error(`Exportação bloqueada: leitura ${reading.captureId} — ${e.message}`);}
  }
  return {...clone(review),exportedAt:new Date().toISOString(),progress:{completed:review.readings.length,total:50,complete:review.readings.length===50},
    limitations:['No OCR or model outputs were consulted by this tool.','Exposure is self-declared per case; ownership does not invalidate a human reading.','SHA-256 binds bytes; it does not authenticate the capture or prevent browser storage tampering.','No automatic promotion to canonical GT.']};
}
