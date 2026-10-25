import test from 'node:test';
import assert from 'node:assert/strict';
import {indexZip,selectZipEntry,readZipEntry} from '../docs/zip.js';
import {zipFixture} from './zip-fixture.js';
function fileOf(z){return new Blob([new Uint8Array(z.prefixSize),z.header,z.name,z.payload,z.central,z.name,z.end]);}
test('selective ZIP32 reads STORED and DEFLATE with exact original bytes and CRC',async()=>{
 for(const method of [0,8]){const bytes=Buffer.from('synthetic png bytes'),z=zipFixture(bytes,method),idx=await indexZip(fileOf(z));assert.equal(idx.entries.length,1);assert.deepEqual((await readZipEntry(idx,selectZipEntry(idx,'synthetic.png'))).bytes,new Uint8Array(bytes));}
});
test('111 MB archive indexing and PNG access do not read or allocate the full archive',async()=>{
 const z=zipFixture(Buffer.from('synthetic'),0,'folder/synthetic.png',111320130),parts=[{start:z.prefixSize,data:Buffer.concat([z.header,z.name,z.payload,z.central,z.name,z.end])}],size=z.prefixSize+parts[0].data.length,reads=[];
 const file={size,arrayBuffer(){throw Error('Whole archive read forbidden');},slice(start,end){reads.push(end-start);const b=Buffer.alloc(end-start);for(const p of parts){const a=Math.max(start,p.start),e=Math.min(end,p.start+p.data.length);if(a<e)p.data.copy(b,a-start,a-p.start,e-p.start);}return new Blob([b]);}};
 const idx=await indexZip(file);assert.equal(Buffer.from((await readZipEntry(idx,selectZipEntry(idx,'synthetic.png'))).bytes).toString(),'synthetic');assert.ok(reads.reduce((a,b)=>a+b,0)<70000);assert.ok(Math.max(...reads)<=65557);
});
test('rejects truncated, multipart, ZIP64, encrypted, unsupported compression and oversize declarations',async()=>{
 const bytes=Buffer.from('original');await assert.rejects(indexZip(new Blob([bytes])));
 for(const change of [z=>z.end.writeUInt16LE(1,4),z=>z.end.writeUInt16LE(65535,10),z=>z.end.writeUInt32LE(0xffffffff,16),z=>z.end.writeUInt32LE(9*1024*1024,12)]){const z=zipFixture(bytes);change(z);await assert.rejects(indexZip(fileOf(z)));}
 for(const change of [z=>{z.central.writeUInt16LE(1,8);z.header.writeUInt16LE(1,6);},z=>z.central.writeUInt16LE(99,10),z=>z.central.writeUInt32LE(21*1024*1024,24),z=>z.central.writeUInt32LE(0xffffffff,42)]){const z=zipFixture(bytes);change(z);const idx=await indexZip(fileOf(z));await assert.rejects(readZipEntry(idx,idx.entries[0]));}
});
test('rejects CRC corruption, local name/header mismatch and missing or ambiguous identities',async()=>{
 for(const change of [z=>z.payload[0]^=1,z=>z.header.writeUInt16LE(8,8),z=>z.header.writeUInt32LE(0,0)]){const z=zipFixture(Buffer.from('original'));change(z);const idx=await indexZip(fileOf(z));await assert.rejects(readZipEntry(idx,idx.entries[0]));}
 const idx=await indexZip(fileOf(zipFixture(Buffer.from('original'))));assert.throws(()=>selectZipEntry(idx,'absent.png'));assert.throws(()=>selectZipEntry({...idx,entries:[...idx.entries,...idx.entries]},'synthetic.png'));assert.throws(()=>selectZipEntry(idx,'synthetic.png','other/path'));await assert.rejects(readZipEntry(idx,{...idx.entries[0]}));
});
