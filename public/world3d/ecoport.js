'use strict';
// 生态港的操作台只演示玩家方案。是否通关、顺序和星光由服务器验收。
const ThinkingEcoport=(()=>{
 let cleanup=()=>{};
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const clone=value=>structuredClone(value);
 const n=value=>Number.isFinite(value)?value:0;
 const get=(value,path)=>path.split('.').reduce((current,key)=>current?.[key],value);
 function set(value,path,next){const keys=path.split('.'),last=keys.pop();keys.reduce((current,key)=>current[key],value)[last]=next;}
 function initialConfig(q){const d=q.data;
  switch(q.kind){
   case 'bridge':return {pairs:[],area:null};
   case 'mirror':return {moved:clone(d.point),mirror:null,distance:null};
   case 'cubes':return {heights:clone(d.heights),front:[null,null],total:null};
   case 'panels':return {halves:[],area:null};
   case 'beacons':return {moved:clone(d.points[0]),mirrors:[null,null],path:[],distance:null};
   case 'inventory':return {min:[[1,1],[1,1]],max:[[1,1],[1,1]],minTotal:null,maxTotal:null};
   case 'catch':return {slowStart:0,fastStart:0,catchTime:null,meeting:null};
   case 'catch-check':return {slowStart:0,fastStart:0,checkSlow:null,checkFast:null,checkGap:null,catchTime:null,meeting:null};
   case 'catch-bridge':return {slowStart:0,fastStart:0,catchTime:null,meeting:null,beforeBridge:null};
   case 'catch-rest':case 'catch-recover':case 'catch-double':return {phases:d.phases.map(p=>({...p,gap:null})),elapsed:q.kind==='catch-recover'?d.elapsed:null,walking:null,meeting:null};
   case 'pasture':return {growth:d.growth,consumption:null,netChange:null,days:null,remaining:null};
   case 'pasture-records':return {records:d.records.map(p=>({days:p.days,consumed:null})),growth:null,initial:null,cows:d.trialCows,days:null};
   case 'pasture-balance':return {trials:d.cows.map((cows,i)=>({cows,trend:null,days:i===2?null:d.checkDays,remaining:null})),sustainable:null};
   case 'water':return {inflow:d.inflow,outflow:null,netChange:null,minutes:d.minutes,remaining:null};
   case 'water-phases':return {phases:[{inflow:d.inflow,outflow:d.first.outflow,minutes:d.first.minutes,remaining:null},{inflow:d.inflow,outflow:null,minutes:d.secondMinutes,remaining:null}]};
   case 'water-records':return {records:d.records.map(p=>({...p,totalOut:null})),inflow:null,initial:null,outflow:null,minutes:d.trialMinutes,totalOut:null,remaining:null};
   default:throw new Error('未知生态港任务类型');
  }
 }
 // 必须先作出预测才能播放实验；此处只检查填写完整，不包含正确答案。
 function predictionReady(q,config){
  const paths={bridge:['area'],mirror:['distance'],cubes:['front.0','front.1','total'],panels:['area'],beacons:['distance'],inventory:['minTotal','maxTotal'],catch:['catchTime','meeting'],'catch-check':['checkSlow','checkFast','checkGap','catchTime','meeting'],'catch-bridge':['catchTime','meeting','beforeBridge'],pasture:['consumption','netChange','days','remaining'],'pasture-records':['records.0.consumed','records.1.consumed','growth','initial','days'],'pasture-balance':['trials.0.trend','trials.0.remaining','trials.1.trend','trials.1.remaining','trials.2.trend','trials.2.days','trials.2.remaining','sustainable'],water:['outflow','netChange','remaining'],'water-phases':['phases.0.remaining','phases.1.outflow','phases.1.remaining'],'water-records':['records.0.totalOut','records.1.totalOut','inflow','initial','outflow','totalOut','remaining']};
  if(q.kind.startsWith('catch-')&&config.phases)return config.phases.every(p=>p.minutes!==null&&p.gap!==null)&&['elapsed','walking','meeting'].every(k=>config[k]!==null);
  return (paths[q.kind]||[]).every(path=>get(config,path)!==null&&get(config,path)!==undefined);
 }
 function phasePosition(d,config,time){let left=Math.max(0,time),walked=0;for(const phase of config.phases){const duration=Math.min(left,Math.max(0,n(phase.minutes)));if(phase.mode==='walk')walked+=duration;left-=duration;if(left<=0)break;}return {slow:d.slow*(d.lead+time),fast:d.fast*walked};}
 // 只按学生输入计算当前实验状态，绝不倒算相遇时间或耗尽时间。
 function simulate(q,config,fraction=1){const d=q.data,p=Math.max(0,Math.min(1,fraction));
  if(q.kind.startsWith('catch')){
   const horizon=config.phases?config.phases.reduce((sum,phase)=>sum+Math.max(0,n(phase.minutes)),0):Math.max(0,n(config.catchTime));
   const time=horizon*p,positions=config.phases?phasePosition(d,config,time):{slow:d.slow*Math.max(0,time-n(config.slowStart)),fast:d.fast*Math.max(0,time-n(config.fastStart))};return {time,...positions,gap:positions.slow-positions.fast};
  }
  if(q.kind==='pasture')return {time:n(config.days)*p,amount:d.initial+(d.growth-n(config.consumption))*n(config.days)*p};
  if(q.kind==='pasture-records')return {time:n(config.days)*p,amount:n(config.initial)+(n(config.growth)-config.cows*d.perCow)*n(config.days)*p};
  if(q.kind==='pasture-balance')return {trials:config.trials.map(trial=>({cows:trial.cows,time:n(trial.days)*p,amount:d.initial+(d.growth-trial.cows*d.perCow)*n(trial.days)*p}))};
  if(q.kind==='water')return {time:d.minutes*p,amount:d.initial+(d.inflow-n(config.outflow))*d.minutes*p};
  if(q.kind==='water-phases'){const duration=config.phases.reduce((sum,phase)=>sum+phase.minutes,0);let left=duration*p,amount=d.initial;for(const phase of config.phases){const minutes=Math.min(left,phase.minutes);amount+=(phase.inflow-n(phase.outflow))*minutes;left-=minutes;}return {time:duration*p,amount};}
  if(q.kind==='water-records')return {time:d.trialMinutes*p,amount:n(config.initial)+(n(config.inflow)-n(config.outflow))*d.trialMinutes*p};
  return {fraction:p};
 }
 const sumHeights=heights=>heights.flat().reduce((a,b)=>a+b,0);
 const frontView=heights=>[0,1].map(col=>Math.max(heights[0][col],heights[1][col]));
 const sideView=heights=>heights.map(row=>Math.max(...row));
 function html(world,demo=false){const port=world.ecoport;
  if(!port?.unlocked)return `<section class="card"><span class="pill">第四张地图 · 云海生态港</span><h1>星图指向了浓雾里的生态港</h1><p>先修复云海天文城的六处设施，飞艇就能继续航行。已完成 ${n(world.observatory?.completed)} / 18 项任务。</p><a class="button" href="#observatory">返回云海天文城</a></section>`;
  return `<section class="world3d-shell eco-shell" aria-label="云海生态港"><div class="world3d-toolbar"><strong data-eco-progress>☘ 云海生态港 · ${port.completed}/18</strong><div>${demo?`<label class="eco-demo-select">教师选关 <select data-eco-stage aria-label="教师选择试玩关卡"><option value="">选择任务</option>${port.stages.map((q,i)=>`<option value="${esc(q.id)}">${i+1}. ${esc(q.title)}</option>`).join('')}</select></label>`:''}<button class="outline mini" data-eco-current disabled data-place="${Math.max(0,Math.floor(port.active/3))}">前往当前任务</button><button class="outline mini" data-camera-out aria-label="拉远视角">－</button><button class="outline mini" data-camera-in aria-label="拉近视角">＋</button><button class="outline mini" data-camera-reset>重置视角</button><button class="outline mini" data-camera-full>沉浸模式</button></div></div><div id="town-viewport" tabindex="0" role="group" aria-label="云海生态港，方向键移动，Enter检查设施"><div id="town-loading" role="status">正在抵达云海生态港……</div><div class="world3d-label" id="town-nearby" hidden></div></div><div class="world3d-controls"><div id="town-joystick" aria-label="触屏移动摇杆"><span></span></div><div><p id="town-position" role="status">${demo?'教师独立试玩 · 可任选任务':'从星图桥出发，恢复生态港的循环'}</p><small>WASD 移动 · R 跑步 · 空格跳跃 · Enter 交谈</small></div><button data-talk disabled>检查附近设施</button></div><section id="town-dialogue" class="card town-dialogue eco-dialogue" hidden></section></section>`;
 }
 function mount(root,world,options={}){
  cleanup();if(!world.ecoport?.unlocked)return;
  let disposed=false,busyTask=false,celebrationTimer,stop=()=>{},stopTask=()=>{};const box=root.querySelector('#town-dialogue');
  const missions=()=>world.ecoport.stations;
  const update=()=>{const port=world.ecoport;root.querySelector('[data-eco-progress]').textContent=`☘ 云海生态港 · ${port.completed}/18 · ✦ ${world.playground.balance}`;const button=root.querySelector('[data-eco-current]');button.dataset.place=port.active<0?5:Math.floor(port.active/3);button.textContent=port.complete?'回访生态控制塔':`前往${port.stations[Math.floor(port.active/3)].title}`;};
  const close=()=>{clearTimeout(celebrationTimer);stopTask();box.hidden=true;GameAudio.mode(false);root.querySelector('#town-viewport').focus();};
  function open(q){clearTimeout(celebrationTimer);stopTask();box.hidden=false;box.classList.add('is-playing');GameAudio.mode(true);
   stopTask=task(box,q,world.ecoport,{...options,onBusy:value=>{busyTask=value;const picker=root.querySelector('[data-eco-stage]');if(picker)picker.disabled=value;},openNext:()=>{const next=world.ecoport.stages[world.ecoport.active];if(next)open(next);else close();}},async out=>{
    if(disposed)return;world.ecoport=out.state.world.ecoport;world.playground=out.state.world.playground;update();
    if(out.stationComplete&&out.reward>0)celebrationTimer=setTimeout(()=>{if(disposed)return;close();GameCompletion.show(root,{title:out.complete?'云海生态港 · 循环重新启动':world.ecoport.stations[q.station].title+' · 修复成功',total:out.complete?18:3,story:false});},1500);
   },close);
  }
  function speak(index){clearTimeout(celebrationTimer);stopTask();const port=world.ecoport,station=port.stations[index];box.hidden=false;box.classList.add('is-playing');
   if(!station.unlocked&&!options.demo){box.innerHTML=`<button class="outline mini" data-eco-close>返回地图</button><h2>${esc(station.title)}</h2><p>先完成当前设施的修复，再沿水渠来到这里。</p>`;return;}
   const q=options.demo?port.stages.find(stage=>stage.station===index&&!stage.passed)||port.stages.find(stage=>stage.station===index):port.stages[port.active];
   if(station.repaired&&!options.demo){box.innerHTML=`<button class="outline mini" data-eco-close>返回地图</button><span class="pill">设施已恢复</span><h2>${esc(station.title)}</h2><p>${port.complete?'水渠、牧场和运输线已经重新连在一起。':'沿亮起的导航灯继续探索。'}</p><details><summary>本设施的任务记录</summary>${port.stages.filter(stage=>stage.station===index).map(stage=>`<p>${esc(stage.title)} · 尝试 ${stage.count||0} 次</p>`).join('')}</details>`;return;}
   if(q&&(options.demo||q.station===index))open(q);
  }
  function click(event){if(event.target.closest('[data-eco-close]'))close();}
  function change(event){if(!busyTask&&options.demo&&event.target.matches('[data-eco-stage]')){const q=world.ecoport.stages.find(stage=>stage.id===event.target.value);if(q)open(q);}}
  root.addEventListener('click',click);root.addEventListener('change',change);
  Promise.all([import('./town3d.js?v=20261015-ecoport'),import('./ecoport-model.mjs')]).then(([town,model])=>{if(disposed)return;stop=town.mountWorld(root,{...world,areas:[],sceneConfig:{camp:true,eco:true,names:missions().map(station=>station.title),getMissions:missions,createScene:()=>model.createEcoport(()=>world.ecoport)}},speak,options);update();}).catch(()=>{if(!disposed)root.querySelector('#town-loading').textContent='生态港加载失败，请刷新重试。';});
  cleanup=()=>{disposed=true;clearTimeout(celebrationTimer);stopTask();stop();GameAudio.mode(false);root.removeEventListener('click',click);root.removeEventListener('change',change);};
 }
 function task(box,q,progress,options,onState,onClose){
  const d=q.data;let config=initialConfig(q),history=[],selection=null,activePoint='moved',activeInventory='min',busy=false,disposed=false,feedback='',success=null,attempt=null,submitted='',hintsUsed=0,hint=false,started=performance.now(),frame=0,playing=false,preview=null;
  const button=(attrs,text,selected=false)=>`<button type="button" class="outline eco-choice ${selected?'selected':''}" ${attrs}>${text}</button>`;
  const input=(path,label,min=0,max=10000)=>`<label class="eco-number">${esc(label)}<input type="number" step="1" min="${min}" max="${max}" data-eco-value="${path}" value="${get(config,path)??''}" inputmode="${min<0?'text':'numeric'}" aria-label="${esc(label)}" placeholder="先预测"></label>`;
  const svg=(content,label,height=290)=>`<svg class="eco-board" viewBox="0 0 660 ${height}" role="img" aria-label="${esc(label)}">${content}</svg>`;
  const txt=(x,y,text,cls='')=>`<text x="${x}" y="${y}"${cls?` class="${cls}"`:''}>${esc(text)}</text>`;
  const choices=(path,items)=>`<div class="eco-actions">${items.map(([value,label])=>button(`data-eco-pick="${path}" data-eco-choice="${value}"`,label,get(config,path)===value)).join('')}</div>`;
  function squares(whole,halves){return `<div class="eco-tiles" aria-label="整格与半格">${Array.from({length:whole},(_,i)=>`<span class="eco-tile" aria-label="完整方格 ${i+1}"></span>`).join('')}${halves.map((_,i)=>{const paired=config.pairs?.some(pair=>pair.includes(i));return `<button type="button" class="eco-half ${paired?'paired':''} ${selection===i?'selected':''}" data-eco-triangle="${i}" aria-label="半格 ${i+1}${paired?' 已拼合':''}" ${paired?'disabled':''}>${i+1}</button>`;}).join('')}</div>`;}
  function pointsBoard(points,path=[]){const minX=-6,maxX=6,maxY=6,scale=40,ox=330,oy=267,xy=([x,y])=>[ox+x*scale,oy-y*scale];
   const target=activePoint==='moved'?config.moved:activePoint==='mirror'?config.mirror:config.mirrors?.[Number(activePoint.slice(-1))];
   let current=config.mirrors?.[0],route=current?[current]:[];for(const step of path){if(!current)break;current=[current[0]+(step==='E'?1:step==='W'?-1:0),current[1]+(step==='N'?1:step==='S'?-1:0)];route.push(current);}
   return svg(`<path d="M90 27H570V267H90Z" fill="#e1f4f4"/><path d="M330 10V280" stroke="#ae8ae0" stroke-width="7"/>${Array.from({length:maxY+1},(_,y)=>Array.from({length:maxX-minX+1},(_,i)=>{const x=minX+i,[cx,cy]=xy([x,y]);return `<circle cx="${cx}" cy="${cy}" r="7" fill="#b3d9df"/><circle cx="${cx}" cy="${cy}" r="17" fill="transparent" tabindex="0" role="button" data-eco-grid="${x},${y}" aria-label="${x===0?'镜面':(x<0?'左':'右')+Math.abs(x)+'格'}，高度${y}格"/>`;}).join('')+txt(595,oy-y*scale+5,`高${y}`)).join('')}${route.length?`<polyline points="${route.map(point=>xy(point).join(',')).join(' ')}" fill="none" stroke="#f5b630" stroke-width="6" pointer-events="none"/>`:''}${points.filter(p=>p.point).map(p=>{const [x,y]=xy(p.point);return `<circle cx="${x}" cy="${y}" r="12" fill="${p.color}" stroke="#514663" stroke-width="2" pointer-events="none"/>${txt(x,y-17,p.label)}`;}).join('')}${txt(330,18,'镜面')}${txt(190,287,'镜面左侧')}${txt(470,287,'镜面右侧')}${target?txt(70,18,'正在摆点'):''}`,'竖直镜面两侧格点；点击格点摆放所选信标');
  }
  function cubePicture(heights,label){let content='';for(const row of [1,0])for(let col=0;col<2;col++){const baseX=260+col*68-row*48,baseY=225-row*34;for(let level=0;level<heights[row][col];level++){const x=baseX,y=baseY-level*29;content+=`<path d="M${x},${y}l34,-18 34,18 -34,18Z" fill="#ffe78a" stroke="#76648e"/><path d="M${x},${y}v29l34,18V${y+18}Z" fill="#b6e4e6" stroke="#76648e"/><path d="M${x+34},${y+18}v29l34,-18v-29Z" fill="#c9b2ed" stroke="#76648e"/>`;}}
   return svg(content+txt(330,32,label)+txt(260,276,'前排（靠近你）'),label);
  }
  function silhouette(values,label){return `<div class="eco-view"><b>${esc(label)}</b><div class="eco-view-columns">${values.map((height,i)=>`<div><div class="eco-view-stack">${Array.from({length:height},()=>'<i></i>').join('')}</div><small>${i===0?'左 / 前':'右 / 后'}：${height}层</small></div>`).join('')}</div></div>`;}
  function chaseBoard(){const result=preview,maximum=Math.max(d.bridge||0,Math.max(0,n(config.meeting)),d.slow*d.lead,600)*1.2,at=metres=>65+Math.min(1.1,Math.max(0,metres/maximum))*515;
   let positions=result||{slow:d.slow*d.lead,fast:0};
   return svg(`<path d="M65 107H610M65 196H610" stroke="#cbc1e4" stroke-width="12" stroke-linecap="round"/>${d.bridge?`<path d="M${at(d.bridge)} 65V225" stroke="#789ac1" stroke-dasharray="8 5" stroke-width="3"/>${txt(at(d.bridge),45,'桥入口 '+d.bridge+'米')}`:''}<g transform="translate(${at(positions.slow)} 94)"><rect x="-21" y="-20" width="42" height="25" rx="7" fill="#ffcf4d"/><circle cx="-12" cy="9" r="7" fill="#5d526c"/><circle cx="12" cy="9" r="7" fill="#5d526c"/></g><g transform="translate(${at(positions.fast)} 178)"><rect x="-17" y="-17" width="34" height="32" rx="10" fill="#8fd8cf"/><circle cx="-6" r="3" fill="#55476b"/><circle cx="6" r="3" fill="#55476b"/></g>${txt(65,70,'运输车')}${txt(65,155,'机器人')}${txt(330,255,result?`第 ${result.time.toFixed(1)} 分钟 · 相差 ${result.gap.toFixed(1)} 米`:'先标记出发时刻和你的预测，再播放')}`,'运输车和机器人同向运动，共用同一距离刻度');
  }
  function flowBoard(wrap=true){const isWater=q.kind.startsWith('water'),amount=preview?.amount,initial=q.kind==='water-records'||q.kind==='pasture-records'?config.initial:d.initial,growth=isWater?(config.inflow??d.inflow):(config.growth??d.growth),activePhase=(preview?.time??0)<=(config.phases?.[0].minutes??0)?0:1,consumption=isWater?(config.outflow??config.phases?.[activePhase].outflow):(config.consumption??(config.cows?config.cows*d.perCow:null)),height=amount===undefined?Math.max(0,n(initial)):Math.max(0,amount),max=Math.max(80,n(initial)*1.5),fill=Math.min(165,165*height/max);
   const picture=svg(`<rect x="240" y="63" width="180" height="180" rx="18" fill="#fffdf5" stroke="#80729c" stroke-width="5"/><clipPath id="eco-tank"><rect x="244" y="67" width="172" height="172" rx="14"/></clipPath><rect x="244" y="${239-fill}" width="172" height="${fill}" fill="${isWater?'#79d3e7':'#a1df7d'}" clip-path="url(#eco-tank)"/><path d="M105 90H223l-14-10m14 10-14 10" fill="none" stroke="#78bd8f" stroke-width="8"/><path d="M435 200H555l-14-10m14 10-14 10" fill="none" stroke="#a98bde" stroke-width="8"/>${txt(147,63,(isWater?'进水':'新长')+' '+(growth??'?')+' /'+(isWater?'分钟':'天'))}${txt(516,170,(isWater?'排水':'消耗')+' '+(consumption??'?')+' /'+(isWater?'分钟':'天'))}${txt(330,42,isWater?'进水始终开启':'生长与吃草同时发生')}${txt(330,272,amount===undefined?'初始 '+(initial??'?')+(isWater?' 升':' 份'):`你的方案运行 ${preview.time.toFixed(1)} ${isWater?'分钟':'天'} · 剩 ${amount.toFixed(1)} ${isWater?'升':'份'}`)}`,isWater?'同时进水和排水的水箱实验':'同时生长和消耗的牧场实验');return wrap?`<div data-eco-visual>${picture}</div>`:picture;
  }
  function board(){
   if(q.kind==='bridge')return `<p class="eco-instruction">点击两个未拼合的半格，把它们配成一格。</p>${squares(d.whole,Array.from({length:d.halfCount}))}<div class="eco-actions">${config.pairs.map((pair,index)=>button(`data-eco-unpair="${index}"`,`<span class="eco-paired-square" aria-hidden="true"><i>${pair[0]+1}</i><i>${pair[1]+1}</i></span>已拼成一格 · 拆开`)).join('')}</div><p>已拼合 ${config.pairs.length} 组 · 每格边长 ${d.cellSide} 米</p><div class="eco-inputs">${input('area','我预测桥面面积（平方米）')}</div>`;
   if(q.kind==='mirror')return `<div class="eco-actions">${button('data-eco-target="moved"','移动 A 得到 B',activePoint==='moved')}${button('data-eco-target="mirror"','放置 B 的镜像 C',activePoint==='mirror')}</div>${pointsBoard([{point:d.point,label:'A',color:'#a3a4b3'},{point:config.moved,label:'B',color:'#ffc94e'},{point:config.mirror,label:'C',color:'#b499ea'}])}<p class="eco-instruction">先选上方的点，再点击格点。镜面左右使用同一个高度刻度，每格 ${d.cellLength} 厘米。</p><div class="eco-inputs">${input('distance','B 与 C 水平距离（厘米）',0,100)}</div>`;
   if(q.kind==='cubes')return cubePicture(config.heights,'点击下面的货摞，拿走最上面的一块')+`<div class="eco-actions">${config.heights.flatMap((row,r)=>row.map((height,c)=>button(`data-eco-remove="${r},${c}"`,`${r?'后':'前'}排${c?'右':'左'}侧：${height}块 · 拿走1块`))).join('')}</div><div class="eco-inputs">${input('front.0','正面左列轮廓（层）',0,6)}${input('front.1','正面右列轮廓（层）',0,6)}${input('total','剩余小正方体（块）',0,30)}</div><details><summary>怎样区分轮廓和库存？</summary><p>从正面看，同一列前后的货箱会互相遮挡。库存需要把每一摞都算进去。</p></details>`;
   if(q.kind==='panels')return `<p class="eco-instruction">已有 ${d.whole} 个整格。点击补板区的三角形加入或取回材料，三角形不能重叠。</p><div class="eco-panel-grid">${Array.from({length:d.maxAddedCells},(_,cell)=>`<div class="eco-panel-cell">${[0,1].map(side=>button(`data-eco-panel="${cell},${side}" aria-label="补板位置${cell+1}，半格${side+1}"`,'',config.halves.some(p=>p[0]===cell&&p[1]===side))).join('')}</div>`).join('')}</div><p>已放入 ${config.halves.length} 块半格 · 目标 ${d.targetArea} 平方米</p><div class="eco-inputs">${input('area','补完后的面积（平方米）')}</div>`;
   if(q.kind==='beacons')return `<div class="eco-actions">${[['moved','移动 A'],['mirror0','放置 A′'],['mirror1','放置 B′']].map(([key,label])=>button(`data-eco-target="${key}"`,label,activePoint===key)).join('')}</div>${pointsBoard([{point:d.points[0],label:'原 A',color:'#c5c4cd'},{point:d.points[1],label:'B',color:'#75c9ce'},{point:config.moved,label:'移动后 A',color:'#ffd552'},{point:config.mirrors[0],label:'A′',color:'#b79bea'},{point:config.mirrors[1],label:'B′',color:'#f69cac'}],config.path)}<p class="eco-instruction">选择信标后点击格点。再从 A′ 出发，按方向键画出到 B′ 的路线；只能横着或竖着走。</p><div class="eco-actions">${[['W','← 西'],['E','东 →'],['N','↑ 北'],['S','↓ 南']].map(([direction,label])=>button(`data-eco-step="${direction}"`,label)).join('')}${button('data-eco-back-route','撤回一步')}</div><p>路线：${config.path.map(step=>({W:'西',E:'东',N:'北',S:'南'}[step])).join(' → ')||'还没画路线'}</p><div class="eco-inputs">${input('distance','路线总长（米）',0,100)}</div>`;
   if(q.kind==='inventory'){const heights=config[activeInventory];return `<div class="eco-actions">${button('data-eco-inventory="min"','搭建最少方案',activeInventory==='min')}${button('data-eco-inventory="max"','搭建最多方案',activeInventory==='max')}</div><div class="eco-view-row"><div class="eco-required">目标正面：左 ${d.front[0]} 层，右 ${d.front[1]} 层<br>目标左侧：前 ${d.side[0]} 层，后 ${d.side[1]} 层</div>${silhouette(frontView(heights),'当前正面正投影')}${silhouette(sideView(heights),'当前左侧正投影')}</div>${cubePicture(heights,activeInventory==='min'?'我的最少方案':'我的最多方案')}<div class="eco-stack-controls">${heights.flatMap((row,r)=>row.map((height,c)=>`<div><b>${r?'后':'前'}排${c?'右':'左'}：${height}层</b>${button(`data-eco-stack="${r},${c},-1" aria-label="${r?'后':'前'}排${c?'右':'左'}减少一块"`,'−')}${button(`data-eco-stack="${r},${c},1" aria-label="${r?'后':'前'}排${c?'右':'左'}增加一块"`,'＋')}</div>`)).join('')}</div><div class="eco-inputs">${input('minTotal','最少方案库存（块）',4,16)}${input('maxTotal','最多方案库存（块）',4,16)}</div>`;}
   if(q.kind.startsWith('catch'))return `<div data-eco-visual>${chaseBoard()}</div>`+chaseControls();
   if(q.kind==='pasture')return flowBoard()+`<div class="eco-inputs">${input('consumption','牛群每天消耗（份）',0,50)}${input('netChange','每天净变化（增加写正，减少写负）',-50,50)}${input('days','我预测几天恰好吃完',1,100)}${input('remaining','那时剩余草量（份）',0,200)}</div>`;
   if(q.kind==='pasture-records')return recordsBoard('牧场')+flowBoard()+`<div class="eco-inputs">${config.records.map((record,i)=>input(`records.${i}.consumed`,`记录 ${i+1} 总吃草量（份）`,0,300)).join('')}${input('growth','每天新长草（份）',0,50)}${input('initial','原有草量（份）',0,200)}${input('days',`${d.trialCows} 头牛预计吃几天`,1,100)}</div>`;
   if(q.kind==='pasture-balance')return `<p class="eco-instruction">三个试验各自从 ${d.initial} 份草开始，不把上一组的草量带到下一组。</p><div class="eco-trials">${config.trials.map((trial,i)=>`<section><h3>${trial.cows} 头牛</h3>${choices(`trials.${i}.trend`,[['increase','草量增加'],['steady','保持不变'],['decrease','草量减少']])}<div class="eco-inputs">${i===2?input(`trials.${i}.days`,'预计恰好吃完的天数',1,100):`<p>观察 ${d.checkDays} 天</p>`}${input(`trials.${i}.remaining`,i===2?'耗尽时剩余（份）':`${d.checkDays} 天后剩余（份）`,0,200)}</div><div data-eco-trial-result="${i}">${preview?trendChart(trial,preview.trials[i]):'<div class="eco-grass" aria-label="初始草量">☘ ☘ ☘ ☘</div>'}</div></section>`).join('')}</div><div class="eco-inputs">${input('sustainable','让草量长期不减少，最多放几头牛',0,30)}</div>`;
   if(q.kind==='water')return flowBoard()+`<div class="eco-inputs">${input('outflow','我设置的排水量（升/分钟）',0,100)}${input('netChange','每分钟净变化（增加正，减少负）',-100,100)}${input('remaining',`${d.minutes} 分钟后剩余（升）`,0,200)}</div>`;
   if(q.kind==='water-phases')return `<div class="eco-phase-row"><section><b>第一段 · 已知设置</b><p>进 ${d.inflow}，排 ${d.first.outflow} 升/分钟，运行 ${d.first.minutes} 分钟。</p>${input('phases.0.remaining','第一段后剩余（升）',0,200)}</section><span class="eco-connector">同一个水箱 →</span><section><b>第二段 · 我的设置</b><p>进水不变，再运行 ${d.secondMinutes} 分钟。</p>${input('phases.1.outflow','第二段排水量（升/分钟）',0,100)}${input('phases.1.remaining','第二段结束剩余（升）',0,200)}</section></div>${flowBoard()}`;
   if(q.kind==='water-records')return recordsBoard('水箱')+flowBoard()+`<div class="eco-inputs">${config.records.map((record,i)=>input(`records.${i}.totalOut`,`记录 ${i+1} 总排水（升）`,0,300)).join('')}${input('inflow','每分钟持续进水（升）',0,50)}${input('initial','原有水量（升）',0,200)}${input('outflow',`希望 ${d.trialMinutes} 分钟排空，设置排水（升/分钟）`,0,100)}${input('totalOut',`${d.trialMinutes} 分钟总排水（升）`,0,300)}${input('remaining','结束时剩余（升）',0,200)}</div>`;
   return '';
  }
  function trendChart(trial,result){const x=25+170*Math.min(1,result.time/Math.max(1,n(trial.days))),y=85-60*Math.max(0,Math.min(60,result.amount))/60,startY=85-60*d.initial/60;
   return `<svg class="eco-trend" viewBox="0 0 220 105" role="img" aria-label="${trial.cows}头牛的实际草量变化曲线"><path d="M25 10V85H205" fill="none" stroke="#a1a0ac" stroke-width="2"/><path d="M25 ${startY}L${x} ${y}" fill="none" stroke="#79ad59" stroke-width="4"/><circle cx="${x}" cy="${y}" r="5" fill="#efb83b"/><text x="15" y="${startY+4}">${d.initial}</text><text x="105" y="102">运行天数 →</text></svg><p class="eco-sim-result">你的试验：${result.time.toFixed(1)} 天，${result.amount.toFixed(1)} 份</p>`;
  }
  function recordsBoard(type){const water=type==='水箱';return `<div class="eco-records">${d.records.map((record,i)=>`<section><b>独立记录 ${i+1}</b><p>${water?`每分钟排 ${record.outflow} 升，${record.minutes} 分钟排空`:`${record.cows} 头牛，${record.days} 天吃完`}</p><div><span>相同原有量</span>＋<span>${water?'新增进水':'新增草量'}</span>＝<span>总${water?'排水':'吃草'}量</span></div></section>`).join('')}</div><p class="eco-instruction">两份记录互相比较，不是先后连续运行。先算各自的总消耗，再找新增量的差别。</p>`;}
  function chaseControls(){
   if(config.phases)return `<div class="eco-phase-row">${config.phases.map((phase,i)=>`<section class="${phase.mode==='rest'?'eco-rest':''}"><b>第 ${i+1} 段 · ${phase.mode==='rest'?'机器人停留':'机器人行走'}</b>${d.phases[i].minutes===null?input(`phases.${i}.minutes`,'安排几分钟',0,100):`<p>${phase.minutes} 分钟</p>`}${input(`phases.${i}.gap`,'本段后相差（米）',0,2000)}</section>`).join('')}</div><p class="eco-instruction">停留时运输车继续前进。上方实验按这些时间段运行，不会替你求最后一段。</p><div class="eco-inputs">${q.kind==='catch-recover'?`<p>首次出发后共经过 ${d.elapsed} 分钟。</p>`:input('elapsed','总经过时间（分钟）',0,200)}${input('walking','机器人实际行走（分钟）',0,200)}${input('meeting','相遇位置距起点（米）',0,10000)}</div>`;
   return `<div class="eco-start-times"><b>以机器人出发为第0分钟，摆好两张出发时间卡：</b><div class="eco-inputs">${input('slowStart','运输车出发时刻（提前用负数）',-50,50)}${input('fastStart','机器人出发时刻',-50,50)}</div></div>${q.kind==='catch-check'?`<section class="eco-checkpoint"><h3>先检查第 ${d.checkTime} 分钟</h3><div class="eco-inputs">${input('checkSlow','运输车位置（米）',0,5000)}${input('checkFast','机器人位置（米）',0,5000)}${input('checkGap','两者相差（米）',0,5000)}</div></section>`:''}<div class="eco-inputs">${input('catchTime','机器人出发后几分钟追上',0,100)}${input('meeting','相遇位置距起点（米）',0,10000)}</div>${q.kind==='catch-bridge'?`<p>相遇发生在桥入口之前吗？</p>${choices('beforeBridge',[[true,'能在桥前追上'],[false,'不能在桥前追上']])}`:''}`;
  }
  function render(){if(disposed)return;const ready=predictionReady(q,config),hasSimulation=q.kind.startsWith('catch')||q.kind.startsWith('water')||q.kind.startsWith('pasture');
   const actions=success?`<div class="eco-success" role="status"><b>${success.reward>0?'✦ +'+success.reward+' 星光':'方案验证成功'}</b><p>${success.complete?'港口循环重新启动！':success.stationComplete?'设施已修复，准备前往下一站。':'操作与预测都通过了检验。'}</p><button type="button" data-eco-next>${success.stationComplete?'返回地图看修复效果':'继续下一项 →'}</button></div>`:
    `<div class="eco-actions eco-submit">${hasSimulation?`<button type="button" class="outline" data-eco-play ${!ready||playing?'disabled':''}>${playing?'正在播放我的方案…':'▶ 播放我的方案'}</button>`:''}<button type="button" data-eco-test>验证我的方案</button>${button('data-eco-undo','撤销')}${button('data-eco-reset','重新设计')}${button('data-eco-hint','一点提示')}</div>${hasSimulation&&!ready?'<p class="eco-note">先填写预测，再用动画检查自己的方案。</p>':''}${hint?`<aside class="eco-hint">${esc(q.hint)}</aside>`:''}`;
   box.innerHTML=`<header class="eco-card-header"><span class="pill">${esc(q.topic)} · 第 ${q.level+1}/3 项 · ✦ ${q.reward}</span>${GameAudio.controls()}<button type="button" class="outline mini" data-eco-close>返回地图 ×</button></header><h2>${esc(q.title)}</h2>${q.level===0?`<p class="eco-story">${esc(q.story)}</p>`:''}<p class="eco-question">${esc(q.text)}</p><section class="eco-workbench" aria-label="我的解题操作台">${board()}</section><p class="eco-feedback" role="status">${esc(feedback)}</p>${actions}`;
   box.querySelectorAll('button,input').forEach(element=>{if(element.hasAttribute('data-sound-action'))return;if(element.hasAttribute('data-eco-close'))element.disabled=busy;else if(!element.hasAttribute('data-eco-next'))element.disabled=element.disabled||busy||!!success||options.readonly;});GameAudio.update();
   if(options.readonly){const message=document.createElement('p');message.textContent='正在查看学生记录。操作体验请进入教师独立试玩。';box.append(message);}
  }
  // 动画帧只更新图示和实验结果，保留输入框、声音按钮及键盘焦点。
  function refreshSimulation(){if(disposed)return;const visual=box.querySelector('[data-eco-visual]');if(visual)visual.innerHTML=q.kind.startsWith('catch')?chaseBoard():flowBoard(false);
   if(q.kind==='pasture-balance')config.trials.forEach((trial,index)=>{const area=box.querySelector(`[data-eco-trial-result="${index}"]`);if(area)area.innerHTML=preview?trendChart(trial,preview.trials[index]):'<div class="eco-grass" aria-label="初始草量">☘ ☘ ☘ ☘</div>';});
   const playButton=box.querySelector('[data-eco-play]');if(playButton){playButton.disabled=playing||busy||options.readonly||!predictionReady(q,config);playButton.textContent=playing?'正在播放我的方案…':'▶ 播放我的方案';}
  }
  function stopPreview(){if(frame)cancelAnimationFrame(frame);frame=0;playing=false;preview=null;refreshSimulation();}
  function save(){stopPreview();history.push(clone(config));if(history.length>80)history.shift();feedback='';attempt=null;submitted='';}
  function play(){if(!predictionReady(q,config)||playing||busy||success||options.readonly)return;stopPreview();playing=true;const start=performance.now();const tick=time=>{if(disposed)return;const fraction=Math.min(1,(time-start)/3000);preview=simulate(q,config,fraction);playing=fraction<1;refreshSimulation();if(playing)frame=requestAnimationFrame(tick);else frame=0;};frame=requestAnimationFrame(tick);refreshSimulation();}
  async function verify(){if(busy||success||options.readonly)return;stopPreview();const serialized=JSON.stringify(config);if(serialized!==submitted){attempt=crypto.randomUUID();submitted=serialized;}busy=true;options.onBusy?.(true);render();
   try{const out=await options.submitEco({stageId:q.id,config:clone(config),revision:progress.revision,seconds:Math.min(86400,(performance.now()-started)/1000),hintsUsed,attemptId:attempt});if(disposed)return;progress.revision=out.state.world.ecoport.revision;await onState(out);feedback=out.feedback;success=out.correct?out:null;attempt=null;submitted='';}
   catch(error){feedback=error.message||'暂时无法保存。方案还在，可以重新验证。';}
   finally{busy=false;options.onBusy?.(false);render();}
  }
  function chooseGrid(raw){const point=raw.split(',').map(Number);if(activePoint==='moved')config.moved=point;else if(activePoint==='mirror')config.mirror=point;else config.mirrors[Number(activePoint.slice(-1))]=point;}
  async function click(event){const element=event.target.closest('button,[data-eco-grid]');if(!element||disposed||busy)return;
   if(element.hasAttribute('data-eco-close')){onClose();return;}
   if(element.hasAttribute('data-eco-next')){if(success.stationComplete)onClose();else{dispose();options.openNext();}return;}
   if(options.readonly||success)return;
   if(element.hasAttribute('data-eco-test')){await verify();return;}
   if(element.hasAttribute('data-eco-play')){play();return;}
   if(element.hasAttribute('data-eco-hint')){if(!hint)hintsUsed++;hint=!hint;render();return;}
   if(element.hasAttribute('data-eco-undo')){stopPreview();if(history.length)config=history.pop();selection=null;feedback='';render();return;}
   if(element.hasAttribute('data-eco-reset')){save();config=initialConfig(q);selection=null;render();return;}
   if(element.dataset.ecoTarget!==undefined){activePoint=element.dataset.ecoTarget;render();return;}
   if(element.dataset.ecoInventory!==undefined){activeInventory=element.dataset.ecoInventory;render();return;}
   const supported=['ecoTriangle','ecoUnpair','ecoGrid','ecoRemove','ecoPanel','ecoStack','ecoStep','ecoPick'];if(!supported.some(key=>element.dataset[key]!==undefined)&&!element.hasAttribute('data-eco-back-route'))return;
   if(element.dataset.ecoTriangle!==undefined){const index=Number(element.dataset.ecoTriangle);if(config.pairs.some(pair=>pair.includes(index)))return;if(selection===null){selection=index;render();return;}if(selection===index){selection=null;render();return;}save();config.pairs.push([selection,index]);selection=null;}
   else{save();if(element.dataset.ecoUnpair!==undefined)config.pairs.splice(Number(element.dataset.ecoUnpair),1);
    if(element.dataset.ecoGrid!==undefined)chooseGrid(element.dataset.ecoGrid);
    if(element.dataset.ecoRemove!==undefined){const [row,col]=element.dataset.ecoRemove.split(',').map(Number);config.heights[row][col]=Math.max(0,config.heights[row][col]-1);}
    if(element.dataset.ecoPanel!==undefined){const point=element.dataset.ecoPanel.split(',').map(Number),index=config.halves.findIndex(p=>p[0]===point[0]&&p[1]===point[1]);if(index<0)config.halves.push(point);else config.halves.splice(index,1);}
    if(element.dataset.ecoStack!==undefined){const [row,col,delta]=element.dataset.ecoStack.split(',').map(Number);config[activeInventory][row][col]=Math.max(d.minHeight,Math.min(d.maxHeight,config[activeInventory][row][col]+delta));}
    if(element.dataset.ecoStep!==undefined&&config.path.length<24)config.path.push(element.dataset.ecoStep);
    if(element.hasAttribute('data-eco-back-route'))config.path.pop();
    if(element.dataset.ecoPick!==undefined){let value=element.dataset.ecoChoice;if(value==='true')value=true;if(value==='false')value=false;set(config,element.dataset.ecoPick,value);}
   }render();
  }
  function change(event){const path=event.target.dataset.ecoValue;if(!path||disposed||busy||success||options.readonly)return;save();const raw=event.target.value,value=raw.trim()===''?null:Number(raw);set(config,path,Number.isFinite(value)?value:null);refreshSimulation();const message=box.querySelector('.eco-feedback');if(message)message.textContent='';}
  function keydown(event){const point=event.target.closest('[data-eco-grid]');if(point&&(event.key==='Enter'||event.key===' ')){event.preventDefault();click({target:point});}}
  function dispose(){disposed=true;stopPreview();box.removeEventListener('click',click);box.removeEventListener('input',change);box.removeEventListener('keydown',keydown);}
  box.addEventListener('click',click);box.addEventListener('input',change);box.addEventListener('keydown',keydown);render();box.scrollTop=0;return dispose;
 }
 return {html,mount,dispose:()=>cleanup(),initialConfig,predictionReady,simulate,frontView,sideView,task};
})();
