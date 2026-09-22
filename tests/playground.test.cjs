const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

test('五种设施按Enter只扣款一次，任何阶段提前结束均立即停止并回到入口',async()=>{
 const T=await import('../public/world3d/vendor/three.module.js'),rules=await import('../public/world3d/playground-rules.mjs');
 for(const id of Object.keys(rules.rides))for(const advance of [false,true]){
  const elements=[];
  function element(){const children=new Map();return {hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(){},remove(){},focus(){},listeners:{},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(){},querySelector(k){if(!children.has(k))children.set(k,{});return children.get(k);}};}
  let payments=0,resets=0,returned=null,resolvePayment;const motions=[];
  const hero={position:new T.Vector3(rules.rides[id].entry.x,0,rules.rides[id].entry.z),rotation:new T.Euler(),getObjectByName(){return null;},updateMatrixWorld(){}};
  const actions={busy:false,sitting:false,update(){},request(){},resetToIdle(){resets++;}};
  const ctx=vm.createContext({T,...rules,crypto:require('node:crypto').webcrypto,document:{createElement(){const el=element();elements.push(el);return el;},addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},buildPlayground:()=>({group:{},motion(...args){motions.push(args);},riderPose(){return {position:new T.Vector3(1,9,2),yaw:0};},surfFrame(){return {position:new T.Vector3(1,1,2),yaw:0};},bounceFrame(){return {position:new T.Vector3(1,3,2),yaw:0};}})});
  vm.runInContext(fs.readFileSync('public/world3d/playground.mjs','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function mountPlayground','function mountPlayground'),ctx);
  const viewport=element(),park=ctx.mountPlayground({shell:element(),viewport,scene:{add(){}},travel(){},stopWalking(){},getHero:()=>hero,getActions:()=>actions,leave(p){returned=p;},say(){},wallet:{balance:40,spent:0},payRide:()=>{payments++;return new Promise(resolve=>resolvePayment=resolve);}});
  park.offer(id);park.offer(id);assert.equal(payments,1);assert.equal(park.active,false);
  resolvePayment({balance:20,spent:20});await new Promise(setImmediate);assert.equal(park.active,true);
  if(advance){for(let i=0;i<100;i++)park.update(.02,hero.position);}
  const panel=elements[0];const click=name=>panel.listeners.click({stopPropagation(){},target:{closest:()=>({dataset:{},hasAttribute:key=>key===name})}});
  if(advance)click('data-ride-pause');
  const motionCount=motions.length;click('data-ride-stop');
  assert.equal(park.active,false,'点击后当场结束，不能继续转圈或等待落地');assert.equal(viewport.dataset.ride,'');assert.deepEqual(returned,rules.rides[id].entry);assert.equal(resets,1);
  park.update(.02,hero.position);assert.equal(motions.length,motionCount,'退出后不能继续推进设施');assert.equal(payments,1);park.dispose();
 }
});
test('住宅、广场及五项设施的上下客点互通，水池及设施不允许步行穿越',async()=>{
 const nav=await import('../public/world3d/navigation3d.mjs'),{townHome}=await import('../public/world3d/home-layout.mjs'),{rides,parkEntrance}=await import('../public/world3d/playground-rules.mjs');
 for(const start of [townHome.door,parkEntrance,...Object.values(rides).map(r=>r.entry)])for(const end of Object.values(rides).map(r=>r.entry)){
  const path=nav.findPath(start,end);assert.ok(path);let position=start;
  for(let i=0;i<4000&&path.length;i++){const next=nav.advancePath(position,path,.15);assert.equal(next.blocked,false);position=next.position;assert.ok(nav.canStand(position.x,position.z));}
  assert.equal(path.length,0);assert.ok(Math.hypot(position.x-end.x,position.z-end.z)<.01);
 }
 for(const ride of Object.values(rides)){assert.equal(nav.canStand(ride.x,ride.z),false);assert.equal(nav.canStand(ride.entry.x,ride.entry.z,false),false);}
 assert.equal(nav.canStand(61,0),false);assert.equal(nav.canStand(19,0),true);
});
test('摩天轮与木马正常完成或提前结束都回到站台，进度单调且不会越界',async()=>{
 const {createRideClock}=await import('../public/world3d/playground-rules.mjs');
 for(const id of ['wheel','carousel','swing'])for(const early of [false,true]){const clock=createRideClock(id);let last=0;for(let i=0;i<3000&&!clock.done;i++){if(early&&i===210)clock.finish();clock.update(.02);assert.ok(clock.progress>=last&&clock.progress<=1);last=clock.progress;}assert.ok(clock.done);assert.equal(clock.progress,1);clock.finish();clock.update(1);assert.equal(clock.progress,1);}
});
test('冲浪可换道、收集星星、碰撞扣机会、跳过浮标，结束后不重复计分',async()=>{
 const {createSurfRound}=await import('../public/world3d/playground-rules.mjs');
 const round=createSurfRound(7);round.steer(-1);round.steer(-1);for(let i=0;i<60;i++)round.update(.02);assert.equal(round.target,-1);assert.ok(round.lane<-.99);
 round.items.splice(0);round.items.push({id:900,kind:'star',lane:-1,distance:.01,passed:false});round.update(.02);assert.equal(round.score,10);round.update(.02);assert.equal(round.score,10);
 round.items.push({id:901,kind:'buoy',lane:-1,distance:.01,passed:false});round.update(.02);assert.equal(round.lives,2);
 assert.equal(round.jump(),true);assert.equal(round.jump(),false);for(let i=0;i<15;i++)round.update(.02);round.items.push({id:902,kind:'buoy',lane:-1,distance:.01,passed:false});round.update(.02);assert.equal(round.lives,2);
 round.stop();const score=round.score;round.update(1);round.steer(1);assert.equal(round.score,score);assert.equal(round.target,-1);
 const timed=createSurfRound(5);for(let i=0;i<2500&&!timed.done;i++)timed.update(.02);assert.ok(timed.done);
 const failed=createSurfRound(1);for(let i=0;i<3;i++){failed.items.push({id:i,kind:'buoy',lane:0,distance:.01,passed:false});failed.update(.02);}assert.ok(failed.done);assert.equal(failed.lives,0);
});

