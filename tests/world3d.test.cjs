const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const engine=require('../server/world3d/engine.cjs');
const {courses,questions,firstQuestions,campCourses}=require('../server/world3d/content.cjs');
const {judgeCampGame}=require('../server/world3d/camp-games.cjs');
const adventure=require('../server/world3d/adventure.cjs');
test('独立游戏入口保留学生身份与教师查看目标，替换中转页而非嵌入',()=>{
 for(const item of [{teacher:false,previewStudentId:null,user:{id:'student-1'},expected:'/world3d/?student=student-1#world'}, {teacher:true,previewStudentId:null,expected:'/world3d/#world'}, {teacher:true,previewStudentId:null,view:'student',expected:'/world3d/?student=student-2#report'}, {teacher:false,previewStudentId:'student-2',expected:'/world3d/?student=student-2#report'}]){
  let target;const scope=vm.createContext({...item,pupil:()=>({id:'student-2'}),location:{replace:url=>target=url}});
  vm.runInContext(fs.readFileSync('public/game-world.js','utf8'),scope);scope.view=item.view||'';
  const html=vm.runInContext('gameWorldPage(view)',scope);assert.equal(target,item.expected);assert.ok(!html.includes('<iframe'));
 }
});
function audioHarness(saved){
 const events={},windowEvents={},tones=[],timers=new Map(),storage={},buses=[];let contexts=0;
 const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
 class AudioContext{
  constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={};}
  async resume(){this.state='running';}async suspend(){this.state='suspended';}
  createGain(){const g={gain:parameter(),connect(){},disconnect(){}};buses.push(g);return g;}
  createOscillator(){const o={frequency:parameter(),connect(){},disconnect(){},start(){tones.push(o);},stop(){o.stopped=true;}};return o;}
 }
 const document={hidden:false,querySelectorAll:()=>[],addEventListener:(k,f)=>events[k]=f};
 const scope={document,window:{AudioContext,addEventListener:(k,f)=>windowEvents[k]=f},localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem:(k,v)=>storage[k]=v},setInterval:f=>{const id=timers.size+1;timers.set(id,f);return id;},clearInterval:id=>timers.delete(id)};
 vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/world3d/game-audio.js'),'utf8')+'\nthis.audio=GameAudio;',scope);
 return {scope,tones,timers,buses,events,windowEvents,storage,contexts:()=>contexts,click:async kind=>{events.click({target:{closest:()=>({dataset:{soundAction:kind}})}});await Promise.resolve();await Promise.resolve();}};
}
test('游戏声音等待操作解锁，正确和错误音阶不同，静音不播放',async()=>{
 const h=audioHarness();assert.equal(h.contexts(),0);h.scope.audio.result(true);assert.equal(h.tones.length,0);
 await h.scope.audio.unlock();assert.equal(h.contexts(),1);assert.equal(h.timers.size,1);
 const before=h.tones.length;h.scope.audio.result(true);const good=h.tones.slice(before).map(o=>o.frequency.value);assert.equal(good.length,4);assert.ok(good.every((n,i)=>!i||n>good[i-1]));
 const next=h.tones.length;h.scope.audio.result(false);const bad=h.tones.slice(next).map(o=>o.frequency.value);assert.equal(bad.length,3);assert.ok(bad.every((n,i)=>!i||n<bad[i-1]));
 await h.click('effects');const count=h.tones.length;h.scope.audio.result(true);assert.equal(h.tones.length,count);assert.equal(JSON.parse(h.storage['math-world-sound-v1']).effects,false);
 await h.click('music');assert.equal(h.timers.size,0);
});
test('答题时降低配乐，隐藏和离开页面停止声音，静音偏好可恢复',async()=>{
 const h=audioHarness();await h.scope.audio.unlock();h.scope.audio.mode(true);assert.equal(h.buses[0].gain.value,.32);h.scope.audio.mode(false);assert.equal(h.buses[0].gain.value,.7);
 h.scope.document.hidden=true;h.events.visibilitychange();assert.equal(h.timers.size,0);assert.ok(h.tones.every(o=>o.stopped));const count=h.tones.length;h.scope.audio.result(false);assert.equal(h.tones.length,count);
 h.scope.document.hidden=false;h.events.visibilitychange();assert.equal(h.timers.size,1);h.windowEvents.pagehide();assert.equal(h.timers.size,0);
 const muted=audioHarness({music:false,effects:false});await muted.scope.audio.unlock();assert.equal(muted.contexts(),0);await muted.click('music');assert.equal(muted.contexts(),1);assert.equal(muted.timers.size,1);
});
const storyBoards=[{places:{0:0,1:1,2:0,3:1},work:{first:'500',second:'2'}},{size:4,work:{first:'100',second:'4'}},{places:Object.fromEntries(Array.from({length:20},(_,i)=>[i,Math.min(i,19-i)])),work:{first:'21',second:'10'}},{arranged:true,work:{first:'1',second:'100'}}];
test('角色设置兼容旧档案，只改变外观，不重置关卡、积分或答题版本',()=>{
 const s=engine.initial();assert.equal(engine.view(s).world.character,'boy');
 engine.start(s,'story-bakery');storyAction(s,'submit',{answer:'1000',bakery:storyBoards[0]});
 const original=structuredClone(s);
 assert.deepEqual(engine.selectCharacter(s,'girl'),{character:'girl'});
 assert.equal(engine.view(s).world.character,'girl');assert.equal(engine.view(JSON.parse(JSON.stringify(s))).world.character,'girl');
 const {character,...rest}=s;assert.deepEqual(rest,original);
 for(const invalid of ['other','../assets','',null,{},['girl']])assert.throws(()=>engine.selectCharacter(s,invalid),{status:400});
 assert.equal(s.character,'girl');engine.selectCharacter(s,'boy');assert.equal(engine.view(s).world.character,'boy');
});
function storyAction(s,action,extra={}){const r=engine.view(s).run;return engine.runAction(s,{runId:r.id,revision:r.version,action,...extra});}

