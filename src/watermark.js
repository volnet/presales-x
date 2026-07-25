'use strict';

const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const crypto=require('crypto');
const {execFile}=require('child_process');
const {promisify}=require('util');
const yauzl=require('yauzl');
const yazl=require('yazl');
const execFileAsync=promisify(execFile);

const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const kindOf=filePath=>/\.(?:docx|docm)$/i.test(filePath)?'word':/\.(?:xlsx|xlsm)$/i.test(filePath)?'excel':'unsupported';
const decode=value=>String(value||'').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const attr=(tag,name)=>(tag.match(new RegExp(`\\b${name}="([^"]*)"`,'i'))||[])[1]||'';
const xmlValue=(xml,tag)=>decode((xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'');
const OFFICE_METADATA=[
  ['title','标题','docProps/core.xml','dc:title'],['subject','主题','docProps/core.xml','dc:subject'],
  ['keywords','标记','docProps/core.xml','cp:keywords'],['category','类别','docProps/core.xml','cp:category'],
  ['comments','备注','docProps/core.xml','dc:description'],['author','作者','docProps/core.xml','dc:creator'],
  ['lastEditor','最后一次保存者','docProps/core.xml','cp:lastModifiedBy'],['revision','修订号','docProps/core.xml','cp:revision'],
  ['created','创建内容的时间','docProps/core.xml','dcterms:created'],['modified','最后一次保存的日期','docProps/core.xml','dcterms:modified'],
  ['lastPrinted','最后一次打印的时间','docProps/core.xml','cp:lastPrinted'],
  ['version','版本号','docProps/app.xml','AppVersion'],['application','程序名称','docProps/app.xml','Application'],
  ['company','公司','docProps/app.xml','Company'],['manager','管理者','docProps/app.xml','Manager']
];
function officeMetadataItems(entries){const items=[];for(const [field,label,part,tag] of OFFICE_METADATA){const entry=entries.find(item=>item.name.toLowerCase()===part.toLowerCase());if(!entry)continue;const value=xmlValue(entry.data.toString('utf8'),tag);items.push({id:`office-metadata-${field}`,type:'metadata',field,part,tag,label,detail:value,originalValue:value,value,selected:false});}return items;}
function removeXmlTag(xml,tag){return xml.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'gi'),'').replace(new RegExp(`<${tag}\\b[^>]*/>`,'gi'),'');}
function encodeXml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function setXmlTag(xml,tag,value){
  if(value==='')return removeXmlTag(xml,tag);
  const content=encodeXml(value),paired=new RegExp(`(<${tag}\\b[^>]*>)[\\s\\S]*?(<\\/${tag}>)`,'i'),empty=new RegExp(`<${tag}\\b[^>]*/>`,'i');
  if(paired.test(xml))return xml.replace(paired,(_match,open,close)=>`${open}${content}${close}`);
  if(empty.test(xml))return xml.replace(empty,`<${tag}>${content}</${tag}>`);
  const rootClose=(xml.match(/<\/[^>]+>\s*$/)||[])[0];if(!rootClose)return xml;
  const attributes=/^dcterms:/.test(tag)?' xsi:type="dcterms:W3CDTF"':'';
  return xml.replace(rootClose,`<${tag}${attributes}>${content}</${tag}>${rootClose}`);
}
function wordWatermarkBlocks(xml){const primary=[...(xml.match(/<w:pict\b[\s\S]*?<\/w:pict>|<w:drawing\b[\s\S]*?<\/w:drawing>/gi)||[])].filter(block=>/watermark|powerpluswatermarkobject|wordpicturewatermark|<v:textpath\b|_x0000_t136/i.test(block));if(primary.length)return primary;return (xml.match(/<v:shape\b[\s\S]*?<\/v:shape>/gi)||[]).filter(block=>/watermark|powerpluswatermarkobject|wordpicturewatermark|<v:textpath\b|_x0000_t136/i.test(block));}
function watermarkContent(block){const text=attr(block,'string')||decode((block.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/i)||[])[1]||''),relation=attr(block,'r:embed')||attr(block,'r:id'),name=attr(block,'descr')||attr(block,'title')||attr(block,'name');return text||name||(relation?`图片水印（${relation}）`:'图片或图形水印');}
function commentPage(documentXml,id){const match=new RegExp(`<w:(?:commentRangeStart|commentReference)\\b(?=[^>]*\\bw:id="${id}")[^>]*>`,'i').exec(documentXml);if(!match)return 1;const before=documentXml.slice(0,match.index);return 1+(before.match(/<w:br\b(?=[^>]*w:type="page")[^>]*\/?>|<w:lastRenderedPageBreak\b[^>]*\/?>/gi)||[]).length;}

