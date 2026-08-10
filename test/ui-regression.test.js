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
  assert.match(app,/class="file-type-icon"/);
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
  assert.match(main,/focusable:process\.platform==='darwin'/);
  assert.match(main,/type:process\.platform==='darwin'\?'panel':undefined/);
  assert.match(main,/function createTray\(\)\{if\(process\.platform!==\'win32\'\|\|/);
  assert.doesNotMatch(main,/process\.platform===\'darwin\'\?\'presalesx-logo\.png\'/);
  assert.match(main,/try\{createTray\(\);\}catch\(error\)[\s\S]*createCompanion\(\)/);
  assert.doesNotMatch(main,/titleBarStyle|titleBarOverlay/);
  assert.match(main,/setBackgroundColor\('#00000000'\)/);
  assert.doesNotMatch(main,/setShape|companionShape|nativeImage|useContentSize|setContentSize/);
  assert.match(read('src/companion/style.css'),/\.robot-hitbox\{[^}]*-webkit-app-region:drag/);
  assert.match(read('src/companion/style.css'),/\.pet-interact\{[^}]*-webkit-app-region:no-drag/);
  assert.match(companionHtml,/id="petInteract"[^>]*aria-label="与柴犬数字宠物互动"/);
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
  assert.match(companionApp,/interact\.addEventListener\('click'/);
  assert.match(companionApp,/interact\.addEventListener\('dblclick'/);
  assert.match(main,/companion\.on\('system-context-menu',[\s\S]*popupCompanionMenu\(\)/);
  assert.doesNotMatch(`${companionApp}\n${read('src/companion-preload.js')}\n${main}`,/companion-drag-|setPointerCapture|lostpointercapture|moveCompanionWithCursor|companionDragState|companionDragTimer/);
  assert.match(companionCss,/\.bubble\{visibility:hidden/);
  assert.match(companionCss,/\.bubble\.visible\{visibility:visible/);
});

test('document media assistant supports selection, editing, preview and export',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js'),preload=read('src/preload.js'),css=read('src/ui/refactor.css');
  assert.match(html,/data-mode="images"/);assert.match(html,/id="imageWorkspace"/);assert.match(html,/id="imageGallery"/);
  assert.match(html,/文档媒体助理/);assert.match(html,/水印/);assert.match(html,/id="imageGrayscaleAction" type="checkbox"/);assert.match(html,/对比度/);assert.match(html,/饱和度/);assert.match(html,/横向/);assert.match(html,/竖向/);assert.match(html,/斜向/);assert.match(html,/透明度/);
  assert.match(app,/inspectOfficeImages/);assert.match(app,/transformImage/);assert.match(app,/getImageData/);assert.match(app,/pickWatermarkImage/);assert.match(app,/exportOfficeImages/);
  assert.match(main,/inspect-office-images/);assert.match(main,/export-office-images/);assert.match(preload,/pickImageSourceFiles/);
  assert.match(css,/\.image-gallery\{/);assert.match(css,/grid-template-columns:repeat\(auto-fill/);assert.match(css,/grid-auto-rows:max-content/);assert.match(css,/aspect-ratio:4\/3/);assert.match(css,/grid-template-rows:auto auto auto minmax\(0,1fr\)/);assert.doesNotMatch(main,/LibreOffice|soffice/);
  assert.match(html,/id="imagePreviewPane"/);assert.match(html,/id="imageSelectionTray"/);assert.match(html,/id="imageCopyAction"/);
  assert.match(app,/gallery\.onclick=.*galleryClickTimer/);assert.match(app,/gallery\.ondblclick=.*openMediaPreview/);assert.match(app,/gallery\.oncontextmenu/);assert.match(app,/event\.metaKey/);assert.match(app,/copyOfficeImages/);
  assert.match(html,/id="imageGalleryLoad"/);assert.match(html,/id="imagePreviewLoader"/);assert.match(app,/requestIdleCallback/);assert.match(app,/IntersectionObserver/);assert.match(app,/batchSize=24/);
  assert.match(app,/updateCurrentGallerySelectionState\(\);updateImageActionState\(\)/);assert.match(app,/extensionLabel\(source\)/);assert.match(app,/extensionLabel\(file\)/);
  assert.match(html,/id="toggleSanitizeFiles"/);assert.match(html,/id="toggleImageFiles"/);assert.match(css,/files-collapsed/);
  assert.match(main,/copy-office-images/);assert.match(read('src/image-clipboard.js'),/clipboard\.write/);
  assert.match(html,/媒体助理/);assert.doesNotMatch(html,/>图片提取</);assert.match(app,/mediaType==='video'/);assert.match(app,/<video/);assert.match(app,/media-format-badge/);assert.match(css,/\.media-format-badge/);
  assert.match(read('src/office-images.js'),/video\/mp4/);assert.match(read('src/office-images.js'),/videoPreviewable/);
  assert.match(html,/id="videoCompressionPanel"/);assert.match(html,/id="mediaTaskConsole"/);assert.match(html,/视频码率/);assert.match(html,/音频码率/);
  assert.match(html,/id="imageEditorPane"/);assert.match(html,/历史记录/);assert.match(html,/id="imageExecutionPlan"/);assert.match(main,/show-thumbnail-context-menu/);assert.match(preload,/showThumbnailContextMenu/);
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

test('project open and save actions belong to supplier review',()=>{
  const html=read('src/ui/index.html');
  const compare=html.match(/id="compareWorkspace"[\s\S]*?id="editorWorkspace"/)?.[0]||'';
  const editor=html.match(/id="editorWorkspace"[\s\S]*?id="watermarkWorkspace"/)?.[0]||'';
  assert.match(compare,/<button id="openProject">打开检查项目<\/button>/);
  assert.match(compare,/id="saveProject"[^>]*>保存检查项目</);
  assert.doesNotMatch(editor,/openProject|saveEditorProject/);
  assert.doesNotMatch(html,/title-actions"><button id="openProject"/);
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

test('application and release artifacts use version 1.3.5 consistently',()=>{
  const manifest=JSON.parse(read('package.json'));
  const html=read('src/ui/index.html');
  const analyzer=read('src/analyzer.js');
  const workflow=read('.github/workflows/release.yml');
  assert.equal(manifest.version,'1.3.5');
  assert.match(html,/PreSalesX 1\.3\.5/);
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
  assert.match(uiCss,/\.file-type-icon\{[^}]*align-self:center/);
  assert.match(uiCss,/\.sanitize-file>button \{[^}]*align-items:center/);
  assert.match(uiCss,/\.sanitize-file-copy strong \{ font-size:13\.5px/);
  assert.doesNotMatch(uiCss,/\.sanitize-file-copy small \{ font-size:12px/);
  assert.doesNotMatch(uiCss,/\.sanitize-file \.sanitize-file-copy>span \{ font-size:12px/);
  assert.match(companionHtml,/class="nose"/);
  assert.match(companionCss,/@keyframes puppy-dash/);
  assert.match(read('src/companion/app.js'),/setState\('dash','马上就来！'\)/);
});

test('sanitization file list clears cleanly and watermark rows explain their content',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),css=read('src/ui/refactor.css');
  assert.match(html,/id="clearSanitizeFiles"[^>]*>清空</);
  assert.match(app,/clearSanitizeFiles/);
  assert.match(app,/sanitizationFiles=\[\]/);
  assert.match(app,/clearSanitizeFiles'\)\.disabled=!sanitizationFiles\.length/);
  assert.match(app,/sanitize-watermark-heading/);
  assert.match(app,/未能读取水印内容/);
  assert.match(css,/\.sanitize-watermark-heading>small i/);
});

test('closing the main window hides it while explicit tray exit closes the companion',()=>{
  const main=read('src/main.js');
  assert.match(main,/if\(win\.isMinimized\(\)\)win\.restore\(\);win\.show\(\);win\.setSkipTaskbar\(false\);win\.focus\(\);win\.moveTop\(\)/);
  assert.match(main,/event\.preventDefault\(\);win\.hide\(\)/);
  assert.match(main,/function quitApplication\(\)\{quitting=true;[^}]*companion\.destroy\(\);app\.quit\(\);\}/);
  assert.doesNotMatch(main,/win\.show\(\);win\.restore\(\);win\.focus\(\)/);
});

test('media assistant separates media downloads from source-file saves',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js'),preload=read('src/preload.js'),css=read('src/ui/refactor.css');
  assert.match(html,/image-gallery-toolbar[\s\S]*id="imageCopyAction"[\s\S]*id="exportImages"/);
  assert.match(html,/workspace-header[\s\S]*id="sourceMediaSave"[\s\S]*id="sourceMediaSaveAs"[\s\S]*image-studio-layout/);
  assert.match(html,/id="imageBatchActions"[^>]*hidden/);
  assert.match(app,/imageBatchActions'\)\.hidden=false/);
  assert.match(html,/image-source-files[\s\S]*id="addImageFiles"/);
  assert.match(app,/saveOfficeMediaSources/);assert.match(main,/save-office-media-sources/);assert.match(preload,/saveOfficeMediaSources/);
  assert.match(css,/\.image-preview-content section>div\{min-width:0;overflow:hidden\}/);
  assert.doesNotMatch(main,/moveCompanionWithCursor|companionDragTimer/);
});

test('media assistant keeps document actions in the header and progress in the editor pane',()=>{
  const html=read('src/ui/index.html'),css=read('src/ui/refactor.css');
  assert.match(html,/<aside id="imageEditorPane"[\s\S]*id="mediaTaskConsole"[\s\S]*<\/aside>/);
  assert.equal((html.match(/id="mediaTaskConsole"/g)||[]).length,1);
  assert.match(css,/image-editor-pane \.media-task-console\{position:sticky;bottom:0/);
  assert.match(css,/image-editor-pane \.media-task-console>button\{grid-template-columns:minmax\(0,1fr\) 18px/);
});

test('all three document workspaces share a DPI-corrected 600px file pane and extension icon',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),css=read('src/ui/refactor.css');
  for(const id of ['addEditorFilesInline','toggleEditorFiles','addSanitizeFiles','toggleSanitizeFiles','addImageFiles','toggleImageFiles'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/600\/scale/);assert.match(app,/window\.devicePixelRatio/);assert.match(app,/--file-pane-width/);
  assert.match(css,/\.editor-layout\{--explorer-width:var\(--file-pane-width,600px\)\}/);
  assert.match(css,/\.sanitize-layout\{grid-template-columns:var\(--file-pane-width,600px\)/);
  assert.match(css,/\.image-studio-layout\{grid-template-columns:var\(--file-pane-width,600px\)/);
  assert.match(css,/\.file-type-icon\{[^}]*width:48px;[^}]*height:48px/);
  assert.ok((app.match(/class="file-type-icon"/g)||[]).length>=3);
});

test('media assistant filters source types, sorts by size and exposes a removable execution plan',()=>{
  const html=read('src/ui/index.html');
  const app=read('src/ui/app.js');
  const css=read('src/ui/refactor.css');
  assert.match(html,/id="imageFileFilters"/);
  assert.match(html,/id="imageExecutionPlan"/);
  assert.match(app,/imageFileTypeFilters/);
  assert.match(app,/imageFileSizeSort/);
  assert.match(app,/data-remove-image-plan/);
  assert.match(app,/renderImageExecutionPlan/);
  assert.match(css,/\.image-preview-pane\{grid-template-rows:45px minmax\(0,2fr\) minmax\(120px,1fr\)/);
});

test('document media assistant uses four local-action panes and conditional preview',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js'),css=read('src/ui/refactor.css');
  for(const label of ['文件','缩略图','预览','编辑','历史记录','水印','调色'])assert.match(html,new RegExp(label));
  assert.match(app,/preview-hidden/);
  assert.match(app,/targets\.length===1/);
  assert.match(app,/showThumbnailContextMenu/);
  assert.match(app,/showDocumentFileMenu/);
  assert.match(main,/打开方式…/);
  assert.match(main,/open-media-preview/);
  assert.match(css,/#imageWorkspace \.image-studio-layout\{grid-template-columns:[^}]*minmax\(360px,1fr\)/);
  assert.match(css,/#imageWorkspace\.preview-hidden \.image-preview-pane\{display:none\}/);
});

test('text watermark defaults to second-precision local time and can be refreshed',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js');
  assert.match(html,/id="watermarkText" maxlength="80"/);
  assert.doesNotMatch(html,/id="watermarkText"[^>]*value="PreSalesX"/);
  assert.match(html,/id="refreshWatermarkTime"/);
  assert.match(app,/currentWatermarkTime/);
  assert.match(app,/getSeconds\(\)/);
  assert.match(app,/watermarkToolSection'\)\.ontoggle/);
  assert.match(app,/refreshWatermarkTime'\)\.onclick=refreshWatermarkTime/);
});

test('media editor panels form a top-aligned Photoshop-inspired light stack',()=>{
  const css=read('src/ui/refactor.css'),requirements=read('docs/ui-design-requirements.md');
  assert.match(css,/#imageWorkspace \.image-editor-pane\{display:flex;flex-direction:column/);
  assert.match(css,/#imageWorkspace \.image-tool-section\{[^}]*border:1px solid/);
  assert.match(css,/#imageWorkspace \.image-tool-section>summary\{[^}]*background:#edf2f7/);
  assert.match(css,/image-tool-section label[^}]*font-size:10px/);
  assert.match(requirements,/所有面板向顶部靠齐/);
  assert.match(requirements,/不使用 Photoshop 的深色底色/);
});

test('media editor has safe horizontal padding, video-only controls and watermark thumbnail preview',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),css=read('src/ui/refactor.css');
  assert.match(css,/image-editor-pane \.image-tool-section>section\{padding:12px 14px 14px\}/);
  assert.match(html,/id="videoToolSection"[^>]*hidden/);
  assert.match(app,/videoToolSection'\)\.hidden=!videos\.length/);
  assert.match(html,/id="watermarkImagePreview"/);
  assert.match(app,/preview\.src=watermarkImage\.data/);
  assert.match(css,/\.watermark-image-preview img\{[^}]*object-fit:contain/);
});

test('color controls preview live and commit only through apply',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js');
  assert.match(html,/id="cancelImageColor"/);
  assert.match(html,/调整只在“处理后”实时预览/);
  assert.match(app,/previewColorAdjustment/);
  assert.match(app,/imageContrast'\)\.oninput[^\n]*previewColorAdjustment/);
  assert.match(app,/imageSaturation'\)\.oninput[^\n]*previewColorAdjustment/);
  assert.match(app,/imageGrayscaleAction'\)\.onchange=previewColorAdjustment/);
  assert.match(app,/cancelImageColor'\)\.onclick=.*restoreColorPreview/);
  assert.match(app,/applyImageColor'\)\.onclick=.*planOperations\.push/);
});

test('watermark and color panels start collapsed with symmetric apply and cancel actions',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),css=read('src/ui/refactor.css');
  assert.match(html,/id="watermarkToolSection" class="image-tool-section"><summary>水印/);
  assert.match(html,/id="colorToolSection" class="image-tool-section"><summary>调色/);
  assert.match(html,/id="cancelImageEffect"[^>]*>取消</);
  assert.match(html,/id="applyImageWatermark"[^>]*>应用</);
  assert.match(app,/cancelImageEffect'\)\.onclick=.*watermarkToolSection'\)\.open=false/);
  assert.match(app,/applyImageWatermark'\)\.onclick=.*watermarkToolSection'\)\.open=false/);
  assert.match(css,/\.image-color-option i\{[^}]*border-radius:999px/);
  assert.match(css,/image-color-option input:checked\+i/);
});

test('collapsed file panes retain the file label and extension glyph rail',()=>{
  const html=read('src/ui/index.html');
  const css=read('src/ui/refactor.css');
  assert.match(html,/file-pane-label">文件/);
  assert.match(css,/\.files-collapsed \.file-type-icon\{display:grid/);
  assert.match(css,/files-collapsed[^}]*explorer-list/);
});
