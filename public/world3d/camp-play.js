'use strict';
// 所有操作都提供原生按钮，触屏和键盘都可使用；不依赖拖拽精度。
const ThinkingCampPlay=(()=>{
 const weights=[7,7,7,7,7,4,4,4,4],boards=[5,4,3,2,2];
 const titles=['铺好山谷吊桥','把物资装上车','让三灯同时亮','谁能打开观测站','给温室量出六升水','规划星光路线'];
 const rules=['用最多3块桥板恰好连通10米河岸，每块只能用一次。点击材料铺上，再点击可取回。','每车最多18千克。先选择车辆，再点击物资装入；点击已装物资可卸下。三辆车要运走所有物资。','调节三盏灯的周期：0秒同时亮后，首次重新同时亮必须在24秒，周期总和不能超过20。','甲说“乙拿钥匙”，乙说“丙拿钥匙”，丙说“乙没拿”。恰好两句是真话，选人并逐句标记。','只有8升和5升两个无刻度水桶。通过装满、倒空或互倒，在8升桶中留下6升。互倒会倒至对方满或自己空。','从左下角出发，只能向东或向北，到达右上角。避开封路点，必须经过补给点。'];
 function mount(box,index,submit){
 let state={pieces:[],trucks:Array(9).fill(-1),periods:[4,4,4],key:'甲',truth:[false,false,false],steps:[]},selected=0,busy=false,disposed=false,feedback='',tick=0,attemptId=null,lastPayload=null;
 let started=performance.now();
 const button=(attr,label,active=false)=>`<button type="button" class="play-control ${active?'selected':''}" ${attr}>${label}</button>`;
 function water(){let a=0,b=0;for(const s of state.steps){if(s==='fillA')a=8;if(s==='fillB')b=5;if(s==='emptyA')a=0;if(s==='emptyB')b=0;if(s==='AB'){const n=Math.min(a,5-b);a-=n;b+=n;}if(s==='BA'){const n=Math.min(b,8-a);a+=n;b-=n;}}return [a,b];}
 function content(){
 if(index===0){const sum=state.pieces.reduce((s,i)=>s+boards[i],0);return `<div class="bridge-bank"><span>此岸</span><div class="bridge-span">${Array.from({length:10},(_,i)=>`<span class="${i<sum?'covered':''}">${i+1}</span>`).join('')}</div><span>彼岸</span></div><p>已铺 ${sum} 米 / 10 米 · 已用 ${state.pieces.length} 块 / 最多3块</p><div class="play-controls">${boards.map((n,i)=>button(`data-piece="${i}"`,`${state.pieces.includes(i)?'取回':'铺上'} ${n}米板（${i+1}）`,state.pieces.includes(i))).join('')}</div>`;}
 if(index===1){const loads=[0,0,0];state.trucks.forEach((v,i)=>{if(v>=0)loads[v]+=weights[i];});return `<div class="truck-row">${loads.map((n,i)=>button(`data-truck="${i}"`,`车辆${i+1} · ${n}/18千克${n>18?' · 超重':''}`,selected===i)).join('')}</div><div class="cargo-grid">${weights.map((w,i)=>button(`data-cargo="${i}"`,`${w}千克 · ${state.trucks[i]<0?'待装':state.trucks[i]+1+'号车'}`,state.trucks[i]>=0)).join('')}</div>`;}
 if(index===2)return `<div class="signal-row">${state.periods.map((n,i)=>`<label><span class="signal-light" data-light="${i}">●</span>${['红灯','蓝灯','绿灯'][i]}<select data-period="${i}" aria-label="${['红灯','蓝灯','绿灯'][i]}周期">${[4,6,8,12].map(v=>`<option ${v===n?'selected':''} value="${v}">${v}秒</option>`).join('')}</select></label>`).join('')}</div><p>周期总和 ${state.periods.reduce((s,n)=>s+n,0)} / 最多20 · <span id="signal-clock">第0秒</span></p><p class="note">灯光每半秒演示一秒，可观察一轮再验证。</p>`;
 if(index===3)return `<p>假设钥匙在谁手中？</p><div class="play-controls">${['甲','乙','丙'].map(v=>button(`data-key="${v}"`,v,state.key===v)).join('')}</div><p>在这个假设下，逐句判断：</p><div class="clue-list">${['甲：乙拿钥匙','乙：丙拿钥匙','丙：乙没拿'].map((v,i)=>button(`data-truth="${i}"`,`${v} · ${state.truth[i]?'真':'假'}`,state.truth[i])).join('')}</div>`;
 if(index===4){const [a,b]=water();return `<div class="water-row"><div><meter min="0" max="8" value="${a}" aria-label="8升桶水量"></meter><strong>8升桶：${a}升</strong></div><div><meter min="0" max="5" value="${b}" aria-label="5升桶水量"></meter><strong>5升桶：${b}升</strong></div></div><div class="play-controls">${[['fillA','装满8升桶'],['fillB','装满5升桶'],['AB','8升桶 → 5升桶'],['BA','5升桶 → 8升桶'],['emptyA','倒空8升桶'],['emptyB','倒空5升桶']].map(([v,l])=>button(`data-water="${v}"`,l)).join('')}</div><p>已操作 ${state.steps.length} / 最多40步</p>`;}
 let x=0,y=0;const visited=new Set(['0,0']);state.steps.forEach(s=>{s==='E'?x++:y++;visited.add(x+','+y);});return `<div class="route-grid">${[3,2,1,0].flatMap(y=>[0,1,2,3].map(x=>`<div class="route-cell ${visited.has(x+','+y)?'visited':''}">${x===1&&y===1?'× 封路':x===2&&y===1?'◆ 补给':x===3&&y===3?'★ 核心':x===0&&y===0?'出发':'·'}</div>`)).join('')}</div><div class="play-controls">${button('data-step="E"','向东 →')}${button('data-step="N"','向北 ↑')}</div><p>路线：${state.steps.map(s=>s==='E'?'东':'北').join(' → ')||'还没有出发'} · ${x},${y}</p>`;
 }
 function render(){if(disposed)return;box.innerHTML=`<button type="button" class="outline mini dialogue-close" data-close-dialogue>关闭操作台</button><span class="pill">动手修复 · 第${index+1}站</span><h2>${titles[index]}</h2><p>${rules[index]}</p>${content()}<p class="play-feedback" role="status">${feedback||'先试一试，你可以随时调整方案。'}</p><div class="play-controls">${button('data-test-game','验证我的方案')}${button('data-undo','撤回一步')}${button('data-reset-game','重新设计')}</div>`;box.querySelectorAll('button,select').forEach(b=>b.disabled=busy);}
 let history=[];
 async function click(e){const b=e.target.closest('button');if(!b||busy)return;
 if(b.hasAttribute('data-test-game')){busy=true;render();const config=structuredClone(state),payload=JSON.stringify(config);if(payload!==lastPayload){attemptId=crypto.randomUUID();lastPayload=payload;}try{const result=await submit(index,config,(performance.now()-started)/1000,attemptId);feedback=result.feedback;started=performance.now();if(result.correct){disposed=true;return;}}catch{feedback='这次未能保存，请检查连接后再验证。你的方案仍在这里。';}finally{busy=false;render();}return;}
 if(b.hasAttribute('data-undo')){if(history.length)state=history.pop();feedback='已撤回，可以继续调整。';render();return;}
 if(b.hasAttribute('data-reset-game')){history.push(structuredClone(state));state={pieces:[],trucks:Array(9).fill(-1),periods:[4,4,4],key:'甲',truth:[false,false,false],steps:[]};tick=0;feedback='重新开始设计。';render();return;}
 if(b.dataset.truck!==undefined){selected=Number(b.dataset.truck);render();return;}
 if(!['piece','cargo','key','truth','water','step'].some(k=>b.dataset[k]!==undefined))return;
 history.push(structuredClone(state));if(history.length>60)history.shift();feedback='';
 if(b.dataset.piece!==undefined){const i=Number(b.dataset.piece);state.pieces=state.pieces.includes(i)?state.pieces.filter(x=>x!==i):[...state.pieces,i];}
 if(b.dataset.cargo!==undefined){const i=Number(b.dataset.cargo);state.trucks[i]=state.trucks[i]===selected?-1:selected;}
 if(b.dataset.key)state.key=b.dataset.key;
 if(b.dataset.truth!==undefined){const i=Number(b.dataset.truth);state.truth[i]=!state.truth[i];}
 if(b.dataset.water){if(state.steps.length<40)state.steps.push(b.dataset.water);else feedback='步骤已达40次，可以撤回或重新设计。';}
 if(b.dataset.step){if(state.steps.length<6)state.steps.push(b.dataset.step);else feedback='已经走了6步，撤回调整路线吧。';}
 render();
 }
 function change(e){if(e.target.dataset.period===undefined||busy)return;history.push(structuredClone(state));state.periods[Number(e.target.dataset.period)]=Number(e.target.value);tick=0;render();}
 box.addEventListener('click',click);box.addEventListener('change',change);render();
 const timer=setInterval(()=>{if(disposed||index!==2||document.hidden)return;tick=(tick+1)%25;box.querySelectorAll('[data-light]').forEach(el=>el.classList.toggle('lit',tick%state.periods[Number(el.dataset.light)]===0));const clock=box.querySelector('#signal-clock');if(clock)clock.textContent='第'+tick+'秒';},500);
 return ()=>{disposed=true;clearInterval(timer);box.removeEventListener('click',click);box.removeEventListener('change',change);};
 }
 return {mount};
})();
