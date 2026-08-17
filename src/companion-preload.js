'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
  platform:process.platform,
  openMain:()=>ipcRenderer.send('companion-open-main'),
  dragStart:point=>ipcRenderer.send('companion-drag-start',point),
  dragMove:point=>ipcRenderer.send('companion-drag-move',point),
  dragEnd:()=>ipcRenderer.send('companion-drag-end'),
  ensureInteractive:()=>ipcRenderer.send('companion-ensure-interactive'),
  onMotion:callback=>ipcRenderer.on('companion-motion',(_event,payload)=>callback(payload))
});
