'use strict';
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {pipeline}=require('stream/promises');
const zlib=require('zlib');
const yauzl=require('yauzl');
const yazl=require('yazl');

const mediaRoots={word:/^word\/media\//i,excel:/^xl\/media\//i,powerpoint:/^ppt\/media\//i};
const mimeByExt={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',webp:'image/webp',svg:'image/svg+xml',tif:'image/tiff',tiff:'image/tiff',emf:'image/x-emf',wmf:'image/x-wmf',mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',ogv:'video/ogg',ogg:'video/ogg',mov:'video/quicktime',avi:'video/x-msvideo',wmv:'video/x-ms-wmv',mpg:'video/mpeg',mpeg:'video/mpeg'};
const imagePreviewable=new Set(['png','jpg','jpeg','gif','bmp','webp','svg']),videoPreviewable=new Set(['mp4','m4v','webm','ogv','ogg','mov']);
const imageReadLimit=128*1024*1024;
const cacheRoot=path.join(os.tmpdir(),'presalesx-media-cache');

function kindFor(file){const extension=path.extname(file).toLowerCase();if(['.docx','.docm'].includes(extension))return'word';if(['.xlsx','.xlsm'].includes(extension))return'excel';if(['.pptx','.pptm'].includes(extension))return'powerpoint';return'';}
function openZip(sourcePath){return new Promise((resolve,reject)=>yauzl.open(sourcePath,{lazyEntries:true,autoClose:false,decodeStrings:true,validateEntrySizes:false},(error,zip)=>error?reject(error):resolve(zip)));}
function readEntry(zip,entry,{limit=Infinity}={}){return new Promise((resolve,reject)=>zip.openReadStream(entry,(error,stream)=>{if(error)return reject(error);const chunks=[];let size=0;stream.on('data',chunk=>{size+=chunk.length;if(size>limit){stream.destroy(new Error(`媒体文件超过 ${Math.round(limit/1024/1024)} MB 内存读取限制`));return;}chunks.push(chunk);});stream.on('end',()=>resolve(Buffer.concat(chunks,size)));stream.on('error',reject);}));}
function dimensions(buffer,ext){try{if(ext==='png'&&buffer.length>=24)return{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};if(ext==='gif'&&buffer.length>=10)return{width:buffer.readUInt16LE(6),height:buffer.readUInt16LE(8)};if(ext==='bmp'&&buffer.length>=26)return{width:buffer.readInt32LE(18),height:Math.abs(buffer.readInt32LE(22))};if(['jpg','jpeg'].includes(ext)){let offset=2;while(offset+9<buffer.length){if(buffer[offset]!==0xff){offset++;continue;}const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);if(marker>=0xc0&&marker<=0xc3)return{height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)};offset+=2+length;}}}catch{}return{};}
function mediaDescriptor(sourcePath,entry){const ext=path.extname(entry.fileName).slice(1).toLowerCase(),mime=mimeByExt[ext],mediaType=mime?.startsWith('video/')?'video':'image';return{id:`${sourcePath}::${entry.fileName}`,entryPath:entry.fileName,name:path.basename(entry.fileName),ext,mime,mediaType,bytes:entry.uncompressedSize,compressedBytes:entry.compressedSize,crc32:entry.crc32,previewable:mediaType==='video'?videoPreviewable.has(ext):imagePreviewable.has(ext),processable:mediaType==='image'&&imagePreviewable.has(ext),lazy:true};}

