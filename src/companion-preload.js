'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
  openMain:()=>ipcRenderer.send('companion-open-main'),
  onMotion:callback=>ipcRenderer.on('companion-motion',(_event,payload)=>callback(payload))
});