function stripWordWatermarks(xml){
  let removed=0;
  const signal=/watermark|powerpluswatermarkobject|wordpicturewatermark|<v:textpath\b|_x0000_t136/i;
  const replace=block=>{if(!signal.test(block))return block;removed++;return '';};
  let output=xml.replace(/<w:pict\b[\s\S]*?<\/w:pict>/gi,replace);
  output=output.replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi,replace);
  output=output.replace(/<v:shape\b[\s\S]*?<\/v:shape>/gi,replace);
  return {xml:output,removed};
}

function stripExcelBackgrounds(xml){
  let removed=0;
  const output=xml.replace(/<(?:picture|backgroundPicture)\b[^>]*\/>/gi,()=>{removed++;return '';});
  return {xml:output,removed};
}

function readArchive(buffer){
  return new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true},(error,zip)=>{
    if(error)return reject(error);const entries=[];
    zip.on('error',reject);zip.on('entry',entry=>{
      if(/\/$/.test(entry.fileName)){entries.push({name:entry.fileName,data:null,mtime:entry.getLastModDate()});zip.readEntry();return;}
      zip.openReadStream(entry,(streamError,stream)=>{if(streamError)return reject(streamError);const chunks=[];stream.on('data',chunk=>chunks.push(chunk));stream.on('error',reject);stream.on('end',()=>{entries.push({name:entry.fileName,data:Buffer.concat(chunks),mtime:entry.getLastModDate()});zip.readEntry();});});
    });zip.on('end',()=>resolve(entries));zip.readEntry();
  }));
}

function writeArchive(entries){
  return new Promise((resolve,reject)=>{const zip=new yazl.ZipFile(),chunks=[];zip.outputStream.on('data',chunk=>chunks.push(chunk));zip.outputStream.on('error',reject);zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));for(const entry of entries){if(entry.data==null)zip.addEmptyDirectory(entry.name);else zip.addBuffer(entry.data,entry.name,{mtime:entry.mtime});}zip.end();});
}

function wordInspection(entries,sourcePath){
  const items=[...officeMetadataItems(entries)];let watermarkCount=0;
  for(const entry of entries.filter(item=>/^word\/header\d*\.xml$/i.test(item.name))){const blocks=wordWatermarkBlocks(entry.data.toString('utf8'));for(const block of blocks){const signature=sha(Buffer.from(block)).slice(0,12),content=watermarkContent(block);watermarkCount++;items.push({id:`word-watermark-${signature}`,type:'watermark',part:entry.name,signature,label:`水印 ${watermarkCount} · ${content}`,detail:`${content}（${entry.name}）`,selected:true});}}
  const document=entries.find(item=>/^word\/document\.xml$/i.test(item.name)),documentXml=document?.data.toString('utf8')||'';
  for(const comments of entries.filter(item=>/^word\/comments(?:\d+)?\.xml$/i.test(item.name))){const xml=comments.data.toString('utf8');for(const block of xml.match(/<(?:\w+:)?comment\b[\s\S]*?<\/(?:\w+:)?comment>/gi)||[]){const open=(block.match(/<(?:\w+:)?comment\b[^>]*>/i)||[])[0]||'',id=attr(open,'w:id')||attr(open,'id')||String(items.length),author=attr(open,'w:author')||attr(open,'author')||'<空>',text=decode(block),page=commentPage(documentXml,id);items.push({id:`word-comment-${id}`,type:'comment',commentId:id,page,label:`第 ${page} 页 · 批注 ${Number(id)+1||id}`,detail:`${author}：${text||'<空>'}`,selected:false});}}
  const revisionCount=(documentXml.match(/<w:(?:ins|del|moveFrom|moveTo)\b/gi)||[]).length;
  const hasRevisions=revisionCount>0||entries.some(item=>/^word\/settings\.xml$/i.test(item.name)&&/<w:trackRevisions\b/i.test(item.data.toString('utf8')));
  return {sourcePath,name:path.basename(sourcePath),kind:'word',hasRevisions,revisionCount,items};
}

