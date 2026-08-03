'use strict';
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);

const actions={
  compare:{label:'加入供应商审查',extensions:['zip']},
  files:{label:'打开文件属性编辑器',extensions:['docx','docm','xlsx','xlsm','pptx','pptm','pdf','jpg','jpeg','png','tiff','bmp','webp','txt','csv','xml','json','html']},
  watermark:{label:'打开文件脱敏',extensions:['docx','docm','xlsx','xlsm']},
  images:{label:'打开文档媒体助理',extensions:['docx','docm','xlsx','xlsm','pptx','pptm']}
};
const allExtensions=[...new Set(Object.values(actions).flatMap(action=>action.extensions))];
const windowsClasses='HKCU\\Software\\Classes';
const commandStore='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell';
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

async function reg(args){return run('reg.exe',args,{windowsHide:true});}
async function setRegistry(key,name,value){const args=['add',key,name?'/v':'/ve',...(name?[name]:[]),'/d',value,'/f'];await reg(args);}
async function installWindows(executable){
  for(const extension of allExtensions){
    const key=`${windowsClasses}\\SystemFileAssociations\\.${extension}\\shell\\PreSalesX`;
    // Recreate the branch so obsolete SubCommands values cannot leave an empty flyout.
    try{await reg(['delete',key,'/f']);}catch{}
    await setRegistry(key,'MUIVerb','PreSalesX');
    await setRegistry(key,'Icon',executable);
    // An empty SubCommands value tells Explorer that the nested shell keys are verbs,
    // rather than treating the selected document itself as the command target.
    await setRegistry(key,'SubCommands','');
    const available=Object.entries(actions).filter(([,action])=>action.extensions.includes(extension));
    for(const [index,[id,action]] of available.entries()){
      const child=`${key}\\shell\\${String(index+1).padStart(2,'0')}-${id}`;
      await setRegistry(child,'MUIVerb',action.label);
      await setRegistry(child,'Icon',executable);
      await setRegistry(`${child}\\command`,'',`"${executable}" --presalesx-action=${id} "%1"`);
    }
  }
  // Remove the previous shared CommandStore implementation after migrating.
  for(const id of Object.keys(actions))try{await reg(['delete',`${commandStore}\\PreSalesX.${id}`,'/f']);}catch{}
  return getWindowsState();
}
async function removeWindows(){
  for(const extension of allExtensions)try{await reg(['delete',`${windowsClasses}\\SystemFileAssociations\\.${extension}\\shell\\PreSalesX`,'/f']);}catch{}
  for(const id of Object.keys(actions))try{await reg(['delete',`${commandStore}\\PreSalesX.${id}`,'/f']);}catch{}
  return getWindowsState();
}
async function getWindowsState(){try{await reg(['query',`${windowsClasses}\\SystemFileAssociations\\.docx\\shell\\PreSalesX`]);return{platform:'win32',installed:true,kind:'Windows 右键子菜单'};}catch{return{platform:'win32',installed:false,kind:'Windows 右键子菜单'};}}

function workflowDocument(action,executable){
  const command=`${JSON.stringify(executable)} --presalesx-action=${action} "$@" >/dev/null 2>&1 &`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>AMApplicationBuild</key><string>523</string><key>AMApplicationVersion</key><string>2.10</string><key>AMDocumentVersion</key><string>2</string><key>actions</key><array><dict><key>action</key><dict><key>AMAccepts</key><dict><key>Container</key><string>List</string><key>Optional</key><true/><key>Types</key><array><string>com.apple.cocoa.path</string></array></dict><key>AMActionVersion</key><string>2.0.3</string><key>AMApplication</key><array><string>Automator</string></array><key>AMParameterProperties</key><dict><key>COMMAND_STRING</key><dict/></dict><key>AMProvides</key><dict><key>Container</key><string>List</string><key>Types</key><array><string>com.apple.cocoa.path</string></array></dict><key>ActionBundlePath</key><string>/System/Library/Automator/Run Shell Script.action</string><key>ActionName</key><string>Run Shell Script</string><key>ActionParameters</key><dict><key>COMMAND_STRING</key><string>${xml(command)}</string><key>CheckedForUserDefaultShell</key><true/><key>inputMethod</key><integer>1</integer><key>shell</key><string>/bin/zsh</string><key>source</key><string></string></dict><key>BundleIdentifier</key><string>com.apple.RunShellScript</string><key>CFBundleVersion</key><string>2.0.3</string></dict></dict></array><key>connectors</key><dict/><key>workflowMetaData</key><dict><key>serviceInputTypeIdentifier</key><string>com.apple.Automator.fileSystemObject</string><key>serviceOutputTypeIdentifier</key><string>com.apple.Automator.nothing</string><key>serviceProcessesInput</key><integer>0</integer></dict></dict></plist>`;
}
function macServiceRoot(){return path.join(os.homedir(),'Library','Services');}
function macServicePath(id){return path.join(macServiceRoot(),`PreSalesX - ${actions[id].label}.workflow`);}
async function installMac(executable){for(const id of Object.keys(actions)){const contents=path.join(macServicePath(id),'Contents');await fs.mkdir(contents,{recursive:true});await fs.writeFile(path.join(contents,'document.wflow'),workflowDocument(id,executable),'utf8');}return getMacState();}
async function removeMac(){for(const id of Object.keys(actions))await fs.rm(macServicePath(id),{recursive:true,force:true});return getMacState();}
async function getMacState(){const states=await Promise.all(Object.keys(actions).map(async id=>{try{await fs.access(path.join(macServicePath(id),'Contents','document.wflow'));return true;}catch{return false;}}));return{platform:'darwin',installed:states.every(Boolean),kind:'macOS Finder 快速操作'};}

async function getContextMenuState(platform=process.platform){if(platform==='win32')return getWindowsState();if(platform==='darwin')return getMacState();return{platform,installed:false,unsupported:true,kind:'系统右键菜单'};}
async function installContextMenu({platform=process.platform,executable=process.execPath}={}){if(platform==='win32')return installWindows(executable);if(platform==='darwin')return installMac(executable);throw new Error('当前系统暂不支持文件右键菜单集成');}
async function removeContextMenu(platform=process.platform){if(platform==='win32')return removeWindows();if(platform==='darwin')return removeMac();throw new Error('当前系统暂不支持文件右键菜单集成');}
function parseContextRequest(argv=[]){const flag=argv.find(value=>String(value).startsWith('--presalesx-action='));if(!flag)return null;const action=String(flag).split('=')[1];if(!actions[action])return null;const files=argv.filter(value=>value&&value!==flag&&!String(value).startsWith('--')&&path.isAbsolute(String(value))&&actions[action].extensions.includes(path.extname(String(value)).slice(1).toLowerCase()));return files.length?{action,files:[...new Set(files.map(file=>path.resolve(file)))]}:null;}

module.exports={actions,allExtensions,getContextMenuState,installContextMenu,removeContextMenu,parseContextRequest,workflowDocument};
