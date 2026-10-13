const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const moduleURL=name=>pathToFileURL(path.resolve('public/world3d/'+name));

test('飞行持续3.5秒，先登艇再飞行，正常结束与跳过只切换一次地图',async()=>{
 const {createVoyageClock,flightDuration}=await import(moduleURL('airship-journey.mjs'));
 assert.equal(flightDuration,3.5);
 let arrivals=0;const clock=createVoyageClock(()=>arrivals++);
 assert.equal(clock.phase,'boarding');clock.update(.9);assert.equal(clock.phase,'flying');
 clock.update(flightDuration-.65-.01);assert.equal(arrivals,0);assert.equal(clock.phase,'flying');
 clock.update(.01);assert.equal(arrivals,1);assert.equal(clock.phase,'finished');
 clock.skip();clock.update(50);assert.equal(arrivals,1);
 const skip=createVoyageClock(()=>arrivals++);skip.skip();skip.skip();assert.equal(arrivals,2);
});
test('到达端先降落再下艇，中途销毁不会迟到跳转，也不会重复下艇',async()=>{
 const {createVoyageClock}=await import(moduleURL('airship-journey.mjs'));
 let exits=0;const landing=createVoyageClock(()=>exits++,true);
 assert.equal(landing.phase,'landing');landing.update(.65);assert.equal(landing.phase,'disembarking');assert.equal(exits,0);
 landing.update(.9);assert.equal(landing.phase,'finished');assert.equal(exits,1);
 const cancelled=createVoyageClock(()=>exits++);cancelled.dispose();cancelled.update(100);cancelled.skip();assert.equal(exits,1);
});
test('两座地图码头的步行入口可到达，船体位于岛外，不挡原来的六站',async()=>{
 const {ports}=await import(moduleURL('airship-journey.mjs'));
 const nav=await import(moduleURL('navigation3d.mjs'));
 for(const region of ['camp','sky']){
  const port=ports[region];assert.ok(nav.findPath({x:-4,z:4},port.approach,false)?.length);
  assert.ok(Math.abs(port.position.x)>16||Math.abs(port.position.z)>14);
 }
});
test('实际飞艇带着角色升空，连续点击只航行一次，切图后降落下艇并释放监听',async()=>{
 const previous=global.document;global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const T=await import(moduleURL('vendor/three.module.js'));
  const {mountAirship}=await import(moduleURL('airship.mjs'));
  const {takeArrival}=await import(moduleURL('airship-journey.mjs'));
  function harness(region,arrival){
   const status={},progress={},panel={hidden:true,querySelector:s=>s==='progress'?progress:status,remove(){}},dialogue={hidden:true,classList:{remove(){}}};
   const listeners=new Set(),root={querySelector:s=>s==='#town-dialogue'?dialogue:{classList:{add(){},remove(){}}},addEventListener:(n,f)=>listeners.add(f),removeEventListener:(n,f)=>listeners.delete(f)};
   const viewport={dataset:{},append(){},focus(){}},hero=new T.Group(),scene=new T.Scene(),actions={busy:false,resetToIdle(){},update(){}};
   hero.position.set(region==='camp'?14.5:0,.09,region==='camp'?0:12.5);
   const navigations=[],landings=[];
   global.document.createElement=name=>name==='div'?panel:{width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})};
   const voyage=mountAirship({root,viewport,scene,region,getHero:()=>hero,getActions:()=>actions,stopWalking(){},leave:p=>landings.push(p),say(){},enabled:true,arrival,navigate:r=>navigations.push(r)});
   return {voyage,hero,viewport,navigations,landings,listeners};
  }
  const camp=harness('camp');camp.voyage.start();camp.voyage.start();camp.voyage.update(.9);camp.voyage.update(1.4);
  assert.equal(camp.viewport.dataset.voyage,'flying');assert.ok(camp.hero.position.y>5);assert.ok(camp.hero.position.x>18.5);assert.ok(camp.voyage.camera);
  camp.voyage.update(2);assert.deepEqual(camp.navigations,['observatory']);camp.voyage.update(20);assert.equal(camp.navigations.length,1);
  const sky=harness('sky',takeArrival('sky'));assert.equal(sky.viewport.dataset.voyage,'landing');
  sky.voyage.update(.65);assert.equal(sky.viewport.dataset.voyage,'disembarking');sky.voyage.update(.9);
  assert.equal(sky.voyage.active,false);assert.deepEqual(sky.landings,[{x:0,z:12.5}]);
  sky.voyage.dispose();camp.voyage.dispose();assert.equal(sky.listeners.size,0);assert.equal(camp.listeners.size,0);
 }finally{if(previous===undefined)delete global.document;else global.document=previous;}
});
