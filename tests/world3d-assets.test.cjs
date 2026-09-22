const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server/index');

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

async function fixture(canSit=()=>true){
  const THREE=await import('../public/world3d/vendor/three.module.js');
  const {createHeroActions}=await import('../public/world3d/hero-actions.mjs');
  const hero=new THREE.Object3D();
  const durations={Idle:2,Walk:1.2,Run:.7,Jump:1.2,SitDown:1,StandUp:1};
  const clips=Object.entries(durations).map(([name,time])=>new THREE.AnimationClip(name,time,[new THREE.NumberKeyframeTrack('.position[y]',[0,time],[0,1])]));
  const actions=createHeroActions(hero,clips,{canSit});
  return {actions,tick(seconds,options={}){for(let t=0;t<seconds;t+=.01)actions.update(.01,options);}};
}

test('跑步开关改变移动速度，反复走跑停止仍可平滑切换',async()=>{
  const {actions:a,tick}=await fixture();
  try{
    assert.equal(a.speed,2.4);tick(.1,{moving:true});assert.equal(a.phase,'Walk');
    for(let i=0;i<10;i++){
      assert.equal(a.request('run'),true);tick(.1,{moving:true});assert.equal(a.phase,'Run');assert.equal(a.speed,3.2);
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
