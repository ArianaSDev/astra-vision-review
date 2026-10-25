// Only small metadata/answers are stored, never images, ZIPs or predictions.
import {validateReadingFields} from './hud.js';
export async function openHudStore(){
  if(!globalThis.indexedDB)throw Error('Armazenamento local indisponível. A revisão HUD não foi iniciada.');
  const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('astra-vision-review-hud',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('reviews',{keyPath:'reviewId'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Feche outras abas da ferramenta para abrir o armazenamento local.'));
  });
  async function transaction(mode,action){return new Promise((resolve,reject)=>{
    const tx=db.transaction('reviews',mode);let result;
    try{result=action(tx.objectStore('reviews'),tx);}catch(e){tx.abort();reject(e);return;}
    tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Gravação local interrompida.'));
  });}
  return {list:()=>transaction('readonly',s=>s.getAll()),
    create:review=>transaction('readwrite',s=>s.add(review)),
    append:(reviewId,reading)=>transaction('readwrite',(s,tx)=>{
      validateReadingFields(reading);
      const req=s.get(reviewId);req.onsuccess=()=>{
        const review=req.result;
        if(!review||review.readings.some(r=>r.captureId===reading.captureId)){tx.abort();return;}
        try{s.put({...review,readings:[...review.readings,reading]});}catch{tx.abort();}
      };
    }),close:()=>db.close()};
}
