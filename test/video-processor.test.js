'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const yazl=require('yazl');
const {ffmpegPath,probeOfficeVideo,compressOfficeVideo,estimateOutputBytes}=require('../src/video-processor');

function run(binary,args){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true});let error='';child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(error)));});}
async function makePptx(file,video){const zip=new yazl.ZipFile(),chunks=[];zip.outputStream.on('data',chunk=>chunks.push(chunk));const finished=new Promise((resolve,reject)=>{zip.outputStream.on('end',resolve);zip.outputStream.on('error',reject);});zip.addBuffer(await fs.readFile(video),'ppt/media/media1.mp4');zip.addBuffer(Buffer.from('<xml/>'),'docProps/core.xml');zip.end();await finished;await fs.writeFile(file,Buffer.concat(chunks));}

test('probes and compresses embedded video with configurable FFmpeg bitrates',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-ffmpeg-test-')),video=path.join(directory,'input.mp4'),pptx=path.join(directory,'video.pptx');
  try{await run(ffmpegPath(),['-y','-f','lavfi','-i','color=c=blue:s=320x180:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest',video]);await makePptx(pptx,video);const request={sourcePath:pptx,entryPath:'ppt/media/media1.mp4'},probe=await probeOfficeVideo(request);assert.ok(probe.duration>.8);assert.equal(probe.width,320);assert.equal(probe.height,180);assert.ok(estimateOutputBytes(probe.duration,2095,128)>0);const progress=[],result=await compressOfficeVideo({...request,videoKbps:512,audioKbps:64},{onProgress:value=>progress.push(value)});assert.ok(result.bytes>0);assert.equal(result.videoKbps,512);assert.equal(result.audioKbps,64);assert.equal(result.warning,true);assert.ok(progress.includes(100));await fs.rm(result.outputPath,{force:true});}finally{await fs.rm(directory,{recursive:true,force:true});}
});
