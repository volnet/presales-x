'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
  openMain:()=>ipcRenderer.send('companion-open-main'),
  quit:()=>ipcRenderer.send('companion-quit'),
  startDrag:()=>ipcRenderer.send('companion-drag-start'),
  stopDrag:()=>ipcRenderer.send('companion-drag-stop'),
  onEmotion:callback=>ipcRenderer.on('companion-emotion',(_event,payload)=>callback(payload))
});
