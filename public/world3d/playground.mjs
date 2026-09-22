import * as T from './vendor/three.module.js';
import {rides,nearbyRide,createRideClock,createSurfRound,createBounceRound} from './playground-rules.mjs';
import {buildPlayground} from './playground-model.mjs';
const seated=id=>['carousel','wheel','swing'].includes(id);
const notes={carousel:'两圈 · 木马骑乘',wheel:'一圈 · 高空观景',surf:'换道 · 跳跃 · 集星',swing:'按空格加把劲',trampoline:'落地蓄力 · 连续弹跳'};
function rideView(id){const r=rides[id];return {look:new T.Vector3(r.x,id==='wheel'?7:2,r.z+(id==='wheel'?1.5:0)),offset:new T.Vector3(10,id==='wheel'?6:7,id==='wheel'?23:15)};}
export function mountPlayground({shell,viewport,scene,travel,stopWalking,getHero,getActions,leave,say,payRide,wallet,readonly=false}){
 const model=buildPlayground();scene.add(model.group);
 const panel=document.createElement('section');panel.className='park-panel';panel.setAttribute('aria-label','游乐场操作');panel.hidden=true;shell.append(panel);
 const shortcut=document.createElement('button');shortcut.className='outline mini park-shortcut';shortcut.textContent='游乐项目';shortcut.hidden=true;shell.append(shortcut);
 let previewId='park',session=null,time=0,paused=false,disposed=false,view=null,announce='',paying=false,pendingPayment=null;const keyboard=new Set();
 const balance=document.createElement('span');balance.className='park-balance';balance.setAttribute('aria-label','游乐场星光余额');shell.append(balance);
 const showBalance=()=>{balance.textContent=`${wallet?.demo?'试玩 ':''}✦ ${wallet?.balance??0} 星光 · 每次 20`;};showBalance();
 function heading(name){return `<div class="park-panel-head"><strong>${name}</strong><button class="outline mini" data-park-close aria-label="关闭游乐场面板">×</button></div>`;}
 function showMenu(){if(session||paying)return;previewId='park';say('欢迎来到星光游乐场，选一个喜欢的项目吧！');stopWalking();panel.hidden=false;panel.dataset.blocking='true';panel.innerHTML=heading('星光游乐场')+Object.values(rides).map(r=>`<button class="park-ride-option" data-park-go="${r.id}"><strong>${r.name}</strong><small>20 星光 · ${r.duration} 秒 · ${notes[r.id]}</small><span>前往 →</span></button>`).join('');}
 // 靠近后按 Enter 即开始，不再额外弹出设施介绍确认卡。
 function offer(id){void start(id);}
 async function start(id){
  const hero=getHero(),actions=getActions(),ride=rides[id];if(session||!hero||!actions||!ride||Math.hypot(hero.position.x-ride.entry.x,hero.position.z-ride.entry.z)>1.6)return;
  if(paying||disposed)return;
  if(readonly){say('查看学生记录时不能消费星光，请使用教师试玩。');return;}
  if(actions.busy||actions.sitting){say('请先站稳，再开始游玩。');return;}
  stopWalking();paying=true;panel.hidden=false;panel.dataset.blocking='true';panel.innerHTML=heading(ride.name)+'<p role="status">正在支付 20 星光……</p>';
  try{
   pendingPayment??={rideId:id,requestId:crypto.randomUUID(),expectedSpent:wallet?.spent??0};
   if(pendingPayment.rideId!==id)throw Error('上次支付结果尚未确认，请先重试原项目。');
   wallet=await payRide(pendingPayment);pendingPayment=null;showBalance();
  }catch(e){
   if(e.status)pendingPayment=null;
   if(!disposed){panel.innerHTML=heading(ride.name)+'<p role="alert"></p><button data-park-start="'+id+'">重试游玩 · 20 星光</button>';panel.querySelector('[role="alert"]').textContent=e.message;say(e.message);}
   return;
  }finally{paying=false;}
  if(disposed)return;
  stopWalking();paused=false;keyboard.clear();announce='';session={id,phase:seated(id)?'boarding':'playing',time:0,energy:.35,clock:seated(id)?createRideClock(id):null,round:id==='surf'?createSurfRound():id==='trampoline'?createBounceRound():null};
  actions.update(0,{blocked:false});if(seated(id))actions.request('sit');
  let controls='<small>可以拖动画面换个角度欣赏。</small>';
  if(id==='surf')controls='<small>← → / A D 换道 · 空格跳跃</small><div class="park-surf-controls"><button data-play="left" aria-label="冲浪向左换道">←</button><button data-play="jump">跳跃</button><button data-play="right" aria-label="冲浪向右换道">→</button></div>';
  if(id==='swing')controls='<small>按空格或按钮，秋千会荡得更高。</small><button class="park-energy" data-play="jump">加把劲</button>';
  if(id==='trampoline')controls='<small>快落到垫面时按空格，蓄力成功得分更高。</small><button class="park-energy" data-play="jump">起跳 / 落地蓄力</button>';
  panel.hidden=false;panel.dataset.blocking='false';shell.classList.add('park-riding');panel.innerHTML=`<div class="park-panel-head"><strong>${ride.name}</strong><span data-ride-time></span></div><p data-ride-status role="status"></p><progress max="100" value="0" aria-label="游玩进度"></progress>${controls}<div class="park-ride-actions"><button class="outline mini" data-ride-pause>暂停</button><button class="outline mini" data-ride-stop>${id==='surf'?'结束冲浪':'提前结束'}</button></div>`;
  viewport.focus({preventScroll:true});
 }
 // 骑马时双腿从鞍座两侧自然垂下，不能沿普通坐姿插进马身。
 function restoreLegs(){if(!session?.legs)return;for(const [bone,q] of session.legs)bone.quaternion.copy(q);session.legs=null;}
 function ridingLegs(hero){session.legs=[];hero.updateMatrixWorld(true);for(const [name,side] of [['Thigh.L',1],['Thigh.R',-1]]){const bone=hero.getObjectByName(name);if(!bone)continue;session.legs.push([bone,bone.quaternion.clone()]);const axis=new T.Vector3(0,1,0).applyQuaternion(bone.parent.getWorldQuaternion(new T.Quaternion()).invert());bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,side*.72));}}
 function finish(){
  if(!session)return;const {id,round}=session,ride=rides[id],actions=getActions(),hero=getHero();
  restoreLegs();session=null;view=null;paused=false;keyboard.clear();shell.classList.remove('park-riding');model.surfFrame(null,time);hero.rotation.set(0,hero.rotation.y,0);actions.resetToIdle();leave(ride.entry);viewport.dataset.ride='';viewport.dataset.ridePhase='';say('已回到设施入口，可以继续游玩或自由走动。');
  const result=id==='surf'?`本局获得 ${round.score} 分，收集了 ${round.score/10} 颗星星。`:id==='trampoline'?`完成 ${round.bounces} 次弹跳，本局获得 ${round.score} 分。`:'已经安全下车，继续逛逛吧！';
  panel.hidden=false;panel.dataset.blocking='true';panel.innerHTML=heading(round?'游玩结束':'回到站台啦')+`<p>${result}</p><div class="park-ride-actions"><button data-park-start="${id}">再玩一次 · 20 星光</button><button class="outline" data-park-menu>其他项目</button></div>`;
 }
 // 所有项目立即结束；角色直接返回安全入口，不再等待设施转完或落地。
 function requestFinish(){if(session)finish();}
 function input(action){if(!session||paused)return;if(session.id==='surf'){if(action==='jump')session.round.jump();else session.round.steer(action==='left'?-1:1);}else if(action==='jump'&&session.id==='trampoline')session.round.jump();else if(action==='jump'&&session.id==='swing'&&!session.clock.returning)session.energy=Math.min(1,session.energy+.16);}
 function togglePause(){if(!session)return;paused=!paused;panel.querySelector('[data-ride-pause]').textContent=paused?'继续游玩':'暂停';keyboard.clear();viewport.focus({preventScroll:true});}
 function click(e){const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(paying)return;
  if(b.hasAttribute('data-park-close')){panel.hidden=true;panel.dataset.blocking='false';viewport.focus();}
  if(b.hasAttribute('data-park-menu'))showMenu();
  if(b.dataset.parkGo){panel.hidden=true;panel.dataset.blocking='false';getActions()?.update(0,{blocked:false});getActions()?.request('stand');travel(rides[b.dataset.parkGo].entry,`ride:${b.dataset.parkGo}`);}
  if(b.dataset.parkStart)start(b.dataset.parkStart);
  if(b.dataset.play){input(b.dataset.play);viewport.focus();}
  if(b.hasAttribute('data-ride-pause'))togglePause();if(b.hasAttribute('data-ride-stop'))requestFinish();
 }
 function keydown(e){if(!session||e.target!==viewport)return;const action={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump'}[e.code];if(action){e.preventDefault();e.stopImmediatePropagation();if(!keyboard.has(e.code))input(action);keyboard.add(e.code);}if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)togglePause();}}
 const keyup=e=>keyboard.delete(e.code),blur=()=>{keyboard.clear();if(session&&!paused){paused=true;panel.querySelector('[data-ride-pause]').textContent='继续游玩';}},visibility=()=>{if(document.hidden)blur();};
 panel.addEventListener('click',click);shortcut.addEventListener('click',showMenu);viewport.addEventListener('keydown',keydown,true);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
 return {group:model.group,get active(){return !!session;},get overview(){if(session||panel.hidden)return null;return previewId==='park'?{look:new T.Vector3(38,3,0),offset:new T.Vector3(-24,22,32)}:rideView(previewId);},get camera(){return view;},get panelOpen(){return !panel.hidden&&panel.dataset.blocking==='true';},get canSit(){return !!session&&seated(session.id);},showMenu,offer,nearby:nearbyRide,
  update(dt,position){
   if(disposed)return;time+=dt;shortcut.hidden=!!session||position.x<16;model.surfFrame(session?.id==='surf'?session.round:null,time);if(!session)return;
   const hero=getHero(),actions=getActions(),s=session,ride=rides[s.id];let pose;restoreLegs();
   if(!paused){s.time+=dt;actions.update(dt,{blocked:false});if(s.phase==='boarding'&&s.time>=1.15){s.phase='playing';s.time=0;}if(s.phase==='playing'){if(s.round)s.round.update(dt);else s.clock.update(dt);}s.energy=Math.max(0,s.energy-dt*.035);}
   if(s.id==='surf'){pose=model.surfFrame(s.round,time);view={look:new T.Vector3(37,0,6.2),offset:new T.Vector3(0,10.5,13),orbit:false};}
   else if(s.id==='trampoline'){pose=model.bounceFrame(s.round);view=rideView(s.id);}
   else {const angle=s.id==='swing'?Math.sin(s.time*1.8)*(.28+s.energy*.58)*Math.sin(Math.PI*s.clock.progress):(s.id==='carousel'?Math.PI*4:Math.PI*2)*s.clock.progress;model.motion(s.id,angle,s.time);pose=model.riderPose(s.id);view=rideView(s.id);}
   hero.position.copy(pose.position);hero.rotation.set(pose.pitch||0,pose.yaw,pose.roll||0);if(s.id==='carousel')ridingLegs(hero);viewport.dataset.ride=s.id;viewport.dataset.ridePhase=paused?'paused':s.phase;
   const activity=s.id==='surf'?`星星 ${s.round.score/10} 颗 · 得分 ${s.round.score} · 剩余机会 ${s.round.lives}`:s.id==='trampoline'?`${s.round.message} · 得分 ${s.round.score}`:s.id==='swing'?`动力 ${Math.round(s.energy*100)}% · 按空格加把劲`:s.id==='wheel'?'正在空中欣赏小镇':'小马出发，欢乐转圈！';
   const message=paused?'已暂停，点击“继续游玩”':s.phase==='boarding'?'坐稳啦，准备出发！':s.clock?.returning?'正在返回站台，请坐稳。':activity;
   if(message!==announce){panel.querySelector('[data-ride-status]').textContent=message;announce=message;}
   panel.classList.toggle('park-hit',s.id==='surf'&&s.round.flash>0);panel.classList.toggle('park-charge-ready',s.id==='trampoline'&&s.round.ready);
   panel.querySelector('progress').value=(s.round?s.round.elapsed/ride.duration:s.clock.progress)*100;panel.querySelector('[data-ride-time]').textContent=s.round?`${Math.max(0,Math.ceil(ride.duration-s.round.elapsed))} 秒`:'';
   if(s.round?.done||s.clock?.done)finish();
  },
  dispose(){disposed=true;session=null;shell.classList.remove('park-riding');panel.remove();shortcut.remove();balance.remove();viewport.removeEventListener('keydown',keydown,true);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);},
 };
}
