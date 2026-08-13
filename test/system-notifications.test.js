'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {showSystemNotification}=require('../src/system-notifications');

test('reports unsupported desktop notifications',()=>{
  let failure='';
  const result=showSystemNotification({Notification:{isSupported:()=>false},item:{name:'a.docx'},available:'属性编辑',onFailure:error=>failure=error});
  assert.equal(result,null);
  assert.match(failure,/不支持/);
});

test('registers failed listener before showing a notification',()=>{
  let failure='',opened=false,released=false,instance;
  class FakeNotification extends EventEmitter{
    static isSupported(){return true;}
    constructor(options){super();this.options=options;instance=this;}
    show(){this.emit('failed',{},new Error('unsigned application'));}
  }
  const result=showSystemNotification({
    Notification:FakeNotification,
    item:{name:'a.docx',path:'/tmp/a.docx'},
    available:'属性编辑',
    onOpen:()=>opened=true,
    onFailure:error=>failure=error,
    onRelease:()=>released=true
  });
  assert.equal(result,instance);
  assert.equal(opened,false);
  assert.equal(released,true);
  assert.equal(failure,'unsigned application');
});

test('opens the application when the notification is clicked',()=>{
  let opened='';
  class FakeNotification extends EventEmitter{
    static isSupported(){return true;}
    constructor(){super();}
    show(){}
  }
  const item={name:'b.xlsx',path:'/tmp/b.xlsx'};
  const notice=showSystemNotification({Notification:FakeNotification,item,available:'文件脱敏',onOpen:value=>opened=value.path});
  notice.emit('click');
  assert.equal(opened,item.path);
});