test('最后一题答对后自动结算，答错、只读、非末题和查看解析不自动结算',async()=>{
 const scope=vm.createContext({});vm.runInContext(fs.readFileSync('public/world3d/completion.js','utf8'),scope);
 const finish=scope.finishGameRun;
 for(const [action,out] of [['submit',{run:{index:0,total:4,result:{correct:true}}}],['submit',{run:{index:3,total:4,result:{correct:false}}}],['submit',{readonly:true,run:{index:3,total:4,result:{correct:true}}}],['reveal',{run:{index:3,total:4,result:{revealed:true}}}]]){
  assert.equal(await finish(action,out,()=>assert.fail('不应自动前进')),out);
 }
 const s=engine.initial();engine.start(s,'story-bakery');
 for(let i=0;i<3;i++){storyAction(s,'submit',{answer:['1000','400','210'][i],bakery:storyBoards[i]});storyAction(s,'next');}
 storyAction(s,'submit',{answer:'3700',bakery:storyBoards[3]});const submitted=engine.view(s);
 await assert.rejects(finish('submit',submitted,async()=>{throw Error('连接失败');}),/连接失败/);
 assert.equal(engine.view(s).run.result.correct,true);assert.equal(engine.view(s).world.adventure.done,false);
 const out=await finish('submit',submitted,async(url,body)=>{assert.equal(url,'/run');const result=engine.runAction(s,body);return {...engine.view(s),...result};});
 assert.equal(out.completed,true);assert.equal(out.run,null);assert.equal(out.world.adventure.done,true);assert.equal(out.world.adventure.points,120);
 assert.ok(Object.values(s.records).every(r=>r.count===1));
 assert.equal(await finish('submit',out,()=>assert.fail('不能重复结算')),out);
});
test('分组题核对中间数量，允许多种有效分组，重试保留摆法和输入',()=>{
 const s=engine.initial();engine.start(s,'story-bakery');storyAction(s,'submit',{answer:'1000',bakery:storyBoards[0]});storyAction(s,'next');
 storyAction(s,'submit',{answer:'400',bakery:{size:4}});
 assert.equal(engine.view(s).run.result.correct,false);assert.match(engine.view(s).run.result.feedback,/每批多少/);assert.equal(adventure.view(s).points,10);
 storyAction(s,'retry');assert.equal(engine.view(s).run.draft,'400');assert.equal(engine.view(s).run.bakery.size,4);
 storyAction(s,'submit',{answer:'400',bakery:{size:4,work:{first:'100',second:'16'}}});assert.match(engine.view(s).run.result.feedback,/一共几批/);
 storyAction(s,'retry');const ready=JSON.stringify(s);
 for(const size of [2,4,8]){const copy=JSON.parse(ready);storyAction(copy,'submit',{answer:'400',bakery:{size,work:{first:String(25*size),second:String(16/size)}}});assert.equal(engine.view(copy).run.result.correct,true);assert.match(engine.view(copy).run.result.explanation,new RegExp('每批'+size+'盒'));assert.equal(adventure.view(copy).points,30);}
});
test('同类迁移不重复领奖，首尾配对变式必须考虑单独一站',()=>{
 const s=engine.initial();engine.start(s,'story-bakery');assert.throws(()=>storyAction(s,'transfer'),{status:400});
 storyAction(s,'submit',{answer:'1000',bakery:storyBoards[0]});storyAction(s,'transfer');assert.equal(engine.view(s).run.lesson.isVariant,true);assert.equal(engine.view(s).run.bakery,null);
 const skipped=JSON.parse(JSON.stringify(s));storyAction(skipped,'next');assert.equal(engine.view(skipped).run.index,1);assert.equal(engine.view(skipped).run.optional,false);assert.equal(adventure.view(skipped).points,10);
 storyAction(s,'submit',{answer:'200',bakery:{...storyBoards[0],work:{first:'100',second:'2'}}});assert.equal(engine.view(s).run.result.correct,true);assert.equal(adventure.view(s).points,10);assert.throws(()=>storyAction(s,'transfer'),{status:400});
 storyAction(s,'next');storyAction(s,'submit',{answer:'400',bakery:storyBoards[1]});storyAction(s,'next');storyAction(s,'submit',{answer:'210',bakery:storyBoards[2]});storyAction(s,'transfer');
 const places=Object.fromEntries(Array.from({length:15},(_,i)=>[i,Math.min(i,14-i)]));
 storyAction(s,'submit',{answer:'240',bakery:{places,work:{first:'32',second:'7'}}});assert.match(engine.view(s).run.result.feedback,/单独一站/);
 storyAction(s,'retry');storyAction(s,'submit',{answer:'240',bakery:{places,work:{first:'32',second:'7',extra:'16'}}});assert.equal(engine.view(s).run.result.correct,true);
 assert.equal(s.records[adventure.variants[2].id].last.work.extra,'16');
});
test('观察输入不泄露标准答案；配满后能取出订单重新摆放，只读不可操作',()=>{
 const s=engine.initial();engine.start(s,'story-bakery');const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/world3d/town.js','utf8'),context);context.p={run:engine.view(s).run};
 const html=vm.runInContext('ThinkingBakery.learning(p)',context);assert.match(html,/每篮多少个/);assert.ok(!html.includes('500'));assert.ok(!JSON.stringify(engine.view(s).run.lesson).includes('500'));
 context.p.run.bakery=structuredClone(storyBoards[0]);vm.runInContext('ThinkingBakery.act(p,"select",0)',context);assert.equal(context.p.bakery.places[0],undefined);
 context.p.readonly=true;assert.match(vm.runInContext('ThinkingBakery.learning(p)',context),/disabled/);assert.match(vm.runInContext('ThinkingBakery.board(p)',context),/disabled/);
});
test('剧情奖励必须同时完成操作与答题，错答不泄露答案，可以重试',()=>{
 const s=engine.initial();engine.start(s,'story-bakery');
 storyAction(s,'submit',{answer:'1000'});
 assert.equal(engine.view(s).run.result.correct,false);assert.equal(engine.view(s).run.result.answer,undefined);
 assert.equal(adventure.view(s).points,0);
 assert.throws(()=>storyAction(s,'next'),{status:400});
 storyAction(s,'retry');storyAction(s,'submit',{answer:'1000',bakery:storyBoards[0]});
 assert.equal(adventure.view(s).points,10);
 assert.throws(()=>storyAction(s,'submit',{answer:'1000',bakery:storyBoards[0]}),{status:409});
});
test('四项准备完成后持久化背包、积分与下一站，重玩不重复发奖',()=>{
 let s=engine.initial();
 for(let lap=0;lap<2;lap++){
  engine.start(s,'story-bakery');
  for(let i=0;i<4;i++){
   storyAction(s,'draft',{bakery:storyBoards[i],note:'先整理再计算'});
   s=JSON.parse(JSON.stringify(s));assert.deepEqual(engine.view(s).run.bakery,adventure.cleanBoard(storyBoards[i]));
   storyAction(s,'submit',{answer:adventure.base[i].answer});storyAction(s,'next');
  }
  assert.equal(adventure.view(s).points,120);assert.equal(adventure.view(s).items.length,2);assert.equal(adventure.view(s).activeNpc,1);
 }
 assert.equal(s.records[adventure.base[0].id].count,2);
});
test('看解析后切换同题型变式，草稿不能伪造通关和积分',()=>{
 const s=engine.initial();engine.start(s,'story-bakery');
 storyAction(s,'draft',{bakery:storyBoards[0],answer:'1000',points:999,done:true});assert.equal(adventure.view(s).points,0);
 storyAction(s,'reveal');assert.equal(engine.view(s).run.result.answer,'1000');
 storyAction(s,'retry');assert.equal(engine.view(s).run.question.id,adventure.variants[0].id);assert.equal(engine.view(s).run.result,null);assert.equal(engine.view(s).run.bakery,null);
 storyAction(s,'submit',{answer:adventure.variants[0].answer,bakery:{...storyBoards[0],work:{first:'100',second:'2'}}});assert.equal(adventure.view(s).points,10);
 assert.throws(()=>adventure.cleanBoard({places:{bad:0}}),{status:400});
});
test('剧情操作台恢复服务端摆放，重新摆放清空草稿，失败反馈不显示答案',()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync('public/world3d/adventure.js','utf8')+fs.readFileSync('public/world3d/town.js','utf8'),context);
 const s=engine.initial();engine.start(s,'story-bakery');storyAction(s,'draft',{bakery:storyBoards[0]});context.p={run:engine.view(s).run};
 assert.match(vm.runInContext('ThinkingBakery.board(p)',context),/199 ＋ 301/);
 vm.runInContext('ThinkingBakery.act(p,"reset")',context);
 assert.equal(Object.keys(context.p.bakery.places).length,0);
 assert.match(vm.runInContext('ThinkingBakery.task(p).story',context),/救援小队/);
 storyAction(s,'submit',{answer:'0'});context.p={run:engine.view(s).run};
 const html=vm.runInContext('ThinkingAdventure.feedback(p.run,false)',context);assert.ok(!html.includes('参考答案'));assert.match(vm.runInContext('ThinkingBakery.board(p)',context),/修改方案/);
});
test('先配对两组才能沿用规律补齐，自动摆放仍需学生计算答案',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/world3d/town.js','utf8'),context);
 context.p={run:{id:'pattern',index:2,courseId:'story-bakery',question:{id:adventure.base[2].id},storyStep:adventure.chapter.steps[2]}};
 assert.equal(vm.runInContext('ThinkingBakery.act(p,"extend")',context),false);
 for(const [id,basket]of [[0,0],[19,0],[1,1],[18,1]]){context.card=id;context.basket=basket;vm.runInContext('ThinkingBakery.act(p,"select",card);ThinkingBakery.act(p,"place",basket)',context);}
 assert.equal(vm.runInContext('ThinkingBakery.act(p,"extend")',context),true);
 assert.equal(Object.keys(context.p.bakery.places).length,20);
 assert.equal(adventure.boardCorrect({index:2,qids:adventure.base.map(q=>q.id),bakery:context.p.bakery}),true);
 assert.equal(context.p.answer,undefined);
});
test('原题库完整迁移，48道小镇题和48道进阶题；未答题接口不泄露答案',()=>{
 assert.equal(firstQuestions.length,48);assert.equal(questions.size,96);
 const s=engine.initial();engine.start(s,'diagnostic');const r=engine.view(s).run;
 assert.equal(r.question.answer,undefined);assert.equal(r.question.explanation,undefined);assert.deepEqual(r.question.hints,[]);
 assert.equal(engine.view(s).world.diagnosticDone,false);
});
test('草稿、提示、版本冲突、解析与通关记录分开处理',()=>{
 const s=engine.initial();engine.start(s,'diagnostic');
 const payload=()=>({runId:s.runs[s.active].id,revision:s.runs[s.active].revision});
 const first=questions.get(s.runs[s.active].qids[0]);
 engine.runAction(s,{...payload(),action:'draft',answer:'还在思考',note:'先凑整',seconds:25});
 assert.equal(engine.view(JSON.parse(JSON.stringify(s))).run.note,'先凑整');
 assert.throws(()=>engine.runAction(s,{...payload(),revision:0,action:'submit'}),{status:409});
 engine.runAction(s,{...payload(),action:'hint'});assert.equal(engine.view(s).run.question.hints.length,1);
 engine.runAction(s,{...payload(),action:'reveal'});assert.equal(s.records[first.id].passed,false);
 assert.equal(engine.view(s).run.result.answer,first.answer);
 assert.throws(()=>engine.runAction(s,{...payload(),action:'submit'}),{status:409});
 engine.runAction(s,{...payload(),action:'next'});assert.equal(engine.view(s).run.index,1);
 assert.equal(s.records[first.id].count,1);
});
function finish(s,id){
 engine.start(s,id);
 while(s.active===id){const r=s.runs[id],q=questions.get(r.qids[r.index]);engine.runAction(s,{runId:r.id,revision:r.revision,action:'submit',answer:q.answer});engine.runAction(s,{runId:r.id,revision:r.revision,action:'next'});}
}
test('隔天复习包含提示后答对的题，当天题目不提前进入复习',()=>{
 const s=engine.initial();engine.start(s,'diagnostic');const r=s.runs[s.active],q=questions.get(r.qids[0]);
 engine.runAction(s,{runId:r.id,revision:r.revision,action:'hint'});
 engine.runAction(s,{runId:r.id,revision:r.revision,action:'submit',answer:q.answer});
 assert.throws(()=>engine.start(s,'review-due'),{status:400});
 s.records[q.id].last.created=new Date(Date.now()-86400000*2).toISOString();
 assert.equal(engine.view(s).world.dueCount,1);
 engine.start(s,'review-due');assert.equal(engine.view(s).run.question.id,q.id);
});
test('教师与学生同样在48题全对后开放山谷，历史提前开启任务不能绕过',()=>{
 const s=engine.initial();
 for(const q of firstQuestions.slice(0,47))s.records[q.id]={passed:true};
 for(const demo of [false,true]){
  assert.equal(engine.campaign(s,demo).first.unlocked,false);
  assert.throws(()=>engine.start(s,campCourses[0].id,demo),{status:403});
 }
 const last=firstQuestions.at(-1);s.records[last.id]={passed:false};assert.equal(engine.campaign(s,true).first.unlocked,false);
 s.records[last.id].passed=true;assert.equal(engine.campaign(s,true).first.unlocked,true);
 engine.start(s,campCourses[0].id,true);const r=s.runs[s.active];
 s.records[last.id].passed=false;
 assert.throws(()=>engine.runAction(s,{runId:r.id,revision:r.revision,action:'hint'}),{status:403});
 const scope=vm.createContext({});vm.runInContext(fs.readFileSync('public/world3d/expedition.js','utf8')+'\nthis.render=ThinkingExpedition.html;',scope);
 const html=scope.render({campaign:engine.campaign(s,true)});assert.match(html,/还差 1 道/);assert.ok(!html.includes('id="town-viewport"'));
});

