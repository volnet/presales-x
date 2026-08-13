'use strict';
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');

const actionExtensions={
  compare:new Set(['zip']),
  files:new Set(['docx','docm','xlsx','xlsm','pptx','pptm','pdf','jpg','jpeg','png','tiff','bmp','webp','txt','csv','xml','json','html']),
  watermark:new Set(['docx','docm','xlsx','xlsm','pptx','pptm']),
  images:new Set(['docx','docm','xlsx','xlsm','pptx','pptm'])
};
const defaultExtensions=[...new Set(Object.values(actionExtensions).flatMap(set=>[...set]))].sort();
function extensionOf(file){return path.extname(file).slice(1).toLowerCase();}
function supportedActions(file,enabledExtensions=defaultExtensions){const ext=extensionOf(file);if(!enabledExtensions.includes(ext))return[];return Object.entries(actionExtensions).filter(([,extensions])=>extensions.has(ext)).map(([action])=>action);}
async function waitForStableFile(file,attempts=16,interval=250){let previous=-1,stable=0;for(let index=0;index<attempts;index++){await new Promise(resolve=>setTimeout(resolve,interval));try{const stat=await fsp.stat(file);if(!stat.isFile())continue;if(stat.size===previous)stable++;else stable=0;previous=stat.size;if(stable>=2)return stat;}catch{previous=-1;stable=0;}}try{const stat=await fsp.stat(file);return stat.isFile()?stat:null;}catch{return null;}}
async function listFiles(root,recursive=false){const files=[];let entries;try{entries=await fsp.readdir(root,{withFileTypes:true});}catch{return files;}for(const entry of entries){const target=path.join(root,entry.name);if(entry.isFile())files.push(target);else if(recursive&&entry.isDirectory())files.push(...await listFiles(target,true));}return files;}
function fileSignature(stat){return `${stat.size}:${Math.round(stat.mtimeMs)}`;}
class FolderMonitor{
  constructor(onDetected=()=>{},onError=()=>{}){this.onDetected=onDetected;this.onError=onError;this.watchers=[];this.seen=new Map();this.pending=new Map();this.settings=null;this.roots=[];this.scanTimer=null;this.scanning=false;}
  async configure(settings){this.stop();this.settings=settings;if(!settings?.enabled)return{active:0,errors:[]};const errors=[];for(const folder of settings.folders||[]){const root=path.resolve(folder);try{await fsp.access(root);for(const file of await listFiles(root,Boolean(settings.recursive))){try{this.seen.set(file.toLowerCase(),fileSignature(await fsp.stat(file)));}catch{}}const watcher=fs.watch(root,{recursive:Boolean(settings.recursive)},(_event,name)=>{if(name)this.consider(path.join(root,String(name)));});watcher.on('error',error=>this.onError(error));this.watchers.push(watcher);this.roots.push(root);}catch(error){errors.push(`${root}: ${error.message}`);this.onError(error);}}
    if(this.roots.length){this.scanTimer=setInterval(()=>this.scan(),1500);this.scanTimer.unref?.();}
    return{active:this.roots.length,errors};
  }
  async scan(){if(this.scanning||!this.settings?.enabled)return;this.scanning=true;try{const current=new Set();for(const root of this.roots)for(const file of await listFiles(root,Boolean(this.settings.recursive))){const key=file.toLowerCase();current.add(key);if(this.pending.has(key)||!supportedActions(file,this.settings.extensions).length)continue;try{if(this.seen.get(key)!==fileSignature(await fsp.stat(file)))this.consider(file);}catch{}}for(const key of this.seen.keys())if(this.roots.some(root=>key.startsWith(`${root.toLowerCase()}${path.sep}`))&&!current.has(key))this.seen.delete(key);}catch(error){this.onError(error);}finally{this.scanning=false;}}
  consider(file){const resolved=path.resolve(file),key=resolved.toLowerCase();if(this.pending.has(key)||!supportedActions(resolved,this.settings.extensions).length)return;const timer=setTimeout(async()=>{try{const stat=await waitForStableFile(resolved);if(!stat){this.seen.delete(key);return;}const signature=fileSignature(stat);if(this.seen.get(key)===signature)return;this.seen.set(key,signature);await this.onDetected({path:resolved,name:path.basename(resolved),extension:extensionOf(resolved),bytes:stat.size,modifiedAt:stat.mtime.toISOString(),actions:supportedActions(resolved,this.settings.extensions),detectedAt:new Date().toISOString(),notification:this.settings.notification||'popup'});}catch(error){this.onError(error);}finally{this.pending.delete(key);}},350);this.pending.set(key,timer);}
  stop(){for(const watcher of this.watchers)watcher.close();this.watchers=[];for(const timer of this.pending.values())clearTimeout(timer);this.pending.clear();if(this.scanTimer)clearInterval(this.scanTimer);this.scanTimer=null;this.roots=[];this.seen.clear();}
}
module.exports={FolderMonitor,actionExtensions,defaultExtensions,supportedActions,extensionOf,waitForStableFile,listFiles,fileSignature};