async function inspectFile(sourcePath,onEntry=()=>{}){
  const kind=kindFor(sourcePath);
  if(!kind)return{sourcePath,name:path.basename(sourcePath),kind:'other',images:[],error:'仅支持 Word、Excel 和 PowerPoint'};
  const [stat,zip]=await Promise.all([fsp.stat(sourcePath),openZip(sourcePath)]),images=[];
  return new Promise((resolve,reject)=>{
    let scanned=0,settled=false;const total=zip.entryCount||1;
    const finish=(error,result)=>{if(settled)return;settled=true;try{zip.close();}catch{}error?reject(error):resolve(result);};
    zip.on('entry',entry=>{scanned++;onEntry({scanned,total,media:images.length,entry:entry.fileName});if(mediaRoots[kind].test(entry.fileName)&&!/\/$/.test(entry.fileName)){const ext=path.extname(entry.fileName).slice(1).toLowerCase();if(mimeByExt[ext])images.push(mediaDescriptor(sourcePath,entry));}onEntry({scanned,total,media:images.length,entry:entry.fileName});setImmediate(()=>zip.readEntry());});
    zip.on('end',()=>finish(null,{sourcePath,name:path.basename(sourcePath),kind,bytes:stat.size,images,indexMode:'lazy'}));
    zip.on('error',error=>finish(error));
    zip.readEntry();
  });
}

async function findEntry(sourcePath,entryPath){const kind=kindFor(sourcePath),normalized=String(entryPath||'').replace(/\\/g,'/');if(!kind||!mediaRoots[kind].test(normalized))throw new Error('无效的 Office 媒体路径');const zip=await openZip(sourcePath);return new Promise((resolve,reject)=>{let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;if(error){try{zip.close();}catch{}reject(error);}else resolve({zip,entry:value});};zip.on('entry',entry=>{if(entry.fileName===normalized)return finish(null,entry);zip.readEntry();});zip.on('end',()=>finish(new Error('Office 文件中找不到该媒体')));zip.on('error',error=>finish(error));zip.readEntry();});}
async function cachePathFor(sourcePath,entry){const stat=await fsp.stat(sourcePath),key=crypto.createHash('sha256').update(`${path.resolve(sourcePath)}\0${stat.size}\0${stat.mtimeMs}\0${entry.fileName}\0${entry.crc32}`).digest('hex'),ext=path.extname(entry.fileName)||'.bin';return path.join(cacheRoot,`${key}${ext}`);}
async function zipEntryDataOffset(sourcePath,entry){const handle=await fsp.open(sourcePath,'r');try{const header=Buffer.alloc(30);await handle.read(header,0,header.length,entry.relativeOffsetOfLocalHeader);if(header.readUInt32LE(0)!==0x04034b50)throw new Error('无效的 ZIP 本地文件头');return entry.relativeOffsetOfLocalHeader+30+header.readUInt16LE(26)+header.readUInt16LE(28);}finally{await handle.close();}}
async function materializeOfficeMedia({sourcePath,entryPath}){sourcePath=path.resolve(sourcePath);const {zip,entry}=await findEntry(sourcePath,entryPath);try{zip.close();}catch{}let temporary='';try{await fsp.mkdir(cacheRoot,{recursive:true});const target=await cachePathFor(sourcePath,entry);try{const stat=await fsp.stat(target);if(stat.size===entry.uncompressedSize)return target;}catch{}temporary=`${target}.${process.pid}.${Date.now()}.tmp`;const start=await zipEntryDataOffset(sourcePath,entry),input=fs.createReadStream(sourcePath,{start,end:start+entry.compressedSize-1}),output=fs.createWriteStream(temporary);if(entry.compressionMethod===0)await pipeline(input,output);else if(entry.compressionMethod===8)await pipeline(input,zlib.createInflateRaw(),output);else throw new Error(`不支持的 ZIP 压缩方法：${entry.compressionMethod}`);const stat=await fsp.stat(temporary);if(stat.size!==entry.uncompressedSize)throw new Error(`媒体解压不完整：预期 ${entry.uncompressedSize} 字节，实际 ${stat.size} 字节`);await fsp.rm(target,{force:true});await fsp.rename(temporary,target);temporary='';return target;}finally{if(temporary)await fsp.rm(temporary,{force:true}).catch(()=>{});}}
async function readOfficeMediaBuffer({sourcePath,entryPath}){const {zip,entry}=await findEntry(path.resolve(sourcePath),entryPath);try{return await readEntry(zip,entry,{limit:imageReadLimit});}finally{try{zip.close();}catch{}}}
async function loadOfficeMedia(request){const sourcePath=path.resolve(request.sourcePath),entryPath=request.entryPath,ext=path.extname(entryPath).slice(1).toLowerCase(),mime=mimeByExt[ext];if(!mime)throw new Error('不支持的媒体格式');if(mime.startsWith('video/')){const mediaPath=await materializeOfficeMedia({sourcePath,entryPath});return{path:mediaPath,mime,bytes:(await fsp.stat(mediaPath)).size};}const data=await readOfficeMediaBuffer({sourcePath,entryPath});return{data:data.toString('base64'),mime,bytes:data.length,...dimensions(data,ext)};}