test('完成摸底开放小镇，48道全对开放营地；重复练习不虚增进度',()=>{
 const s=engine.initial();finish(s,'diagnostic');assert.equal(engine.view(s).world.diagnosticDone,true);
 assert.equal(engine.campaign(s).first.unlocked,false);
 assert.throws(()=>engine.start(s,campCourses[0].id),{status:403});
 for(const c of courses.filter(c=>c.id!=='diagnostic'&&!c.id.startsWith('camp-')))finish(s,c.id);
 assert.equal(engine.campaign(s).first.correct,48);assert.equal(engine.campaign(s).first.unlocked,true);
 finish(s,'diagnostic');assert.equal(engine.campaign(s).first.correct,48);
 assert.equal(engine.campaign(s).missions[1].unlocked,false);
 const body={mission:0,config:{pieces:[0,2,3]},seconds:20,attemptId:crypto.randomUUID()};
 assert.equal(engine.submitGame(s,body).correct,true);engine.submitGame(s,body);assert.equal(s.repairs[0].count,1);
 assert.equal(engine.campaign(s).missions[1].unlocked,true);
 assert.throws(()=>engine.submitGame(s,{...body,config:{pieces:[1]}}),{status:409});
});
test('六种操作游戏均由服务端重放验证，不能伪造通关',()=>{
 const solutions=[{pieces:[0,2,3]},{trucks:[0,0,1,1,2,0,1,2,2]},{periods:[4,6,8]},{key:'丙',truth:[false,true,true]},{steps:['fillA','AB','emptyB','AB','fillA','AB']},{steps:['E','E','N','E','N','N']}];
 solutions.forEach((config,i)=>assert.equal(judgeCampGame(i,config).correct,true));
 assert.equal(judgeCampGame(0,{pieces:[0]}).correct,false);
 assert.throws(()=>judgeCampGame(0,{pieces:[0,0]}));assert.throws(()=>judgeCampGame(4,{steps:['fake']}));
 assert.throws(()=>engine.submitGame(engine.initial(),{mission:5,config:solutions[5],seconds:0,attemptId:crypto.randomUUID()}),{status:403});
});
test('模型文件完整且有动画，寻路与碰撞保持原逻辑',async()=>{
 const nav=await import(pathToFileURL(path.resolve('public/world3d/navigation3d.mjs')));
 for(let i=0;i<6;i++){const route=nav.findPath({x:-4,z:4},nav.meetingPoint(i));assert.ok(route.length);assert.ok(route.every(p=>nav.canStand(p.x,p.z)));}
 assert.equal(nav.canStand(0,0),false);
 for(const name of ['thinking-town','starlight-camp','explorer']){const b=fs.readFileSync('public/world3d/assets/'+name+'.glb');assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.length,b.readUInt32LE(8));const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.match(json.asset.generator,/Blender/);if(name==='explorer')assert.ok(json.animations.length);}
 assert.ok(fs.existsSync('public/world3d/vendor/THREE-LICENSE.txt'));
});

