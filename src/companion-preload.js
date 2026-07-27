'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
  openMain:()=>ipcRenderer.send('companion-open-main'),
  startDrag:point=>ipcRenderer.send('companion-drag-start',point),
  moveDrag:point=>ipcRenderer.send('companion-drag-move',point),
  stopDrag:()=>ipcRenderer.send('companion-drag-stop'),
  onMotion:callback=>ipcRenderer.on('companion-motion',(_event,payload)=>callback(payload))
});
