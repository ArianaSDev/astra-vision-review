// Shared display geometry. Scaling affects the canvas only, never source bytes.
export function fitImage(width,height,viewWidth,viewHeight){
  const scale=Math.min(viewWidth/width,viewHeight/height);
  return {scale,x:(viewWidth-width*scale)/2,y:(viewHeight-height*scale)/2};
}
export function zoomImage(transform,factor,anchor,minScale,maxScale=minScale*12){
  const scale=Math.max(minScale,Math.min(maxScale,transform.scale*factor)),k=scale/transform.scale;
  return {scale,x:anchor.x-(anchor.x-transform.x)*k,y:anchor.y-(anchor.y-transform.y)*k};
}
export function downloadJSON(data,filename){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
