'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const {supportedActions,defaultExtensions,extensionOf,waitForStableFile,FolderMonitor}=require('../src/folder-monitor');

test('folder monitor classifies supported files for nearby actions',()=>{
  assert.deepEqual(supportedActions('supplier.zip'),['compare']);
  assert.deepEqual(supportedActions('proposal.docx'),['files','watermark','images']);
  assert.deepEqual(supportedActions('deck.pptx'),['files','images']);
  assert.deepEqual(supportedActions('contract.pdf'),['files']);
  assert.deepEqual(supportedActions('ignored.exe'),[]);
  assert.equal(extensionOf('Example.XLSX'),'xlsx');
});

test('folder monitor respects configurable extensions',()=>{
  assert.deepEqual(supportedActions('proposal.docx',['pdf']),[]);
  assert.deepEqual(supportedActions('contract.pdf',['pdf']),['files']);
  assert.ok(defaultExtensions.includes('zip'));
  assert.ok(defaultExtensions.includes('pptx'));
});

test('stable-file check survives a Windows download rename race',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-monitor-'));
  const file=path.join(folder,'late-download.docx');
  const creation=setTimeout(()=>fs.writeFile(file,'complete'),350);
  try{const stat=await waitForStableFile(file,8,100);assert.equal(stat.size,8);}finally{clearTimeout(creation);await fs.rm(folder,{recursive:true,force:true});}
});

test('folder monitor detects sequential and same-name replacement downloads once each',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-monitor-')),detected=[];
  const monitor=new FolderMonitor(item=>detected.push(item.name));
  try{
    await monitor.configure({enabled:true,folders:[folder],extensions:['txt'],notification:'silent',recursive:false});
    const first=path.join(folder,'first.txt');
    await fs.writeFile(first,'first');
    // Windows can emit another rename/change event while stability checking is
    // still in progress. It must not enqueue the same finished file twice.
    setTimeout(()=>monitor.consider(first),500);
    await new Promise(resolve=>setTimeout(resolve,1200));
    await fs.writeFile(path.join(folder,'second.txt'),'second');
    await new Promise(resolve=>setTimeout(resolve,1200));
    await fs.writeFile(first,'first replacement');
    await new Promise(resolve=>setTimeout(resolve,1200));
    assert.deepEqual(detected.sort(),['first.txt','first.txt','second.txt']);
  }finally{monitor.stop();await fs.rm(folder,{recursive:true,force:true});}
});
