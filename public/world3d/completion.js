'use strict';
// 复用服务器现有的结算操作，只有最后一题答对才自动前进。
async function finishGameRun(action,out,send){
 const run=out.run;
 if(action!=='submit'||!run?.result?.correct||out.readonly||run.index+1!==run.total)return out;
 return send('/run',{runId:run.id,revision:run.version,action:'next'});
}

const GameCompletion=(()=>{
 let dialog=null,opener=null;
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;}
 function show(root,{story,title,total,adventure}){
  close();opener=root;
  dialog=document.createElement('dialog');dialog.className='game-completion';dialog.setAttribute('aria-labelledby','completion-title');
  const confetti=Array.from({length:36},(_,i)=>`<i style="--x:${(i*29)%100}%;--delay:${i%9*.12}s;--color:${['#ffce44','#ff9274','#ae92f3','#86dcb0','#75cde9'][i%5]};--turn:${i%2?540:-540}deg"></i>`).join('');
  dialog.innerHTML=`<div class="completion-confetti" aria-hidden="true">${confetti}</div><div class="completion-content"><svg class="completion-cup" viewBox="0 0 160 150" aria-hidden="true"><path d="M44 28H20v18q0 32 36 32M116 28h24v18q0 32-36 32" fill="none" stroke="#e59938" stroke-width="10"/><path d="M42 16h76v35q0 44-38 44T42 51z" fill="#ffda4d" stroke="#393248" stroke-width="4"/><path d="m80 32 7 14 16 2-12 12 3 16-14-8-14 8 3-16-12-12 16-2z" fill="#fff8de"/><path d="M80 95v28" stroke="#393248" stroke-width="10"/><rect x="47" y="123" width="66" height="14" rx="6" fill="#ae92f3" stroke="#393248" stroke-width="4"/></svg><h1 id="completion-title">${story?'通关成功！':'本轮挑战完成！'}</h1><p>${safe(title)} · ${total} 道题已完成</p>${story?`<p class="star-reward">当前星光 ✦ ${adventure.points}</p><p>口粮准备齐了！带上信号纸条，去音乐屋找多多。</p>`:'<p>这次探索已保存，继续向下一站出发吧！</p>'}<div class="actions"><button type="button" data-completion-close>${story?'寻找下一位伙伴 →':'继续探索 →'}</button><a href="#report" class="button outline">查看游戏足迹</a></div></div>`;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.querySelector('[data-completion-close]').addEventListener('click',close);
  root.append(dialog);dialog.showModal();dialog.querySelector('button').focus();GameAudio.result(true,true);
 }
 return {show,close};
})();
