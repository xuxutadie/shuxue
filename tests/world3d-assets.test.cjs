const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server/index');

test('新山谷入口能从广场、家园和游乐场往返，平台边缘和石柱阻挡步行',async()=>{
 const {findPath,advancePath,canStand}=await import('../public/world3d/navigation3d.mjs');
 const {valleyGate}=await import('../public/world3d/valley-layout.mjs');
 const {townHome}=await import('../public/world3d/home-layout.mjs');
 for(const start of [{x:-4,z:4},townHome.door,{x:19,z:0},{x:0,z:2.5}]){
  const path=findPath(start,valleyGate.approach);assert.ok(path?.length);
  const result=advancePath(start,path,200);assert.equal(result.blocked,false);
  assert.deepEqual(result.position,valleyGate.approach);
  assert.ok(findPath(valleyGate.approach,start)?.length);
 }
 assert.equal(canStand(2.6,19.5),false);assert.equal(canStand(9.4,19.5),false);
 assert.equal(canStand(6,23),false);assert.equal(canStand(0,18),false);
 assert.equal(canStand(6,17,false),false,'营地不能获得小镇扩建边界');
 assert.equal(canStand(0,11.5,false),true,'营地原返回落点继续可用');
});

test('只有 3D 页面允许读取 GLB 内嵌的本地贴图，普通教学页面保持原策略',async()=>{
  const server=createApp({query(){throw new Error('静态资源不应访问数据库');}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const normal=await fetch(base+'/');
    const preview=await fetch(base+'/world3d/character-preview.html');
    assert.equal(normal.status,200);assert.equal(preview.status,200);
    assert.doesNotMatch(normal.headers.get('content-security-policy'),/blob:/);
    const policy=preview.headers.get('content-security-policy');
    assert.match(policy,/connect-src 'self' blob:/);
    assert.match(policy,/img-src 'self' data: blob:/);
    assert.match(policy,/script-src 'self';/);
    const model=await fetch(base+'/world3d/assets/explorer-actions-v2.glb');
    assert.equal(model.status,200);
    const bytes=Buffer.from(await model.arrayBuffer());
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
    assert.ok(gltf.skins?.length,'新主角必须包含骨骼');
    for(const name of ['Idle','Walk','Run','Jump','SitDown','StandUp'])assert.ok(gltf.animations.some(clip=>clip.name===name),`缺少 ${name} 动作`);
    assert.ok(bytes.length<5*1024*1024,'游戏主角应使用压缩后的模型');
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('家园各区域可以互通，走路不穿床、隔墙和家具，小镇可走到家门口',async()=>{
 const home=await import('../public/world3d/home-layout.mjs');
 for(const obstacle of home.obstacles)assert.equal(home.canStand(obstacle.x,obstacle.z),false);
 for(const start of Object.values(home.spots))for(const end of Object.values(home.spots)){
  const path=home.findPath(start,end);assert.ok(path,'室内落点应连通');let position=start;
  for(let i=0;i<600&&path.length;i++){const step=home.advancePath(position,path,.1);assert.equal(step.blocked,false);position=step.position;assert.equal(home.canStand(position.x,position.z),true);}
  assert.equal(path.length,0);assert.ok(Math.hypot(position.x-end.x,position.z-end.z)<.02);
 }
 const town=await import('../public/world3d/navigation3d.mjs');
 assert.ok(town.findPath({x:-4,z:4},home.townHome.door));
 assert.equal(town.canStand(home.townHome.x,home.townHome.z),false);
 assert.equal(town.canStand(-12,0),true,'旧住宅位置应恢复通行');
 assert.equal(town.canStand(-25,3,false),false,'营地不能走到住宅区的空中');
 for(const end of [home.townHome.door,{x:-32,z:3},{x:-25,z:8},{x:-31,z:-8}]){
  const path=town.findPath({x:-4,z:4},end);assert.ok(path,'住宅区与广场必须连通');let position={x:-4,z:4};
  for(let i=0;i<2000&&path.length;i++){const step=town.advancePath(position,path,.15);assert.equal(step.blocked,false);position=step.position;}
  assert.equal(path.length,0);assert.ok(Math.hypot(position.x-end.x,position.z-end.z)<.02);
 }
 for(let i=0;i<6;i++)assert.ok(town.findPath(home.townHome.door,town.meetingPoint(i)),'新家仍可抵达每个任务点');
 for(const obstacle of home.gardenObstacles)assert.equal(town.canStand(obstacle.x,obstacle.z),false);
 assert.equal(town.canStand(-34,0),false);assert.equal(town.canStand(-25,10),false);
 const wallStop=town.stepPosition(home.townHome.door,-12,0);assert.ok(wallStop.x>-24,'不能从新正门穿过旋转后的住宅');
 assert.ok(home.townHome.door.x>home.townHome.x,'正门应位于朝向广场的东侧');
 assert.equal(home.townHome.door.z,home.townHome.z);
 assert.equal(town.canStand(-27,3.8),false,'旋转后的侧墙应阻挡角色');
 assert.equal(town.canStand(-30.5,0),true,'屋后空地不应有旧碰撞体');
 const stopped=home.stepPosition({x:-1,z:-1},10,0);assert.ok(stopped.x<0,'大步移动也不能穿过隔墙');
});

async function fixture(canSit=()=>true){
  const THREE=await import('../public/world3d/vendor/three.module.js');
  const {createHeroActions}=await import('../public/world3d/hero-actions.mjs');
  const hero=new THREE.Object3D();
  const durations={Idle:2,Walk:1.2,Run:.7,Jump:1.2,SitDown:1,StandUp:1};
  const clips=Object.entries(durations).map(([name,time])=>new THREE.AnimationClip(name,time,[new THREE.NumberKeyframeTrack('.position[y]',[0,time],[0,1])]));
  const actions=createHeroActions(hero,clips,{canSit});
  return {actions,tick(seconds,options={}){for(let t=0;t<seconds;t+=.01)actions.update(.01,options);}};
}

test('两位主角都有轻量骨骼模型和同一组六种动作，旧存档默认男生',async()=>{
 const fs=require('node:fs');const {heroes,heroFor}=await import('../public/world3d/hero-catalog.mjs');
 assert.equal(heroFor(undefined).id,'boy');assert.equal(heroFor('bad').id,'boy');assert.equal(heroFor('girl').id,'girl');
 assert.equal(heroes.length,2);
 for(const hero of heroes){
  const bytes=fs.readFileSync('public'+hero.asset.split('?')[0]);
  assert.ok(bytes.length<5*1024*1024);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.skins.length,1);assert.equal(json.skins[0].joints.length,22);
  assert.deepEqual(json.animations.map(a=>a.name).sort(),['Idle','Jump','Run','SitDown','StandUp','Walk']);
  for(const a of json.animations){assert.ok(a.channels.length>0);assert.ok(a.samplers.every(s=>json.accessors[s.input].count>1));}
  const primitive=json.meshes[0].primitives[0];assert.ok(primitive.attributes.JOINTS_0!==undefined);assert.ok(primitive.attributes.WEIGHTS_0!==undefined);
 }
});

test('跑步开关改变移动速度，反复走跑停止仍可平滑切换',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    assert.equal(a.speed,2.9);tick(.1,{moving:true});assert.equal(a.phase,'Walk');
    for(let i=0;i<10;i++){
      assert.equal(a.request('run'),true);tick(.1,{moving:true});assert.equal(a.phase,'Run');assert.equal(a.speed,3.6);
      tick(.1);assert.equal(a.phase,'Idle');assert.equal(a.running,true);
      a.request('run');tick(.1,{moving:true});assert.equal(a.phase,'Walk');
    }
  }finally{a.dispose();}
});

test('跳跃单次播放，不能重复起跳或空中坐下，落地恢复走跑',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    a.request('run');a.request('jump');assert.equal(a.phase,'Jump');assert.equal(a.canMove,true);
    assert.equal(a.request('jump'),false);assert.equal(a.request('sit'),false);
    tick(.6,{moving:true});assert.equal(a.phase,'Jump');
    tick(.7,{moving:true});assert.equal(a.phase,'Run');
    assert.equal(a.request('jump'),true);tick(1.3);assert.equal(a.phase,'Idle');
  }finally{a.dispose();}
});

