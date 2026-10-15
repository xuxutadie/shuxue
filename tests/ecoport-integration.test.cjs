const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {database,migrate}=require('../server/db');
const {createApp}=require('../server/index');
const engine=require('../server/world3d/engine.cjs');
const sky=require('../server/world3d/observatory.cjs');
let pool,server,base,classId;const ids=[],clients=[];
before(async()=>{
 pool=database();await migrate(pool);
 for(const role of ['teacher','teacher','student','student']){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),csrf=randomBytes(20).toString('hex');ids.push(id);
  await pool.query('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,$5,false)',[id,'eco_'+id.slice(0,12),'生态港测试','unused-test-hash',role]);
  await pool.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),id,csrf]);
  clients.push(async(url,body)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:'math_session='+token,'X-CSRF-Token':csrf,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};});
 }
 classId=randomUUID();await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)',[classId,ids[0],'生态港测试班']);
 for(const id of ids.slice(2))await pool.query('INSERT INTO students(user_id,class_id,data) VALUES($1,$2,$3)',[id,classId,JSON.stringify({completed:[],practice:{},talk:{},notes:{},history:[],games:{factor:{date:'原记录'}}})]);
 server=createApp(pool).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
 if(pool){try{
  await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])',[ids]);
  if(classId)await pool.query('DELETE FROM classes WHERE id=$1',[classId]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
 }finally{await pool.end();}}
});
const body=config=>({stageId:'eco-1-1',attemptId:randomUUID(),revision:0,seconds:12,hintsUsed:0,config});
const url=()=>'/api/world3d/'+ids[2];
test('生态港执行三图通关、教师只读、跨账号与可信试玩权限',async()=>{
 const input=body({pairs:[[0,1],[2,3],[4,5],[6,7]],area:44});
 assert.equal((await clients[2](url()+'/ecoport',{...input,demo:true})).status,403);
 assert.equal((await clients[0](url()+'/ecoport',input)).status,403);
 assert.equal((await clients[3](url()+'/ecoport',input)).status,404);
 assert.equal((await clients[1](url())).status,404);
 assert.equal((await clients[2]('/api/world3d/demo/ecoport',input)).status,403);
 const demo=(await clients[0]('/api/world3d/demo')).data;
 assert.equal(demo.world.ecoport.unlocked,true);assert.equal(demo.world.ecoport.completed,0);
 // 教师直接体验最后一站，权限与顺序例外只来自服务端登录身份。
 const trial=await clients[0]('/api/world3d/demo/ecoport',{...input,stageId:'eco-6-1',config:{inflow:3,outflow:9,netChange:-6,minutes:9,remaining:0}});
 assert.equal(trial.status,200);assert.equal(trial.data.state.world.ecoport.completed,1);
 assert.equal((await clients[1]('/api/world3d/demo')).data.world.ecoport.completed,0);
 assert.equal((await clients[2](url())).data.world.ecoport.completed,0);
});
test('生态港并发提交一次计数、个人持久化及新旧地图星光守恒',async()=>{
 const original=(await pool.query('SELECT data FROM students WHERE user_id=$1',[ids[2]])).rows[0].data;
 try{
  const seeded=structuredClone(original);seeded.world3d=engine.initial();
  seeded.world3d.observatory={revision:18,records:Object.fromEntries(sky.stages.map(q=>[q.id,{passed:true,count:1,firstCorrect:true,firstSuccessAt:1,history:[]}]))};
  await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(seeded)]);
  const before=(await clients[2](url())).data;
  assert.equal(before.world.ecoport.unlocked,true);assert.equal(before.world.playground.balance,420);
  const input=body({pairs:[[0,1],[2,3],[4,5],[6,7]],area:44});
  const replies=await Promise.all([clients[2](url()+'/ecoport',input),clients[2](url()+'/ecoport',input)]);
  assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.equal(replies.reduce((n,r)=>n+r.data.reward,0),20);
  const loaded=(await clients[2](url())).data,teacher=(await clients[0](url())).data;
  assert.equal(loaded.world.ecoport.completed,1);assert.equal(loaded.world.playground.balance,440);
  assert.equal(loaded.world.adventure.points,440);assert.equal(teacher.report.ecoport[0].count,1);
  assert.equal(teacher.report.ecoport[0].firstSuccessAt,1);
  assert.equal((await clients[3]('/api/world3d/'+ids[3])).data.world.ecoport.completed,0);
  const saved=(await pool.query('SELECT data FROM students WHERE user_id=$1',[ids[2]])).rows[0].data;
  assert.deepEqual(saved.world3d.observatory,seeded.world3d.observatory);assert.deepEqual(saved.games,original.games);
  const purchase=await clients[2](url()+'/playground',{rideId:'surf',requestId:randomUUID(),expectedSpent:0});
  assert.equal(purchase.status,200);assert.equal(purchase.data.balance,420);
 }finally{await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(original)]);}
});
test('回顾测评进行中不能从生态港接口获得游戏帮助或写入进度',async()=>{
 const original=(await pool.query('SELECT data FROM students WHERE user_id=$1',[ids[2]])).rows[0].data;
 try{
  const copy=structuredClone(original);copy.reviewExam={enabled:true,attempt:{deadline:new Date(Date.now()+3600000).toISOString(),submitted_at:null}};
  await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(copy)]);
  assert.equal((await clients[2](url())).status,403);
  assert.equal((await clients[2](url()+'/ecoport',body({}))).status,403);
 }finally{await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(original)]);}
});
