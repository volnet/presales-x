'use strict';
const fs=require('fs').promises;
const path=require('path');
const os=require('os');
const {execFile}=require('child_process');
const {promisify}=require('util');
const ExcelJS=require('exceljs');
const run=promisify(execFile);

const natural=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
async function renderWindows(sourcePath,outputDir){
  const quote=value=>`'${String(value).replace(/'/g,"''")}'`,script=`$ErrorActionPreference='Stop';$ppt=New-Object -ComObject PowerPoint.Application;try{$deck=$ppt.Presentations.Open(${quote(sourcePath)},$true,$true,$false);$deck.Export(${quote(outputDir)},'PNG',1600,900);$deck.Close()}finally{$ppt.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt)|Out-Null}`;
  await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,maxBuffer:1024*1024});
}
async function renderMac(sourcePath,outputDir){
  const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"'),script=`tell application "Keynote"\nset d to open POSIX file "${escape(sourcePath)}"\nexport d to POSIX file "${escape(outputDir)}" as slide images with properties {image format:PNG}\nclose d saving no\nend tell`;
  await run('osascript',['-e',script],{maxBuffer:1024*1024});
}
async function renderPptPages(sourcePath){
  sourcePath=path.resolve(sourcePath);if(!/\.(pptx|pptm)$/i.test(sourcePath))throw new Error('请选择 PowerPoint 文件（.pptx 或 .pptm）');
  const outputDir=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-ppt-pages-'));
  try{if(process.platform==='win32')await renderWindows(sourcePath,outputDir);else if(process.platform==='darwin')await renderMac(sourcePath,outputDir);else throw new Error('当前系统暂不支持 PowerPoint 页面渲染');}
  catch(error){await fs.rm(outputDir,{recursive:true,force:true});throw new Error(process.platform==='darwin'?`无法渲染 PowerPoint。请确认本机已安装 Keynote。${error.message}`:`无法渲染 PowerPoint。请确认本机已安装 Microsoft PowerPoint。${error.message}`);}
  let files=(await fs.readdir(outputDir)).filter(name=>/\.(png|jpe?g)$/i.test(name)).sort(natural);
  if(!files.length){const nested=await fs.readdir(outputDir,{withFileTypes:true});for(const dir of nested.filter(item=>item.isDirectory()))files.push(...(await fs.readdir(path.join(outputDir,dir.name))).filter(name=>/\.(png|jpe?g)$/i.test(name)).map(name=>path.join(dir.name,name)));files.sort(natural);}
  if(!files.length){await fs.rm(outputDir,{recursive:true,force:true});throw new Error('渲染完成，但没有生成页面图片');}
  return{sourcePath,name:path.basename(sourcePath),outputDir,pages:await Promise.all(files.map(async(name,index)=>{const filePath=path.join(outputDir,name),stat=await fs.stat(filePath);return{index:index+1,name:`第 ${index+1} 页.png`,path:filePath,bytes:stat.size};}))};
}
async function exportPagesExcel(rendered,destination){
  const workbook=new ExcelJS.Workbook();workbook.creator='PreSalesX';const sheet=workbook.addWorksheet('PPT 页面');sheet.columns=[{header:'页码',key:'page',width:10},{header:'页面图片',key:'image',width:110}];sheet.getRow(1).height=26;sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1769E0'}};sheet.views=[{state:'frozen',ySplit:1}];
  for(const page of rendered.pages){const row=sheet.addRow({page:page.index});row.height=270;row.alignment={vertical:'middle',horizontal:'center'};const imageId=workbook.addImage({filename:page.path,extension:'png'});sheet.addImage(imageId,{tl:{col:1.08,row:row.number-0.92},ext:{width:480,height:270},editAs:'oneCell'});}
  await workbook.xlsx.writeFile(destination);return{destination:path.resolve(destination),count:rendered.pages.length};
}
module.exports={renderPptPages,exportPagesExcel};
