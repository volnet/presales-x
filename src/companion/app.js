'use strict';

const stage=document.querySelector('#stage');
const interact=document.querySelector('#petInteract');
const bubble=document.querySelector('#bubble');
document.body.dataset.platform=window.companion.platform;
const transitions={
  entrance:{next:'welcome',after:1400},
  welcome:{next:'idle',after:3300},
  wake:{next:'greet',after:720},
  greet:{next:'idle',after:1500},
  think:{next:'thinking',after:460},
  insight:{next:'idle',after:1900},
  dash:{next:'idle',after:760}
};
let state='entrance',transitionTimer,idleTimer,bubbleTimer,bubbleHideTimer,clickTimer,pointerGesture,lastTap=null;

function hideBubble(){
  clearTimeout(bubbleHideTimer);
  bubble.classList.remove('visible');
  bubble.classList.add('leaving');
  bubbleHideTimer=setTimeout(()=>{bubble.hidden=true;bubble.classList.remove('leaving');},160);
}

function say(text,duration=2800){
  clearTimeout(bubbleTimer);
  clearTimeout(bubbleHideTimer);
  if(!text){hideBubble();return;}
  bubble.textContent=text;
  bubble.hidden=false;
  bubble.classList.remove('leaving','visible');
  requestAnimationFrame(()=>bubble.classList.add('visible'));
  bubbleTimer=setTimeout(hideBubble,duration);
}
function scheduleSleep(delay=18000){
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{setState('sleep');window.companion.ensureInteractive();},delay);
}
function setState(next,message=''){
  clearTimeout(transitionTimer);
  clearTimeout(idleTimer);
  state=next;
  stage.dataset.state=next;
  if(message)say(message);
  if(next==='welcome')say('嗨，我是你的售前伙伴。准备好一起开始了吗？',3600);
  if(next==='greet'&&!message)say('我醒啦，需要我一起看看吗？',2400);
  if(next==='insight'&&!message)say('有思路了！',2200);
  const transition=transitions[next];
  if(transition)transitionTimer=setTimeout(()=>setState(transition.next),transition.after);
  else if(next==='idle')scheduleSleep();
}
function react(kind,message=''){
  if(kind==='activity'){
    if(state==='sleep'||state==='sleeping')setState('wake',message);
    else setState('greet',message);
    return;
  }
  if(kind==='think')setState(state==='sleep'?'wake':'think',message);
  else if(kind==='insight')setState('insight',message);
  else if(kind==='dash')setState('dash',message);
}

interact.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary)return;
  event.preventDefault();
  if(pointerGesture)window.companion.dragEnd();
  pointerGesture={id:event.pointerId,startX:event.screenX,startY:event.screenY,moved:false};
  try{interact.setPointerCapture(event.pointerId);}catch{}
  window.companion.dragStart({x:event.screenX,y:event.screenY});
});
interact.addEventListener('pointermove',event=>{
  if(!pointerGesture||pointerGesture.id!==event.pointerId)return;
  if(event.buttons===0){cancelPointer(event.pointerId);return;}
  const distance=Math.hypot(event.screenX-pointerGesture.startX,event.screenY-pointerGesture.startY);
  if(distance>4)pointerGesture.moved=true;
  if(pointerGesture.moved)window.companion.dragMove({x:event.screenX,y:event.screenY});
});
function finishPointer(event){
  if(!pointerGesture||pointerGesture.id!==event.pointerId)return;
  const gesture=pointerGesture;
  pointerGesture=null;
  try{if(interact.hasPointerCapture(event.pointerId))interact.releasePointerCapture(event.pointerId);}catch{}
  window.companion.dragEnd();
  if(gesture.moved){lastTap=null;clearTimeout(clickTimer);return;}
  const now=Date.now(),isDouble=lastTap&&now-lastTap.time<460&&Math.hypot(event.screenX-lastTap.x,event.screenY-lastTap.y)<18;
  if(isDouble){lastTap=null;clearTimeout(clickTimer);setState('dash','马上就来！');window.companion.openMain();}
  else{lastTap={time:now,x:event.screenX,y:event.screenY};clearTimeout(clickTimer);clickTimer=setTimeout(()=>{lastTap=null;react('activity','我在，随时可以帮忙。');},470);}
}
function cancelPointer(pointerId){
  if(!pointerGesture||(pointerId!==undefined&&pointerGesture.id!==pointerId))return;
  const activeId=pointerGesture.id;
  pointerGesture=null;
  lastTap=null;
  clearTimeout(clickTimer);
  try{if(interact.hasPointerCapture(activeId))interact.releasePointerCapture(activeId);}catch{}
  window.companion.dragEnd();
}
document.addEventListener('pointerup',finishPointer,true);
document.addEventListener('pointercancel',event=>cancelPointer(event.pointerId),true);
interact.addEventListener('lostpointercapture',event=>{if(window.companion.platform!=='win32')cancelPointer(event.pointerId);});
window.addEventListener('blur',()=>{if(window.companion.platform!=='win32')cancelPointer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelPointer();});
window.addEventListener('pageshow',()=>window.companion.ensureInteractive());
setInterval(()=>window.companion.ensureInteractive(),5000);
window.companion.onMotion(payload=>react(payload.name,payload.message));
setState('entrance');
