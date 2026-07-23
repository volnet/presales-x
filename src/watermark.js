'use strict';

const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const crypto=require('crypto');
const yauzl=require('yauzl');
const yazl=require('yazl');
const {PDFDocument,PDFName,PDFDict,PDFArray,PDFStream,PDFNumber,decodePDFRawStream}=require('pdf-lib');

const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const kindOf=filePath=>/\.(?:docx|docm)$/i.test(filePath)?'word':/\.(?:xlsx|xlsm)$/i.test(filePath)?'excel':/\.pdf$/i.test(filePath)?'pdf':'unsupported';
const decode=value=>String(value||'').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const attr=(tag,name)=>(tag.match(new RegExp(`\\b${name}="([^"]*)"`,'i'))||[])[1]||'';
const xmlValue=(xml,tag)=>decode((xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'');
const OFFICE_METADATA=[
  ['author','作者','docProps/core.xml','dc:creator'],['lastEditor','最后一次保存者','docProps/core.xml','cp:lastModifiedBy'],
  ['revision','修订号','docProps/core.xml','cp:revision'],['created','创建时间','docProps/core.xml','dcterms:created'],
  ['modified','最后保存时间','docProps/core.xml','dcterms:modified'],['title','标题','docProps/core.xml','dc:title'],
  ['subject','主题','docProps/core.xml','dc:subject'],['keywords','关键词','docProps/core.xml','cp:keywords'],
  ['application','程序名称','docProps/app.xml','Application'],['company','公司','docProps/app.xml','Company'],
  ['manager','管理者','docProps/app.xml','Manager'],['version','版本号','docProps/app.xml','AppVersion']
];
function officeMetadataItems(entries){const items=[];for(const [field,label,part,tag] of OFFICE_METADATA){const entry=entries.find(item=>item.name.toLowerCase()===part.toLowerCase());if(!entry)continue;const value=xmlValue(entry.data.toString('utf8'),tag);if(value)items.push({id:`office-metadata-${field}`,type:'metadata',field,part,tag,label:`文件属性 · ${label}`,detail:value,selected:false});}return items;}
function removeXmlTag(xml,tag){return xml.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'gi'),'').replace(new RegExp(`<${tag}\\b[^>]*/>`,'gi'),'');}
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

