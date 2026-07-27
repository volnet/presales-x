'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const yazl=require('yazl');
const {stripWordWatermarks,stripExcelBackgrounds,stripExcelHeaderWatermarks,inspectSanitizationFile,sanitizeOfficeFile}=require('../src/watermark');

test('Word header watermark markup is removed without deleting ordinary shapes',()=>{
  const xml='<w:hdr><w:pict><v:shape id="PowerPlusWaterMarkObject1"><v:textpath string="CONFIDENTIAL"/></v:shape></w:pict><w:pict><v:shape id="ordinary"/></w:pict></w:hdr>';
  const result=stripWordWatermarks(xml);
  assert.equal(result.removed,1);
  assert.doesNotMatch(result.xml,/PowerPlusWaterMark/);
  assert.match(result.xml,/ordinary/);
});

test('Excel sheet background pictures are removed',()=>{
  const result=stripExcelBackgrounds('<x:worksheet><x:sheetData/><x:picture r:id="rId2"/></x:worksheet>');
  assert.equal(result.removed,1);
  assert.equal(result.xml,'<x:worksheet><x:sheetData/></x:worksheet>');
});

test('Excel header and footer image watermarks are removed',()=>{
  const result=stripExcelHeaderWatermarks('<worksheet><headerFooter><oddHeader>&amp;C&amp;G</oddHeader></headerFooter><legacyDrawingHF r:id="rId3"/></worksheet>');
  assert.ok(result.removed>=1);
  assert.doesNotMatch(result.xml,/headerFooter|legacyDrawingHF|&amp;G/);
});

test('XLSX backgrounds and header image watermarks are detected unselected and removed on save',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-xlsx-watermark-')),source=path.join(directory,'sample.xlsx'),destination=path.join(directory,'clean.xlsx'),zip=new yazl.ZipFile(),chunks=[];
  zip.outputStream.on('data',chunk=>chunks.push(chunk));
  const finished=new Promise((resolve,reject)=>{zip.outputStream.on('end',resolve);zip.outputStream.on('error',reject);});
  zip.addBuffer(Buffer.from('<workbook><sheets><sheet name="报价"/></sheets></workbook>'),'xl/workbook.xml');
  zip.addBuffer(Buffer.from('<x:worksheet><x:sheetData/><x:picture r:id="rId2"/><x:headerFooter><x:oddHeader>&amp;C&amp;G</x:oddHeader></x:headerFooter><x:legacyDrawingHF r:id="rId3"/></x:worksheet>'),'xl/worksheets/sheet1.xml');
  zip.end();await finished;await fs.writeFile(source,Buffer.concat(chunks));
  const inspection=await inspectSanitizationFile(source),watermarks=inspection.items.filter(item=>item.type==='watermark');
  assert.equal(watermarks.length,2);
  assert.ok(watermarks.every(item=>item.selected===false));
  const result=await sanitizeOfficeFile(source,directory,watermarks.map(item=>item.id),destination,{overwrite:false});
  assert.equal(result.status,'cleaned');
  assert.equal((await inspectSanitizationFile(destination)).items.filter(item=>item.type==='watermark').length,0);
  await fs.rm(directory,{recursive:true,force:true});
});

test('file sanitization lists watermark, comments and revision state before creating a copy',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-sanitize-')),source=path.join(directory,'sample.docx'),zip=new yazl.ZipFile(),chunks=[];
  zip.outputStream.on('data',chunk=>chunks.push(chunk));
  const finished=new Promise((resolve,reject)=>{zip.outputStream.on('end',resolve);zip.outputStream.on('error',reject);});
  zip.addBuffer(Buffer.from('<w:hdr><w:pict><v:shape id="PowerPlusWaterMarkObject1"><v:textpath string="SECRET"/></v:shape></w:pict></w:hdr>'),'word/header1.xml');
  zip.addBuffer(Buffer.from('<w:comments><w:comment w:id="0" w:author="Alice"><w:p><w:r><w:t>内部批注</w:t></w:r></w:p></w:comment></w:comments>'),'word/comments.xml');
  zip.addBuffer(Buffer.from('<w:document><w:body><w:p><w:r><w:t>第一页</w:t><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>正文</w:t></w:r><w:commentReference w:id="0"/></w:p><w:ins><w:r><w:t>修订</w:t></w:r></w:ins></w:body></w:document>'),'word/document.xml');
  zip.addBuffer(Buffer.from('<cp:coreProperties><dc:creator>Alice</dc:creator><cp:lastModifiedBy>Bob</cp:lastModifiedBy></cp:coreProperties>'),'docProps/core.xml');
  zip.end();await finished;await fs.writeFile(source,Buffer.concat(chunks));
  const inspection=await inspectSanitizationFile(source);
  assert.equal(inspection.hasRevisions,true);
  assert.equal(inspection.items.filter(item=>item.type==='watermark').length,1);
  assert.equal(inspection.items.filter(item=>item.type==='comment').length,1);
  assert.match(inspection.items.find(item=>item.type==='watermark').detail,/SECRET/);
  assert.match(inspection.items.find(item=>item.type==='comment').label,/第 2 页/);
  assert.ok(inspection.items.some(item=>item.id==='office-metadata-author'));
  assert.equal(inspection.items.find(item=>item.type==='watermark').selected,false);
  assert.equal(inspection.items.find(item=>item.type==='comment').selected,false);
  const requestedDestination=path.join(directory,'自定义脱敏文件名.docx'),fileDate='2020-05-06T07:08:09.000Z',result=await sanitizeOfficeFile(source,directory,inspection.items.map(item=>item.id),requestedDestination,{metadataUpdates:{author:'123匿名作者',lastEditor:'',title:'脱敏后的项目名称'},fileTimeUpdates:{created:fileDate,modified:fileDate,accessed:fileDate}});
  assert.equal(result.status,'cleaned');assert.equal(result.originalUntouched,true);
  assert.equal(result.destination,requestedDestination);
  const sanitizedStat=await fs.stat(requestedDestination);
  assert.ok(Math.abs(sanitizedStat.birthtime.getTime()-new Date(fileDate).getTime())<2000);
  assert.ok(Math.abs(sanitizedStat.mtime.getTime()-new Date(fileDate).getTime())<2000);
  assert.ok(Math.abs(sanitizedStat.atime.getTime()-new Date(fileDate).getTime())<2000);
  const sanitizedInspection=await inspectSanitizationFile(requestedDestination);
  assert.equal(sanitizedInspection.items.find(item=>item.field==='author').detail,'123匿名作者');
  assert.equal(sanitizedInspection.items.find(item=>item.field==='lastEditor').detail,'');
  assert.equal(sanitizedInspection.items.find(item=>item.field==='title').detail,'脱敏后的项目名称');
  const verifiedStat=await fs.stat(requestedDestination);
  assert.ok(Math.abs(verifiedStat.atime.getTime()-new Date(fileDate).getTime())<2000);
  const saveResult=await sanitizeOfficeFile(source,directory,[inspection.items.find(item=>item.type==='watermark').id],source,{overwrite:true});
  assert.equal(saveResult.status,'cleaned');assert.equal(saveResult.originalUntouched,false);
  assert.equal(saveResult.destination,source);
  assert.equal((await inspectSanitizationFile(source)).items.filter(item=>item.type==='watermark').length,0);
  await fs.rm(directory,{recursive:true,force:true});
});
test('PDF is explicitly excluded from file sanitization',async()=>{
  await assert.rejects(()=>inspectSanitizationFile(path.join(os.tmpdir(),'sample.pdf')),/暂仅支持 Word 和 Excel/);
});
