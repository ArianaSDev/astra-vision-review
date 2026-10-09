import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manifest,scene,sceneB,bytes,pngHeader,zip,manifestSource,syntheticSource} from './fixtures.js';
import {validateManifest,validateScene,MAX_FILE_BYTES} from '../docs/manifest.js';
import {verifyPNG,extractPNG,point,validBox,contextWindow,exportReview,conferRegion} from '../docs/core.js';
const clone=v=>structuredClone(v);
test('manifest strict allowlist rejects annotations at either level',()=>{
 for(const key of ['boxes','groundTruth','reviews','proposals','heroId','__proto__']){const m=clone(manifest);Object.defineProperty(m,key,{value:[],enumerable:true});assert.throws(()=>validateManifest(m));const n=clone(manifest);Object.defineProperty(n.scenes[0],key,{value:[],enumerable:true});assert.throws(()=>validateManifest(n));}
 assert.ok(Object.isFrozen(validateManifest(manifest).scenes[0].limitations));
});
test('manifest rejects invalid types, paths, hashes, timing and duplicate identities',()=>{
 for(const patch of [{width:'1280'},{height:0},{width:4097},{pngBytes:32},{pngBytes:21*1024*1024},{sha256:'f'.repeat(63)},{sha256:'F'.repeat(64)},{frameIndex:-1},{frameIndex:1.5},{timestampSeconds:'1'},{timestamp:'00:60:00.000'},{timestampSeconds:2},{timingAuthority:''},{limitations:[]},{limitations:['']},{id:'../A'},{pngPath:'../a.png'},{pngPath:'https://example.com/a.png'},{pngPath:'/a.png'},{pngPath:'a//b.png'}])assert.throws(()=>validateScene({...scene,...patch}),JSON.stringify(patch));
 for(const m of [null,[],{...manifest,schema:'unknown'},{...manifest,scenes:[]},{...manifest,scenes:[scene,scene]},{...manifest,scenes:[scene,{...sceneB,pngPath:'other/synthetic-a.png'}]}])assert.throws(()=>validateManifest(m));
 // Declared frame index is not silently converted using an assumed FPS.
 assert.equal(validateScene({...scene,frameIndex:900}).timestampSeconds,1);
});
test('PNG verification binds actual bytes, resolution and SHA-256 for distinct scenes',async()=>{
 assert.equal((await verifyPNG(bytes,scene)).sha256,scene.sha256);assert.equal((await verifyPNG(pngHeader(640,288),sceneB)).sha256,sceneB.sha256);
 await assert.rejects(verifyPNG(bytes,sceneB),/Resolução/);await assert.rejects(verifyPNG(bytes.subarray(0,32),scene),/Tamanho/);const altered=Buffer.from(bytes);altered[25]^=1;await assert.rejects(verifyPNG(altered,scene),/SHA-256/);
});
test('ZIP multicene resolves exact paths, ignores unrelated content and rejects basename substitutions',async()=>{
 const z=zip([{name:scene.pngPath,bytes},{name:sceneB.pngPath,bytes:pngHeader(640,288)},{name:'private-answers.json',bytes:Buffer.from('not parsed')}]);
 for(const s of [scene,sceneB]){const result=await extractPNG(z,s.pngPath);await verifyPNG(result.bytes,s);assert.equal(result.path,s.pngPath);}
 await assert.rejects(extractPNG(zip([{name:'other/synthetic-a.png',bytes}]),scene.pngPath),/não encontrado/);
 await assert.rejects(extractPNG(zip([{name:scene.pngPath,bytes},{name:scene.pngPath,bytes}]),scene.pngPath),/duplicada/);
});
test('ZIP rejects inconsistent headers, CRC, expansion and file resource limits',async()=>{
 const original=zip([{name:scene.pngPath,bytes}]);const a=new Uint8Array(original.slice(0));a[30]^=1;await assert.rejects(extractPNG(a.buffer,scene.pngPath),/Cabeçalho/);
 const crc=new Uint8Array(original.slice(0));crc[30+scene.pngPath.length]^=1;await assert.rejects(extractPNG(crc.buffer,scene.pngPath),/CRC/);
 const big=original.slice(0),v=new DataView(big),central=30+scene.pngPath.length+33;v.setUint32(central+24,21*1024*1024,true);await assert.rejects(extractPNG(big,scene.pngPath),/20 MB/);
 const wrong=original.slice(0);new DataView(wrong).setUint32(18,999,true);await assert.rejects(extractPNG(wrong,scene.pngPath),/inconsistentes/);
 await assert.rejects(extractPNG(new ArrayBuffer(MAX_FILE_BYTES+1),scene.pngPath),/tamanho ZIP/);
 const z=zip([{name:scene.pngPath,bytes,method:8}]),d=new DataView(z),end=z.byteLength-22,c=d.getUint32(end+16,true);d.setUint32(c+24,1,true);d.setUint32(22,1,true);await assert.rejects(extractPNG(z,scene.pngPath),/descompactado/);
});
test('geometry uses selected scene extent under pan/zoom',()=>{
 for(const scale of [.25,1,12])assert.deepEqual(point(640*scale-9,288*scale+31,{scale,x:-9,y:31},sceneB),{x:640,y:288});
 assert.ok(!validBox({x:639,y:0,width:2,height:1},sceneB));assert.ok(validBox({x:639,y:0,width:1,height:1},sceneB));const w=contextWindow({x:620,y:270,width:10,height:10},sceneB);assert.ok(w.x+w.width<=640&&w.y+w.height<=288);
});
test('schema 0.3 preserves earlier field meanings and rejects cross-scene or reviewer export',()=>{
 const box={id:'B1',category:'IGNORE',x:1.5,y:2.5,width:30,height:20,certainty:'approximate',note:''};conferRegion(box,'indeterminate','R1');
 const args={scene,manifestSource,source:syntheticSource,reviewer:'R1',boxes:[box],coverage:'partial'};const d=JSON.parse(JSON.stringify(exportReview(args)));
 assert.equal(d.schema,'astra-vision-review/0.3');assert.equal(d.canonicalGroundTruth,false);assert.equal(d.trainingAuthorized,false);assert.equal(d.status,'provisional_unvalidated');assert.equal(d.coordinateSystem.units,'original-image-pixels');assert.equal(d.boxes[0].certainty,'approximate');assert.deepEqual(d.boxes[0].xyxy,[1.5,2.5,31.5,22.5]);assert.equal(d.conference.method,'manual_individual_visual');assert.deepEqual(d.session,{sceneId:scene.id,pngSha256:scene.sha256,reviewer:'R1'});
 assert.throws(()=>exportReview({...args,scene:sceneB}),/não verificados/);assert.throws(()=>exportReview({...args,reviewer:'R2'}),/Confira/);assert.throws(()=>exportReview({...args,source:{...syntheticSource,zipEntry:scene.pngPath}}));
 for(const coverage of ['complete','partial','inadequate']){assert.throws(()=>exportReview({...args,boxes:[],coverage}),/explicitamente/);assert.equal(exportReview({...args,boxes:[],coverage,emptySceneExamined:true}).coverage,coverage);}
});
test('local-only loading, CSP and no private fixture identity in runtime',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes("form-action 'none'"));assert.ok(html.includes("img-src 'self' blob:"));
 assert.ok(!/<script[^>]+src=["']https?:/i.test(html));assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|WebSocket|https?:\/\//.test(app));assert.ok(app.includes('URL.createObjectURL'));assert.ok(app.includes('link.download='));assert.ok(!/C05|23835|Kagura_Cenas/.test(app));
});
