const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const sky=require('../server/world3d/observatory.cjs');
const engine=require('../server/world3d/engine.cjs');
const {wallet}=require('../server/world3d/playground.cjs');

// 独立枚举可行解，检验题目不是无解关卡，也不依赖前端提供的正确标志。
function solve(q){
 const d=q.data;
 if(q.kind==='balance')return {removed:d.fixed,groups:d.capsules,unit:(d.total-d.fixed)/d.capsules};
 if(q.kind==='pattern')return {colors:[0,1,2].map(i=>d.pattern[(d.start+i-1)%d.pattern.length])};
 if(q.kind==='gear'){let time=1;while(!d.periods.every(p=>time%p===0))time++;return {time};}
 if(q.kind==='mirror')return {turns:[[1],[1,1],[1,1,-1]][q.level]};
 if(q.kind==='logic'){
  const answers=d.people.map((p,person)=>({person,truth:d.claims.map(c=>c.set.includes(person)!==!!c.not)})).filter(a=>a.truth.filter(Boolean).length===d.trueCount);
  assert.equal(answers.length,1,'逻辑题应有唯一信号来源');return answers[0];
 }
 const paths=[];
 function walk(x,y,path,visited){
  if(x>=d.size||y>=d.size||d.blocked.some(p=>p[0]===x&&p[1]===y))return;
  visited=[...visited,`${x},${y}`];
  if(x===d.size-1&&y===d.size-1){if(d.via.every(p=>visited.includes(p.join(','))))paths.push(path);return;}
  walk(x+1,y,[...path,'E'],visited);walk(x,y+1,[...path,'N'],visited);
 }
 walk(0,0,[],[]);assert.ok(paths.length>=d.routes);return {paths:paths.slice(0,d.routes)};
}
const body=(s,q,config=solve(q))=>({stageId:q.id,config,revision:s.observatory?.revision||0,seconds:3,attemptId:randomUUID()});

test('18项挑战均有有效方案，错误方案不通关',()=>{
 assert.equal(sky.stages.length,18);assert.equal(new Set(sky.stages.map(q=>q.id)).size,18);
 for(const q of sky.stages){assert.equal(sky.judge(q,solve(q)).correct,true,q.id);assert.equal(sky.judge(q,{}).correct,false,q.id);}
});
test('旧存档保持不变，学生锁定第三地图，教师可以独立试玩',()=>{
 const s=engine.initial(),before=JSON.stringify(s);
 assert.equal(engine.view(s).world.observatory.unlocked,false);
 assert.equal(engine.view(s,{demo:true}).world.observatory.unlocked,true);
 assert.equal(JSON.stringify(s),before);assert.throws(()=>sky.submit(s,body(s,sky.stages[0]),false),{status:403});
 assert.equal(s.observatory,undefined);
});
test('不能跳关；答错后能重试，并保存首次答对次数',()=>{
 const s=engine.initial();assert.throws(()=>sky.submit(s,body(s,sky.stages[1]),true),{status:403});
 const q=sky.stages[0];const wrong=sky.submit(s,body(s,q,{removed:0,groups:1,unit:6}),true);
 assert.equal(wrong.correct,false);assert.equal(sky.earned(s),0);
 assert.equal(sky.submit(s,body(s,q),true).reward,10);
 const r=sky.report(JSON.parse(JSON.stringify(s)))[0];assert.equal(r.count,2);assert.equal(r.firstCorrect,false);assert.equal(r.firstSuccessAt,2);assert.equal(r.history.length,2);
 assert.equal(sky.view(s,true).active,1);
});
test('重试提交幂等，多标签旧版本和篡改请求不发奖',()=>{
 const s=engine.initial(),payload=body(s,sky.stages[0]);
 assert.equal(sky.submit(s,payload,true).reward,10);const before=JSON.stringify(s);
 assert.equal(sky.submit(s,payload,true).reward,0);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>sky.submit(s,{...payload,config:{unit:100}},true),{status:409});
 assert.throws(()=>sky.submit(s,{...body(s,sky.stages[1]),revision:0},true),{status:409});
 assert.throws(()=>sky.submit(s,body(s,sky.stages[0]),true),{status:403});
 assert.equal(sky.earned(s),10);
});
test('完整18关逐站解锁，首次通关奖励420星光，存档及账户互不影响',()=>{
 let s=engine.initial();const another=engine.initial();let rewards=0;
 for(const [i,q] of sky.stages.entries()){
  assert.equal(sky.view(s,true).active,i);
  const result=sky.submit(s,body(s,q),true);rewards+=result.reward;
  assert.equal(result.stationComplete,q.level===2);
  s=JSON.parse(JSON.stringify(s));
 }
 assert.equal(rewards,420);assert.equal(sky.view(s,true).completed,18);assert.equal(sky.view(s,true).active,-1);
 assert.ok(sky.view(s,true).stations.every(m=>m.repaired));assert.equal(wallet(s).balance,420);
 assert.equal(engine.view(s).world.adventure.points,420);
 assert.equal(sky.earned(another),0);assert.equal(sky.view(another,true).active,0);
});
test('路径必须经过补给点，双路线不能重复，齿轮不能接受后续共同周期',()=>{
 const route=sky.stages[17],answer=solve(route);
 assert.equal(sky.judge(route,{paths:[answer.paths[0],answer.paths[0]]}).correct,false);
 assert.equal(sky.judge(route,{paths:[['E','N']]}).correct,false);
 const gear=sky.stages[6];assert.equal(sky.judge(gear,{time:24}).correct,false);
 const mirror=sky.stages[11];assert.equal(sky.judge(mirror,{turns:[1,1,1]}).correct,false);
});
test('天文城可构建及播放修复动画，悬空岩石不能穿出岛面，六站都能步行到达',async()=>{
 const {pathToFileURL}=require('node:url'),path=require('node:path');
 const previous=global.document;
 global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const {createObservatory}=await import(pathToFileURL(path.resolve('public/world3d/observatory-model.mjs')));
  const nav=await import(pathToFileURL(path.resolve('public/world3d/navigation3d.mjs')));
  const progress=sky.view(engine.initial(),true),model=createObservatory(()=>progress);
  model.animate(.1);progress.stations.forEach(m=>m.repaired=true);progress.complete=true;model.animate(.1);
  model.scene.updateMatrixWorld(true);
  const rocks=model.scene.children.filter(m=>m.geometry?.type==='ConeGeometry');assert.equal(rocks.length,13);
  for(const rock of rocks){rock.geometry.computeBoundingBox();assert.ok(rock.geometry.boundingBox.clone().applyMatrix4(rock.matrixWorld).max.y<-.8);}
  for(let i=0;i<6;i++)assert.ok(nav.findPath({x:-4,z:4},nav.meetingPoint(i),false)?.length);
  model.scene.traverse(o=>{assert.ok(Number.isFinite(o.position.y));o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
 }finally{if(previous===undefined)delete global.document;else global.document=previous;}
});
