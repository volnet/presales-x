'use strict';

function showSystemNotification({Notification,item,available,icon,onOpen=()=>{},onFailure=()=>{},onRelease=()=>{}}){
  if(!Notification||typeof Notification.isSupported!=='function'||!Notification.isSupported()){
    onFailure('当前系统不支持桌面通知');
    return null;
  }
  let notice;
  try{
    notice=new Notification({
      id:`presalesx-monitor-${String(item.path||item.name||Date.now()).toLowerCase()}`,
      groupId:'presalesx-folder-monitor',
      title:'PreSalesX',
      subtitle:item.name,
      body:`发现新文件：${item.name}\n可用操作：${available}`,
      icon,
      silent:true
    });
    let released=false;
    const release=()=>{if(released)return;released=true;onRelease(notice);};
    notice.once('click',()=>{release();onOpen(item);});
    notice.once('close',release);
    notice.once('failed',(_event,error)=>{
      release();
      const detail=error?.message||String(error||'系统未接受通知');
      onFailure(detail,item);
    });
    notice.show();
    return notice;
  }catch(error){
    if(notice)onRelease(notice);
    onFailure(error?.message||String(error),item);
    return null;
  }
}

module.exports={showSystemNotification};