const {database,migrate}=require('../server/db'),{createApp}=require('../server/index');
let pool,server,base,ids=[],classId,clients=[];
before(async()=>{
 pool=database();await migrate(pool);
 for(const role of ['teacher','teacher','student','student']){
  const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(20).toString('hex');ids.push(id);
  await pool.query('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,$5,false)',[id,'game_'+id.slice(0,12),'游戏测试','unused-test-hash',role]);
  await pool.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),id,csrf]);
  clients.push(async(url,body,extra={})=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:'math_session='+token,'X-CSRF-Token':csrf,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};});
 }
 classId=crypto.randomUUID();await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)',[classId,ids[0],'3D测试班']);
 for(const id of ids.slice(2))await pool.query('INSERT INTO students(user_id,class_id,data) VALUES($1,$2,$3)',[id,classId,JSON.stringify({completed:[],games:{factor:{date:'原记录'}},practice:{},talk:{},notes:{},history:[]})]);
 server=createApp(pool).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(pool){try{await pool.query('DELETE FROM attempts WHERE student_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])',[ids]);if(classId)await pool.query('DELETE FROM classes WHERE id=$1',[classId]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);}finally{await pool.end();}}});
test('游乐设施扣款经过账号权限与数据库行锁，并发和重试只消费一次',async()=>{
 const url='/api/world3d/'+ids[2],body={rideId:'wheel',requestId:crypto.randomUUID(),expectedSpent:0};
 assert.equal((await clients[0](url+'/playground',body)).status,403);
 assert.equal((await clients[3](url+'/playground',body)).status,404);
 assert.equal((await clients[2](url+'/playground',body)).status,400);
 const saved=(await pool.query('SELECT data FROM students WHERE user_id=$1',[ids[2]])).rows[0].data;
 try{
  const seeded=structuredClone(saved);seeded.world3d=engine.initial();seeded.world3d.adventure={chapters:{bakery:{rewards:{boxes:20}}}};
  await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(seeded)]);
  const replies=await Promise.all([clients[2](url+'/playground',body),clients[2](url+'/playground',body)]);
  assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.ok(replies.every(r=>r.data.balance===0));
  const loaded=(await clients[2](url)).data;assert.equal(loaded.world.playground.spent,20);assert.equal(loaded.world.adventure.points,0);
  assert.equal((await clients[2](url+'/playground',{...body,requestId:crypto.randomUUID(),expectedSpent:20})).status,400);
 }finally{await pool.query('UPDATE students SET data=$2 WHERE user_id=$1',[ids[2],JSON.stringify(saved)]);}
});