async function inspectOfficeImages(files,progress=()=>{}){const results=[];for(let index=0;index<files.length;index++){const sourcePath=path.resolve(files[index]),fileName=path.basename(sourcePath);let lastScanned=0,lastMedia=-1;progress({done:index,total:files.length,name:fileName});try{results.push(await inspectFile(sourcePath,state=>{const mediaMilestone=state.media!==lastMedia&&state.media%16===0,entryMilestone=state.scanned-lastScanned>=32;if(state.scanned!==state.total&&!mediaMilestone&&!entryMilestone)return;lastScanned=state.scanned;lastMedia=state.media;progress({done:index+(state.scanned/state.total),total:files.length,name:`${fileName} · 已索引 ${state.media} 项媒体`});}));}catch(error){results.push({sourcePath,name:fileName,kind:kindFor(sourcePath)||'other',images:[],error:error.message});}}progress({done:files.length,total:files.length,name:'媒体索引完成'});return results;}

async function replaceOfficeMedia(sourcePath,replacements,destination=sourcePath){
  if(!kindFor(sourcePath))throw new Error('仅支持 Word、Excel 和 PowerPoint 源文件');
  const replacementMap=new Map(replacements.map(item=>[item.entryPath,Buffer.isBuffer(item.data)?item.data:Buffer.from(item.data,'base64')]));
  if(!replacementMap.size)throw new Error('没有可写回源文件的媒体修改');
  const archive=await openZip(sourcePath),output=new yazl.ZipFile(),target=path.resolve(destination),source=path.resolve(sourcePath),temporary=target===source?path.join(path.dirname(source),`.${path.basename(source)}.presalesx-${process.pid}-${Date.now()}.tmp`):target;
  await fsp.mkdir(path.dirname(temporary),{recursive:true});const outputStream=fs.createWriteStream(temporary),finished=new Promise((resolve,reject)=>{output.outputStream.pipe(outputStream);outputStream.on('finish',resolve);outputStream.on('error',reject);output.outputStream.on('error',reject);});
  await new Promise((resolve,reject)=>{archive.on('entry',entry=>{if(/\/$/.test(entry.fileName)){output.addEmptyDirectory(entry.fileName);archive.readEntry();return;}if(replacementMap.has(entry.fileName)){output.addBuffer(replacementMap.get(entry.fileName),entry.fileName,{mtime:entry.getLastModDate()});archive.readEntry();return;}archive.openReadStream(entry,(error,stream)=>{if(error)return reject(error);output.addReadStream(stream,entry.fileName,{mtime:entry.getLastModDate()});stream.on('end',()=>archive.readEntry());stream.on('error',reject);});});archive.on('end',()=>{archive.close();resolve();});archive.on('error',reject);archive.readEntry();});
  output.end();await finished;if(target===source){await fsp.copyFile(temporary,source);await fsp.unlink(temporary);}return{sourcePath:source,destination:target,replaced:replacementMap.size,bytes:(await fsp.stat(target)).size};
}
module.exports={inspectOfficeImages,loadOfficeMedia,materializeOfficeMedia,readOfficeMediaBuffer,replaceOfficeMedia,kindFor,dimensions};
