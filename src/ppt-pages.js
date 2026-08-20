'use strict';
const fs=require('fs').promises;
const path=require('path');
const os=require('os');
const {execFile}=require('child_process');
const {promisify}=require('util');
const ExcelJS=require('exceljs');
const run=promisify(execFile);

const natural=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
async function imageFiles(root,relative=''){
  const directory=path.join(root,relative),items=await fs.readdir(directory,{withFileTypes:true}),files=[];
  for(const item of items){const name=path.join(relative,item.name);if(item.isDirectory())files.push(...await imageFiles(root,name));else if(/\.(png|jpe?g)$/i.test(item.name))files.push(name);}
  return files.sort(natural);
}
function pageIndex(name,fallback){const match=path.basename(name,path.extname(name)).match(/(\d+)(?!.*\d)/);return match?Number(match[1]):fallback;}
async function pageInfo(outputDir,name,fallback){const filePath=path.join(outputDir,name),stat=await fs.stat(filePath),index=pageIndex(name,fallback);return{index,name:`第 ${index} 页.png`,path:filePath,bytes:stat.size,sourceName:name};}
function watchPages(outputDir,onPage){
  const seen=new Set();let timer=null,stopped=false,chain=Promise.resolve();
  const scan=()=>{chain=chain.then(async()=>{if(stopped)return;const files=await imageFiles(outputDir).catch(()=>[]);for(let offset=0;offset<files.length;offset++){const name=files[offset];if(seen.has(name))continue;seen.add(name);const page=await pageInfo(outputDir,name,offset+1);if(onPage)await onPage(page);}});return chain;};
  timer=setInterval(scan,180);scan();
  return{scan,async stop(){clearInterval(timer);await scan();stopped=true;await chain;},seen};
}
async function renderWindows(sourcePath,outputDir){
  const quote=value=>`'${String(value).replace(/'/g,"''")}'`,script=`$ErrorActionPreference='Stop';$ppt=New-Object -ComObject PowerPoint.Application;try{$deck=$ppt.Presentations.Open(${quote(sourcePath)},$true,$true,$false);$deck.Export(${quote(outputDir)},'PNG',1600,900);$deck.Close()}finally{$ppt.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt)|Out-Null}`;
  await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,maxBuffer:1024*1024});
}
async function renderMac(sourcePath,outputDir){
  const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"'),script=`tell application "Keynote"\nset d to open POSIX file "${escape(sourcePath)}"\nexport d to POSIX file "${escape(outputDir)}" as slide images with properties {image format:PNG}\nclose d saving no\nend tell`;
  await run('osascript',['-e',script],{maxBuffer:1024*1024});
}
async function renderPptPages(sourcePath,{onPage}={}){
  sourcePath=path.resolve(sourcePath);if(!/\.(pptx|pptm)$/i.test(sourcePath))throw new Error('请选择 PowerPoint 文件（.pptx 或 .pptm）');
  const outputDir=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-ppt-pages-'));
  const watcher=watchPages(outputDir,onPage);
  try{if(process.platform==='win32')await renderWindows(sourcePath,outputDir);else if(process.platform==='darwin')await renderMac(sourcePath,outputDir);else throw new Error('当前系统暂不支持 PowerPoint 页面渲染');}
  catch(error){await watcher.stop();await fs.rm(outputDir,{recursive:true,force:true});throw new Error(process.platform==='darwin'?`无法渲染 PowerPoint。请确认本机已安装 Keynote。${error.message}`:`无法渲染 PowerPoint。请确认本机已安装 Microsoft PowerPoint。${error.message}`);}
  await watcher.stop();const files=await imageFiles(outputDir);
  if(!files.length){await fs.rm(outputDir,{recursive:true,force:true});throw new Error('渲染完成，但没有生成页面图片');}
  const pages=await Promise.all(files.map((name,index)=>pageInfo(outputDir,name,index+1)));pages.sort((a,b)=>a.index-b.index);
  return{sourcePath,name:path.basename(sourcePath),outputDir,pages};
}
async function exportPagesExcel(rendered,destination){
  const workbook=new ExcelJS.Workbook();workbook.creator='PreSalesX';const sheet=workbook.addWorksheet('PPT 页面');sheet.columns=[{header:'页码',key:'page',width:10},{header:'页面图片',key:'image',width:110}];sheet.getRow(1).height=26;sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1769E0'}};sheet.views=[{state:'frozen',ySplit:1}];
  for(const page of rendered.pages){const row=sheet.addRow({page:page.index});row.height=270;row.alignment={vertical:'middle',horizontal:'center'};const imageId=workbook.addImage({filename:page.path,extension:'png'});sheet.addImage(imageId,{tl:{col:1.08,row:row.number-0.92},ext:{width:480,height:270},editAs:'oneCell'});}
  await workbook.xlsx.writeFile(destination);return{destination:path.resolve(destination),count:rendered.pages.length};
}
module.exports={renderPptPages,exportPagesExcel};
