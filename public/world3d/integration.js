'use strict';
// 与数学主站共用登录 Cookie；不读取或复制原项目的账号、密钥和家庭数据库。
const app=document.getElementById('app');
const params=new URLSearchParams(location.search);
let gameUser,csrf='',owner='',data,practice=null,route='',busy=false,serial=0,saveQueue=Promise.resolve(),dirty=false,paused=false,seconds=0,lastTick=Date.now(),lastSave=Date.now();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(text){const box=document.querySelector('.question-card-status')||document.getElementById('toast');box.textContent=text;box.classList.add('show');setTimeout(()=>{box.classList.remove('show');box.textContent='';},5000);}
async function request(path='',body){
 const response=await fetch('/api/world3d/'+encodeURIComponent(owner)+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok){const e=new Error(result.error||'连接失败，请稍后重试。');e.status=response.status;throw e;}return result;
}
function accept(out){data=out;if(out.run){practice={run:out.run,readonly:out.readonly,answer:out.run.draft,note:out.run.note};seconds=out.run.seconds;}else practice=null;lastTick=Date.now();}
function clock(){const n=Math.round(seconds);return `${Math.floor(n/60)}分${n%60}秒`;}
function capture(){if(!practice||practice.run.result)return;const answer=document.getElementById('answer'),note=document.getElementById('note');if(answer){practice.answer=answer.value;practice.note=note?.value||'';if(practice.run.storyStep){practice.bakery??=structuredClone(practice.run.bakery||{});practice.bakery.work??={};document.querySelectorAll('[data-work]').forEach(input=>practice.bakery.work[input.dataset.work]=input.value);}}}
function fields(){capture();return {runId:practice.run.id,revision:practice.run.version,answer:practice.answer??practice.run.draft,note:practice.note??practice.run.note,seconds,...(practice.run.storyStep?{bakery:structuredClone(practice.bakery||practice.run.bakery||{})}:{})};}
function syncText(text){const el=document.getElementById('sync');if(el)el.textContent=text;}
async function loadLatest(preserveDraft=false){
 // 等待正在进行的保存结束，但不能让失败的旧请求阻止读取最新进度。
 await saveQueue.catch(()=>{});
 capture();
 const previous=practice,local=previous?{answer:previous.answer,note:previous.note,bakery:structuredClone(previous.bakery||previous.run.bakery||{}),seconds}:null;
 const out=await request();
 const keep=preserveDraft&&local&&!out.readonly&&!previous.run.result&&!out.run?.result&&out.run?.id===previous.run.id&&out.run?.index===previous.run.index&&out.run?.question.id===previous.run.question.id;
 accept(out);saveQueue=Promise.resolve();dirty=false;paused=false;
 if(keep){
  // 只在同一道未提交题目上保留输入；已提交或已前进时以服务器记录为准。
  Object.assign(practice,{answer:local.answer,note:local.note,bakery:local.bakery});
  Object.assign(practice.run,{draft:local.answer,note:local.note,...(practice.run.storyStep?{bakery:local.bakery}:{})});
  seconds=Math.max(seconds,local.seconds);dirty=true;
 }
 paint();return keep;
}
function saveDraft(){
 if(route!=='practice'||!practice||practice.run.result||data.readonly||(!dirty&&seconds===practice.run.seconds))return saveQueue;
 // 串行保存，避免自动保存与提交同时携带旧版本号。
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  if(!practice||practice.run.result)return;
  const p=practice,payload=fields();syncText('正在保存…');
  try{const out=await request('/run',{...payload,action:'draft'});if(practice!==p)return;data=out;p.run=out.run;dirty=p.answer!==payload.answer||p.note!==payload.note||!!p.run.storyStep&&JSON.stringify(p.bakery||{})!==JSON.stringify(payload.bakery||{});syncText(dirty?'还有新修改，等待保存':'进度已保存');}
  catch(e){dirty=true;paused=true;syncText(e.message+' 输入仍保留在页面中。');throw e;}
 });return saveQueue;
}
function practiceHTML(){
 if(!practice)return '<section class="card"><h1>这一段探索已结束</h1><p>返回小镇领取新任务，或查看游戏足迹。</p><a class="button" href="#world">返回小镇</a></section>';
 const r=practice.run,q=r.question,t=r.storyStep?ThinkingBakery.task(practice):null;practice.answer=r.draft;practice.note=r.note;
 const locked=r.result||data.readonly?'disabled':'';
 const heading=t?r.storyStep?.title||t.title:q.title;
 const statement=t?t.story:q.text;
 return `<section class="card game-practice"><div class="row"><span class="pill">${r.index+1} / ${r.total}${r.lesson?' · '+esc(r.lesson.topic):''}</span>${r.storyStep?`<small>本关 ✦ ${r.storyStep.reward}</small>`:''}</div><h1>${esc(heading)}</h1>${r.optional&&!r.result?.correct&&!data.readonly?'<button class="outline mini" data-game-action="next">结束选做，继续主线 →</button>':''}<p class="question-text">${esc(statement)}</p>${r.lesson?`<p class="learning-goal">学会：${esc(r.lesson.goal)}</p>`:''}${r.storyStep?ThinkingAdventure.feedback(r,data.readonly):''}${t?(r.result?.correct?'<details><summary>回看我的摆放</summary>'+ThinkingBakery.board(practice)+'</details>':ThinkingBakery.board(practice)):''}${r.result?.correct?'<details><summary>查看我的作答</summary>':''}<form id="game-answer-form">${ThinkingBakery.learning(practice)}<label for="answer">${r.lesson?'③ 一共多少个面包？':'我的答案'}</label><input id="answer" type="text" maxlength="100" autocomplete="off" value="${esc(r.draft)}" ${locked}><details class="optional-note"><summary>记录我的思路（选填）</summary>${GameDictation.controls(locked)}<textarea id="note" aria-label="我的思路" maxlength="1000" ${locked}>${esc(r.note)}</textarea></details>${!r.result&&!data.readonly?'<div class="actions"><button type="submit">验证我的方案</button><button type="button" class="outline" data-game-action="hint">给一点提示</button></div>':''}${q.hints.length?`<details open><summary>提示</summary>${q.hints.map(h=>`<p>${esc(h)}</p>`).join('')}</details>`:''}${!r.result&&!data.readonly?`<details class="world-more"><summary>还是不会？</summary><p>${r.storyStep?'可以先看方法，之后换一道同类题再练。':'看完方法后，再继续下一题。'}</p><button type="button" class="outline mini" data-game-action="reveal">学习本题方法</button></details>`:''}</form>${r.result?.correct?'</details>':''}${!r.storyStep&&r.result?`<div class="feedback"><strong>${r.result.revealed?'先理解方法':r.result.correct?'答对了！':'再看看方法'}</strong><details ${r.result.correct?'':'open'}><summary>查看解法</summary><p>${esc(r.result.answer)}</p><p>${esc(r.result.explanation)}</p></details>${!data.readonly?'<button data-game-action="next">继续 →</button>':''}</div>`:''}<p id="sync" role="status">进度已保存</p><details class="world-more"><summary>进度与计时</summary><p>思考时间：<span id="thinking-time">${clock()}</span></p>${!r.result&&!data.readonly?'<button class="outline mini" data-game-action="pause">暂停 / 继续</button> <button class="outline mini" data-game-action="save">重试保存</button> <button class="outline mini" data-game-action="reload">载入最新进度</button>':''}</details></section>`;

}
function coursesHTML(){return `<h1>小镇与营地的数学任务</h1><p>48 道小镇题＋48 道营地进阶题。起点摸底的6题与小镇题重合，不重复计数。</p><div class="game-tasks">${data.courses.map(c=>`<article class="card"><span class="pill">${c.count} 道题</span><h2>${esc(c.title)}</h2><details><summary>练什么？</summary><p>${esc(c.description)}</p></details><button data-start="${esc(c.id)}" ${!c.unlocked||data.readonly?'disabled':''}>${c.unlocked?'开始 / 继续任务':'完成前置关卡后开放'}</button></article>`).join('')}</div>`;}
function reportHTML(){
 const rows=data.report.questions;
 return ThinkingAdventure.bag(data.world.adventure)+`<h1>${esc(data.name)}的游戏足迹</h1><p>已探索 ${rows.length} 道不同题目；${rows.filter(r=>r.passed).length} 道曾答对。游戏记录不计入课堂测评分数。</p><div class="card game-report"><table><thead><tr><th>题目</th><th>作答次数</th><th>第一次</th><th>通关</th><th>最近作答与思路</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${r.count}</td><td>${r.firstCorrect?r.firstHints?'提示后答对':'独立答对':'待巩固'}</td><td>${r.passed?'✓':'尚未答对'}</td><td><details><summary>展开记录</summary>${r.history.map(a=>`<p>${esc(a.created.slice(0,16).replace('T',' '))} · ${esc(a.answer||'未填写')} · ${a.revealed?'学习解析':a.correct?'答对':'未答对'}<br>思路：${esc(a.note||'未填写')}${a.workLabels?'<br>观察：'+a.workLabels.labels.map((label,i)=>esc(label)+'：'+esc(a.work?.[['first','second'][i]]||'未填')).join('；')+(a.workLabels.extra?'；'+esc(a.workLabels.extra)+'：'+esc(a.work?.extra||'未填'):''):''}</p>`).join('')}</details></td></tr>`).join('')||'<tr><td colspan="5">完成一题后，这里就会留下足迹。</td></tr>'}</tbody></table></div><h2>营地修复记录</h2><div class="game-tasks">${data.report.repairs.map(r=>`<article class="card"><h3>${esc(r.title)}</h3><p>${r.passed?'已修复':'还在尝试'} · 共验证 ${r.count} 次</p><details><summary>查看最近方案</summary>${r.history.map(a=>`<p>${esc(a.description)}<br>${esc(a.feedback)}</p>`).join('')}</details></article>`).join('')||'<p>开始修复营地后显示。</p>'}</div>`;
}
let sceneKind=null;
function dispose(){GameDictation.cancel();QuestionCard.close();GameCompletion.close();ThinkingTown.dispose();ThinkingExpedition.dispose();sceneKind=null;}
function showQuestion(options={}){GameDictation.cancel();QuestionCard.render(app,practiceHTML(),{onClose:()=>void act('close-card'),...options});}
function paint(){
 route=location.hash.slice(1)||'world';
 if(route==='practice'&&practice?.run.courseId.startsWith('camp-')&&!data.world.campaign.first.unlocked){route='expedition';history.replaceState(null,'','#expedition');}
 document.querySelectorAll('.game-nav a').forEach(a=>{if(a.hash==='#'+route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(route==='practice'&&practice){
  const desired=practice.run.courseId.startsWith('camp-')?'camp':'town';
  // 作答和操作台更新只刷新卡片，保留正在运行的场景与镜头。
  if(sceneKind!==desired||!app.querySelector('#town-viewport')){
   dispose();app.innerHTML=desired==='camp'?ThinkingExpedition.html(data.world):ThinkingTown.html(data.world,data.name);
   if(desired==='camp')ThinkingExpedition.mount(app,data.world,{submitGame});else ThinkingTown.mount(app,data.world);
   sceneKind=desired;
  }
  showQuestion({feedback:!!practice.run.result});return;
 }
 dispose();
 if(route==='celebration'&&data.world.adventure.done)app.innerHTML=ThinkingAdventure.celebration(data.world.adventure);
 else if(route==='practice')app.innerHTML=practiceHTML();
 else if(route==='courses')app.innerHTML=coursesHTML();
 else if(route==='report')app.innerHTML=reportHTML();
 else if(route==='expedition'){app.innerHTML=ThinkingExpedition.html(data.world);ThinkingExpedition.mount(app,data.world,{submitGame});sceneKind='camp';}
 else {app.innerHTML=ThinkingTown.html(data.world,data.name);ThinkingTown.mount(app,data.world);sceneKind='town';}
 if(data.readonly){const p=document.createElement('p');p.className='readonly-note';p.textContent='正在查看学生的真实进度；如需操作体验，请返回教师端进入教师试玩。';app.prepend(p);}
 app.focus({preventScroll:true});
 // 新阶段从剧情开头展示；结果则定位到反馈，避免旧页面滚动位置遮住动画。
 requestAnimationFrame(()=>{if(route==='practice'&&practice?.run.result){app.querySelector('.story-feedback')?.scrollIntoView({block:'center'});}else window.scrollTo(0,0);});
}
async function submitGame(mission,config,time,attemptId){
 if(data.readonly)throw Error('当前仅查看学生进度。');
 const ticket=serial,out=await request('/camp',{mission,config,seconds:Math.min(86400,time),attemptId});
 if(ticket===serial){accept(out.state);GameAudio.result(out.correct);if(out.correct){paint();toast(out.feedback);}}
 return out;
}
async function navigate(){
 const ticket=++serial,oldRoute=route;
 try{await GameDictation.finish();await saveDraft();if(ticket!==serial)return;const out=await request();if(ticket!==serial)return;accept(out);paused=false;paint();}
 catch(e){if(ticket!==serial)return;if(dirty){history.replaceState(null,'','#'+oldRoute);toast('保存未完成，已保留当前答案。请重试保存。');}else {dispose();app.innerHTML=`<section class="card game-error"><h1>暂时没能打开游戏</h1><p>${esc(e.message)}</p><button data-game-action="reload">重新连接</button><a href="/#home" target="_top">返回主站</a></section>`;}}
}
async function act(action,courseId){
 if(busy)return;
 if(GameDictation.active){busy=true;try{await GameDictation.finish();}finally{busy=false;}}
 if(action==='close-card'){
  busy=true;try{await saveDraft();location.hash=practice?.run.courseId.startsWith('camp-')?'expedition':'world';}catch(e){toast(e.message);}finally{busy=false;}return;
 }
 if(action==='reload'){
  if(dirty&&!confirm('载入服务器最新进度会替换本页未保存的文字，请先复制保留。继续吗？'))return;
  busy=true;document.body.inert=true;
  try{await loadLatest();toast('已载入最新进度，可以继续。');}catch(e){toast(e.message);}finally{busy=false;document.body.inert=false;}return;
 }
 if(data.readonly){toast('这里只查看学生记录，请进入教师试玩进行体验。');return;}
 busy=true;document.body.inert=true;
 try{
  if(action==='save'){await saveDraft();paused=false;syncText('进度已保存，可以继续。');return;}
  if(action==='pause'){paused=!paused;await saveDraft();syncText(paused?'已暂停，点击“暂停 / 继续”恢复':'正在继续计时');return;}
  await saveDraft();
  if(action==='start'){accept(await request('/start',{courseId}));dirty=false;location.hash='practice';if(route==='practice')paint();return;}
  if(action==='continue'){location.hash='practice';return;}
  if(!practice)return;

  capture();const finishedRun=practice.run,wasStory=!!finishedRun.storyStep;
  let out=await request('/run',{...fields(),action});dirty=false;accept(out);
  // 最后一题提交与结算分开保存。结算失败时展示已保存的结果，允许再次继续。
  try{out=await finishGameRun(action,out,request);}catch(e){paint();throw e;}
  accept(out);
  if(out.completed){
   history.replaceState(null,'',finishedRun.courseId.startsWith('camp-')?'#expedition':'#world');paint();
   document.body.inert=false;
   GameCompletion.show(app,{story:wasStory,title:finishedRun.courseTitle,total:finishedRun.total,adventure:data.world.adventure});
  }else{if(action==='submit'&&out.run?.result)GameAudio.result(out.run.result.correct);paint();}
 }catch(e){
  paused=true;
  if(e.status===409){
   try{
    const kept=await loadLatest(true);
    const message=kept?'进度已同步，你的答案和思路已保留，请再次验证。':'已恢复服务器保存的最新进度，请继续当前题目。';
    toast(message);syncText(message);
   }catch(syncError){toast(syncError.message);syncText('暂时无法同步，当前输入仍保留。请稍后载入最新进度。');}
  }else{toast(e.message);syncText(e.message+' 当前输入仍在页面中。');}
 }
 finally{busy=false;document.body.inert=false;}
}
app.addEventListener('submit',event=>{if(event.target.id==='game-answer-form'){event.preventDefault();void act('submit');}});
app.addEventListener('input',event=>{if(['answer','note'].includes(event.target.id)||event.target.hasAttribute('data-work')){dirty=true;capture();syncText('输入已保留，稍后自动保存');}});
app.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||busy)return;
 if(data?.readonly&&button.hasAttribute('data-play-mission')){event.stopImmediatePropagation();toast('请在教师试玩中操作设施。');return;}
 if(button.hasAttribute('data-voice-action')){if(!data?.readonly)GameDictation.toggle();return;}
 if(button.dataset.start)void act('start',button.dataset.start);
 else if(button.dataset.gameAction)void act(button.dataset.gameAction);
 else if(button.dataset.action==='continue')void act('continue');
 else if(button.dataset.action==='review-due')void act('start','review-due');
 else if(button.dataset.bakery&&practice&&!data.readonly){busy=true;try{await GameDictation.finish();capture();if(ThinkingBakery.act(practice,button.dataset.bakery,button.dataset.value)){if(practice.run.storyStep){dirty=true;practice.run.bakery=practice.bakery;}practice.run={...practice.run,draft:practice.answer,note:practice.note};showQuestion({preserveScroll:true,focus:{action:button.dataset.bakery,value:button.dataset.value}});}}finally{busy=false;}}
},true);
setInterval(()=>{
 const now=Date.now(),elapsed=Math.min(2,(now-lastTick)/1000);lastTick=now;
 if(route!=='practice'||!practice||practice.run.result||data?.readonly)return;
 if(!paused&&!document.hidden){seconds=Math.min(86400,seconds+elapsed);const el=document.getElementById('thinking-time');if(el)el.textContent=clock();}
 if(!busy&&now-lastSave>=10000){lastSave=now;void saveDraft().catch(()=>{});}
},1000);
window.addEventListener('hashchange',()=>void navigate());
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',dispose);
// 返回课堂或切换教师查看入口前，先保存当前答题草稿。
document.addEventListener('click',async event=>{
 const link=event.target.closest('a[data-leave-game]');if(!link)return;
 event.preventDefault();if(busy)return;busy=true;
 try{await GameDictation.finish();await saveDraft();location.assign(link.href);}catch(e){toast('保存未完成，请重试。'+e.message);}finally{busy=false;}
});
(async()=>{
 document.querySelector('.game-header').insertAdjacentHTML('beforeend',GameAudio.controls());GameAudio.update();
 try{
  const response=await fetch('/api/me'),session=await response.json();if(!response.ok)throw Error('请先在数学主站登录。');
  gameUser=session.user;csrf=session.csrf;owner=gameUser.role==='student'?gameUser.id:params.get('student')||'demo';
  if(params.get('student')&&gameUser.role==='student'&&params.get('student')!==gameUser.id)throw Error('不能查看其他学生的游戏档案。');
  document.getElementById('player-name').textContent=gameUser.name;
  if(gameUser.role==='teacher')document.querySelector('.game-header').insertAdjacentHTML('beforeend',owner==='demo'?'<a href="/#world3d/student" data-leave-game>查看所选学生进度</a>':'<a href="/world3d/#world" data-leave-game>返回教师试玩</a>');
  document.getElementById('mode-note').textContent=owner==='demo'?'教师试玩 · 不影响学生记录':'进度随账号保存';
  await navigate();
 }catch(e){app.innerHTML=`<section class="card game-error"><h1>请先登录学习空间</h1><p>${esc(e.message)}</p><a class="button" href="/#home" target="_top">返回主站登录</a></section>`;}
})();
