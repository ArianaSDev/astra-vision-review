import {manifest,scene,sceneB,pngHeader,zip} from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// DOM/canvas simulation: tests event logic, not rendering or actual device compatibility.
class Element{
 constructor(id=''){this.id=id;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.dataset={};this.handlers={};this.children=[];this.clientWidth=640;this.clientHeight=288;this.drawCalls=[];}
 addEventListener(name,fn){this.handlers[name]=fn;}
 async fire(name,data={}){return this.handlers[name]?.({type:name,preventDefault(){},...data});}
 append(...els){this.children.push(...els);}
 replaceChildren(){this.children=[];}
 setAttribute(key,value){this[key]=value;}
 getBoundingClientRect(){return {left:0,top:0};}
 setPointerCapture(){}
 remove(){}
 scrollIntoView(){}
 click(){if(this.download)downloads.push(this);}
 getContext(){return new Proxy({measureText:()=>({width:12}),drawImage:(...args)=>this.drawCalls.push(args)},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>(t[k]=v,true)});}
}
const ids='canvas status count boxes selection x y width height certainty boxnote notes coverage ack undo export zoom reviewer manifest scene scene-label file empty provenance in out fit delete apply viewport conference-progress review-start empty-scene-label empty-scene region-review review-title review-state review-crop review-overview review-keep review-adjust review-indeterminate review-prev review-next review-close'.split(' '),els=Object.fromEntries(ids.map(id=>[id,new Element(id)])),buttons=['visible_body','IGNORE','select','pan'].map(mode=>{const b=new Element();b.dataset.mode=mode;return b;}),downloads=[];
globalThis.document={getElementById:id=>els[id],querySelectorAll:()=>buttons,createElement:()=>new Element(),body:new Element()};
globalThis.window={addEventListener(){}};globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}};globalThis.confirm=()=>true;globalThis.Image=class{naturalWidth=1280;naturalHeight=576;async decode(){}};
const originalTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn)=>{fn();return 0;};
await import('../docs/app.js');
globalThis.setTimeout=originalTimeout;
async function reviewer(value){els.reviewer.value=value;await els.reviewer.fire('change');}
async function draw(x1,y1,x2,y2,id=1){await els.canvas.fire('pointerdown',{pointerId:id,clientX:x1,clientY:y1});await els.canvas.fire('pointermove',{pointerId:id,clientX:x2,clientY:y2});await els.canvas.fire('pointerup',{pointerId:id});}
test('local import, gesture coordinates, edits, IGNORE, export and reviewer isolation',async()=>{
 await reviewer('R1');await loadManifest();await chooseScene('SYN_A');const bytes=Buffer.alloc(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(1280,16);bytes.writeUInt32BE(576,20);els.file.files=[{name:'synthetic-a.png',size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await els.file.fire('change');assert.match(els.status.textContent,/verificada/);assert.equal(els.empty.hidden,true);const provenance=JSON.parse(els.provenance.textContent).source;assert.equal(provenance.sha256,createHash('sha256').update(bytes).digest('hex'));
 await draw(50,30,150,80);assert.equal(els.count.textContent,1);assert.equal(els.x.value,100);assert.equal(els.y.value,60);assert.equal(els.width.value,200);assert.equal(els.height.value,100);
 els.x.value=1270;els.apply.onclick();assert.match(els.status.textContent,/inválidas/);els.x.value=110;els.certainty.value='supported';els.apply.onclick();assert.equal(els.x.value,110);
 await buttons[2].fire('click');await draw(80,40,90,50);assert.equal(els.x.value,130);assert.equal(els.y.value,80);
 await buttons[1].fire('click');await draw(250,100,275,125);assert.equal(els.count.textContent,2);assert.ok(els.boxes.children[1].children[0].textContent.includes('IGNORE'));
 els.coverage.value='partial';await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');assert.equal(els.export.disabled,true);els['review-start'].onclick();els['review-keep'].onclick();assert.equal(els.export.disabled,true);els['review-keep'].onclick();assert.equal(els.export.disabled,false);
 const original=globalThis.setTimeout;globalThis.setTimeout=()=>0;els.export.onclick();globalThis.setTimeout=original;assert.equal(downloads.length,1);assert.match(downloads[0].download,/review-SYN_A-R1/);
 await reviewer('R2');assert.equal(els.count.textContent,0);assert.equal(els.coverage.value,'');assert.equal(els.ack.checked,false);assert.equal(els.export.disabled,true);assert.ok(els.provenance.textContent.includes(provenance.sha256));
});
test('two-finger pinch cancels pending drawing, zoom retains native coordinates, undo and deletion work',async()=>{
 await buttons[0].fire('click');await els.canvas.fire('pointerdown',{pointerId:1,clientX:100,clientY:100});await els.canvas.fire('pointermove',{pointerId:1,clientX:140,clientY:120});await els.canvas.fire('pointerdown',{pointerId:2,clientX:200,clientY:120});await els.canvas.fire('pointermove',{pointerId:2,clientX:260,clientY:120});await els.canvas.fire('pointerup',{pointerId:2});await els.canvas.fire('pointerup',{pointerId:1});assert.equal(els.count.textContent,0);assert.equal(els.zoom.textContent,'200%');els.fit.onclick();await draw(50,50,100,100);assert.equal(els.x.value,100);assert.equal(els.count.textContent,1);els.delete.onclick();assert.equal(els.count.textContent,0);els.undo.onclick();assert.equal(els.count.textContent,1);
});
test('wrong image resolution cannot be exported',async()=>{const bytes=Buffer.alloc(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(640,16);bytes.writeUInt32BE(288,20);els.file.files=[{name:'synthetic-a.png',size:33,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await els.file.fire('change');assert.match(els.status.textContent,/exigida 1280/);assert.equal(els.export.disabled,true);assert.equal(els.count.textContent,0);});
async function loadManifest(value=manifest){const b=Buffer.from(JSON.stringify(value));els.manifest.files=[{name:'synthetic-manifest.json',size:b.length,arrayBuffer:async()=>new Uint8Array(b).buffer}];await els.manifest.fire('change');}
async function chooseScene(value){els.scene.value=value;await els.scene.fire('change');}
async function loadSynthetic(){const bytes=Buffer.alloc(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(1280,16);bytes.writeUInt32BE(576,20);els.file.files=[{name:'synthetic-a.png',size:33,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await els.file.fire('change');}
async function exported(){const original=globalThis.setTimeout;globalThis.setTimeout=()=>0;try{els.export.onclick();}finally{globalThis.setTimeout=original;}const response=await fetch(downloads.at(-1).href);return response.json();}
test('individual enlarged view with whole-scene context gates bodies and IGNORE independently',async()=>{
 await reviewer('R3');await loadSynthetic();await buttons[0].fire('click');await draw(50,30,90,70);await buttons[1].fire('click');await draw(200,100,240,140);els.coverage.value='partial';await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');assert.equal(els.export.disabled,true);
 els['review-start'].onclick();assert.match(els['review-title'].textContent,/B1/);assert.equal(els['region-review'].hidden,false);const crop=els['review-crop'].drawCalls.at(-1),whole=els['review-overview'].drawCalls.at(-1);assert.ok(crop[3]<1280&&crop[4]<576);assert.deepEqual(whole.slice(1,5),[0,0,1280,576]);
 els['review-keep'].onclick();assert.equal(els.export.disabled,true);assert.match(els['review-title'].textContent,/IGNORE/);els['review-indeterminate'].onclick();assert.equal(els.export.disabled,false);
 const data=await exported();assert.equal(data.schema,'astra-vision-review/0.3');assert.equal(data.conference.reviewedRegions,2);assert.deepEqual(data.conference.indeterminateRegionIds,['B2']);assert.equal(data.boxes[1].certainty,'approximate');assert.deepEqual(data.boxes[0].xyxy,[100,60,180,140]);assert.equal(data.boxes[1].conference.reviewer,'R3');
});
test('adjust choice invalidates only target, numeric edits and undo require its new conference',async()=>{
 els['review-prev'].onclick();assert.match(els['review-title'].textContent,/B1/);els['review-adjust'].onclick();assert.equal(buttons[2]['aria-pressed'],'true');assert.match(els['conference-progress'].textContent,/1 de 2/);assert.equal(els.export.disabled,true);assert.equal(els['region-review'].hidden,true);els.x.value=105;els.apply.onclick();assert.equal(els.x.value,105);els.undo.onclick();assert.match(els['conference-progress'].textContent,/1 de 2/);els['review-start'].onclick();assert.match(els['review-title'].textContent,/B1/);els['review-keep'].onclick();assert.equal(els.export.disabled,false);const d=await exported();assert.equal(d.boxes[1].conference.decision,'indeterminate');
});
test('pointer adjustment under zoom invalidates target without changing other conferences',async()=>{
 els['review-close'].onclick();await els.boxes.children[1].children[1].fire('click');els.fit.onclick();els.in.onclick();await draw(180,110.4,194,124.4);assert.match(els['conference-progress'].textContent,/1 de 2/);assert.equal(els.x.value,420);assert.equal(els.y.value,220);assert.equal(els.export.disabled,true);els['review-start'].onclick();assert.match(els['review-title'].textContent,/B2/);els['review-indeterminate'].onclick();assert.equal(els.export.disabled,false);const d=await exported();d.boxes[1].xyxy.forEach((v,i)=>assert.ok(Math.abs(v-[420,220,500,300][i])<1e-9));assert.equal(d.boxes[0].conference.status,'reviewed');
});
test('zero-region passage requires explicit confirmation after deleting last box',async()=>{
 els.delete.onclick();await els.boxes.children[0].children[1].fire('click');els.delete.onclick();assert.equal(els.count.textContent,0);assert.equal(els['empty-scene'].checked,false);assert.equal(els.export.disabled,true);els['empty-scene'].checked=true;await els['empty-scene'].fire('change');assert.equal(els.export.disabled,false);const d=await exported();assert.deepEqual(d.boxes,[]);assert.equal(d.conference.emptySceneExamined,true);assert.equal(d.canonicalGroundTruth,false);
});
test('reviewer switch clears zero-region conference and all view/annotation state',async()=>{
 await reviewer('R1');assert.equal(els['empty-scene'].checked,false);assert.equal(els['region-review'].hidden,true);assert.equal(els.export.disabled,true);assert.equal(els.coverage.value,'');assert.equal(els.notes.value,'');assert.equal(els.count.textContent,0);
});
async function imageFor(s=scene,container=null){globalThis.Image=class{naturalWidth=s.width;naturalHeight=s.height;async decode(){}};const b=pngHeader(s.width,s.height);els.file.files=[container||{name:s.pngPath.split('/').at(-1),size:b.length,arrayBuffer:async()=>new Uint8Array(b).buffer}];await els.file.fire('change');}
async function fresh(s=scene){globalThis.confirm=()=>true;await loadManifest();await chooseScene(s.id);await reviewer('TEST');await imageFor(s);}
test('multiscene import, zero-box export and native coordinates cannot reuse prior scene state',async()=>{
 await fresh(sceneB);assert.match(els.status.textContent,/SYN_B verificada/);await buttons[0].fire('click');await draw(50,30,150,80);assert.equal(els.x.value,50);assert.equal(els.width.value,100);
 await chooseScene(scene.id);assert.equal(els.count.textContent,0);assert.equal(els.empty.hidden,false);assert.equal(els.export.disabled,true);assert.equal(els.provenance.textContent,'Imagem não verificada.');await imageFor(scene);for(const coverage of ['complete','partial','inadequate']){els.coverage.value=coverage;await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');els['empty-scene'].checked=true;await els['empty-scene'].fire('change');const d=await exported();assert.equal(d.scene.id,scene.id);assert.equal(d.source.sha256,scene.sha256);assert.equal(d.coverage,coverage);assert.equal(d.session.reviewer,'TEST');}
});
test('every pending form state requires discard and cancellation restores reviewer/scene selection',async()=>{
 const pending=[()=>els.notes.value='not exported',()=>els.coverage.value='partial',()=>els.ack.checked=true,()=>els['empty-scene'].checked=true];
 for(const set of pending){await fresh();set();let prompts=0;globalThis.confirm=()=>{prompts++;return false;};await reviewer('R2');assert.equal(els.reviewer.value,'TEST');await chooseScene(sceneB.id);assert.equal(els.scene.value,scene.id);assert.equal(prompts,2);assert.equal(els.empty.hidden,true);globalThis.confirm=()=>true;await chooseScene(sceneB.id);assert.equal(els.notes.value,'');assert.equal(els.coverage.value,'');assert.equal(els.ack.checked,false);assert.equal(els['empty-scene'].checked,false);}
});
test('unapplied box fields survive unrelated updates, block export and trigger discard',async()=>{
 await fresh();await draw(50,30,150,80);els.coverage.value='complete';await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');els['review-start'].onclick();els['review-keep'].onclick();await exported();
 for(const [id,value] of [['x','112.3'],['certainty','supported'],['boxnote','uncertain limit']]){const original=els[id].value;els[id].value=value;await els.coverage.fire('change');assert.equal(els[id].value,value);const before=downloads.length;els.export.onclick();assert.equal(downloads.length,before);assert.match(els.status.textContent,/pendentes/);let prompts=0;globalThis.confirm=()=>{prompts++;return false;};await reviewer('R2');assert.equal(prompts,1);assert.equal(els.reviewer.value,'TEST');els[id].value=original;}
 globalThis.confirm=()=>true;await reviewer('R2');assert.equal(els.count.textContent,0);assert.equal(els.boxnote.value,'');assert.equal(els.coverage.value,'');
});
test('reimport confirmation includes pending state and rejection leaves prior image intact',async()=>{
 await fresh();els.notes.value='pending';globalThis.confirm=()=>false;await imageFor(scene);assert.equal(els.notes.value,'pending');assert.equal(els.empty.hidden,true);assert.ok(els.provenance.textContent.includes(scene.sha256));await loadManifest();assert.equal(els.scene.value,scene.id);globalThis.confirm=()=>true;
});
test('stale file read cannot populate a newly selected scene or clear newer loading state',async()=>{
 await fresh();let release;const deferred=new Promise(r=>release=r),b=pngHeader();els.file.files=[{name:'synthetic-a.png',size:33,arrayBuffer:()=>deferred}];const pending=els.file.fire('change');assert.equal(els.file.disabled,true);await chooseScene(sceneB.id);await imageFor(sceneB);release(new Uint8Array(b).buffer);await pending;assert.equal(els.scene.value,sceneB.id);assert.match(els.status.textContent,/SYN_B verificada/);assert.ok(els.provenance.textContent.includes(sceneB.sha256));assert.equal(els.file.disabled,false);
});
test('reviewer switch during decoding cancels installation of obsolete image',async()=>{
 await fresh();let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);globalThis.Image=class{naturalWidth=1280;naturalHeight=576;async decode(){started();await wait;}};const b=pngHeader();els.file.files=[{name:'synthetic-a.png',size:33,arrayBuffer:async()=>new Uint8Array(b).buffer}];const pending=els.file.fire('change');await ready;await reviewer('R1');release();await pending;assert.equal(els.reviewer.value,'R1');assert.equal(els.empty.hidden,false);assert.equal(els.export.disabled,true);assert.equal(els.count.textContent,0);assert.equal(els.provenance.textContent,'Imagem não verificada.');
});
test('stale manifest read and mutation during import never overwrite active session',async()=>{
 await fresh();let release;const wait=new Promise(r=>release=r);els.manifest.files=[{name:'synthetic-manifest.json',size:100,arrayBuffer:()=>wait}];const pending=els.manifest.fire('change');await reviewer('R3');release(new Uint8Array(Buffer.from(JSON.stringify(manifest))).buffer);await pending;assert.equal(els.reviewer.value,'R3');assert.equal(els.scene.value,scene.id);assert.ok(els.provenance.textContent.includes(scene.sha256));
 await fresh();let release2;const wait2=new Promise(r=>release2=r);els.file.files=[{name:'synthetic-a.png',size:33,arrayBuffer:()=>wait2}];const p=els.file.fire('change');els.notes.value='changed during load';release2(new Uint8Array(pngHeader()).buffer);await p;assert.match(els.status.textContent,/Estado alterado/);assert.equal(els.empty.hidden,false);assert.equal(els.export.disabled,true);assert.equal(els.notes.value,'changed during load');
});
test('failed hash and invalid contaminated manifest cannot authorize export',async()=>{
 await fresh();const bad=pngHeader();bad[25]^=1;await imageFor(scene,{name:'synthetic-a.png',size:33,arrayBuffer:async()=>new Uint8Array(bad).buffer});assert.match(els.status.textContent,/SHA-256/);assert.equal(els.export.disabled,true);const before=els.scene.value;await loadManifest({...manifest,boxes:[]});assert.match(els.status.textContent,/incompatível/);assert.equal(els.scene.value,before);assert.equal(els.export.disabled,true);
});

test('UI ZIP import binds each scene and rejects duplicated entry',async()=>{
 await fresh(sceneB);const z=zip([{name:scene.pngPath,bytes:pngHeader()},{name:sceneB.pngPath,bytes:pngHeader(640,288)}]);await imageFor(sceneB,{name:'synthetic-scenes.zip',size:z.byteLength,arrayBuffer:async()=>z});assert.match(els.status.textContent,/SYN_B verificada/);const provenance=JSON.parse(els.provenance.textContent);assert.equal(provenance.source.zipEntry,sceneB.pngPath);assert.equal(provenance.source.containerType,'zip');const duplicate=zip([{name:sceneB.pngPath,bytes:pngHeader(640,288)},{name:sceneB.pngPath,bytes:pngHeader(640,288)}]);await imageFor(sceneB,{name:'synthetic-scenes.zip',size:duplicate.byteLength,arrayBuffer:async()=>duplicate});assert.match(els.status.textContent,/duplicada/);assert.equal(els.export.disabled,true);
});

test('diagnostic observes touch rejection and commit without changing review semantics',async()=>{
 els['diagnostic-output']=new Element();
 await fresh();await buttons[0].fire('click');
 await reviewer('');await els.canvas.fire('pointerdown',{pointerId:91,clientX:50,clientY:30});
 let d=JSON.parse(els['diagnostic-output'].textContent);assert.equal(d.state.reviewerInternal,'');assert.equal(d.recent.at(-1).reason,'reviewer_missing');assert.equal(els.count.textContent,0);
 const committedBefore=d.counts['draw-committed']||0;await reviewer('TEST');await draw(50,30,100,70,92);
 d=JSON.parse(els['diagnostic-output'].textContent);assert.equal(d.state.regions,1);assert.equal(d.counts['draw-committed'],committedBefore+1);
 await els.canvas.fire('lostpointercapture');d=JSON.parse(els['diagnostic-output'].textContent);assert.equal(d.counts.lostpointercapture,1);assert.equal(els.count.textContent,1);
 await els.canvas.fire('pointerdown',{pointerId:93,clientX:50,clientY:30});await els.canvas.fire('pointercancel',{pointerId:93});d=JSON.parse(els['diagnostic-output'].textContent);assert.ok(d.recent.some(e=>e.reason==='pointercancel'));assert.equal(els.count.textContent,1);
 els.coverage.value='partial';await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');els['review-start'].onclick();els['review-keep'].onclick();const data=await exported();assert.equal(data.schema,'astra-vision-review/0.3');assert.equal(data.reviewer,'TEST');assert.ok(!('diagnostic' in data));assert.equal(data.boxes.length,1);
});
