import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('HUD catalog picker does not hide files by provider MIME; image pickers remain restricted',async()=>{
 const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
 const input=id=>html.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
 assert.match(input('hud-catalog'),/type="file"/);
 assert.doesNotMatch(input('hud-catalog'),/\baccept\s*=/i);
 for(const id of ['file','hud-files'])assert.match(input(id),/accept="[^"]*image\/png[^"]*application\/zip/);
});
