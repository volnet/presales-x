'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('watermark workspace and companion are first-class local features',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js');
  assert.match(html,/data-mode="watermark"/);
  assert.match(html,/id="watermarkWorkspace"/);
  assert.doesNotMatch(html,/id="options"/);
  assert.match(app,/pickWatermarkFiles/);
  assert.match(app,/addSanitizationFiles/);
  assert.match(main,/createCompanion/);
  assert.match(main,/app\.disableHardwareAcceleration\(\);/);
  assert.match(main,/inspectSanitizationFiles/);
  assert.match(main,/sanitizeOfficeFile/);
  assert.match(main,/showSaveDialog/);
  assert.doesNotMatch(main,/findSoffice|--headless|LibreOffice/);
  assert.match(html,/sanitize-layout/);
  assert.match(app,/renderSanitizationDetail/);
  assert.match(html,/脱敏前/);
  assert.match(html,/脱敏后/);
  assert.match(html,/id="sanitizeComparisonList"/);
  assert.doesNotMatch(html,/id="sanitizeOptionList"|id="sanitizeAfterList"/);
  assert.match(app,/sanitize-before-value/);
  assert.match(app,/sanitize-after-value/);
  assert.match(app,/data-metadata-field/);
  assert.match(app,/data-clear-metadata/);
  assert.match(app,/data-restore-metadata/);
  assert.match(app,/metadataUpdates/);
  assert.match(app,/fileTimeUpdates/);
  assert.match(app,/data-filesystem-field/);
  const sanitizer=read('src/watermark.js');
  assert.match(sanitizer,/创建日期/);
  assert.match(sanitizer,/修改日期/);
  assert.match(sanitizer,/访问日期/);
  assert.match(app,/type="\$\{isTime\?'datetime-local':'text'\}"/);
  assert.match(app,/toISOString\(\)/);
  assert.match(app,/ISO 8601/);
  assert.match(html,/id="sanitizeSelectAll"/);
  assert.match(app,/batchClearWatermarks/);
  assert.match(app,/batchClearMetadata/);
  assert.match(app,/sanitizeBatch/);
  assert.match(main,/sanitize-files-batch/);
  assert.match(main,/批量脱敏文件\.zip/);
  assert.match(main,/let name=path\.basename\(sourcePath\)/);
  assert.match(app,/class="sanitize-kind"/);
  assert.match(html,/id="sanitizeSave"/);
  assert.match(html,/id="sanitizeSaveAs"/);
  assert.doesNotMatch(html,/Word、Excel、PDF/);
  assert.match(app,/sanitizeCurrent\(action\)/);
  assert.doesNotMatch(app,/sanitizationFiles\.map\(file=>\(\{sourcePath/);
  assert.doesNotMatch(`${html}\n${app}\n${main}\n${read('src/preload.js')}`,/sanitizePreview|renderDocumentPreview|openWith|docx-preview|文件预览/);
  const companionHtml=read('src/companion/index.html'),companionApp=read('src/companion/app.js');
  assert.doesNotMatch(companionHtml,/PreSalesX/);
  assert.match(companionHtml,/id="bubble"/);
  for(const state of ['entrance','sleep','wake','think','insight','dash'])assert.match(companionApp,new RegExp(`['"]${state}['"]`));
  assert.doesNotMatch(companionApp,/Math\.random|\.png/);
  assert.match(main,/const width=220,height=220/);
  assert.match(main,/roundedCorners:false/);
  assert.match(main,/focusable:false/);
  assert.doesNotMatch(main,/titleBarStyle|titleBarOverlay/);
  assert.match(main,/setBackgroundColor\('#00000000'\)/);
  assert.doesNotMatch(main,/setShape|companionShape|nativeImage|useContentSize|setContentSize/);
  assert.match(read('src/companion/style.css'),/\.robot-hitbox:focus,[^{]*\.robot-hitbox:focus-visible[^{]*\{outline:0/);
  assert.match(read('scripts/after-pack.js'),/--set-icon/);
  assert.match(read('scripts/after-pack.js'),/presalesx-logo\.ico/);
  const companionCss=read('src/companion/style.css');
  assert.match(companionHtml,/柴犬数字宠物/);
  assert.match(companionHtml,/#171c24/);
  assert.match(companionHtml,/class="tan-brow"/);
  for(const part of ['head','torso','arm-left','arm-right','leg-left','leg-right','tail'])assert.match(companionHtml,new RegExp(`class="[^"]*${part}`));
  for(const motion of ['puppy-arrive','puppy-land','curl-up','wake-up','curious-tilt','idea-pop','puppy-dash','leg-run-left','leg-run-right'])assert.match(companionCss,new RegExp(`@keyframes ${motion}`));
  assert.match(main,/label:'隐藏宠物'/);
  assert.match(main,/setCompanionVisible\(false\)/);
  assert.match(main,/setCompanionVisible\(true\)/);
  assert.match(main,/notifyCompanionVisibility/);
  assert.match(html,/id="showCompanion"[^>]*hidden/);
  assert.match(read('src/preload.js'),/showCompanion:\(\)=>ipcRenderer\.send\('companion-show'\)/);
  assert.match(read('src/preload.js'),/onCompanionVisibility/);
  assert.match(read('src/ui/app.js'),/onCompanionVisibility/);
  assert.match(main,/ipcMain\.on\('companion-show'/);
  assert.match(companionApp,/startDrag\(dragOrigin\)/);
  assert.match(companionApp,/moveDrag\(queuedDragPoint\)/);
  assert.match(read('src/companion-preload.js'),/companion-drag-move/);
  assert.match(main,/ipcMain\.on\('companion-drag-move'/);
  assert.match(main,/getDisplayNearestPoint/);
  assert.match(companionCss,/\.bubble\{visibility:hidden/);
  assert.match(companionCss,/\.bubble\.visible\{visibility:visible/);
});

test('Office image studio supports album selection, batch effects and export',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js'),preload=read('src/preload.js'),css=read('src/ui/refactor.css');
  assert.match(html,/data-mode="images"/);assert.match(html,/id="imageWorkspace"/);assert.match(html,/id="imageGallery"/);
  assert.match(html,/批量加水印/);assert.match(html,/>转黑白</);assert.match(html,/横向/);assert.match(html,/竖向/);assert.match(html,/斜向/);assert.match(html,/透明度/);
  assert.match(app,/inspectOfficeImages/);assert.match(app,/transformImage/);assert.match(app,/getImageData/);assert.match(app,/pickWatermarkImage/);assert.match(app,/exportOfficeImages/);
  assert.match(main,/inspect-office-images/);assert.match(main,/export-office-images/);assert.match(preload,/pickImageSourceFiles/);
  assert.match(css,/\.image-gallery\{/);assert.match(css,/grid-template-columns:repeat\(auto-fill/);assert.doesNotMatch(main,/LibreOffice|soffice/);
  assert.match(html,/id="imagePreviewPane"/);assert.match(html,/id="imageSelectionTray"/);assert.match(html,/id="imageCopyAction"/);
  assert.match(app,/ondblclick=.*showImagePreview/);assert.match(app,/oncontextmenu/);assert.match(app,/event\.metaKey/);assert.match(app,/copyOfficeImages/);
  assert.match(app,/updateCurrentGallerySelectionState\(\);updateImageActionState\(\)/);assert.match(app,/extensionLabel\(source\)/);assert.match(app,/extensionLabel\(file\)/);
  assert.match(html,/id="toggleSanitizeFiles"/);assert.match(html,/id="toggleImageFiles"/);assert.match(css,/files-collapsed/);
  assert.match(main,/copy-office-images/);assert.match(read('src/image-clipboard.js'),/clipboard\.write/);
  assert.match(html,/媒体助理/);assert.doesNotMatch(html,/>图片提取</);assert.match(app,/mediaType==='video'/);assert.match(app,/<video/);assert.match(app,/media-format-badge/);assert.match(css,/\.media-format-badge/);
  assert.match(read('src/office-images.js'),/video\/mp4/);assert.match(read('src/office-images.js'),/videoPreviewable/);
  assert.match(html,/id="videoCompressionPanel"/);assert.match(html,/id="mediaTaskConsole"/);assert.match(html,/视频码率/);assert.match(html,/音频码率/);
  assert.match(html,/media-action-group/);assert.match(html,/>编辑</);assert.match(html,/>输出</);assert.match(app,/showMediaContextMenu/);assert.match(app,/handleMediaAction/);
  assert.match(app,/imagePreviewContent.*oncontextmenu/);
  assert.match(app,/onMediaTaskProgress/);assert.match(app,/canvas-process/);assert.match(main,/compress-office-video/);assert.match(read('src/video-processor.js'),/-progress/);
});

test('refactored application shell preserves named grid areas',()=>{
  const css=read('src/ui/refactor.css');
  assert.match(css,/"title title"\s+58px/);
  assert.match(css,/"rail work"\s+minmax\(0,\s*1fr\)/);
  assert.match(css,/"status status"\s+26px/);
  assert.doesNotMatch(css,/\.app-shell\s*\{[^}]*grid-template:\s*52px\s+1fr\s+24px\s*\//s);
});

test('saving metadata keeps the active property editor mounted and editable',()=>{
  const source=read('src/ui/app.js');
  const editorStart=source.indexOf('const submit=async action=>'),saveBranch=source.slice(editorStart,source.indexOf("}catch(error){showStatus('保存失败",editorStart));
  assert.match(source,/data-original=/);
  assert.match(saveBranch,/input\.dataset\.original=input\.value/);
  assert.match(source,/input\.disabled=false/);
  assert.match(saveBranch,/resume\.focus/);
  assert.doesNotMatch(saveBranch,/renderFileDetail\s*\(/);
  assert.doesNotMatch(saveBranch,/alert\s*\(/);
});

test('file detail header uses two explicit rows without a negative sticky offset',()=>{
  const app=read('src/ui/app.js');
  const css=read('src/ui/style.css');
  assert.match(app,/file-name-row/);
  assert.match(app,/file-info-row/);
  assert.match(css,/\.file-detail-sticky\{position:sticky;top:0/);
  assert.match(app,/data-expand-sections/);
  assert.match(app,/data-collapse-sections/);
  assert.match(app,/property-section" open/);
  assert.match(read('src/ui/pro.css'),/\.file-name-row \{[^}]*white-space: normal/);
  assert.doesNotMatch(css,/\.file-detail-sticky\{[^}]*top:-/);
});

test('batch review and property editor are separate workspaces',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/style.css');
  assert.match(html,/id="compareWorkspace"/);
  assert.match(html,/id="editorWorkspace"/);
  assert.match(html,/文件审查/);
  assert.doesNotMatch(html,/供应商概览|文件级审查/);
  assert.match(html,/属性重复审查/);
  assert.match(html,/操作记录/);
  assert.match(app,/--supplier-count:\$\{Math\.max\(1,data\.supplierStats\.length\)\}/);
  assert.match(css,/repeat\(var\(--supplier-count\),minmax\(245px,1fr\)\)/);
});

test('property editor has a draggable file pane and compact add control',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(html,/id="editorSplitter"/);
  assert.match(html,/id="addEditorFilesInline"/);
  assert.match(app,/onpointerdown/);
  assert.match(app,/setExplorerWidth/);
  assert.match(css,/--explorer-width/);
});

test('supplier review uses numbered expandable metadata cards and inline filters',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(app,/supplier-file-card/);
  assert.match(app,/file-sequence/);
  assert.match(app,/查看更多与编辑/);
  assert.match(app,/仅查看相同文件/);
  assert.match(app,/仅查看属性重复文件/);
  assert.match(app,/文件大小/);
  assert.match(app,/&lt;空&gt;/);
  assert.match(app,/fileIssues/);
  assert.match(app,/issue-tag/);
  assert.match(app,/>\+<\/button>/);
  assert.match(app,/>−<\/button>/);
  assert.match(app,/index===0\?'open'/);
  assert.match(css,/\.alert-banner\.fatal/);
  assert.doesNotMatch(html,/id="compareFiles"/);
});

test('attribute repetition review uses one full-path evidence row per file',()=>{
  const app=read('src/ui/app.js');
  const css=read('src/ui/pro.css');
  assert.match(app,/跨供应商属性重复/);
  assert.match(app,/duplicate-file-row/);
  assert.match(app,/group\.riskLevel/);
  assert.match(app,/pathMarkup\(ref\.path\)/);
  assert.match(css,/\.duplicate-file-row \{[^}]*grid-template-columns/);
  assert.match(css,/\.path-directory/);
});

test('save messages are rendered on separate lines',()=>{
  const css=read('src/ui/style.css');
  assert.match(css,/\.save-summary span\{display:block/);
});

test('visible product branding uses PreSalesX consistently',()=>{
  const source=['README.md','package.json','package-lock.json','src/main.js','src/cli.js','src/reports.js','src/ui/index.html','src/ui/app.js','scripts/after-pack.js','scripts/ui-smoke.js','.github/workflows/release.yml'].map(read).join('\n');
  const forbidden=new RegExp([
    Buffer.from('54656e6465724775617264','hex').toString(),
    Buffer.from('74656e6465722d6775617264','hex').toString(),
    Buffer.from('74656e6465726775617264','hex').toString(),
    Buffer.from('50726553616c65734775617264','hex').toString(),
    Buffer.from('70726573616c65732d6775617264','hex').toString(),
    Buffer.from('70726573616c65736775617264','hex').toString()
  ].join('|'),'i');
  assert.match(source,/PreSalesX/);
  assert.doesNotMatch(source,forbidden);
});

test('application and release artifacts use version 1.3.0 consistently',()=>{
  const manifest=JSON.parse(read('package.json'));
  const html=read('src/ui/index.html');
  const analyzer=read('src/analyzer.js');
  const workflow=read('.github/workflows/release.yml');
  assert.equal(manifest.version,'1.3.0');
  assert.match(html,/PreSalesX 1\.3\.0/);
  assert.match(analyzer,/appVersion:APP_VERSION/);
  assert.match(manifest.scripts['dist:win'],/--win zip --x64/);
  assert.match(manifest.scripts['dist:mac'],/--mac zip --universal/);
  assert.match(manifest.scripts['dist:win'],/--publish never/);
  assert.match(manifest.scripts['dist:mac'],/--publish never/);
  assert.match(workflow,/PreSalesX-\*-Windows-\*\.zip/);
  assert.match(workflow,/PreSalesX-\*-macOS-\*\.zip/);
  assert.match(workflow,/gh release create/);
});

test('chosen files have a readable type badge and the Shiba has stateful happy motion',()=>{
  const uiCss=read('src/ui/refactor.css');
  const companionHtml=read('src/companion/index.html');
  const companionCss=read('src/companion/style.css');
  assert.match(uiCss,/\.chosen-file \{[^}]*grid-template-columns:64px/);
  assert.match(uiCss,/\.chosen-file \.zip-icon \{[^}]*padding:3px 9px/);
  assert.match(uiCss,/\.companion-launcher \{[^}]*border-radius:50%/);
  assert.match(uiCss,/\.companion-launcher svg \{[^}]*width:38px/);
  assert.match(companionHtml,/class="nose"/);
  assert.match(companionHtml,/class="tongue"/);
  assert.match(companionCss,/\.face-sleep,\.face-think,\.idea,\.zzz,\.tongue\{opacity:0\}/);
  assert.match(companionCss,/\[data-state="welcome"\] \.tongue/);
  assert.match(companionCss,/@keyframes tongue-happy/);
  assert.match(uiCss,/\.sanitize-file \.sanitize-kind \{ align-self:center/);
  assert.match(uiCss,/\.sanitize-file>button \{[^}]*align-items:center/);
  assert.match(uiCss,/\.sanitize-file-copy strong \{ font-size:13\.5px/);
  assert.doesNotMatch(uiCss,/\.sanitize-file-copy small \{ font-size:12px/);
  assert.doesNotMatch(uiCss,/\.sanitize-file \.sanitize-file-copy>span \{ font-size:12px/);
  assert.match(companionHtml,/class="nose"/);
  assert.match(companionCss,/@keyframes puppy-dash/);
  assert.match(read('src/companion/app.js'),/setState\('dash','马上就来！'\)/);
});
