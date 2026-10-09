import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// DOM/canvas simulation: tests event logic, not rendering or actual device compatibility.
class Element{
 constructor(id=''){this.id=id;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.dataset={};this.handlers={};this.children=[];this.clientWidth=640;this.clientHeight=288;}
 addEventListener(name,fn){this.handlers[name]=fn;}
 async fire(name,data={}){return this.handlers[name]?.({type:name,preventDefault(){},...data});}
 append(...els){this.children.push(...els);}
 replaceChildren(){this.children=[];}
 setAttribute(key,value){this[key]=value;}
 getBoundingClientRect(){return {left:0,top:0};}
 setPointerCapture(){}
 remove(){}
 click(){if(this.download)downloads.push(this);}
 getContext(){return new Proxy({measureText:()=>({width:12})},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>(t[k]=v,true)});}
}
const ids='canvas status count boxes selection x y width height certainty boxnote notes coverage ack undo export zoom reviewer file empty provenance in out fit delete apply viewport'.split(' '),els=Object.fromEntries(ids.map(id=>[id,new Element(id)])),buttons=['visible_body','IGNORE','select','pan'].map(mode=>{const b=new Element();b.dataset.mode=mode;return b;}),downloads=[];
globalThis.document={getElementById:id=>els[id],querySelectorAll:()=>buttons,createElement:()=>new Element(),body:new Element()};
globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}};globalThis.confirm=()=>true;globalThis.Image=class{naturalWidth=1280;naturalHeight=576;async decode(){}};
const originalTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn)=>{fn();return 0;};
await import('../docs/app.js');
globalThis.setTimeout=originalTimeout;
async function reviewer(value){els.reviewer.value=value;await els.reviewer.fire('change');}
async function draw(x1,y1,x2,y2,id=1){await els.canvas.fire('pointerdown',{pointerId:id,clientX:x1,clientY:y1});await els.canvas.fire('pointermove',{pointerId:id,clientX:x2,clientY:y2});await els.canvas.fire('pointerup',{pointerId:id});}
test('local import, gesture coordinates, edits, IGNORE, export and reviewer isolation',async()=>{
 await reviewer('R1');const bytes=Buffer.alloc(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(1280,16);bytes.writeUInt32BE(576,20);els.file.files=[{name:'C05_frame_23835.png',size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await els.file.fire('change');assert.match(els.status.textContent,/verificado/);assert.equal(els.empty.hidden,true);const provenance=JSON.parse(els.provenance.textContent);assert.equal(provenance.sha256,createHash('sha256').update(bytes).digest('hex'));
 await draw(50,30,150,80);assert.equal(els.count.textContent,1);assert.equal(els.x.value,100);assert.equal(els.y.value,60);assert.equal(els.width.value,200);assert.equal(els.height.value,100);
 els.x.value=1270;els.apply.onclick();assert.match(els.status.textContent,/inválidas/);els.x.value=110;els.certainty.value='supported';els.apply.onclick();assert.equal(els.x.value,110);
 await buttons[2].fire('click');await draw(80,40,90,50);assert.equal(els.x.value,130);assert.equal(els.y.value,80);
 await buttons[1].fire('click');await draw(250,100,275,125);assert.equal(els.count.textContent,2);assert.ok(els.boxes.children[1].children[0].textContent.includes('IGNORE'));
 els.coverage.value='partial';await els.coverage.fire('change');els.ack.checked=true;await els.ack.fire('change');assert.equal(els.export.disabled,false);
 const original=globalThis.setTimeout;globalThis.setTimeout=()=>0;els.export.onclick();globalThis.setTimeout=original;assert.equal(downloads.length,1);assert.match(downloads[0].download,/review-C05-R1/);
 await reviewer('R2');assert.equal(els.count.textContent,0);assert.equal(els.coverage.value,'');assert.equal(els.ack.checked,false);assert.equal(els.export.disabled,true);assert.ok(els.provenance.textContent.includes(provenance.sha256));
});
test('two-finger pinch cancels pending drawing, zoom retains native coordinates, undo and deletion work',async()=>{
 await buttons[0].fire('click');await els.canvas.fire('pointerdown',{pointerId:1,clientX:100,clientY:100});await els.canvas.fire('pointermove',{pointerId:1,clientX:140,clientY:120});await els.canvas.fire('pointerdown',{pointerId:2,clientX:200,clientY:120});await els.canvas.fire('pointermove',{pointerId:2,clientX:260,clientY:120});await els.canvas.fire('pointerup',{pointerId:2});await els.canvas.fire('pointerup',{pointerId:1});assert.equal(els.count.textContent,0);assert.equal(els.zoom.textContent,'200%');els.fit.onclick();await draw(50,50,100,100);assert.equal(els.x.value,100);assert.equal(els.count.textContent,1);els.delete.onclick();assert.equal(els.count.textContent,0);els.undo.onclick();assert.equal(els.count.textContent,1);
});
test('wrong image resolution cannot be exported',async()=>{const bytes=Buffer.alloc(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(640,16);bytes.writeUInt32BE(288,20);els.file.files=[{name:'C05_frame_23835.png',size:33,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await els.file.fire('change');assert.match(els.status.textContent,/exigida 1280/);assert.equal(els.export.disabled,true);assert.equal(els.count.textContent,0);});