function decodedPdfStream(stream){
  try{return Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');}
  catch{return Buffer.from(stream.getContents()).toString('latin1');}
}

function pdfPageStreams(page){
  const contents=page.node.Contents();if(!contents)return [];
  if(contents instanceof PDFArray){const streams=[];for(let index=0;index<contents.size();index++){const stream=contents.lookupMaybe(index,PDFStream);if(stream)streams.push({index,stream});}return streams;}
  return contents instanceof PDFStream?[{index:0,stream:contents}]:[];
}

function pdfResourceDict(context,owner){
  const resourceObject=owner instanceof PDFDict?owner.lookup(PDFName.of('Resources')):owner.node.getInheritableAttribute(PDFName.of('Resources'));
  return resourceObject?context.lookupMaybe(resourceObject,PDFDict):undefined;
}

function pdfOpacityMap(context,resources){
  const result=new Map(),states=resources?.lookupMaybe(PDFName.of('ExtGState'),PDFDict);if(!states)return result;
  for(const [name,value] of states.entries()){const state=context.lookupMaybe(value,PDFDict);if(!state)continue;const fill=state.lookupMaybe(PDFName.of('ca'),PDFNumber)?.asNumber(),stroke=state.lookupMaybe(PDFName.of('CA'),PDFNumber)?.asNumber(),opacity=Math.min(fill??1,stroke??1);result.set(name.toString().replace(/^\//,''),opacity);}
  return result;
}

function pdfGraphicsBlocks(content){
  const stack=[],blocks=[],whitespace=/[\x00\t\n\f\r ]/,delimiter=/[\(\)<>\[\]\{\}\/%]/;let index=0;
  while(index<content.length){
    const char=content[index];if(whitespace.test(char)){index++;continue;}
    if(char==='%'){while(index<content.length&&!/[\r\n]/.test(content[index]))index++;continue;}
    if(char==='('){let depth=1;index++;while(index<content.length&&depth){if(content[index]==='\\'){index+=2;continue;}if(content[index]==='(')depth++;else if(content[index]===')')depth--;index++;}continue;}
    if(char==='<'){if(content[index+1]==='<'){index+=2;continue;}index++;while(index<content.length&&content[index]!=='>')index++;index++;continue;}
    if(char==='/'||delimiter.test(char)){index++;while(index<content.length&&!whitespace.test(content[index])&&!delimiter.test(content[index]))index++;continue;}
    const start=index;while(index<content.length&&!whitespace.test(content[index])&&!delimiter.test(content[index]))index++;const token=content.slice(start,index);
    if(token==='q')stack.push(start);else if(token==='Q'&&stack.length)blocks.push({start:stack.pop(),end:index});
  }
  return blocks;
}

const PDF_NUMBER='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[Ee][+-]?\\d+)?';
function pdfLiteralText(value){return value.slice(1,-1).replace(/\\([nrtbf()\\])/g,(_match,char)=>({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[char]??char)).replace(/\\[0-7]{1,3}/g,'').trim();}
function pdfHexText(value){const bytes=Buffer.from(value.replace(/[<>\s]/g,''),'hex');if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff){let result='';for(let index=2;index+1<bytes.length;index+=2)result+=String.fromCharCode(bytes[index]*256+bytes[index+1]);return result.trim();}return bytes.toString('latin1').replace(/[^\x20-\x7e\u00a0-\uffff]/g,'').trim();}
function pdfDrawnText(content){
  const values=[];for(const match of content.matchAll(/(\((?:\\.|[^\\)])*\))\s*Tj\b/g))values.push(pdfLiteralText(match[1]));
  for(const match of content.matchAll(/(<[0-9A-Fa-f\s]+>)\s*Tj\b/g))values.push(pdfHexText(match[1]));
  for(const array of content.matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ\b/g)){for(const match of array[1].matchAll(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g))values.push(match[0][0]==='('?pdfLiteralText(match[0]):pdfHexText(match[0]));}
  return values.filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}
function pdfContentSignals(content,opacityMap){
  const stateNames=[...content.matchAll(/\/([^\s<>\[\]()/%]+)\s+gs\b/g)].map(match=>match[1]),lowOpacity=stateNames.some(name=>(opacityMap.get(name)??1)<.9),hasText=/\b(?:Tj|TJ)\b/.test(content),hasObject=/\/[^\s<>\[\]()/%]+\s+Do\b/.test(content),artifact=/\/Artifact\b[\s\S]*?\/(?:Subtype\s*\/Watermark|Type\s*\/Pagination)\b/i.test(content);
  const matrices=[...content.matchAll(new RegExp(`(${PDF_NUMBER})\\s+(${PDF_NUMBER})\\s+(${PDF_NUMBER})\\s+(${PDF_NUMBER})\\s+(${PDF_NUMBER})\\s+(${PDF_NUMBER})\\s+(?:cm|Tm)\\b`,'g'))].map(match=>match.slice(1).map(Number)),rotated=matrices.some(([,b,c])=>Math.abs(b)>.05||Math.abs(c)>.05),largeTransform=matrices.some(([a,b,c,d])=>Math.hypot(a,b)>120||Math.hypot(c,d)>120),fontSizes=[...content.matchAll(new RegExp(`\\/${'[^\\\\s<>\\\\[\\\\]\\\\(\\\\)/%]+'}\\s+(${PDF_NUMBER})\\s+Tf\\b`,'g'))].map(match=>Number(match[1])),largeText=fontSizes.some(size=>size>=24);
  return {artifact,lowOpacity,hasText,hasObject,rotated,largeTransform,largeText,text:pdfDrawnText(content)};
}

function pdfFormWatermarks(document,page){
  const context=document.context,resources=pdfResourceDict(context,page),objects=resources?.lookupMaybe(PDFName.of('XObject'),PDFDict),result=new Map();if(!objects)return result;
  for(const [name,value] of objects.entries()){const stream=context.lookupMaybe(value,PDFStream);if(!stream||stream.dict.lookupMaybe(PDFName.of('Subtype'),PDFName)?.toString()!=='/Form')continue;const content=decodedPdfStream(stream),signals=pdfContentSignals(content,pdfOpacityMap(context,pdfResourceDict(context,stream.dict)));if(signals.artifact||(signals.lowOpacity&&(signals.largeText||signals.rotated||signals.largeTransform))||(signals.hasText&&signals.rotated&&signals.largeText))result.set(name.toString().replace(/^\//,''),signals.text||'图片或图形水印');}
  return result;
}

function pdfVisualWatermarks(document,page,pageIndex){
  const context=document.context,opacity=pdfOpacityMap(context,pdfResourceDict(context,page)),forms=pdfFormWatermarks(document,page),items=[];
  for(const {index:streamIndex,stream} of pdfPageStreams(page)){const content=decodedPdfStream(stream),candidates=pdfGraphicsBlocks(content).map(block=>{const value=content.slice(block.start,block.end),signals=pdfContentSignals(value,opacity),formNames=[...value.matchAll(/\/([^\s<>\[\]()/%]+)\s+Do\b/g)].map(match=>match[1]),formText=formNames.map(name=>forms.get(name)).find(Boolean),isWatermark=signals.artifact||Boolean(formText)||(signals.lowOpacity&&((signals.hasText&&(signals.rotated||signals.largeText))||(signals.hasObject&&(signals.rotated||signals.largeTransform))))||(signals.hasText&&signals.rotated&&signals.largeText);return {...block,value,signals,formText,isWatermark};}).filter(item=>item.isWatermark);
    const innermost=candidates.filter(item=>!candidates.some(other=>other.start>item.start&&other.end<item.end));let occurrence=0;
    for(const item of innermost){const signature=sha(Buffer.from(item.value,'latin1')).slice(0,12),contentText=item.signals.text||item.formText||'图片或图形水印';items.push({id:`pdf-content-watermark-${pageIndex}-${streamIndex}-${signature}-${occurrence++}`,type:'watermark',contentWatermark:true,pageIndex,streamIndex,signature,label:`第 ${pageIndex+1} 页 · 页面内容水印`,detail:contentText,selected:true});}
  }
  return items;
}

function replacePdfPageStream(document,page,streamIndex,content){
  const stream=document.context.flateStream(Buffer.from(content,'latin1')),reference=document.context.register(stream),contents=page.node.Contents();
  if(contents instanceof PDFArray)contents.set(streamIndex,reference);else page.node.set(PDFName.of('Contents'),reference);
}

function removePdfVisualWatermarks(document,inspection,selected){
  let removed=0;const pages=document.getPages();
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){const page=pages[pageIndex],selectedItems=inspection.items.filter(item=>item.contentWatermark&&item.pageIndex===pageIndex&&selected.has(item.id));if(!selectedItems.length)continue;const signatures=new Set(selectedItems.map(item=>`${item.streamIndex}|${item.signature}`));
    for(const {index:streamIndex,stream} of pdfPageStreams(page)){let content=decodedPdfStream(stream),changed=false;const blocks=pdfGraphicsBlocks(content).map(block=>({...block,value:content.slice(block.start,block.end)})).filter(block=>signatures.has(`${streamIndex}|${sha(Buffer.from(block.value,'latin1')).slice(0,12)}`)).sort((a,b)=>b.start-a.start);for(const block of blocks){content=content.slice(0,block.start)+content.slice(block.end);removed++;changed=true;}if(changed)replacePdfPageStream(document,page,streamIndex,content);}
  }
  return removed;
}

async function pdfInspection(buffer,sourcePath){
  const document=await PDFDocument.load(buffer,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false}),items=[];
  const date=method=>{try{return document[method]?.()?.toISOString?.()||'';}catch{return '';}},metadata=[['author','作者',document.getAuthor?.()],['title','标题',document.getTitle?.()],['subject','主题',document.getSubject?.()],['keywords','关键词',document.getKeywords?.()],['creator','创建程序',document.getCreator?.()],['producer','制作工具',document.getProducer?.()],['created','创建时间',date('getCreationDate')],['modified','修改时间',date('getModificationDate')]];
  for(const [field,label,value] of metadata)if(value)items.push({id:`pdf-metadata-${field}`,type:'metadata',field,label:`PDF 属性 · ${label}`,detail:String(value),selected:true});
  const pages=document.getPages(),commentSubtypes=new Set(['Text','FreeText','Popup','Highlight','Underline','StrikeOut','Squiggly','Caret','Circle','Square','Ink','FileAttachment']);
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){items.push(...pdfVisualWatermarks(document,pages[pageIndex],pageIndex));const annots=pages[pageIndex].node.lookupMaybe(PDFName.of('Annots'),PDFArray);if(!annots)continue;for(let index=0;index<annots.size();index++){const annotation=document.context.lookup(annots.get(index),PDFDict);if(!annotation)continue;const subtype=annotation.get(PDFName.of('Subtype'))?.toString().replace('/','')||'',contents=annotation.get(PDFName.of('Contents'))?.decodeText?.()||'',author=annotation.get(PDFName.of('T'))?.decodeText?.()||'',type=['Watermark','Stamp'].includes(subtype)?'watermark':commentSubtypes.has(subtype)?'comment':'';if(!type)continue;const id=`pdf-annotation-${pageIndex}-${index}`;items.push({id,type,pageIndex,annotationIndex:index,label:`第 ${pageIndex+1} 页 · ${type==='watermark'?'水印':'批注'}`,detail:[author,contents||subtype].filter(Boolean).join('：'),selected:type==='watermark'});}}
  return {sourcePath,name:path.basename(sourcePath),kind:'pdf',hasRevisions:false,revisionCount:0,items,pageCount:pages.length};
}

async function inspectSanitizationFile(sourcePath){
  const kind=kindOf(sourcePath);if(kind==='unsupported')throw new Error('仅支持 Word、Excel 和 PDF');
  const buffer=await fsp.readFile(sourcePath);if(kind==='pdf')return pdfInspection(buffer,sourcePath);
  const entries=await readArchive(buffer);return kind==='word'?wordInspection(entries,sourcePath):excelInspection(entries,sourcePath);
}

async function inspectSanitizationFiles(filePaths,progress=()=>{}){
  const files=[];for(let index=0;index<filePaths.length;index++){try{files.push(await inspectSanitizationFile(path.resolve(filePaths[index])));}catch(error){files.push({sourcePath:filePaths[index],name:path.basename(filePaths[index]),kind:'unsupported',error:error.message,items:[]});}progress({done:index+1,total:filePaths.length,name:path.basename(filePaths[index])});}return files;
}

function removeWordComment(xml,id,isComments){
  if(isComments)return xml.replace(new RegExp(`<w:comment\\b(?=[^>]*\\bw:id="${id}")[\\s\\S]*?<\\/w:comment>`,'gi'),'');
  return xml.replace(new RegExp(`<w:(?:commentRangeStart|commentRangeEnd|commentReference)\\b(?=[^>]*\\bw:id="${id}")[^>]*\\/?>`,'gi'),'');
}

async function sanitizeOfficeFile(sourcePath,directory,selectedIds,destinationOverride=''){
  const inspection=await inspectSanitizationFile(sourcePath),selected=new Set(selectedIds),sourceBuffer=await fsp.readFile(sourcePath);
  if(inspection.kind==='pdf'){
    const document=await PDFDocument.load(sourceBuffer,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false}),info=document.context.trailerInfo.Info?document.context.lookup(document.context.trailerInfo.Info,PDFDict):null,map={author:'Author',title:'Title',subject:'Subject',keywords:'Keywords',creator:'Creator',producer:'Producer',created:'CreationDate',modified:'ModDate'};let removed=0,metadataRemoved=false;
    for(const item of inspection.items.filter(value=>selected.has(value.id)&&value.type==='metadata')){if(info?.has(PDFName.of(map[item.field]))){info.delete(PDFName.of(map[item.field]));removed++;metadataRemoved=true;}}
    if(metadataRemoved&&document.catalog.has(PDFName.of('Metadata')))document.catalog.delete(PDFName.of('Metadata'));
    removed+=removePdfVisualWatermarks(document,inspection,selected);
    const annotations=inspection.items.filter(value=>selected.has(value.id)&&value.annotationIndex!=null&&['watermark','comment'].includes(value.type)).sort((a,b)=>b.pageIndex-a.pageIndex||b.annotationIndex-a.annotationIndex);
    for(const item of annotations){const annots=document.getPages()[item.pageIndex].node.lookupMaybe(PDFName.of('Annots'),PDFArray);if(annots&&item.annotationIndex<annots.size()){annots.remove(item.annotationIndex);removed++;}}
    if(!removed)return {sourcePath,kind:'pdf',status:'unchanged',removed:0};const output=Buffer.from(await document.save({updateFieldAppearances:false})),destination=destinationOverride||await uniqueDestination(directory,sourcePath);await fsp.writeFile(destination,output,destinationOverride?undefined:{flag:'wx'});return {sourcePath,destination,kind:'pdf',status:'cleaned',removed,beforeSha256:sha(sourceBuffer),afterSha256:sha(output),originalUntouched:true};
  }
  const entries=await readArchive(sourceBuffer);let removed=0;
  for(const entry of entries){if(!entry.data)continue;let xml=entry.data.toString('utf8'),changed=false;
    if(inspection.kind==='word'&&/^word\/header\d*\.xml$/i.test(entry.name)){const selectedSignatures=new Set(inspection.items.filter(value=>value.type==='watermark'&&value.part===entry.name&&selected.has(value.id)).map(value=>value.signature));if(selectedSignatures.size){let count=0;for(const block of wordWatermarkBlocks(xml)){const signature=sha(Buffer.from(block)).slice(0,12);if(selectedSignatures.has(signature)){xml=xml.replace(block,'');count++;}}removed+=count;changed=count>0;}}
    if(inspection.kind==='word'&&/^word\/.*\.xml$/i.test(entry.name)){for(const item of inspection.items.filter(value=>value.type==='comment'&&selected.has(value.id))){const next=removeWordComment(xml,item.commentId,/^word\/comments(?:\d+)?\.xml$/i.test(entry.name));if(next!==xml){xml=next;removed++;changed=true;}}}
    if(inspection.kind==='excel'){for(const item of inspection.items.filter(value=>selected.has(value.id)&&value.part===entry.name)){if(item.type==='watermark'){const result=stripExcelBackgrounds(xml);xml=result.xml;removed+=result.removed;changed=!!result.removed||changed;}else if(item.type==='comment'){const next=xml.replace(new RegExp(`<comment\\b(?=[^>]*\\bref="${item.ref}")[\\s\\S]*?<\\/comment>`,'gi'),'');if(next!==xml){xml=next;removed++;changed=true;}}}}
    for(const item of inspection.items.filter(value=>value.type==='metadata'&&value.part===entry.name&&selected.has(value.id))){const next=removeXmlTag(xml,item.tag);if(next!==xml){xml=next;removed++;changed=true;}}
    if(changed)entry.data=Buffer.from(xml);
  }
  if(!removed)return {sourcePath,kind:inspection.kind,status:'unchanged',removed:0};
  const output=await writeArchive(entries),destination=destinationOverride||await uniqueDestination(directory,sourcePath);
  await fsp.writeFile(destination,output,destinationOverride?undefined:{flag:'wx'});
  const before=await fsp.readFile(sourcePath);return {sourcePath,destination,kind:inspection.kind,status:'cleaned',removed,beforeSha256:sha(before),afterSha256:sha(output),originalUntouched:true};
}

async function uniqueDestination(directory,sourcePath){
  const ext=path.extname(sourcePath),base=path.basename(sourcePath,ext);
  for(let index=1;;index++){const suffix=index===1?'':` (${index})`,candidate=path.join(directory,`${base}-已脱敏${suffix}${ext}`);try{await fsp.access(candidate);}catch{return candidate;}}
}

async function sanitizeOfficeFiles(requests,directory,progress=()=>{}){
  const results=[];for(let index=0;index<requests.length;index++){const request=requests[index];try{results.push(await sanitizeOfficeFile(request.sourcePath,directory,request.selectedIds||[]));}catch(error){results.push({sourcePath:request.sourcePath,status:'error',removed:0,error:error.message});}progress({done:index+1,total:requests.length,name:path.basename(request.sourcePath)});}return {directory,results,cleaned:results.filter(item=>item.status==='cleaned').length,removed:results.reduce((sum,item)=>sum+item.removed,0)};
}

async function rewriteOffice(buffer,kind){
  const entries=await readArchive(buffer);let removed=0;for(const entry of entries){if(!entry.data)continue;if(kind==='word'&&/^word\/header\d*\.xml$/i.test(entry.name)){const result=stripWordWatermarks(entry.data.toString('utf8'));entry.data=Buffer.from(result.xml);removed+=result.removed;}if(kind==='excel'&&/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)){const result=stripExcelBackgrounds(entry.data.toString('utf8'));entry.data=Buffer.from(result.xml);removed+=result.removed;}}return {buffer:await writeArchive(entries),removed};
}

module.exports={kindOf,stripWordWatermarks,stripExcelBackgrounds,rewriteOffice,inspectSanitizationFile,inspectSanitizationFiles,sanitizeOfficeFile,sanitizeOfficeFiles};
