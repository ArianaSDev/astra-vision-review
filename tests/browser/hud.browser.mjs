// Synthetic end-to-end test. Never opens an OWNER image or device.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdtemp,open,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {syntheticCatalog} from '../hud-fixture.js';
import {zipFixture} from '../zip-fixture.js';
const {chromium}=createRequire(import.meta.url)('playwright');
async function waitUntil(check){const deadline=Date.now()+15000;while(Date.now()<deadline){if(await check())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Synthetic UI condition timed out');}
async function waitStatus(page,text){await waitUntil(async()=>(await page.locator('#hud-status').textContent()).includes(text));}
async function waitProgress(page,n){await waitUntil(async()=>(await page.locator('#hud-progress').textContent()).startsWith(`${n}/50`));}
const root=path.resolve('docs'),tmp=await mkdtemp(path.join(tmpdir(),'vision-synthetic-'));
const server=createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://localhost').pathname,relative=pathname==='/'?'index.html':pathname.slice(1),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('path');const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(bytes);}catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,hasTouch:true}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1')external.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.selectOption('#review-workflow','hud');
 await waitStatus(page,'Revisão OWNER local');
 assert.equal(await page.locator('#box-workflow').isVisible(),false);
 const catalog=syntheticCatalog(),pngs=[];
 for(let i=0;i<50;i++){
  const data=await page.evaluate(i=>{const c=document.createElement('canvas');c.width=813;c.height=366;const ctx=c.getContext('2d');ctx.fillStyle=`rgb(${i*3},${i*4},${i*5})`;ctx.fillRect(0,0,813,366);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText(`SYNTHETIC ${i} — NOT GAMEPLAY`,20,100);return c.toDataURL().split(',')[1];},i);
  const bytes=Buffer.from(data,'base64');pngs.push(bytes);catalog.cases[i].sha256=createHash('sha256').update(bytes).digest('hex');
 }
 await page.setInputFiles('#hud-catalog',{name:'synthetic-catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(catalog))});
 await waitStatus(page,'Catálogo validado');
 await page.fill('#hud-device','Synthetic mobile viewport');await page.fill('#hud-environment','Synthetic test only');await page.click('#hud-start');
 await waitStatus(page,'Passagem criada');
 const z=zipFixture(pngs[0],8,'folder/synthetic-0.png',111320130),archive=path.join(tmp,'synthetic-111MB.zip'),fd=await open(archive,'w');
 try{await fd.write(Buffer.concat([z.header,z.name,z.payload,z.central,z.name,z.end]),0,undefined,z.prefixSize);}finally{await fd.close();}
 await page.setInputFiles('#hud-files',archive);await waitStatus(page,'PNG verificado');
 assert.equal(JSON.parse(await page.locator('#hud-provenance').textContent()).sha256,catalog.cases[0].sha256);
 await page.click('#hud-in');assert.equal(await page.locator('#hud-zoom').textContent(),'140%');await page.click('#hud-fit');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:851,height:393});await page.click('#hud-fit');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:393,height:851});
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 let downloads=0;page.on('download',()=>downloads++);
 for(const [name,label,other] of [['gold','Ouro','clock'],['clock','Relógio','gold']]){
  await page.selectOption(`#hud-${other}-state`,'VALUE');await page.fill(`#hud-${other}-value`,'SYNTHETIC VALUE');await page.fill(`#hud-${other}-justification`,'');
  for(const state of ['ABSENT','NOT_EVALUABLE','UNKNOWN'])for(const justification of ['', ' \t ']){
   await page.selectOption(`#hud-${name}-state`,state);assert.equal(await page.locator(`#hud-${name}-justification`).getAttribute('required'),'');
   await page.fill(`#hud-${name}-justification`,justification);await page.click('#hud-save');await waitStatus(page,`${label}: Informe a justificativa`);await waitProgress(page,0);
   await page.click('#hud-export');await waitStatus(page,`${label}: Informe a justificativa`);assert.equal(downloads,0);
  }
 }
 await page.selectOption('#hud-gold-state','VALUE');await page.fill('#hud-gold-value','SYNTHETIC VALUE');await page.fill('#hud-gold-justification','Synthetic visible text');await page.selectOption('#hud-clock-state','UNKNOWN');
 await page.fill('#hud-clock-justification','Synthetic uncertainty');await page.selectOption('#hud-exposure','previously_exposed');await page.check('#hud-no-assistance');
 await page.evaluate(()=>{window.testOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota failure','QuotaExceededError');};});
 await page.click('#hud-save');await waitStatus(page,'interrompida');
 assert.ok((await page.locator('#hud-progress').textContent()).startsWith('0/50'));assert.equal(await page.locator('#hud-gold-value').inputValue(),'SYNTHETIC VALUE');assert.equal(await page.locator('#hud-save').isDisabled(),false);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.testOriginalPut;delete window.testOriginalPut;});await page.click('#hud-save');
 await waitProgress(page,1);
 assert.equal(await page.locator('#hud-save').isDisabled(),true);assert.equal(await page.locator('#hud-gold-value').isDisabled(),true);
 const downloadPromise=page.waitForEvent('download');await page.click('#hud-export');const download=await downloadPromise;const savedPath=await download.path();let result=JSON.parse(await readFile(savedPath,'utf8'));
 assert.equal(result.readings[0].conditions.priorExposure,'previously_exposed');assert.equal(result.readings[0].clock.value,null);assert.equal(result.readings[0].gold.value,'SYNTHETIC VALUE');assert.equal(result.readings[0].source.zipEntry,'folder/synthetic-0.png');assert.equal(result.canonicalGroundTruth,false);assert.equal(result.progress.complete,false);
 const originalSeal=result.readings[0].readingSha256;
 // A legacy invalid sealed record must block export, never be silently rewritten.
 const originalStored=await page.evaluate(async()=>{const {openHudStore}=await import('/hud-storage.js');const s=await openHudStore();try{return (await s.list())[0];}finally{s.close();}});
 const invalidStored=structuredClone(originalStored);invalidStored.readings[0].clock.justification='   ';
 const writeStored=async value=>page.evaluate(value=>new Promise((resolve,reject)=>{const req=indexedDB.open('astra-vision-review-hud',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('reviews','readwrite');tx.objectStore('reviews').put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}),value);
 await writeStored(invalidStored);await page.click('#hud-resume');await waitStatus(page,'Passagem retomada');
 // Resume uses the existing in-memory list until refreshed; reload reads the actual stored bytes.
 await page.reload();await page.selectOption('#review-workflow','hud');await waitUntil(async()=>await page.locator('#hud-resume-list option').count()===1);await page.click('#hud-resume');await waitStatus(page,'Passagem retomada');
 const beforeBlockedDownload=downloads;await page.click('#hud-export');await waitStatus(page,'Exportação bloqueada');assert.equal(downloads,beforeBlockedDownload);
 const afterBlocked=await page.evaluate(async()=>{const {openHudStore}=await import('/hud-storage.js');const s=await openHudStore();try{return (await s.list())[0];}finally{s.close();}});assert.deepEqual(afterBlocked,invalidStored);
 await writeStored(originalStored);
 const duplicateRejected=await page.evaluate(async()=>{const {openHudStore}=await import('/hud-storage.js');const s=await openHudStore();try{const r=(await s.list())[0];try{await s.append(r.reviewId,r.readings[0]);return false;}catch{return true;}}finally{s.close();}});assert.equal(duplicateRejected,true);
 await page.reload();await page.selectOption('#review-workflow','hud');await waitUntil(async()=>await page.locator('#hud-resume-list option').count()===1);
 // Reformatting the same catalog cannot start a second first passage.
 await page.setInputFiles('#hud-catalog',{name:'synthetic-reformatted.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(catalog,null,2))});await waitStatus(page,'Catálogo validado');
 await page.fill('#hud-device','Synthetic mobile viewport');await page.fill('#hud-environment','Synthetic test only');await page.click('#hud-start');await waitStatus(page,'Já existe uma primeira passagem');
 await page.click('#hud-resume');
 await waitStatus(page,'Passagem retomada');
 // Keep all 50 File handles but decode only the selected PNG.
 await page.setInputFiles('#hud-files',pngs.map((buffer,i)=>({name:`synthetic-${i}.png`,mimeType:'image/png',buffer})));
 await waitStatus(page,'já selada');
 assert.equal(await page.locator('#hud-gold-value').inputValue(),''); // no prior answers displayed on resume
 await page.selectOption('#hud-case','1');await waitStatus(page,'PNG verificado');await page.selectOption('#hud-gold-state','VALUE');await page.fill('#hud-gold-value','draft');page.once('dialog',d=>d.dismiss());await page.selectOption('#hud-case','0');assert.equal(await page.locator('#hud-case').inputValue(),'1');assert.equal(await page.locator('#hud-gold-value').inputValue(),'draft');await page.selectOption('#hud-gold-state','');
 for(let i=1;i<50;i++){
  await page.selectOption('#hud-case',String(i));await waitStatus(page,'PNG verificado');
  await page.selectOption('#hud-gold-state',i%2?'ABSENT':'NOT_EVALUABLE');await page.fill('#hud-gold-justification','Synthetic state');
  await page.selectOption('#hud-clock-state','VALUE');await page.fill('#hud-clock-value','SYNTHETIC CLOCK');await page.fill('#hud-clock-justification','Synthetic text');
  await page.selectOption('#hud-exposure','unknown');await page.check('#hud-no-assistance');await page.click('#hud-save');await waitProgress(page,i+1);
 }
 const dp=page.waitForEvent('download');await page.click('#hud-export');result=JSON.parse(await readFile(await (await dp).path(),'utf8'));
 assert.equal(result.readings.length,50);assert.equal(result.readings.filter(r=>r.kind==='control').length,10);assert.equal(new Set(result.readings.map(r=>r.sessionId)).size,10);assert.equal(result.progress.complete,true);assert.equal(result.readings[0].readingSha256,originalSeal);
 // A wrong original cannot enable sealing, even with an eligible filename.
 await page.setInputFiles('#hud-files',{name:'synthetic-49.png',mimeType:'image/png',buffer:pngs[0]});await waitStatus(page,'SHA-256 diverge');assert.equal(await page.locator('#hud-save').isDisabled(),true);
 await page.selectOption('#review-workflow','boxes');assert.equal(await page.locator('#box-workflow').isVisible(),true);assert.equal(await page.locator('#reviewer').isVisible(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({browser:await browser.version(),syntheticReadings:50,controlReadings:10,sessionGroups:10,largeZipBytes:(await stat(archive)).size,externalRequests:0,legacyWorkflowVisible:true,indexedDBReload:true,firstReadingPreserved:true,quotaFailureRejected:true,duplicateReadingRejected:true,cancelledNavigationPreservesDraft:true,requiredJustificationBothFields:true,invalidDraftExportRejected:true,invalidStoredExportRejectedWithoutRewrite:true,pageErrors:errors}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await rm(tmp,{recursive:true,force:true});}
