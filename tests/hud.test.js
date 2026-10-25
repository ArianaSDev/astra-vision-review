import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalog,validateField,makeFirstReading,newReview,appendFirstReading,exportHud,sha256} from '../docs/hud.js';
import {fitImage,zoomImage} from '../docs/viewport.js';

import {syntheticCatalog} from './hud-fixture.js';
const conditions={device:'synthetic browser',environment:'test only',priorExposure:'previously_exposed',noAssistance:true};
const field=(state='VALUE')=>({state,value:state==='VALUE'?'manual text':null,notes:'',justification:'synthetic visual decision'});
function record(overrides={}){const c=syntheticCatalog().cases[0];return makeFirstReading({caseInfo:c,source:{filename:c.filename,sha256:c.sha256,width:813,height:366,pngBytes:123,containerFilename:'synthetic.zip',zipEntry:'originals/'+c.filename},conditions,gold:field(),clock:field('UNKNOWN'),openedAt:'2026-01-01T00:00:00Z',now:'2026-01-01T00:01:00Z',...overrides});}
test('exact private catalog preserves 40 gameplay, 10 controls and ten correlated session groups',()=>{
 const c=validateCatalog(syntheticCatalog());assert.equal(c.cases.length,50);assert.equal(c.cases.filter(v=>v.kind==='control').length,10);assert.equal(new Set(c.cases.map(v=>v.sessionId)).size,10);
 for(const transform of [c=>c.cases.pop(),c=>c.cases[1].captureId=c.cases[0].captureId,c=>c.cases[1].sha256=c.cases[0].sha256,c=>c.cases[1].kind='control',c=>c.cases[1].sessionId='wrong',c=>c.cases[1].filename='../x.png',c=>c.cases[1].zipEntry='wrong.png',c=>c.cases[1].captureId='Fanny-holdout']){const bad=syntheticCatalog();transform(bad);assert.throws(()=>validateCatalog(bad));}
});
test('catalog rejects embedded OCR, expectations and extra metadata instead of importing answers',()=>{
 for(const key of ['ocr','predictions','expectedGold','historicalClock']){const c=syntheticCatalog();c.cases[0][key]='forbidden';assert.throws(()=>validateCatalog(c),/somente metadados/);}
 const c=syntheticCatalog();c.answers=[];assert.throws(()=>validateCatalog(c));
});
test('four states are independent and only VALUE may carry a manually read value',()=>{
 for(const s of ['VALUE','ABSENT','NOT_EVALUABLE','UNKNOWN'])assert.equal(validateField(field(s)).state,s);
 assert.throws(()=>validateField({...field('ABSENT'),value:'17'}));assert.throws(()=>validateField({...field(),value:''}));assert.throws(()=>validateField({...field(),state:'PREDICTED'}));assert.equal(validateField({...field(),justification:''}).justification,'');assert.throws(()=>validateField({...field(),justification:null}));
 assert.equal(record().gold.value,'manual text');assert.equal(record().clock.value,null);
});
test('hash, original geometry and OWNER conditions are mandatory; exposure is not falsely labelled blind',()=>{
 const r=record();assert.equal(r.reviewer,'OWNER');assert.equal(r.conditions.priorExposure,'previously_exposed');assert.equal(r.source.zipEntry,'originals/synthetic-0.png');assert.equal(r.canonicalGroundTruth,false);assert.ok(!('blindPass' in r));
 assert.throws(()=>record({source:{filename:'synthetic-0.png',sha256:'f'.repeat(64),width:813,height:366}}));assert.throws(()=>record({conditions:{...conditions,noAssistance:false}}));assert.throws(()=>record({conditions:{...conditions,device:''}}));
});
test('first reading cannot be replaced; partial and full JSON exports preserve all original records',()=>{
 const c=validateCatalog(syntheticCatalog()),r=newReview(c,'f'.repeat(64),conditions),one=appendFirstReading(r,record());assert.equal(r.readings.length,0);assert.equal(one.readings.length,1);assert.throws(()=>appendFirstReading(one,record()));
 const exported=exportHud(one);assert.equal(exported.progress.complete,false);assert.equal(exported.progress.total,50);assert.equal(exported.catalog.cases[0].sessionId,c.cases[0].sessionId);exported.readings[0].gold.value='changed copy';assert.equal(one.readings[0].gold.value,'manual text');
 let full=r;for(const item of c.cases)full=appendFirstReading(full,record({caseInfo:item,source:{filename:item.filename,sha256:item.sha256,width:813,height:366}}));assert.equal(exportHud(full).progress.complete,true);assert.equal(exportHud(full).readings.filter(v=>v.kind==='control').length,10);
});
test('display-only geometry preserves the image point under zoom, for HUD and legacy dimensions',()=>{
 for(const [w,h] of [[813,366],[1280,576]]){const original=fitImage(w,h,393,360),anchor={x:160,y:120},point={x:(anchor.x-original.x)/original.scale,y:(anchor.y-original.y)/original.scale},zoom=zoomImage(original,3,anchor,original.scale);assert.ok(Math.abs((anchor.x-zoom.x)/zoom.scale-point.x)<1e-9);assert.ok(Math.abs((anchor.y-zoom.y)/zoom.scale-point.y)<1e-9);}
});
test('hash is calculated on the actual unmodified bytes',async()=>{assert.equal(await sha256(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');});
test('non-VALUE states require a human justification, independently for gold and clock',()=>{
 for(const state of ['ABSENT','NOT_EVALUABLE','UNKNOWN']){
  for(const justification of ['',null,' \t\n ',undefined]){
   assert.throws(()=>validateField({...field(state),justification}),/justificativa/i);
   for(const [key,label] of [['gold','ouro'],['clock','relógio']])assert.throws(()=>record({[key]:{...field(state),justification}}),new RegExp(label));
  }
  const explained={...field(state),justification:'  Synthetic explanation  '};assert.deepEqual(validateField(explained),explained);
  assert.throws(()=>validateField({...explained,value:'123'}),/somente em VALUE/);
 }
 const value={...field(),justification:''};assert.deepEqual(validateField(value),value);assert.throws(()=>validateField({...value,value:' \t '}));
});
test('invalid stored fields block export and append without rewriting any first reading',()=>{
 const review=appendFirstReading(newReview(validateCatalog(syntheticCatalog()),'f'.repeat(64),conditions),record());
 const original=JSON.stringify(review);assert.doesNotThrow(()=>exportHud(review));assert.equal(JSON.stringify(review),original);
 for(const key of ['gold','clock'])for(const state of ['ABSENT','NOT_EVALUABLE','UNKNOWN']){
  const invalid=structuredClone(review);invalid.readings[0][key]={...field(state),justification:'   '};const before=JSON.stringify(invalid);
  assert.throws(()=>exportHud(invalid),/Exportação bloqueada/);assert.equal(JSON.stringify(invalid),before);
  const empty={...review,readings:[]};assert.throws(()=>appendFirstReading(empty,invalid.readings[0]),/justificativa/i);assert.equal(empty.readings.length,0);
 }
 assert.throws(()=>appendFirstReading(review,record()),/já está selada/);assert.equal(JSON.stringify(review),original);
});
