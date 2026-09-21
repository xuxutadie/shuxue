'use strict';
// 原创短旋律使用浏览器合成，不加载第三方音源；只在用户操作后启动。
const GameAudio=(()=>{
 let context=null,timer=null,active=false,answering=false,recording=false,beat=0,music=true,effects=true,musicBus,effectBus;
 const voices=new Set(),storageKey='math-world-sound-v1';
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){music=saved.music!==false;effects=saved.effects!==false;}}catch{}
 const melodies=[
  [72,76,79,0,81,79,76,0,74,76,79,76,72,0,67,0],
  [69,72,76,0,79,76,72,0,71,74,76,74,69,0,64,0],
  [65,69,72,0,76,74,72,0,69,72,74,72,69,0,65,0],
  [67,71,74,0,79,77,74,0,76,74,71,69,67,0,0,0]
 ];
 const roots=[48,45,41,43],frequency=n=>440*Math.pow(2,(n-69)/12);
 function tone(note,start,duration,volume,bus,wave='sine'){
  if(!context||context.state!=='running'||document.hidden)return;
  const osc=context.createOscillator(),gain=context.createGain();osc.type=wave;osc.frequency.value=frequency(note);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain);gain.connect(bus);voices.add(osc);
  osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.03);
 }
 function clear(){if(timer!==null){clearInterval(timer);timer=null;}for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 function step(){
  if(!context||!active||document.hidden||!music)return;
  const phrase=Math.floor(beat/16)%melodies.length,index=beat%16,note=melodies[phrase][index],now=context.currentTime+.02;
  if(note){tone(note,now,.85,.055,musicBus);tone(note+12,now,.35,.008,musicBus,'triangle');}
  if(index%4===0){tone(roots[phrase],now,1.7,.025,musicBus,'triangle');tone(roots[phrase]+7,now,1.6,.012,musicBus);}
  beat=(beat+1)%64;
 }
 function schedule(){if(timer!==null)clearInterval(timer);timer=null;if(active&&music&&!document.hidden&&context?.state==='running'){step();timer=setInterval(step,420);}}
 function update(){
  for(const b of document.querySelectorAll('[data-sound-action]')){
   const kind=b.dataset.soundAction,on=kind==='music'?music:effects;
   b.textContent=(kind==='music'?'♫ 音乐':'♪ 音效')+'：'+(on?(active?'开':'点击开启'):'关');b.setAttribute('aria-pressed',String(on&&active));
  }
 }
 async function unlock(){
  if(!music&&!effects)return;
  try{
   if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('浏览器不支持声音');context=new Audio();musicBus=context.createGain();effectBus=context.createGain();musicBus.gain.value=recording?0:answering?.32:.7;effectBus.gain.value=.55;musicBus.connect(context.destination);effectBus.connect(context.destination);}
   if(context.state!=='running')await context.resume();
   const wasActive=active;active=context.state==='running';if(!wasActive)schedule();update();
  }catch{active=false;for(const b of document.querySelectorAll('[data-sound-action]'))b.textContent='点击重试声音';}
 }
 function result(correct,win=false){
  if(!effects||!active||!context||document.hidden)return;
  const notes=win?[72,76,79,84,88]:correct?[72,76,79,84]:[67,64,60];
  notes.forEach((n,i)=>tone(n,context.currentTime+i*(correct?.11:.16),.5,correct?.12:.085,effectBus));
 }
 function mode(value){answering=value;if(musicBus)musicBus.gain.setTargetAtTime(recording?0:value?.32:.7,context.currentTime,.15);}
 function dictating(value){recording=value;mode(answering);}
 function controls(){return '<div class="game-sounds" aria-label="游戏声音"><button type="button" class="outline mini" data-sound-action="music">♫ 开启音乐</button><button type="button" class="outline mini" data-sound-action="effects">♪ 开启音效</button></div>';}
 async function toggle(kind){
  const enabled=kind==='music'?music:effects;
  // 尚未解锁时，“点击开启”先解锁，不会反向关闭。
  if(!active&&enabled){await unlock();return;}
  if(kind==='music')music=!music;else effects=!effects;
  try{localStorage.setItem(storageKey,JSON.stringify({music,effects}));}catch{}
  clear();if(music||effects)await unlock();schedule();update();
 }
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-sound-action]'))void unlock();},{capture:true});
 document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.target.closest('[data-sound-action]'))void unlock();},{capture:true});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-sound-action]');if(b)void toggle(b.dataset.soundAction);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else schedule();});
 window.addEventListener('pagehide',()=>{active=false;clear();void context?.suspend();});
 window.addEventListener('pageshow',()=>update());
 return {controls,update,unlock,result,mode,dictating};
})();
