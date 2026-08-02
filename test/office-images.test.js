'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs').promises;
const path=require('node:path');
const os=require('node:os');
const yazl=require('yazl');
const {inspectOfficeImages,replaceOfficeMedia,kindFor,dimensions}=require('../src/office-images');

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function officePackage(file,entry,data=png){const zip=new yazl.ZipFile(),chunks=[];zip.outputStream.on('data',chunk=>chunks.push(chunk));const finished=new Promise((resolve,reject)=>{zip.outputStream.on('end',resolve);zip.outputStream.on('error',reject);});zip.addBuffer(data,entry);zip.addBuffer(Buffer.from('<xml/>'),'docProps/core.xml');zip.end();await finished;await fs.writeFile(file,Buffer.concat(chunks));}

test('detects Word, Excel and PowerPoint image media without Office automation',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-images-'));
  try{
    const fixtures=[['sample.docx','word/media/image1.png','word'],['sample.xlsx','xl/media/image2.png','excel'],['sample.pptx','ppt/media/image3.png','powerpoint']];
    for(const [name,entry,kind] of fixtures)await officePackage(path.join(directory,name),entry);
    const result=await inspectOfficeImages(fixtures.map(([name])=>path.join(directory,name)));
    assert.deepEqual(result.map(item=>item.kind),fixtures.map(item=>item[2]));
    assert.deepEqual(result.map(item=>item.images.length),[1,1,1]);
    assert.deepEqual(result.map(item=>item.images[0].entryPath),fixtures.map(item=>item[1]));
    assert.ok(result.every(item=>item.images[0].previewable));
    assert.ok(result.every(item=>item.images[0].width===1&&item.images[0].height===1));
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('extracts embedded Office video with media metadata',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-video-')),source=path.join(directory,'video.pptx');
  try{await officePackage(source,'ppt/media/media1.mp4',Buffer.from('fake-mp4'));const [result]=await inspectOfficeImages([source]),media=result.images[0];assert.equal(media.mediaType,'video');assert.equal(media.ext,'mp4');assert.equal(media.mime,'video/mp4');assert.equal(media.previewable,true);assert.equal(media.processable,false);}finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('writes processed media back into an Office source copy',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'presalesx-media-write-')),source=path.join(directory,'source.docx'),destination=path.join(directory,'processed.docx');
  try{await officePackage(source,'word/media/image1.png',png);const replacement=Buffer.from(png);replacement[replacement.length-1]^=1;const result=await replaceOfficeMedia(source,[{entryPath:'word/media/image1.png',data:replacement}],destination);assert.equal(result.replaced,1);const [inspected]=await inspectOfficeImages([destination]);assert.equal(inspected.images[0].data,replacement.toString('base64'));assert.notEqual((await fs.readFile(source)).toString('base64'),(await fs.readFile(destination)).toString('base64'));}finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('classifies supported Office containers and PNG dimensions',()=>{
  assert.equal(kindFor('a.docm'),'word');assert.equal(kindFor('a.xlsm'),'excel');assert.equal(kindFor('a.pptm'),'powerpoint');assert.equal(kindFor('a.pdf'),'');
  assert.deepEqual(dimensions(png,'png'),{width:1,height:1});
});