test('坐下保持不循环，移动先起身，反复起坐不会卡住',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    for(let i=0;i<3;i++){
      a.request('sit');assert.equal(a.canMove,false);tick(1.1);assert.equal(a.phase,'Seated');
      tick(2);assert.equal(a.phase,'Seated');assert.equal(a.request('jump'),false);
      tick(.1,{wantsMove:true});assert.equal(a.phase,'StandUp');assert.equal(a.canMove,false);
      tick(1.1,{moving:true,wantsMove:true});assert.equal(a.phase,'Walk');assert.equal(a.canMove,true);
    }
    a.request('sit');tick(.5,{wantsMove:true});assert.equal(a.phase,'SitDown');
    tick(.6,{wantsMove:true});assert.equal(a.phase,'StandUp');
  }finally{a.dispose();}
});

test('答题时拒绝动作与移动，已起跳的角色会完成落地',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    a.request('jump');tick(.4);tick(.1,{blocked:true});assert.equal(a.canMove,false);
    for(const key of ['run','jump','sit'])assert.equal(a.request(key),false);
    tick(1.2,{blocked:true,moving:true});assert.equal(a.phase,'Idle');
    tick(.1,{blocked:false});assert.equal(a.request('sit'),true);
    tick(1.1,{blocked:true});assert.equal(a.phase,'Seated');
    tick(.1,{blocked:false});assert.equal(a.request('sit'),true);tick(1.1);assert.equal(a.phase,'Idle');
  }finally{a.dispose();}
});