test('账号权限、教师只读与独立试玩、跨学生隔离和持久化',async()=>{
 const url='/api/world3d/'+ids[2];
 assert.equal((await clients[3](url)).status,404);assert.equal((await clients[1](url)).status,404);
 assert.equal((await clients[2]('/api/world3d/demo')).status,403);
 assert.equal((await clients[0](url,{courseId:'diagnostic'})).status,404);
 assert.equal((await clients[0](url+'/start',{courseId:'diagnostic'})).status,403);
 assert.equal((await clients[0](url+'/start',{courseId:'diagnostic'},{'X-Student-Preview':ids[2]})).status,403);
 let r=await clients[2](url+'/start',{courseId:'diagnostic'});assert.equal(r.status,200);
 const run=r.data.run;
 r=await clients[2](url+'/run',{runId:run.id,revision:run.version,action:'submit',answer:'1000',note:'先凑成两个500',seconds:30});assert.equal(r.status,200);assert.equal(r.data.run.result.correct,true);
 const viewed=await clients[0](url);assert.equal(viewed.data.readonly,true);assert.equal(viewed.data.report.questions[0].count,1);
 assert.equal((await clients[2](url)).data.run.result.correct,true);
 const demo=await clients[0]('/api/world3d/demo');assert.ok(demo.data.world.campaign.missions.every(m=>!m.unlocked));assert.equal(demo.data.report.questions.length,0);
 assert.equal((await clients[0]('/api/world3d/demo/start',{courseId:campCourses[0].id})).status,403);
 assert.equal((await clients[0]('/api/world3d/demo/camp',{mission:0,config:{pieces:[0,2,3]},seconds:20,attemptId:crypto.randomUUID()})).status,403);
 await clients[0]('/api/world3d/demo/start',{courseId:'diagnostic'});
 assert.equal((await clients[1]('/api/world3d/demo')).data.run,null);
 const raw=(await pool.query('SELECT data FROM students WHERE user_id=$1',[ids[2]])).rows[0].data;
 assert.equal(raw.games.factor.date,'原记录');assert.deepEqual(raw.practice,{});
 assert.equal((await clients[2]('/api/students/'+ids[2])).data.world3d,undefined);
 assert.equal((await fetch(base+'/world3d/seed.json')).status,404);
 assert.equal((await fetch(base+'/server/world3d/seed.json')).status,404);
 const story=await clients[2](url+'/start',{courseId:'story-bakery'});
 const storyRun=story.data.run;
 assert.equal((await clients[2](url+'/run',{runId:storyRun.id,revision:storyRun.version,action:'submit',answer:'1000',bakery:storyBoards[0]})).status,200);
 const savedStory=await clients[0](url);
 assert.equal(savedStory.data.world.adventure.points,10);
 assert.equal(savedStory.data.readonly,true);
 assert.equal((await clients[3]('/api/world3d/'+ids[3])).data.world.adventure.points,0);
 await pool.query("INSERT INTO attempts(id,student_id,kind,version,answers,deadline) VALUES($1,$2,'A','v2',$3,now()+interval '45 minutes')",[crypto.randomUUID(),ids[3],JSON.stringify(Array(20).fill(''))]);
 assert.equal((await clients[3]('/api/world3d/'+ids[3])).status,403);
 assert.equal((await clients[3]('/api/world3d/'+ids[3]+'/start',{courseId:'diagnostic'})).status,403);
});

