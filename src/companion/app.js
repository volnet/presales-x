'use strict';
const names=['welcome','celebrate','focus','encourage','concern','sleepy'],button=document.querySelector('#avatarButton'),avatar=document.querySelector('#avatar');
let current='welcome',timer,dragged=false;
function show(name){if(!names.includes(name))name='welcome';current=name;button.classList.add('changing');setTimeout(()=>{avatar.src=`assets/companion-${name}.png`;button.classList.remove('changing');},120);}
function scheduleMotion(){clearTimeout(timer);timer=setTimeout(()=>{show(names[Math.floor(Math.random()*names.length)]);scheduleMotion();},4000+Math.random()*6000);}
button.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragged=false;button.classList.add('dragging');button.setPointerCapture(event.pointerId);window.companion.startDrag();});
button.addEventListener('pointermove',()=>{if(button.classList.contains('dragging'))dragged=true;});
button.addEventListener('pointerup',event=>{button.releasePointerCapture(event.pointerId);button.classList.remove('dragging');window.companion.stopDrag();});
button.addEventListener('click',()=>{if(!dragged)show(names[(names.indexOf(current)+1)%names.length]);});
button.addEventListener('dblclick',event=>{event.preventDefault();if(!dragged)window.companion.openMain();});
window.addEventListener('blur',()=>{button.classList.remove('dragging');window.companion.stopDrag();});
window.companion.onEmotion(payload=>show(payload.name));
show('welcome');scheduleMotion();