test('轻按方向键也能起身，坐下过程中收到移动指令会顺序完成起身',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    a.request('sit');tick(.2);assert.equal(a.request('stand'),true);
    tick(.9);assert.equal(a.phase,'StandUp');tick(1.1);assert.equal(a.phase,'Idle');
    a.request('sit');tick(1.1);a.request('stand');assert.equal(a.phase,'StandUp');
    tick(1.1);assert.equal(a.canMove,true);
  }finally{a.dispose();}
});

test('没有凳子不能坐下，对齐座位后才能坐；起身不依赖再次寻找凳子',async()=>{
  let aligned=false;
  const {actions:a,tick}=await fixture(()=>aligned);
  try{
    assert.equal(a.request('sit'),false);assert.equal(a.phase,'Idle');
    aligned=true;assert.equal(a.request('sit'),true);tick(1.1);assert.equal(a.phase,'Seated');
    aligned=false;assert.equal(a.request('sit'),true);tick(1.1);assert.equal(a.phase,'Idle');
    assert.equal(a.request('sit'),false);
  }finally{a.dispose();}
});

test('凳前站位可通过正常寻路抵达，远处及关卡入口不误判为座位',async()=>{
  const {seats,nearbySeat,seatAtPoint}=await import('../public/world3d/seats.mjs');
  const {canStand,findPath}=await import('../public/world3d/navigation3d.mjs');
  for(const seat of seats){
    assert.equal(canStand(seat.approach.x,seat.approach.z),true);
    assert.ok(findPath({x:-4,z:4},seat.approach));
    assert.equal(nearbySeat(seat.approach).id,seat.id);
    assert.equal(seatAtPoint({x:seat.x,y:.67,z:seat.z}).id,seat.id);
    assert.equal(seatAtPoint({x:seat.x,y:.09,z:seat.z}),null);
  }
  assert.equal(nearbySeat({x:0,z:11.5}),null);
  assert.equal(nearbySeat({x:0,z:0}),null);
});

test('广场两排长椅相对，模型靠背与人物坐下方向一致，喷泉水滴持续运动',async()=>{
 const fs=require('node:fs'),T=await import('../public/world3d/vendor/three.module.js');
 const {GLTFLoader}=await import('../public/world3d/vendor/GLTFLoader.js');
 const {preparePlaza,createPlazaFountain}=await import('../public/world3d/plaza.mjs');
 const {seats,campSeats}=await import('../public/world3d/seats.mjs');
 const bytes=fs.readFileSync('public/world3d/assets/thinking-town.glb');
 const town=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const report=preparePlaza(town.scene);assert.ok(report.rotatedVertices>100);assert.ok(report.removedTriangles>10);
 assert.equal(town.scene.getObjectByName('Landscape_广场水面').visible,false);
 const p=new T.Vector3();
 for(const seat of seats){
  assert.ok(Math.cos(seat.yaw)*seat.z<0,'长椅应面向另一排');
  assert.ok(Math.abs(seat.approach.z)<Math.abs(seat.z),'上座位置应位于两排长椅之间');
  let backs=0;
  town.scene.traverse(o=>{if(!o.isMesh||!o.name.startsWith('Landscape_'))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){
   p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
   if(Math.abs(p.x-seat.x)<1.3&&Math.abs(p.z-seat.z)<.7&&p.y>.95&&p.y<1.6){backs++;assert.ok((p.z-seat.z)*Math.cos(seat.yaw)<0,'靠背应在人物后方');}
  }});assert.ok(backs>10,'每张椅子仍应保留靠背');
 }
 assert.ok(campSeats.every(s=>s.yaw===0&&s.approach.z>s.z),'营地长凳朝向不变');
 const fountain=createPlazaFountain(),drops=fountain.group.getObjectByName('fountain-moving-droplets');
 const original=Array.from(drops.instanceMatrix.array);fountain.update(.08);assert.notDeepEqual(Array.from(drops.instanceMatrix.array),original);
 const bounds=new T.Box3().setFromObject(fountain.group);assert.ok(bounds.max.y>2.8,'主水柱应高到清晰可见');assert.ok(bounds.max.x<2&&bounds.min.x>-2,'池体保持在原来的碰撞范围内');
 for(const root of [town.scene,fountain.group])root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});
});
