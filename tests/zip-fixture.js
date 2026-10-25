import {deflateRawSync} from 'node:zlib';
import {crc32} from '../docs/core.js';
export function zipFixture(bytes,method=0,name='folder/synthetic.png',prefixSize=0){
 const n=Buffer.from(name),payload=method===8?deflateRawSync(bytes):bytes,h=Buffer.alloc(30),c=Buffer.alloc(46),end=Buffer.alloc(22);
 h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(method,8);h.writeUInt32LE(crc32(bytes),14);h.writeUInt32LE(payload.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(n.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(method,10);c.writeUInt32LE(crc32(bytes),16);c.writeUInt32LE(payload.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(prefixSize,42);
 const directoryOffset=prefixSize+h.length+n.length+payload.length;
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(c.length+n.length,12);end.writeUInt32LE(directoryOffset,16);
 return {prefixSize,header:h,name:n,payload,central:c,end,directoryOffset};
}
