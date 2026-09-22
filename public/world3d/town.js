'use strict';
// 学习任务界面；3D渲染按需加载，退出时释放资源。
globalThis.ThinkingTown=(()=>{
  const names=['巧算面包坊','规律音乐屋','推理侦探社','空间积木馆','枚举植物园','生活杂货铺'];
  const people=['面包师米米','乐手多多','侦探阿布','建筑师方方','园丁芽芽','店长圆圆'];
  const signs=['＋','♫','？','▧','♧','◎'];
  const x=[1,6,11,1,6,11],y=[1,1,1,7,7,7];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cleanup=()=>{};
  function action(task,label){if(!task)return '';return `<button ${task.kind==='continue'?'data-action="continue"':task.kind==='review'?'data-action="review-due"':`data-start="${escape(task.courseId)}"`}>${escape(label||task.title)} →</button>`;}
  function planHTML(data){return `<section class="card journey-plan"><div class="row"><div><span class="pill">下一步，已经帮你想好</span><h2>我的探索路线</h2></div><a class="button outline mini" href="#world">回小镇接任务 →</a></div><p>${escape(data.note)}</p><p class="note">每个方向仅一道摸底题，只是起点观察；印章表示完成探索，不等于已经掌握。</p><ol class="journey-list">${data.tasks.map((t,i)=>`<li><span class="journey-number">${i+1}</span><div><h3>${escape(t.title)}</h3><p>${escape(t.reason)}</p></div>${action(t,'开始这次练习')}</li>`).join('')}</ol>${data.exhausted?'<div class="hint"><strong>当前发布的新题已探索完！</strong><p>可以复习旧题、向家长讲解方法，也可以继续营地挑战；数学课堂里还有更多知识等你探索。</p></div>':''}${data.pendingCount&&!data.dueCount?'<p class="note">今天需要巩固的题会在明天进入隔天复习。现在可以休息，或选择一节新课。</p>':''}</section>`;}
  function arrival(data,nickname='小小探索家'){
    const progress=data.diagnosticProgress||{completed:0,total:6};
    return `<section class="town-arrival" aria-label="进入小镇前的出发准备"><div class="arrival-copy"><span class="arrival-step">第一站 · 出发准备</span><h1>${escape(nickname)}，<br>先认识你的思考方式。</h1><p>小镇的朋友正在等你。出发前，先用 ${progress.total} 道小问题，发现你习惯怎样观察、推理和解决问题。</p><p class="arrival-kind">这里不比速度，也不要求全对。遇到困难，可以画一画、想一想，再看看提示。</p><div class="arrival-progress"><span>已探索 ${progress.completed} / ${progress.total} 个方向</span><progress aria-label="起点摸底进度" max="${progress.total}" value="${progress.completed}"></progress></div><button data-start="diagnostic">${progress.completed?'继续起点摸底':'开始起点摸底'} →</button><small>完成后，就能领取探索护照，走进思维小镇。</small></div><div class="arrival-passport"><span class="passport-star" aria-hidden="true">✦</span><span class="arrival-step">思维加油站</span><h2>我的探索护照</h2><p>每一个想法，都值得被发现。</p><div class="passport-stamps">${['数感','规律','推理','空间','枚举','建模'].map((name,i)=>`<span><b aria-hidden="true">${['＋','♫','?','◇','♧','◎'][i]}</b>${name}</span>`).join('')}</div><div class="passport-route">认识自己 <span>→</span> 进入小镇 <span>→</span> 和朋友一起探索</div></div></section>`;
  }
  function stageBanner(data){const first=data.campaign?.first;if(!first)return '';return `<section class="town-quest"><span>第一关</span><div><strong>好奇心小镇 · 已答对 ${first.correct} / ${first.total} 题</strong><p>每一道题都答对后，出发去星光探险营。可以重做，看解析不算答对。</p></div>${first.unlocked?'<a class="button" href="#expedition">进入第二关 →</a>':'<button data-start="stage-one-retry">补齐未通关题 →</button>'}</section>`;}
  function html(data,nickname){if(!data.diagnosticDone&&!data.adventure)return arrival(data,nickname);return `${ThinkingAdventure.overview(data.adventure)}<section class="world3d-shell" aria-label="三维思维小镇"><div class="world3d-toolbar"><strong>✦ 思维加油站 · 好奇心广场</strong><div><button type="button" class="outline mini" data-camera-out aria-label="拉远视角">－</button><button type="button" class="outline mini" data-camera-in aria-label="拉近视角">＋</button><button type="button" class="outline mini" data-camera-reset>重置视角</button><button type="button" class="outline mini" data-camera-full aria-pressed="false">沉浸模式</button></div></div><div id="town-viewport" tabindex="0" role="group" aria-label="3D小镇，方向键或WASD走动，拖动旋转镜头，Enter交谈"><div id="town-loading" role="status"><strong>正在打开立体小镇……</strong><p>正在加载场景、角色与动画，请稍等。</p></div><div class="world3d-label" id="town-nearby" hidden>欢迎来到思维加油站</div></div><div class="world3d-controls"><div id="town-joystick" aria-label="触屏移动摇杆"><span></span></div><div><p id="town-position" role="status">准备进入3D小镇。</p><small>方向键 / 摇杆移动 · R 跑步 · 空格跳跃 · C 坐凳子</small></div><button type="button" data-talk disabled>与附近人物交谈</button></div></section><div class="town-destinations" aria-label="小镇地点">${names.map((name,i)=>`<button type="button" class="outline mini" data-place="${i}" disabled>前往${name}</button>`).join('')}</div><section id="town-dialogue" class="card town-dialogue" aria-label="朋友的任务" hidden></section><details class="world-more"><summary>探索路线与通关进度</summary>${stageBanner(data)}${planHTML(data)}</details>`;}
  function mount(root,data){
    cleanup();if(!data.diagnosticDone&&!data.adventure)return;let abandoned=false,stop=()=>{};
    const dialogue=root.querySelector('#town-dialogue');
    function speak(i){dialogue.hidden=false;root.querySelector('.world3d-shell').append(dialogue);if(data.adventure&&!data.adventure.done){dialogue.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>关闭对话</button><span class="pill">${people[i]}</span><h2>${i===0?'救援队的口粮，需要你的帮助':'我们正在等待救援口粮'}</h2><p>${i===0?'暴风雨打乱了订单。请陪我完成四项准备：整理订单、分批装箱、安排配送、核对库存。每完成一项，就离出发更近一步！':'请先去面包坊帮助米米完成口粮委托。完成后，他会告诉你下一站的线索。'}</p>${i===0?'<button data-start="story-bakery">接受 / 继续米米的委托 →</button>':'<button data-place="0">前往面包坊 →</button>'}`;return;}const area=data.areas[i];dialogue.innerHTML=`<button type="button" class="outline mini dialogue-close" data-close-dialogue>关闭对话</button><span class="pill">${people[i]} · ${names[i]}</span>${i===1&&data.adventure?.done?'<p class="story-locked">多多：米米已经把口粮准备好了？太棒了！这张纸条上的图案反复出现，先和我一起练习观察规律，我们再读懂营地的信号。</p>':''}<h2>${['把数字搭配好，计算也会变轻松！','仔细听、仔细看，规律就藏在重复里。','一个线索一个线索地检查，你能找到理由。','动手画一画，换个角度看世界。','按顺序找，就不容易漏掉可能性。','用数学帮生活里的小伙伴解决问题。'][i]}</h2><p>这里已留下 ${area.explored} 道探索足迹，收集 ${area.stamps} 枚课程印章。</p>${!data.diagnosticDone?'<p class="note">摸底可以稍后继续，现在也可以探索这位朋友的专属课程。</p>':''}<div class="town-lessons">${area.lessons.map(c=>`<article><h3>${escape(c.title)}</h3><p>${c.fresh?'还有 '+c.fresh+' 道未探索题':'✦ 已收集本课探索印章'} · 全课 ${c.count} 题</p><button data-start="${escape(c.id)}" class="${c.fresh?'':'outline'}">${c.fresh?'接受任务':'再练一次'} →</button></article>`).join('')||'<p>这位朋友正在准备新课程，请去其他店铺看看。</p>'}</div>${area.due?`<p>这个方向有 ${area.due} 道题值得隔天再想一次。</p><button data-action="review-due" class="outline">开始隔天复习 →</button>`:''}<p class="note">接受任务会进入你选中的课程，其他任务进度自动保留。回来选择同一课程可继续上次进度。</p>`;}
    import('/world3d/town3d.js?v=20260922-seats').then(module=>{if(!abandoned)stop=module.mountWorld(root,data,speak);}).catch(()=>{if(!abandoned){const box=root.querySelector('#town-loading');if(box)box.innerHTML='<strong>3D组件未能加载</strong><p>请刷新页面重试，或从下方学习路线继续练习。</p>';}});
    cleanup=()=>{abandoned=true;stop();};
  }
  return {html,planHTML,mount,dispose:()=>cleanup()};
})();

// 面包坊情景工作台：只呈现题目条件和孩子的操作，不内置标准答案。
globalThis.ThinkingBakery=(()=>{
 const tasks={
  q1:{title:'野餐队的四张订单',story:'米米：四支野餐队分别订了199、298、301、202个面包。请两两放进两个配送篮，让两篮总数相同，再算出一共要烤多少个。',kind:'pair',values:[199,298,301,202],bins:2},
  q7:{title:'重新整理烘焙盒',story:'米米：每盒装25个面包，今天要送出16盒。请把小盒整理成几批，想想怎样计算全部面包的数量。',kind:'bundle',count:16,unit:25,choices:[2,4,8]},
  q8:{title:'二十站爱心配送',story:'米米：第1站送1个面包，第2站送2个，一直到第20站送20个。试着把配送站两两搭配，算出今天一共要准备多少个。',kind:'pair',values:Array.from({length:20},(_,i)=>i+1),bins:10},
  q9:{title:'补上最后一盒',story:'米米：仓库里有99盒面包，每盒37个，柜台上还有37个散装面包。请先整理货物，再计算一共有多少个。',kind:'stock',base:99,extra:1,unit:37},
  v1:{title:'下午茶订单来了',story:'米米：四桌客人分别订了48、97、52、3个面包。请每篮放两张订单，让两篮总数相同，再计算总数量。',kind:'pair',values:[48,97,52,3],bins:2},
  v2:{title:'庆典运输车',story:'米米：庆典需要24盒迷你面包，每盒125个。请把盒子分成便于计算的几批，填写这趟车运送的总数量。',kind:'bundle',count:24,unit:125,choices:[3,4,6,8]},
  v3:{title:'双份配送日',story:'米米：今天依次给15站送2、4、6……30个面包。把站点配对试试；如果留下一个站点，也别漏掉它。总共需要多少个？',kind:'pair',values:Array.from({length:15},(_,i)=>(i+1)*2),bins:8},
  v4:{title:'多来了一盒',story:'米米：今天收到101盒面包，每盒24个。请把整批货物拆成便于计算的两部分，算清总数量再签收。',kind:'stock',base:100,extra:1,unit:24}
 };
 const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const questionKeys={"qd3a27ba665a426345b156e06":"q1","qd9540f19d96dd0c5c2eb6f0b":"q7","q32007ba6b1171b4ed1147598":"q8","q5e61e73482e064a4a1c70f9f":"q9","qa616c49d8d72372050a343fa":"v1","q5928ee416b07ae33aa0332b4":"v2","qaad1e4befe4729e2ad143fc2":"v3","qcef471269ba23cde4d067be5":"v4"};
 function task(p){const t=p&&p.run.courseId!=='diagnostic'&&tasks[questionKeys[p.run.question?.id]];if(!t||!p.run.storyStep)return t;return {...t,story:t.story.replace('野餐队','救援小队').replace('野餐','救援').replace('庆典','救援行动').replace('四桌客人','四支救援小队'),title:p.run.storyStep.title};}
 function state(p){const key=p.run.id+':'+p.run.index;if(p.bakery?.key!==key)p.bakery={key,selected:null,places:{},size:0,arranged:false,message:'',...(p.run.bakery||{}),key};return p.bakery;}
 function canExtend(t,s){
  if(t.kind!=='pair'||t.values.length<8)return false;
  const groups=Array.from({length:t.bins},()=>[]);t.values.forEach((v,i)=>{if(s.places[i]!==undefined)groups[s.places[i]].push(v);});
  const pairs=groups.filter(g=>g.length===2),sum=t.values[0]+t.values.at(-1);
  return pairs.length>=2&&pairs.every(g=>g[0]+g[1]===sum)&&Object.keys(s.places).length<t.values.length;
 }
 function board(p){const t=task(p),s=state(p);if(!t)return '';const disabled=p.run.result||p.readonly?'disabled':'';
  const button=(label,action,value,selected=false)=>`<button type="button" class="bakery-piece ${selected?'chosen':''}" data-bakery="${action}" data-value="${value}" ${disabled} aria-pressed="${selected}">${label}</button>`;
  let work='';
  if(t.kind==='pair'){
   const tile=i=>button(`🥖 <b>${t.values[i]}</b><small>订单 ${i+1}</small>`,'select',i,s.selected===i);
   work=`<p class="bakery-guide">点订单取出，再点配送篮放入；每篮最多两张。</p><div class="bakery-shelf" aria-label="待分配订单">${t.values.map((_,i)=>s.places[i]===undefined?tile(i):'').join('')||'<span>已全部放入，可点选换篮。</span>'}</div><div class="bakery-baskets">${Array.from({length:t.bins},(_,b)=>{const ids=t.values.map((_,i)=>i).filter(i=>s.places[i]===b);return `<div class="bakery-basket"><button type="button" class="outline mini" data-bakery="place" data-value="${b}" ${disabled}>放入配送篮 ${b+1}</button><div>${ids.map(tile).join('')||'<span class="muted">等你安排</span>'}</div><small>${ids.length?ids.map(i=>t.values[i]).join(' ＋ ')+' ＝ ？':'可以放两张订单'}</small></div>`;}).join('')}</div>`;
  }else if(t.kind==='bundle'){
   work=`<p class="bakery-guide">① 选择每批几盒，比较哪种分组更好算。</p><div class="actions">${t.choices.map(n=>button(n+'盒一批','bundle',n,s.size===n)).join('')}</div><div class="bakery-baskets">${Array.from({length:s.size?t.count/s.size:1},(_,i)=>`<div class="bakery-basket"><strong>${s.size?'第 '+(i+1)+' 批':'未分组的货物'}</strong><div class="bakery-boxes">${Array.from({length:s.size||t.count},()=>`<span aria-label="一盒${t.unit}个">📦<small>${t.unit}个</small></span>`).join('')}</div></div>`).join('')}</div><p>${s.size?`${t.unit} × ${t.count} ＝（${t.unit} × ${s.size}）× □。数一数有几批，再填写下面的观察。`:'分组只改变摆法，总数量不变。'}</p>`;
  }else{
   const original=t.base===99?'99盒＋37个散装':'101盒';
   work=`<div class="bakery-stock"><span>📦<strong>${s.arranged?(t.base===99?'100盒':'100盒 ＋ 1盒'):original}</strong><small>每盒 ${t.unit} 个</small></span><span class="bakery-van" aria-hidden="true">🚚</span></div><div class="actions">${button(t.base===99?'把37个散装装成一盒，再合批':'把101盒拆成100盒和1盒','stock',1,s.arranged)}</div><p>${s.arranged?'货物已重新整理，面包总数没有改变。请你计算这张订单的总数量。':'先整理货物，观察整理前后哪些数量变了，哪些没有变。'}</p>`;
  }
  const retry=p.run.result&&!p.run.result.correct&&!p.readonly?`<button type="button" data-game-action="retry">${p.run.result.revealed?'换一道同类题':'修改方案，再试一次'}</button>`:'';
  return `<section class="bakery-workbench" aria-label="面包坊操作台"><div class="row"><strong>① 动手试一试</strong>${retry||`<button type="button" class="outline mini" data-bakery="reset" ${disabled}>重新摆放</button>`}</div>${work}${t.kind==='pair'?`<p class="math-bridge">${t.values.length===4?'每篮数量 × 篮数 = 总数':t.values.length%2?'每对数量 × 对数 ＋ 单独一站 = 总数':'每对数量 × 对数 = 总数'}</p>`:t.kind==='stock'?`<p class="math-bridge">${t.base===99?'每盒数量 ×（原来盒数 ＋ 新装盒数）':'每盒数量 × 整批盒数 ＋ 每盒数量 × 剩余盒数'} = 总数</p>`:''}${canExtend(t,s)&&!p.run.result&&!p.readonly?'<button type="button" class="outline" data-bakery="extend">按我找到的规律补齐</button>':''}<p class="bakery-message" role="status">${safe(s.message)}</p></section>`;
 }
 function learning(p){
  const lesson=p.run.lesson;if(!lesson)return '';const s=state(p),work=s.work||{},locked=p.run.result||p.readonly?'disabled':'';
  return `<fieldset class="bakery-observation"><legend>② 说清你的发现</legend><div class="observation-fields">${[...lesson.labels,...(lesson.extra?[lesson.extra]:[])].map((label,i)=>`<label>${safe(label)}<input type="text" inputmode="numeric" data-work="${['first','second','extra'][i]}" maxlength="12" value="${safe(work[['first','second','extra'][i]]||'')}" ${locked} autocomplete="off"></label>`).join('')}</div></fieldset>`;

 }
 function act(p,action,value){const t=task(p);if(!t||p.readonly||p.paused||p.conflict||p.run.result)return false;const s=state(p),n=Number(value);
  // 孩子先亲手发现两组配对，再复用自己的规律，减少机械点击。
  if(action==='extend'&&canExtend(t,s)){
   const remaining=t.values.map((_,i)=>i).filter(i=>s.places[i]===undefined);
   const occupied=new Set(Object.values(s.places));
   // 零散摆放先撤回，完整的配对保持原样。
   for(const b of occupied){const ids=Object.keys(s.places).filter(k=>s.places[k]===b);if(ids.length===1){delete s.places[ids[0]];remaining.push(Number(ids[0]));}}
   remaining.sort((a,b)=>t.values[a]-t.values[b]);
   for(let b=0;b<t.bins&&remaining.length;b++){if(Object.values(s.places).includes(b))continue;s.places[remaining.shift()]=b;if(remaining.length)s.places[remaining.pop()]=b;}
   s.selected=null;s.message='已按照你发现的配对规律补齐。请核对每一组，再自己计算总数量。';return true;
  }
  if(action==='reset'){p.bakery=null;if(p.run.storyStep)p.run.bakery=null;state(p);return true;}
  if(action==='select'&&t.kind==='pair'&&Number.isInteger(n)&&n>=0&&n<t.values.length){delete s.places[n];s.selected=n;s.message=`已选中订单 ${n+1}：${t.values[n]} 个。请选择配送篮。`;return true;}
  if(action==='place'&&t.kind==='pair'&&Number.isInteger(n)&&n>=0&&n<t.bins){if(s.selected===null){s.message='先点选一张订单，再选配送篮。';return true;}if(Object.entries(s.places).filter(([id,b])=>b===n&&Number(id)!==s.selected).length>=2){s.message='这个篮子已有两张订单，可以换一个篮子。';return true;}s.places[s.selected]=n;s.selected=null;s.message='已放好。想换搭配，可以再次点选这张订单。';return true;}
  if(action==='bundle'&&t.kind==='bundle'&&t.choices.includes(n)){if(s.size!==n)s.work={};s.size=n;s.message='看看每批盒数与总批数怎样变化。';return true;}
  if(action==='stock'&&t.kind==='stock'){s.arranged=true;s.message='整理好了！想一想怎样利用整批数量计算。';return true;}return false;
 }
 function feedback(p){if(!task(p)||!p.run.result)return '';return p.run.result.correct&&!p.run.result.revealed?'<div class="bakery-delivered" role="status"><span>🚚 🥖</span><strong>订单核对成功，面包出发啦！</strong><p>米米：谢谢你！再说说，你的摆法为什么更好算？</p></div>':'<div class="hint">米米：先停下来核对条件。看看下面的方法，下次再独立试试。</div>';}
 return {task,board,learning,act,feedback};
})();
