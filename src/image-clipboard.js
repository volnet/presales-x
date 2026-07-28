'use strict';
const {clipboard,nativeImage}=require('electron');
function copyImages(images=[]){const valid=images.filter(image=>image.data&&image.mime?.startsWith('image/'));if(!valid.length)return{count:0};const urls=valid.map(image=>`data:${image.mime};base64,${image.data}`),first=nativeImage.createFromDataURL(urls[0]);clipboard.write({image:first,html:`<div>${urls.map((url,index)=>`<img src="${url}" alt="${String(valid[index].name||'图片').replace(/[&<>"']/g,'')}">`).join('')}</div>`,text:valid.length===1?valid[0].name:`已复制 ${valid.length} 张图片`});return{count:valid.length};}
function copyFile(file){if(process.platform==='win32')clipboard.writeBuffer('FileNameW',Buffer.from(`${file}\0`,'ucs2'));else clipboard.writeText(file);return{path:file};}
module.exports={copyImages,copyFile};
