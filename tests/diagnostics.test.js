import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnostics} from '../docs/diagnostics.js';
test('diagnostics retains bounded events and current state without modifying it',()=>{
  const state={reviewerVisual:'TEST',reviewerInternal:'',busy:false},element={textContent:''};
  const d=createDiagnostics(()=>element,()=>state);
  for(let i=0;i<20;i++)d.record('pointermove','tracked');
  d.record('draw-rejected','reviewer_missing');
  const out=JSON.parse(element.textContent);
  assert.equal(out.counts.pointermove,20);assert.equal(out.recent.length,12);
  assert.deepEqual(out.state,state);assert.equal(out.recent.at(-1).reason,'reviewer_missing');
  assert.equal(state.reviewerInternal,'');
  for(let i=0;i<20;i++)d.record('pointermove','untracked');
  assert.equal(JSON.parse(element.textContent).lastRejection.reason,'reviewer_missing');
});
test('diagnostic failure never interrupts editor callers',()=>{
  const d=createDiagnostics(()=>{throw Error('output unavailable');},()=>{throw Error('snapshot unavailable');});
  assert.doesNotThrow(()=>d.refresh());assert.doesNotThrow(()=>d.record('pointerdown','received'));
});
