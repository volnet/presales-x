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
let state='entrance',transitionTimer,idleTimer,bubbleTimer,clickTimer;

function say(text,duration=2800){
  clearTimeout(bubbleTimer);
  bubble.classList.remove('visible');
  if(!text)return;
  bubble.textContent=text;
  requestAnimationFrame(()=>bubble.classList.add('visible'));
  bubbleTimer=setTimeout(()=>bubble.classList.remove('visible'),duration);
}
function scheduleSleep(delay=18000){
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>setState('sleep'),delay);
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

if(window.companion.platform!=='win32'){
  interact.addEventListener('click',()=>{clearTimeout(clickTimer);clickTimer=setTimeout(()=>react('activity','我在，随时可以帮忙。'),220);});
  interact.addEventListener('dblclick',event=>{event.preventDefault();clearTimeout(clickTimer);setState('dash','马上就来！');setTimeout(()=>window.companion.openMain(),620);});
}
window.companion.onMotion(payload=>react(payload.name,payload.message));
setState('entrance');
