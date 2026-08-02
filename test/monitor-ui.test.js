'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('monitor settings replace the new-workspace entry and expose quick actions',()=>{
  const html=read('src/ui/index.html'),app=read('src/ui/app.js'),main=read('src/main.js'),preload=read('src/preload.js'),css=read('src/ui/monitor.css');
  assert.match(html,/id="monitorSettingsEntry"/);
  assert.match(html,/id="settingsWorkspace"/);
  assert.match(css,/#newWorkspace\{display:none!important\}/);
  assert.match(app,/monitorActionLabel/);
  assert.match(app,/action==='compare'/);
  assert.match(app,/\$\('#run'\)\.click\(\)/);
  assert.match(main,/FolderMonitor/);
  assert.match(main,/companionMotion\('insight'/);
  assert.match(preload,/monitorApi/);
  assert.match(preload,/watch-file-detected/);
});

test('folder alerts integrate with native Windows and macOS notifications',()=>{
  const main=read('src/main.js'),preload=read('src/preload.js'),app=read('src/ui/app.js');
  assert.match(main,/new Notification/);
  assert.match(main,/setAppUserModelId/);
  assert.match(main,/watch-notification-open/);
  assert.match(preload,/monitorNotificationApi/);
  assert.match(app,/systemNotificationChoice/);
  assert.match(app,/monitorNotificationApi\.onOpen/);
  assert.match(main,/activeNotifications\.add\(notice\)/);
  assert.match(main,/notice\.on\('click',\(\)=>\{release\(\);showMain\(\)/);
});

test('closing the main window keeps PreSalesX alive in the system tray',()=>{
  const main=read('src/main.js');
  assert.match(main,/\bTray\b/);
  assert.match(main,/new Tray\(/);
  assert.match(main,/win\.on\('close',event=>\{if\(quitting\|\|process\.env\.PRESALESX_SMOKE==='1'\)return;event\.preventDefault\(\);win\.hide\(\);\}\)/);
  assert.match(main,/tray\.on\('double-click',showMain\)/);
  assert.match(main,/label:'退出 PreSalesX',click:quitApplication/);
  assert.match(main,/function quitApplication\(\)\{quitting=true;/);
  assert.match(main,/requestSingleInstanceLock\(\)/);
  assert.match(main,/app\.on\('second-instance',showMain\)/);
});

test('clicking a system notification restores the existing alert without duplicating it',()=>{
  const app=read('src/ui/app.js');
  assert.match(app,/monitorNotificationApi\.onOpen\(item=>\{setStatus/);
  assert.doesNotMatch(app,/monitorNotificationApi\.onOpen\(item=>\{showMonitorToast/);
});
