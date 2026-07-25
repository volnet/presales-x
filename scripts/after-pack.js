'use strict';

const path=require('path');
const os=require('os');
const fs=require('fs').promises;
const {execFile}=require('child_process');
const {promisify}=require('util');
const {version}=require('../package.json');
const execFileAsync=promisify(execFile);
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

exports.default=async context=>{
  if(context.electronPlatformName!=='win32')return;
  const root=context.packager.projectDir,exe=path.join(context.appOutDir,'PreSalesX.exe'),icon=path.join(root,'src','ui','assets','presalesx-logo.ico'),rcedit=path.join(root,'node_modules','electron-winstaller','vendor','rcedit.exe');
  const temporary=path.join(os.tmpdir(),`PreSalesX-resource-edit-${process.pid}-${Date.now()}.exe`),args=target=>[target,'--set-icon',icon,'--set-version-string','ProductName','PreSalesX','--set-version-string','FileDescription','PreSalesX Pre-Sales Document Review Workspace','--set-version-string','CompanyName','PreSalesX','--set-version-string','InternalName','PreSalesX','--set-version-string','OriginalFilename','PreSalesX.exe','--set-file-version',version,'--set-product-version',version];
  await fs.copyFile(exe,temporary);
  try{
    await execFileAsync(rcedit,args(temporary),{windowsHide:true});
    for(let attempt=0;;attempt++){try{await fs.copyFile(temporary,exe);break;}catch(error){if(attempt===5)throw error;await wait(300*(attempt+1));}}
  }finally{for(let attempt=0;attempt<8;attempt++){try{await fs.rm(temporary,{force:true});break;}catch{await wait(250*(attempt+1));}}}
};
