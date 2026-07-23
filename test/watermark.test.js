'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const yazl=require('yazl');
const {PDFDocument,PDFName,PDFString,degrees}=require('pdf-lib');
const {stripWordWatermarks,stripExcelBackgrounds,inspectSanitizationFile,sanitizeOfficeFile}=require('../src/watermark');

test('Word header watermark markup is removed without deleting ordinary shapes',()=>{
  const xml='<w:hdr><w:pict><v:shape id="PowerPlusWaterMarkObject1"><v:textpath string="CONFIDENTIAL"/></v:shape></w:pict><w:pict><v:shape id="ordinary"/></w:pict></w:hdr>';
  const result=stripWordWatermarks(xml);
  assert.equal(result.removed,1);
  assert.doesNotMatch(result.xml,/PowerPlusWaterMark/);
  assert.match(result.xml,/ordinary/);
});

test('Excel sheet background pictures are removed',()=>{
  const result=stripExcelBackgrounds('<worksheet><sheetData/><picture r:id="rId2"/></worksheet>');
  assert.equal(result.removed,1);
  assert.equal(result.xml,'<worksheet><sheetData/></worksheet>');
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
  assert.equal(inspection.items.find(item=>item.type==='watermark').selected,true);
  assert.equal(inspection.items.find(item=>item.type==='comment').selected,false);
  const requestedDestination=path.join(directory,'自定义脱敏文件名.docx'),result=await sanitizeOfficeFile(source,directory,inspection.items.map(item=>item.id),requestedDestination);
  assert.equal(result.status,'cleaned');assert.equal(result.originalUntouched,true);
  assert.equal(result.destination,requestedDestination);
  await fs.rm(directory,{recursive:true,force:true});
});


test('PDF sanitization exposes and removes document properties into a new copy',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-pdf-sanitize-')),source=path.join(directory,'sample.pdf'),document=await PDFDocument.create(),page=document.addPage([600,800]);
  page.drawText('CONFIDENTIAL',{x:80,y:380,size:58,rotate:degrees(35),opacity:.24});
  page.drawText('ordinary translucent note',{x:40,y:100,size:12,opacity:.5});
  const annotation=document.context.obj({Type:'Annot',Subtype:'Text',Rect:[40,700,60,720],Contents:PDFString.of('Word export comment')}),annotationRef=document.context.register(annotation),annots=document.context.obj([annotationRef]);page.node.set(PDFName.of('Annots'),annots);
  document.setAuthor('Sensitive Author');document.setCreator('Sensitive Tool');await fs.writeFile(source,await document.save());
  const inspection=await inspectSanitizationFile(source);
  assert.equal(inspection.kind,'pdf');
  assert.ok(inspection.items.some(item=>item.id==='pdf-metadata-author'));
  assert.ok(inspection.items.some(item=>item.contentWatermark&&/CONFIDENTIAL/.test(item.detail)));
  assert.equal(inspection.items.filter(item=>item.contentWatermark).length,1);
  assert.ok(inspection.items.some(item=>item.type==='comment'&&/Word export comment/.test(item.detail)));
  const result=await sanitizeOfficeFile(source,directory,inspection.items.map(item=>item.id));
  assert.equal(result.status,'cleaned');assert.equal(result.originalUntouched,true);
  const cleaned=await PDFDocument.load(await fs.readFile(result.destination),{updateMetadata:false});
  assert.equal(cleaned.getAuthor(),undefined);
  const reinspection=await inspectSanitizationFile(result.destination);
  assert.equal(reinspection.items.filter(item=>item.type==='watermark'||item.type==='comment').length,0);
  await fs.rm(directory,{recursive:true,force:true});
});