function excelInspection(entries,sourcePath){
  const items=[...officeMetadataItems(entries)],workbook=entries.find(item=>/^xl\/workbook\.xml$/i.test(item.name))?.data.toString('utf8')||'';
  const sheetNames=(workbook.match(/<sheet\b[^>]*>/gi)||[]).map((tag,index)=>attr(tag,'name')||`Sheet ${index+1}`);
  for(const entry of entries.filter(item=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(item.name))){
    const number=Number((entry.name.match(/sheet(\d+)/i)||[])[1])||1,sheet=sheetNames[number-1]||`Sheet ${number}`,xml=entry.data.toString('utf8');
    const backgrounds=(xml.match(/<(?:picture|backgroundPicture)\b[^>]*\/>/gi)||[]).length;
    if(backgrounds){const relation=attr((xml.match(/<(?:picture|backgroundPicture)\b[^>]*\/>/i)||[])[0]||'','r:id');items.push({id:`excel-background-${number}`,type:'watermark',part:entry.name,label:`${sheet} · 工作表背景`,detail:`背景图片 ${relation||'<未命名>'}`,selected:true});}
  }
  for(const entry of entries.filter(item=>/^xl\/comments\d*\.xml$/i.test(item.name))){const xml=entry.data.toString('utf8'),authors=(xml.match(/<author>[\s\S]*?<\/author>/gi)||[]).map(decode);for(const block of xml.match(/<comment\b[\s\S]*?<\/comment>/gi)||[]){const open=(block.match(/<comment\b[^>]*>/i)||[])[0]||'',ref=attr(open,'ref'),author=authors[Number(attr(open,'authorId'))]||'<空>',id=`excel-comment-${entry.name.replace(/\W/g,'-')}-${ref}`;items.push({id,type:'comment',part:entry.name,ref,label:`批注 ${ref||items.length+1}`,detail:`${author}：${decode(block)||'<空>'}`,selected:false});}}
  return {sourcePath,name:path.basename(sourcePath),kind:'excel',hasRevisions:false,revisionCount:0,items};
}

async function inspectSanitizationFile(sourcePath){
  const kind=kindOf(sourcePath);if(kind==='unsupported')throw new Error('文件脱敏暂仅支持 Word 和 Excel');
  const stat=await fsp.stat(sourcePath),buffer=await fsp.readFile(sourcePath);
  if(process.platform==='win32')await fsp.utimes(sourcePath,stat.atime,stat.mtime);
  const entries=await readArchive(buffer),inspection=kind==='word'?wordInspection(entries,sourcePath):excelInspection(entries,sourcePath);
  inspection.items.push(
    {id:'filesystem-created',type:'filesystem',field:'created',label:'创建日期',detail:stat.birthtime.toISOString(),originalValue:stat.birthtime.toISOString(),value:stat.birthtime.toISOString()},
    {id:'filesystem-modified',type:'filesystem',field:'modified',label:'修改日期',detail:stat.mtime.toISOString(),originalValue:stat.mtime.toISOString(),value:stat.mtime.toISOString()},
    {id:'filesystem-accessed',type:'filesystem',field:'accessed',label:'访问日期',detail:stat.atime.toISOString(),originalValue:stat.atime.toISOString(),value:stat.atime.toISOString()}
  );
  return inspection;
}

function checkedDate(value,label){const date=new Date(value);if(!value||Number.isNaN(date.getTime()))throw new Error(`${label}不是有效日期时间`);return date;}
async function setWindowsFileTimes(filePath,updates={}){
  if(!Object.keys(updates).length)return 0;
  if(process.platform!=='win32')throw new Error('创建日期、修改日期和访问日期修改目前仅支持 Windows');
  const stat=await fsp.stat(filePath),accessed=updates.accessed?checkedDate(updates.accessed,'访问日期'):stat.atime,modified=updates.modified?checkedDate(updates.modified,'修改日期'):stat.mtime;
  if(updates.created){
    const created=checkedDate(updates.created,'创建日期').toISOString();
    const quote=value=>`'${String(value).replace(/'/g,"''")}'`,script=`[System.IO.File]::SetCreationTimeUtc(${quote(filePath)},[DateTime]::Parse(${quote(created)},[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime())`,encoded=Buffer.from(script,'utf16le').toString('base64');
    await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{windowsHide:true});
  }
  await fsp.utimes(filePath,accessed,modified);
  return Object.keys(updates).length;
}

async function inspectSanitizationFiles(filePaths,progress=()=>{}){
  const files=[];for(let index=0;index<filePaths.length;index++){try{files.push(await inspectSanitizationFile(path.resolve(filePaths[index])));}catch(error){files.push({sourcePath:filePaths[index],name:path.basename(filePaths[index]),kind:'unsupported',error:error.message,items:[]});}progress({done:index+1,total:filePaths.length,name:path.basename(filePaths[index])});}return files;
}

function removeWordComment(xml,id,isComments){
  if(isComments)return xml.replace(new RegExp(`<w:comment\\b(?=[^>]*\\bw:id="${id}")[\\s\\S]*?<\\/w:comment>`,'gi'),'');
  return xml.replace(new RegExp(`<w:(?:commentRangeStart|commentRangeEnd|commentReference)\\b(?=[^>]*\\bw:id="${id}")[^>]*\\/?>`,'gi'),'');
}