test('摩天轮整圈运行时座舱不会碰到轮盘、支架、地面或相邻座舱',async()=>{
 const T=await import('../public/world3d/vendor/three.module.js');
 const prior=global.document;global.document={createElement(){return {width:0,height:0,getContext(){return {fillRect(){},fillText(){}};}};}};
 let model;try{const {buildPlayground}=await import('../public/world3d/playground-model.mjs');model=buildPlayground();}finally{global.document=prior;}
 const rotor=model.group.getObjectByName('wheel-rotor'),supports=model.group.getObjectByName('wheel-supports'),cabins=Array.from({length:8},(_,i)=>model.group.getObjectByName(`wheel-cabin-${i}`));
 const supportBox=new T.Box3().setFromObject(supports);
 // 最低马蹄应高于木马平台上沿 0.43，覆盖所有马匹及完整起伏周期。
 for(let tick=0;tick<180;tick++){
  model.motion('carousel',tick*.05,tick*.05);model.group.updateMatrixWorld(true);
  model.group.traverse(o=>{if(o.name==='horse-hoof')assert.ok(new T.Box3().setFromObject(o).min.y>.43,'木马下降时马蹄不能穿过平台');});
 }
 for(let degree=0;degree<=360;degree+=2){model.motion('wheel',degree*Math.PI/180,0);model.group.updateMatrixWorld(true);const ringBox=new T.Box3().setFromObject(rotor),boxes=cabins.map(c=>new T.Box3().setFromObject(c));
  boxes.forEach((box,i)=>{assert.ok(box.min.y>.3,'座舱底板应始终高于平台');assert.equal(box.intersectsBox(ringBox),false,'座舱不能扫过轮圈与辐条');assert.equal(box.intersectsBox(supportBox),false,'座舱不能扫过支架');for(let j=i+1;j<boxes.length;j++)assert.equal(box.intersectsBox(boxes[j]),false,'相邻座舱不能重叠');});
  const pose=model.riderPose('wheel');assert.ok(boxes[0].containsPoint(pose.position),'角色落点必须位于自己的座舱内');
 }
 model.group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
});

test('游乐场消费每次20星光，刷新保留余额，重试不重复扣费且不能透支',()=>{
 const {wallet,purchase}=require('../server/world3d/playground.cjs'),{initial,view}=require('../server/world3d/engine.cjs');
 const state=initial();state.adventure={chapters:{bakery:{rewards:{orders:10,boxes:20,route:30}}}};
 const body={rideId:'carousel',requestId:'unique-request-0001',expectedSpent:0};
 assert.equal(wallet(state).balance,60);assert.equal(purchase(state,body).balance,40);assert.equal(purchase(state,body).balance,40);
 assert.equal(view(JSON.parse(JSON.stringify(state))).world.adventure.points,40);
 assert.throws(()=>purchase(state,{...body,rideId:'wheel'}),{status:409});
 assert.throws(()=>purchase(state,{...body,requestId:'unique-request-0002'}),{status:409});
 assert.equal(purchase(state,{...body,requestId:'unique-request-0002',expectedSpent:20}).balance,20);
 assert.equal(purchase(state,{...body,requestId:'unique-request-0003',expectedSpent:40}).balance,0);
 assert.throws(()=>purchase(state,{...body,requestId:'unique-request-0004',expectedSpent:60}),{status:400});
 assert.throws(()=>purchase(state,{...body,rideId:'other'}),{status:400});
 assert.throws(()=>purchase(state,{...body,expectedSpent:-20}),{status:400});
 assert.equal(wallet(initial()).balance,0);assert.equal(wallet(initial(),{demo:true}).balance,120);
});
test('蹦床正确时机蓄力会得分，空中结束要等落地，闲置也能超时退出',async()=>{
 const {createBounceRound}=await import('../public/world3d/playground-rules.mjs');const r=createBounceRound();assert.equal(r.jump(),true);r.update(.02);assert.equal(r.jump(),false,'空中乱按不应重复蓄力');
 for(let i=0;i<200&&!r.ready;i++)r.update(.01);assert.ok(r.ready);assert.equal(r.jump(),true);assert.equal(r.jump(),false,'一次落地只能蓄力一次');
 for(let i=0;i<100&&r.bounces<1;i++)r.update(.01);assert.equal(r.score,20);assert.ok(r.velocity>8);
 for(let i=0;i<20;i++)r.update(.01);assert.ok(r.height>0);r.stop();assert.equal(r.done,false);
 for(let i=0;i<300&&!r.done;i++)r.update(.01);assert.equal(r.done,true);assert.equal(r.height,0);assert.equal(r.jump(),false);
 const idle=createBounceRound();for(let i=0;i<700;i++)idle.update(.05);assert.ok(idle.done);
});
