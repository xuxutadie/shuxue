'use strict';
// 题面来自服务端；本地仅演示操作，通关和星光只接受服务端验证结果。
const ThinkingObservatory=(()=>{
 let cleanup=()=>{};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const colors={黄:'#ffd34f',蓝:'#67cee9',粉:'#f99bb7'};
 function html(world,demo=false){const o=world.observatory;
  if(!o?.unlocked)return `<section class="card"><span class="pill">第三张地图 · 云海天文城</span><h1>远方传来了微弱的求救信号</h1><p>先完成星光探险营的六站修复，飞艇就能出发。目前已修复 ${world.campaign.missions.filter(m=>m.repaired).length} / 6 站。</p><a class="button" href="#expedition">回营地继续修复</a></section>`;
  return `<section class="world3d-shell sky-shell" aria-label="云海天文城"><div class="world3d-toolbar"><strong data-sky-progress>☀ 云海天文城 · ${o.completed}/18</strong><div><button class="outline mini" data-sky-current disabled data-place="${o.active<0?5:Math.floor(o.active/3)}">前往当前任务</button><button class="outline mini" data-camera-out aria-label="拉远视角">－</button><button class="outline mini" data-camera-in aria-label="拉近视角">＋</button><button class="outline mini" data-camera-reset>重置视角</button><button class="outline mini" data-camera-full>沉浸模式</button></div></div><div id="town-viewport" tabindex="0" role="group" aria-label="云海天文城，方向键移动，Enter检查设施"><div id="town-loading" role="status">正在乘飞艇抵达天文城……</div><div class="world3d-label" id="town-nearby" hidden></div></div><div class="world3d-controls"><div id="town-joystick" aria-label="触屏移动摇杆"><span></span></div><div><p id="town-position" role="status">${demo?'教师独立试玩 · 可以提前体验本地图':'营地恢复信号，天文城等待你的帮助'}</p><small>WASD 移动 · R 跑步 · 空格跳跃 · Enter 交谈</small></div><button data-talk disabled>检查附近设施</button></div><section id="town-dialogue" class="card town-dialogue sky-dialogue" hidden></section></section>`;
 }
 function mount(root,world,options={}){
  cleanup();if(!world.observatory?.unlocked)return;
  let disposed=false,celebrationTimer,stop=()=>{},stopTask=()=>{};const box=root.querySelector('#town-dialogue');
  const missions=()=>world.observatory.stations;
  const update=()=>{const o=world.observatory;root.querySelector('[data-sky-progress]').textContent=`☀ 云海天文城 · ${o.completed}/18 · ✦ ${world.playground.balance}`;const b=root.querySelector('[data-sky-current]');b.dataset.place=o.active<0?5:Math.floor(o.active/3);b.textContent=o.complete?'回访天文塔':`前往${o.stations[Math.floor(o.active/3)].title}`;};
  const speak=i=>{
   clearTimeout(celebrationTimer);stopTask();const o=world.observatory,m=o.stations[i];box.hidden=false;box.classList.add('is-playing');
   if(!m.unlocked){box.innerHTML=`<button class="outline mini" data-close-dialogue>关闭</button><h2>${esc(m.title)}</h2><p>这里还没有供能。先完成当前站，再来修复。</p>`;return;}
   if(m.repaired){box.innerHTML=`<button class="outline mini" data-close-dialogue>回到地图</button><span class="pill">设施已修复</span><h2>${esc(m.title)}</h2><p>${o.complete?'云海星图已重新点亮，谢谢你！':'这里已经恢复运行，下一站在等你。'}</p><details><summary>回看三项任务与尝试次数</summary>${o.stages.filter(q=>q.station===i).map(q=>`<p>${esc(q.text)}<br>完成 · 共尝试 ${q.count} 次</p>`).join('')}</details>`;return;}
   const q=o.stages[o.active];if(q.station!==i)return;
   stopTask=task(box,q,o,{...options,openSkyCurrent:()=>speak(Math.floor(world.observatory.active/3))},async out=>{
    if(disposed)return;world.observatory=out.state.world.observatory;world.ecoport=out.state.world.ecoport;world.playground=out.state.world.playground;update();
    if(out.stationComplete)celebrationTimer=setTimeout(()=>{if(disposed)return;stopTask();box.hidden=true;GameCompletion.show(root,{title:out.complete?'云海天文城 · 星图重新点亮':m.title+' · 修复成功',total:out.complete?18:3,story:false});},1400);
   },()=>{box.hidden=true;root.querySelector('#town-viewport').focus();});
  };
  function click(e){if(e.target.closest('[data-close-dialogue],[data-sky-next]'))clearTimeout(celebrationTimer);if(e.target.closest('[data-close-dialogue]'))stopTask();}
  root.addEventListener('click',click);
  Promise.all([import('./town3d.js?v=20261015-ecoport'),import('./observatory-model.mjs')]).then(([town,model])=>{
   if(disposed)return;
   stop=town.mountWorld(root,{...world,areas:[],sceneConfig:{camp:true,sky:true,getEcoport:()=>world.ecoport,names:missions().map(m=>m.title),getMissions:missions,createScene:()=>model.createObservatory(()=>world.observatory)}},speak,options);update();
  }).catch(()=>{if(!disposed)root.querySelector('#town-loading').textContent='天文城加载失败，请刷新重试。';});
  cleanup=()=>{disposed=true;clearTimeout(celebrationTimer);stopTask();stop();root.removeEventListener('click',click);};
 }
 function task(box,q,progress,options,onState,onClose){
  const d=q.data;const blank=()=>({removed:0,groups:1,unit:0,colors:['','',''],time:0,turns:d.mirrors?.map(()=>-1)||[],person:-1,truth:d.claims?.map(()=>false)||[],paths:Array.from({length:d.routes||1},()=>[])});
  let state=blank(),history=[],selectedPath=0,busy=false,disposed=false,feedback='',success=null,attempt=null,submitted='',started=performance.now(),hint=false;
  const b=(attrs,text,selected=false)=>`<button type="button" class="outline sky-choice ${selected?'selected':''}" ${attrs}>${text}</button>`;
  const number=(key,label,min,max)=>`<label class="sky-number">${label}<input type="number" min="${min}" max="${max}" step="1" data-number="${key}" value="${state[key]}" aria-label="${label}"></label>`;
  const svg=(content,label)=>`<svg class="sky-board" viewBox="0 0 600 250" role="img" aria-label="${label}">${content}</svg>`;
  function board(){
   if(q.kind==='balance'){
    const leftFixed=d.fixed-state.removed,right=d.total-state.removed;
    return svg(`<path d="M300 90v115m-40 0h80M80 90h440" stroke="#635585" stroke-width="8" fill="none"/><path d="M160 90v45m280-45v45" stroke="#635585" stroke-width="3"/><rect x="55" y="130" width="210" height="60" rx="18" fill="#b5e8e9"/><rect x="335" y="130" width="210" height="60" rx="18" fill="#ffe399"/><text x="160" y="157">${d.capsules}罐 + ${leftFixed}千克</text><text x="440" y="157">${right}千克</text><text x="300" y="35">两侧同步移走配重 → 平均分组</text><text x="300" y="237">分成 ${state.groups} 组 · 每组：${Number((d.capsules/Math.max(1,state.groups)).toFixed(2))}罐 + ${Number((leftFixed/Math.max(1,state.groups)).toFixed(2))}千克 = ${Number((right/Math.max(1,state.groups)).toFixed(2))}千克</text>`,'天平两侧剩余重量与分组演示')+`<div class="sky-inputs">${number('removed','两侧同时移走（千克）',0,d.fixed)}${number('groups','平均分成几组',1,d.capsules)}${number('unit','每罐配重（千克）',0,d.total)}</div>`;
   }
   if(q.kind==='pattern')return `<div class="sky-lights" aria-label="已知灯光顺序">${[...d.pattern,...d.pattern].map((c,i)=>`<span style="--lamp:${colors[c]}">${i+1}<b>${c}</b></span>`).join('')}</div><p>点击待修星灯切换颜色：</p><div class="sky-inputs">${state.colors.map((c,i)=>b(`data-color="${i}"`,`第${d.start+i}盏：${c||'未设置'}`,!!c)).join('')}</div>`;
   if(q.kind==='gear')return svg(d.periods.map((period,i)=>{const cx=300+(i-(d.periods.length-1)/2)*170,angle=state.time/period*360;return `<g transform="translate(${cx} 103)"><circle r="60" fill="${state.time%period===0?'#ffe078':'#d8cbf7'}" stroke="#66558d" stroke-width="6"/><g transform="rotate(${angle})"><path d="M0 0V-53M-48 0H48M0 48V-48" stroke="#8570b3" stroke-width="8"/><circle cy="-46" r="9" fill="#ff806e"/></g><circle r="13" fill="#fff9ef"/></g><text x="${cx}" y="196">每${period}秒一圈</text>`;}).join('')+`<text x="300" y="235">第 ${state.time} 秒 · ${state.time>0&&d.periods.every(p=>state.time%p===0)?'标记同时朝上（还要判断是不是第一次）':'继续观察标记'}</text>`,'齿轮标记随时间旋转')+`<div class="sky-inputs">${b('data-time="-1"','退1秒')}${b('data-time="1"','进1秒')}${b('data-time="5"','进5秒')}${number('time','观察时间（秒）',0,d.max)}</div>`;
   if(q.kind==='mirror'){
    const path=lightPath(d,state.turns),points=path.map(([x,y])=>`${80+x*80},${30+y*45}`).join(' ');
    return svg(`<rect x="38" y="6" width="485" height="229" rx="20" fill="#def3e4"/><polyline points="${points}" fill="none" stroke="#ffb525" stroke-width="7" stroke-linejoin="round"/><text x="80" y="83">☀</text><text x="${80+d.goal[0]*80}" y="${38+d.goal[1]*45}">★</text>${d.mirrors.map(([x,y],i)=>`<g transform="translate(${80+x*80} ${30+y*45})"><circle r="19" fill="#a9e1f4"/><path d="M-14 ${state.turns[i]===1?-14:14}L14 ${state.turns[i]===1?14:-14}" stroke="#61588c" stroke-width="6"/><text y="-24">镜${i+1}</text></g>`).join('')}`,'光线在镜面之间的实际路径')+`<div class="sky-inputs">${state.turns.map((v,i)=>b(`data-mirror="${i}"`,`旋转镜${i+1}：${v===1?'＼':'／'}`)).join('')}</div>`;
   }
   if(q.kind==='logic')return `<p>假设正确信号来自：</p><div class="sky-inputs">${d.people.map((p,i)=>b(`data-person="${i}"`,esc(p),state.person===i)).join('')}</div><p>在你的假设下，点击切换每条记录的真假：</p><div class="sky-claims">${d.claims.map((a,i)=>b(`data-truth="${i}"`,`记录${i+1}：信号${a.not?'不':''}来自${a.set.map(k=>d.people[k]).join('或')} · ${state.truth[i]?'真':'假'}`,state.truth[i])).join('')}</div>`;
   let x=0,y=0;const points=[[0,0]],steps=state.paths[selectedPath];for(const step of steps){step==='E'?x++:y++;points.push([x,y]);}
   const unit=200/(d.size-1),xy=([x,y])=>[195+x*unit,225-y*unit];
   return (d.routes===2?`<div class="sky-inputs">${b('data-path="0"','路线一',selectedPath===0)}${b('data-path="1"','路线二',selectedPath===1)}</div>`:'')+svg(Array.from({length:d.size},(_,y)=>Array.from({length:d.size},(_,x)=>{const [cx,cy]=xy([x,y]);return `<circle cx="${cx}" cy="${cy}" r="13" fill="#e5dcf8"/><text x="${cx}" y="${cy+5}">${d.blocked.some(p=>p[0]===x&&p[1]===y)?'×':d.via.some(p=>p[0]===x&&p[1]===y)?'◆':x===d.size-1&&y===d.size-1?'★':x===0&&y===0?'起':''}</text>`;}).join('')).join('')+`<polyline points="${points.map(p=>xy(p).join(',')).join(' ')}" fill="none" stroke="#e48847" stroke-width="5" opacity=".7"/><circle cx="${xy([x,y])[0]}" cy="${xy([x,y])[1]}" r="9" fill="#7851cb"/>`,'从起点经过补给点到达星图的路线')+`<div class="sky-inputs">${b('data-step="E"','向东 →')}${b('data-step="N"','向北 ↑')}${b('data-back-step','撤回一步')}</div><p>当前路线：${steps.map(s=>s==='E'?'东':'北').join(' → ')||'尚未出发'}</p>`;
  }
  function render(){if(disposed)return;
   box.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>回到地图</button><span class="pill">${esc(q.topic)} · ${q.level+1}/3 · ✦ ${q.reward}</span><h2>${esc(q.title)}</h2>${q.level===0?`<p class="sky-story">${esc(q.story)}</p>`:''}<p>${esc(q.text)}</p>${board()}<p class="sky-feedback" role="status">${esc(feedback)}</p>${success?`<div class="sky-success" role="status"><b>✦ +${success.reward} 星光</b><p>${success.complete?'星图重新点亮！云海天文城全部修复。':success.stationComplete?'本站修复完成！下一站已经获得能源。':'挑战完成，继续下一项操作。'}</p><button data-sky-next>${success.stationComplete?'回到地图看修复效果':'下一项挑战 →'}</button></div>`:`<div class="sky-inputs">${b('data-sky-test','验证我的方案')}${b('data-sky-undo','撤回操作')}${b('data-sky-reset','重新设计')}${b('data-sky-hint','给一点提示')}</div>${hint?`<p class="sky-hint">${esc(q.hint)}</p>`:''}`}`;
   box.querySelectorAll('button,input').forEach(el=>{if(el.hasAttribute('data-close-dialogue'))el.disabled=busy;if(!el.hasAttribute('data-close-dialogue')&&!el.hasAttribute('data-sky-next'))el.disabled=busy||!!success||options.readonly;});
   if(options.readonly){const p=document.createElement('p');p.textContent='正在查看学生进度。实际操作请使用教师试玩。';box.append(p);}
  }
  const save=()=>{history.push(structuredClone(state));if(history.length>60)history.shift();feedback='';};
  async function click(e){const el=e.target.closest('button');if(!el||busy||disposed)return;
   if(el.hasAttribute('data-sky-next')){const next=success;if(next.stationComplete){onClose();dispose();}else{dispose();options.openSkyCurrent();}return;}
   if(options.readonly||success)return;
   if(el.hasAttribute('data-sky-test')){
    const payload=JSON.stringify(state);if(payload!==submitted){attempt=crypto.randomUUID();submitted=payload;}busy=true;render();
    try{const out=await options.submitSky({stageId:q.id,config:structuredClone(state),revision:progress.revision,seconds:Math.min(86400,(performance.now()-started)/1000),attemptId:attempt});if(disposed)return;progress.revision=out.state.world.observatory.revision;await onState(out);feedback=out.feedback;success=out.correct?out:null;attempt=null;submitted='';}
    catch(error){feedback=error.message||'暂时未能保存，请重试；你的方案仍保留。';}
    finally{busy=false;render();}return;
   }
   if(el.hasAttribute('data-sky-hint')){hint=true;render();return;}
   if(el.hasAttribute('data-sky-undo')){if(history.length)state=history.pop();render();return;}
   if(el.hasAttribute('data-sky-reset')){save();state=blank();render();return;}
   if(el.dataset.path!==undefined){selectedPath=Number(el.dataset.path);render();return;}
   if(!['color','mirror','person','truth','step','time'].some(k=>el.dataset[k]!==undefined)&&!el.hasAttribute('data-back-step'))return;
   save();if(el.dataset.color!==undefined){const i=Number(el.dataset.color);state.colors[i]=d.colors[(d.colors.indexOf(state.colors[i])+1)%d.colors.length];}
   if(el.dataset.mirror!==undefined)state.turns[Number(el.dataset.mirror)]*=-1;
   if(el.dataset.person!==undefined)state.person=Number(el.dataset.person);
   if(el.dataset.truth!==undefined)state.truth[Number(el.dataset.truth)]=!state.truth[Number(el.dataset.truth)];
   if(el.dataset.time!==undefined)state.time=Math.max(0,Math.min(d.max,state.time+Number(el.dataset.time)));
   if(el.dataset.step){const steps=state.paths[selectedPath],n=steps.filter(s=>s===el.dataset.step).length;if(n<d.size-1)steps.push(el.dataset.step);}
   if(el.hasAttribute('data-back-step'))state.paths[selectedPath].pop();render();
  }
  function change(e){
   const key=e.target.dataset.number;if(!key||busy||success||options.readonly)return;
   save();state[key]=Number.isFinite(Number(e.target.value))?Math.floor(Number(e.target.value)):0;
   // 仅更新演示图，避免重建输入框打断连续输入或吞掉鼠标点击。
   const old=box.querySelector('.sky-board');if(old){const template=document.createElement('template');template.innerHTML=board();old.replaceWith(template.content.querySelector('.sky-board'));}
   box.querySelector('.sky-feedback').textContent='';
  }
  function dispose(){disposed=true;box.removeEventListener('click',click);box.removeEventListener('input',change);}
  box.addEventListener('click',click);box.addEventListener('input',change);render();box.scrollTop=0;return dispose;
 }
 function lightPath(d,turns){let x=0,y=1,dx=1,dy=0;const points=[[x,y]],seen=new Set();for(let n=0;n<80;n++){if(x===d.goal[0]&&y===d.goal[1])break;const i=d.mirrors.findIndex(p=>p[0]===x&&p[1]===y);if(i>=0){if(turns[i]===1)[dx,dy]=[dy,dx];else [dx,dy]=[-dy,-dx];}const key=[x,y,dx,dy].join(',');if(seen.has(key))break;seen.add(key);x+=dx;y+=dy;if(x<0||y<0||x>=d.width||y>=d.height)break;points.push([x,y]);}return points;}
 return {html,mount,dispose:()=>cleanup()};
})();
