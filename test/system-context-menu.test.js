'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {actions,allExtensions,parseContextRequest,workflowDocument}=require('../src/system-context-menu');

test('system context actions are limited by supported document types',()=>{
  assert.deepEqual(actions.compare.extensions,['zip']);
  assert.ok(actions.files.extensions.includes('pdf'));
  assert.ok(actions.watermark.extensions.includes('docx'));
  assert.ok(actions.images.extensions.includes('pptx'));
  assert.ok(allExtensions.includes('xlsx'));
});

test('Windows uses self-contained cascading verbs instead of an empty CommandStore flyout',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','src','system-context-menu.js'),'utf8');
  assert.match(source,/\\\\shell\\\\\$\{String\(index\+1\)\.padStart\(2,'0'\)\}-\$\{id\}/);
  assert.match(source,/setRegistry\(child,'MUIVerb',action\.label\)/);
  assert.match(source,/setRegistry\(`\$\{child\}\\\\command`/);
  assert.match(source,/setRegistry\(key,'SubCommands',''\)/);
});

test('context-menu arguments route only compatible absolute files',()=>{
  const doc=path.resolve('proposal.docx'),zip=path.resolve('supplier.zip'),exe=path.resolve('PreSalesX.exe');
  assert.deepEqual(parseContextRequest([exe,'--presalesx-action=files',doc,zip]),{action:'files',files:[doc]});
  assert.deepEqual(parseContextRequest([exe,'--presalesx-action=compare',zip]),{action:'compare',files:[zip]});
  assert.equal(parseContextRequest([exe,'--presalesx-action=watermark',zip]),null);
});

test('macOS workflow forwards Finder file arguments to PreSalesX',()=>{
  const workflow=workflowDocument('images','/Applications/PreSalesX.app/Contents/MacOS/PreSalesX');
  assert.match(workflow,/Run Shell Script\.action/);
  assert.match(workflow,/--presalesx-action=images/);
  assert.match(workflow,/&quot;\$@&quot;/);
});

test('main process exposes install remove and direct-open routing',()=>{
  const main=fs.readFileSync(path.join(__dirname,'..','src','main.js'),'utf8');
  const preload=fs.readFileSync(path.join(__dirname,'..','src','preload.js'),'utf8');
  assert.match(main,/install-system-context-menu/);
  assert.match(main,/remove-system-context-menu/);
  assert.match(main,/parseContextRequest\(argv\)/);
  assert.match(main,/system-context-open/);
  assert.match(preload,/systemContextMenuApi/);
});