test('女生选择按学生账号保存，教师预览不可更换，教师试玩相互隔离',async()=>{
 const url='/api/world3d/'+ids[2];
 const previous=(await clients[2](url)).data;
 assert.equal((await clients[3](url+'/character',{character:'girl'})).status,404);
 assert.equal((await clients[0](url+'/character',{character:'girl'})).status,403);
 assert.equal((await clients[0](url+'/character',{character:'girl'},{'X-Student-Preview':ids[2]})).status,403);
 assert.equal((await clients[2](url+'/character',{character:'missing'})).status,400);
 assert.equal((await clients[2](url+'/character',{character:'girl'})).status,200);
 const updated=(await clients[2](url)).data;
 assert.equal(updated.world.character,'girl');assert.deepEqual(updated.run,previous.run);
 assert.deepEqual(updated.report,previous.report);assert.deepEqual(updated.world.adventure,previous.world.adventure);
 assert.equal((await clients[0](url)).data.world.character,'girl');
 assert.equal((await clients[0]('/api/world3d/'+ids[3])).data.world.character,'boy');
 assert.equal((await clients[2]('/api/world3d/demo/character',{character:'girl'})).status,403);
 assert.equal((await clients[0]('/api/world3d/demo/character',{character:'girl'})).status,200);
 assert.equal((await clients[0]('/api/world3d/demo')).data.world.character,'girl');
 assert.equal((await clients[1]('/api/world3d/demo')).data.world.character,'boy');
});
test('家园布置按学生与角色隔离，校验样式和版本，不改变学习进度',async()=>{
 const url='/api/world3d/'+ids[2],before=(await clients[2](url)).data;
 assert.equal(before.world.homes.boy.wall,'sky');assert.equal(before.world.homes.girl.wall,'lavender');
 const settings={character:'girl',wall:'mint',rug:'stars',ornament:'crystal',revision:0};
 assert.equal((await clients[3](url+'/home',settings)).status,404);
 assert.equal((await clients[0](url+'/home',settings)).status,403);
 assert.equal((await clients[0](url+'/home',settings,{'X-Student-Preview':ids[2]})).status,403);
 for(const invalid of [{...settings,character:'other'},{...settings,wall:'<script>'},{...settings,rug:'other'},{...settings,ornament:'other'}])assert.equal((await clients[2](url+'/home',invalid)).status,400);
 assert.equal((await clients[2](url+'/home',settings)).status,200);
 assert.equal((await clients[2](url+'/home',settings)).status,409);
 const after=(await clients[2](url)).data;
 assert.deepEqual(after.world.homes.girl,{wall:'mint',rug:'stars',ornament:'crystal',revision:1});
 assert.deepEqual(after.world.homes.boy,before.world.homes.boy);
 for(const key of ['run','report'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(after.world.adventure,before.world.adventure);assert.deepEqual(after.world.campaign,before.world.campaign);
 assert.deepEqual((await clients[0](url)).data.world.homes,after.world.homes);
 assert.equal((await clients[0]('/api/world3d/'+ids[3])).data.world.homes.girl.revision,0);
 assert.equal((await clients[0]('/api/world3d/demo/home',settings)).status,200);
 assert.equal((await clients[1]('/api/world3d/demo')).data.world.homes.girl.revision,0);
 assert.equal((await clients[2](url+'/home',{...settings,character:'boy',wall:'cream'})).status,200);
 assert.equal((await clients[2](url)).data.world.homes.girl.wall,'mint');
});
test('游戏页面和模型由本站提供，普通首页不加载3D库',async()=>{
 const html=await(await fetch(base+'/')).text();assert.ok(!html.includes('three.module'));
 for(const name of ['index.html','integration.js','town3d.js','assets/explorer.glb','vendor/three.module.js'])assert.equal((await fetch(base+'/world3d/'+name)).status,200);
});

test('语音期间静音配乐，结束后恢复当前场景音量',async()=>{
 const h=audioHarness();h.scope.audio.dictating(true);await h.scope.audio.unlock();assert.equal(h.buses[0].gain.value,0);
 h.scope.audio.mode(true);assert.equal(h.buses[0].gain.value,0);h.scope.audio.dictating(false);assert.equal(h.buses[0].gain.value,.32);
 h.scope.audio.dictating(true);h.scope.audio.mode(false);assert.equal(h.buses[0].gain.value,0);h.scope.audio.dictating(false);assert.equal(h.buses[0].gain.value,.7);
});

test('思路框接收最终文字并触发草稿，收尾后才允许继续，旧结果不串题',async()=>{
 let engine,note={value:'先比较',isConnected:true,disabled:false,dispatchEvent:event=>inputs.push(event.type)};
 const inputs=[],muted=[],events={},timers=new Map();let id=0;
 class Recognition{constructor(){engine=this;}start(){}stop(){}abort(){}}
 const status={textContent:''},button={setAttribute(){}};
 const context=vm.createContext({Event,window:{SpeechRecognition:Recognition,isSecureContext:true,addEventListener(){}},document:{getElementById:key=>key==='note'?note:status,querySelector:()=>button,addEventListener:(key,fn)=>events[key]=fn},GameAudio:{dictating:value=>muted.push(value)},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('public/world3d/speech.js','utf8')+fs.readFileSync('public/world3d/dictation.js','utf8')+'\nthis.voice=GameDictation;',context);
 const voice=context.voice;
 assert.equal(voice.controls(true),'');assert.match(voice.controls(false),/语音输入/);
 voice.toggle();assert.equal(muted.at(-1),true);
 let finished=false;const pending=voice.finish().then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);
 const result=[{transcript:'相同部分抵消'}];result.isFinal=true;
 engine.onresult({resultIndex:0,results:[result]});assert.equal(note.value,'先比较\n相同部分抵消');assert.deepEqual(inputs,['input']);
 engine.onend();await pending;assert.equal(finished,true);assert.equal(muted.at(-1),false);
 voice.toggle();const old=engine;voice.cancel();note={value:'下一题',isConnected:true,dispatchEvent(){}};voice.toggle();old.onresult({resultIndex:0,results:[result]});assert.equal(note.value,'下一题');
 context.document.hidden=true;events.visibilitychange();assert.equal(voice.active,false);assert.equal(timers.size,0);
});

function speechFixture(supported=true) {
  let engine, text='原有思路', state;
  class Recognition {
    constructor(){engine=this;}
    start(){}
    stop(){this.stopped=true;}
    abort(){this.aborted=true;}
  }
  const timers=new Map();let timerId=0;
  const context={setTimeout:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('public/world3d/speech.js','utf8'),context);
  const speech=context.createThinkingSpeech({Recognition:supported?Recognition:undefined,read:()=>text,write:value=>text=value,notify:value=>state=value});
  const result=(words,final=true)=>{const r=[{transcript:words}];r.isFinal=final;return r;};
  return {speech,result,timers,expire:delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.callback();}},get engine(){return engine;},get text(){return text;},set text(value){text=value;},get state(){return state;}};
}
test('语音追加最终文字，保留手动修改，不保存中间结果或重复结果',()=>{
  const f=speechFixture();f.speech.start();assert.equal(f.engine.lang,'zh-CN');
  f.engine.onresult({resultIndex:0,results:[f.result('还没说完',false)]});assert.equal(f.text,'原有思路');
  f.text='我手动改过';f.engine.onresult({resultIndex:0,results:[f.result('先凑整百')]});
  assert.equal(f.text,'我手动改过\n先凑整百');
  f.engine.onresult({resultIndex:0,results:[f.result('先凑整百')]});assert.equal(f.text,'我手动改过\n先凑整百');f.speech.cancel();
});
test('结束时接收最后一句，结束后可以提交',()=>{
  const f=speechFixture();f.speech.start();f.speech.stop();assert.equal(f.speech.active,true);
  f.engine.onresult({resultIndex:0,results:[f.result('最后一句')]});f.engine.onend();
  assert.equal(f.text,'原有思路\n最后一句');assert.equal(f.speech.active,false);
});
test('离开题目后忽略迟到结果，也不干扰新会话',()=>{
  const f=speechFixture();f.speech.start();const old=f.engine;f.speech.cancel();f.speech.start();
  old.onresult({resultIndex:0,results:[f.result('迟到文字')]});old.onend();
  assert.equal(f.text,'原有思路');assert.equal(f.speech.active,true);f.speech.cancel();
});
test('达到字数上限停止识别，不超出草稿限制',()=>{
  const f=speechFixture();f.text='字'.repeat(999);f.speech.start();
  f.engine.onresult({resultIndex:0,results:[f.result('新的思考')]});assert.equal(f.text.length,1000);assert.equal(f.engine.stopped,true);f.engine.onend();assert.match(f.state.message,/1000/);
});
test('不支持、拒绝权限或断网时显示明确提示并恢复编辑',()=>{
  const missing=speechFixture(false);missing.speech.start();assert.match(missing.state.message,/不支持/);
  const f=speechFixture();f.speech.start();f.engine.onerror({error:'not-allowed'});assert.match(f.state.message,/权限/);assert.equal(f.speech.active,false);
  f.speech.start();f.engine.onerror({error:'network'});assert.match(f.state.message,/网络/);assert.equal(f.speech.active,false);
});

