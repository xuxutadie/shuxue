'use strict';
// 把浏览器识别接到当前思路框；最终文字通过原有草稿流程保存。
const GameDictation=(()=>{
 let speech=null,target=null,waiters=[];
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 function controls(locked){
  if(locked)return '';
  if(!Recognition||!window.isSecureContext)return '<p class="voice-privacy">当前浏览器无法提供语音识别。可点文字框使用设备自带的语音输入；Windows 可按 Win + H。</p>';
  return '<div class="voice-tools"><button type="button" class="outline mini" data-voice-action aria-pressed="false">🎙 语音输入</button></div><p id="voice-status" class="voice-status" role="status" aria-live="polite"></p><small class="voice-privacy">普通话 · 识别后可修改。语音由浏览器处理，可能联网；本站只保存文字。</small>';
 }
 function notify(state){
  GameAudio.dictating(state.active);
  const status=document.getElementById('voice-status'),button=document.querySelector('[data-voice-action]');
  if(status)status.textContent=state.message;
  if(button){button.textContent=state.stopping?'正在结束…':state.active?'■ 结束说话':'🎙 语音输入';button.disabled=!!state.stopping;button.setAttribute('aria-pressed',String(state.active));}
  if(!state.active){const pending=waiters;waiters=[];pending.forEach(resolve=>resolve());}
 }
 function toggle(){
  if(speech?.active){speech.stop();return;}
  const note=document.getElementById('note');if(!note||note.disabled)return;
  cancel();target=note;
  speech=createThinkingSpeech({Recognition,
   read:()=>target?.value||'',
   write:value=>{
    // 旧题目关闭后的回调绝不能写入下一道题。
    if(!target?.isConnected||target.disabled||document.getElementById('note')!==target)return;
    target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));
   },notify});
  speech.start();
 }
 function finish(){
  if(!speech?.active)return Promise.resolve();
  return new Promise(resolve=>{waiters.push(resolve);speech.stop();});
 }
 function cancel(){speech?.cancel();speech=null;target=null;GameAudio.dictating(false);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 document.addEventListener('toggle',event=>{if(event.target.matches?.('.optional-note')&&!event.target.open)void finish();},true);
 window.addEventListener('pagehide',cancel);
 return {controls,toggle,finish,cancel,get active(){return !!speech?.active;}};
})();
