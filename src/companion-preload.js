'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
  openMain:()=>ipcRenderer.send('companion-open-main'),
  startDrag:()=>ipcRenderer.send('companion-drag-start'),
  stopDrag:()=>ipcRenderer.send('companion-drag-stop'),
  onMotion:callback=>ipcRenderer.on('companion-motion',(_event,payload)=>callback(payload))
});