async function sanitizeOfficeFile(sourcePath,directory,selectedIds,destinationOverride='',options={}){
  const inspection=await inspectSanitizationFile(sourcePath),selected=new Set(selectedIds),sourceBuffer=await fsp.readFile(sourcePath);
  const metadataUpdates=options.metadataUpdates||{},fileTimeUpdates=options.fileTimeUpdates||{},entries=await readArchive(sourceBuffer);let removed=0,modified=0;
  for(const entry of entries){if(!entry.data)continue;let xml=entry.data.toString('utf8'),changed=false;
    if(inspection.kind==='word'&&/^word\/header\d*\.xml$/i.test(entry.name)){const selectedSignatures=new Set(inspection.items.filter(value=>value.type==='watermark'&&value.part===entry.name&&selected.has(value.id)).map(value=>value.signature));if(selectedSignatures.size){let count=0;for(const block of wordWatermarkBlocks(xml)){const signature=sha(Buffer.from(block)).slice(0,12);if(selectedSignatures.has(signature)){xml=xml.replace(block,'');count++;}}removed+=count;changed=count>0;}}
    if(inspection.kind==='word'&&/^word\/.*\.xml$/i.test(entry.name)){for(const item of inspection.items.filter(value=>value.type==='comment'&&selected.has(value.id))){const next=removeWordComment(xml,item.commentId,/^word\/comments(?:\d+)?\.xml$/i.test(entry.name));if(next!==xml){xml=next;removed++;changed=true;}}}
    if(inspection.kind==='excel'){for(const item of inspection.items.filter(value=>selected.has(value.id)&&value.part===entry.name)){if(item.type==='watermark'){const result=stripExcelBackgrounds(xml);xml=result.xml;removed+=result.removed;changed=!!result.removed||changed;}else if(item.type==='comment'){const next=xml.replace(new RegExp(`<comment\\b(?=[^>]*\\bref="${item.ref}")[\\s\\S]*?<\\/comment>`,'gi'),'');if(next!==xml){xml=next;removed++;changed=true;}}}}
    for(const item of inspection.items.filter(value=>value.type==='metadata'&&value.part===entry.name&&Object.prototype.hasOwnProperty.call(metadataUpdates,value.field))){const next=setXmlTag(xml,item.tag,String(metadataUpdates[item.field]??''));if(next!==xml){xml=next;modified++;changed=true;}}
    if(changed)entry.data=Buffer.from(xml);
  }
  if(!removed&&!modified&&Object.keys(fileTimeUpdates).length){
    const destination=destinationOverride||sourcePath;if(path.resolve(destination)!==path.resolve(sourcePath))await fsp.copyFile(sourcePath,destination);
    const fileTimesModified=await setWindowsFileTimes(destination,fileTimeUpdates);
    return {sourcePath,destination,kind:inspection.kind,status:'cleaned',removed:0,modified:0,fileTimesModified,beforeSha256:sha(sourceBuffer),afterSha256:sha(await fsp.readFile(destination)),originalUntouched:!options.overwrite};
  }
  if(!removed&&!modified)return {sourcePath,kind:inspection.kind,status:'unchanged',removed:0,modified:0,fileTimesModified:0};
  const output=await writeArchive(entries),destination=destinationOverride||await uniqueDestination(directory,sourcePath);
  await fsp.writeFile(destination,output,destinationOverride?undefined:{flag:'wx'});
  const fileTimesModified=await setWindowsFileTimes(destination,fileTimeUpdates);
  return {sourcePath,destination,kind:inspection.kind,status:'cleaned',removed,modified,fileTimesModified,beforeSha256:sha(sourceBuffer),afterSha256:sha(output),originalUntouched:!options.overwrite};
}

async function uniqueDestination(directory,sourcePath){
  const ext=path.extname(sourcePath),base=path.basename(sourcePath,ext);
  for(let index=1;;index++){const suffix=index===1?'':` (${index})`,candidate=path.join(directory,`${base}-已脱敏${suffix}${ext}`);try{await fsp.access(candidate);}catch{return candidate;}}
}

async function rewriteOffice(buffer,kind){
  const entries=await readArchive(buffer);let removed=0;for(const entry of entries){if(!entry.data)continue;if(kind==='word'&&/^word\/header\d*\.xml$/i.test(entry.name)){const result=stripWordWatermarks(entry.data.toString('utf8'));entry.data=Buffer.from(result.xml);removed+=result.removed;}if(kind==='excel'&&/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)){const result=stripExcelBackgrounds(entry.data.toString('utf8'));entry.data=Buffer.from(result.xml);removed+=result.removed;}}return {buffer:await writeArchive(entries),removed};
}

module.exports={kindOf,stripWordWatermarks,stripExcelBackgrounds,rewriteOffice,inspectSanitizationFile,inspectSanitizationFiles,sanitizeOfficeFile};