test('服务无响应时12秒退出，恢复操作并忽略迟到结果',()=>{
  const f=speechFixture();f.speech.start();f.expire(12000);
  assert.equal(f.speech.active,false);assert.equal(f.engine.aborted,true);assert.match(f.state.message,/12秒/);
  f.engine.onresult({resultIndex:0,results:[f.result('迟到的文字')]});assert.equal(f.text,'原有思路');assert.equal(f.timers.size,0);
});
test('麦克风开始后无文字20秒退出，有文字后重新计时',()=>{
  const f=speechFixture();f.speech.start();f.engine.onaudiostart();assert.match(f.state.message,/麦克风已开始/);
  f.expire(12000);assert.equal(f.speech.active,true);
  f.engine.onresult({resultIndex:0,results:[f.result('已经识别')]});f.expire(20000);
  assert.equal(f.speech.active,false);assert.match(f.state.message,/20秒/);assert.equal(f.text,'原有思路\n已经识别');assert.equal(f.timers.size,0);
});
test('没有任何文字结束时不误报识别成功，取消后清除所有超时',()=>{
  const f=speechFixture();f.speech.start();f.engine.onend();assert.match(f.state.message,/没有收到文字/);assert.equal(f.timers.size,0);
  f.speech.start();f.speech.cancel();f.expire(12000);assert.equal(f.speech.active,false);assert.equal(f.timers.size,0);
});
test('停止识别时只保留收尾超时，超时不锁住提交按钮',()=>{
  const f=speechFixture();f.speech.start();f.speech.stop();f.expire(12000);assert.equal(f.speech.active,true);
  f.expire(4000);assert.equal(f.speech.active,false);assert.equal(f.timers.size,0);
});
