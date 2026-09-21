'use strict';
// 答题卡只替换自己的内容；底下的 Three.js 场景和角色位置保持不变。
const QuestionCard=(()=>{
 let dialog=null,opener=null;
 function render(root,html,options={}){
  const existing=dialog?.isConnected,scroll=existing?dialog.querySelector('.question-card-body').scrollTop:0;
  if(!existing){opener=document.activeElement;dialog=document.createElement('dialog');dialog.className='question-card';dialog.setAttribute('aria-label','游戏任务答题卡');root.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();options.onClose?.();});}
  dialog.innerHTML=`<header class="question-card-header"><strong>✦ 当前任务</strong>${GameAudio.controls()}<button type="button" class="outline mini" data-game-action="close-card" aria-label="保存并收起答题卡">收起 ×</button></header><div class="question-card-status" role="status"></div><div class="question-card-body">${html}</div>`;
  document.body.classList.add('answering');
  if(!dialog.open){window.scrollTo(0,0);dialog.showModal();}
  const body=dialog.querySelector('.question-card-body');body.scrollTop=options.preserveScroll?scroll:0;
  GameAudio.mode(true);GameAudio.update();
  if(options.feedback){const feedback=body.querySelector('.story-feedback,.feedback');if(feedback)body.scrollTop+=feedback.getBoundingClientRect().top-body.getBoundingClientRect().top-12;}
  // 操作台重排时把焦点还给对应按钮，键盘与触屏都可持续操作。
  if(options.focus){const buttons=[...dialog.querySelectorAll('[data-bakery]')];buttons.find(b=>b.dataset.bakery===options.focus.action&&b.dataset.value===options.focus.value)?.focus({preventScroll:true});}
 }
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}document.body.classList.remove('answering');GameAudio.mode(false);if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;}
 return {render,close};
})();
