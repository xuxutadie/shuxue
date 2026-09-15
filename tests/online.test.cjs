const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { database, migrate } = require('../server/db');
const { createApp } = require('../server/index');
const { bank, currentExamVersions } = require('../server/content');
const { expireAttempts } = require('../server/exams');
let pool, server, base, classId, s1, s2, teacher1, teacher2, student1, student2;
const prefix='test_'+Date.now(), password='Test-only-Math-42!';
const ids=[];
function agent(){return {cookie:'',csrf:'',async request(path,method='GET',body,extra={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)this.csrf=data.csrf;return {status:r.status,data};}};}
async function login(client,account){const r=await client.request('/api/login','POST',{username:account,password});assert.equal(r.status,200);return r;}
before(async()=>{
 if(!process.env.DATABASE_URL)throw new Error('集成测试需要真实PostgreSQL测试数据库。');
 pool=database();await migrate(pool);
 const encoded=await argon2.hash(password);
 for(const suffix of ['t1','t2']){const id=crypto.randomUUID();ids.push(id);await pool.query("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,'teacher',false)",[id,prefix+suffix,suffix,encoded]);}
 classId=crypto.randomUUID();await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)',[classId,ids[0],'接口测试班']);
 server=createApp(pool).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 teacher1=agent();teacher2=agent();await login(teacher1,prefix+'t1');await login(teacher2,prefix+'t2');
 for(const suffix of ['s1','s2']){const result=await teacher1.request('/api/teacher/students','POST',{username:prefix+suffix,name:suffix,password,classId});assert.equal(result.status,201);ids.push(result.data.id);}
 [s1,s2]=ids.slice(2);student1=agent();student2=agent();await login(student1,prefix+'s1');await login(student2,prefix+'s2');
});
test('未登录隔离、强制改密、学生权限和跨教师隔离',async()=>{
 assert.equal((await agent().request('/api/content')).status,401);
 assert.equal((await student1.request('/api/content')).status,403);
 for(const client of [student1,student2])assert.equal((await client.request('/api/password','POST',{current:password,password:password+'New'})).status,200);
 assert.equal((await student1.request('/api/teacher/overview')).status,403);
 assert.equal((await student1.request('/api/students/'+s2)).status,404);
 assert.equal((await teacher2.request('/api/students/'+s1)).status,404);
 assert.equal((await student1.request('/api/students/'+s1+'/lessons/0','PUT',{completed:true})).status,403);
 assert.equal((await student1.request('/api/students/'+s1+'/lessons/0','PUT',{prep:'我的解释'}, {'X-CSRF-Token':'bad'})).status,403);
 assert.equal((await student1.request('/api/students/'+s1+'/lessons/0','PUT',{prep:'我的解释'}, {Origin:'https://evil.invalid'})).status,403);
 const c=await student1.request('/api/content');assert.equal(c.status,200);assert.equal(c.data.lessons.length,12);assert.equal(c.data.lessons[0].practice[0].answer,undefined);
});
test('独立练习保留首次结果和重做，学生不能改教师评价',async()=>{
 let r=await student1.request(`/api/students/${s1}/practice/0/0`,'POST',{answer:'999'});assert.equal(r.data.correct,false);assert.equal(r.data.firstCorrect,false);
 r=await student1.request(`/api/students/${s1}/practice/0/0`,'POST',{answer:bank.lessons[0].practice[0].answer});assert.equal(r.data.correct,true);assert.equal(r.data.firstCorrect,false);assert.equal(r.data.attempts,2);
 assert.equal((await teacher1.request(`/api/students/${s1}/lessons/0`,'PUT',{level:'独立讲清',note:'会用相减解释',completed:true})).status,200);
 assert.equal((await student1.request(`/api/students/${s1}/lessons/0`,'PUT',{prep:'先找到相同部分'})).status,200);
 r=await student1.request('/api/students/'+s1);assert.equal(r.data.talk[0].level,'独立讲清');assert.deepEqual(r.data.notes,{});
});

test('换题后旧成绩保留原题，新题从首次作答重新统计并拒收旧页面',async()=>{
 const old={answer:'旧题答案',correct:true,firstCorrect:false,attempts:3,submissions:[{answer:'旧题答案',correct:true}]};
 await pool.query("UPDATE students SET data=jsonb_set(data,'{practice,1-0}',$2::jsonb) WHERE user_id=$1",[s1,JSON.stringify(old)]);
 let r=await teacher1.request('/api/students/'+s1);
 assert.equal(r.data.practice['1-0'],undefined);
 assert.equal(r.data.practiceHistory.filter(h=>h.key==='1-0').length,1);
 assert.notEqual(r.data.practiceHistory.find(h=>h.key==='1-0').question.text,bank.lessons[1].practice[0].text);
 const q=bank.lessons[1].practice[0];
 r=await student1.request(`/api/students/${s1}/practice/1/0`,'POST',{answer:q.answer});assert.equal(r.status,409);
 r=await student1.request(`/api/students/${s1}/practice/1/0`,'POST',{answer:q.answer,version:q.version});assert.equal(r.status,200);assert.equal(r.data.attempts,1);assert.equal(r.data.firstCorrect,true);
 r=await teacher1.request('/api/students/'+s1);assert.equal(r.data.practiceHistory.filter(h=>h.key==='1-0').length,1);assert.equal(r.data.practice['1-0'].question.text,q.text);
 const again=await teacher1.request('/api/students/'+s1);assert.equal(again.data.practiceHistory.length,r.data.practiceHistory.length);
});
test('布置、服务端评分120分、答案不泄漏、并发冲突、重复交卷与讲评',async()=>{
 assert.equal((await student1.request(`/api/students/${s1}/exams/A/start`,'POST',{})).status,403);
 assert.equal((await teacher1.request('/api/teacher/assign','POST',{classId,kind:'A',enabled:true})).status,200);
 const started=await student1.request(`/api/students/${s1}/exams/A/start`,'POST',{});assert.equal(started.status,200);assert.equal(started.data.record.version,'v3');
 const repeated=await student1.request(`/api/students/${s1}/exams/A/start`,'POST',{});assert.equal(repeated.data.record.id,started.data.record.id);assert.equal(repeated.data.record.deadline,started.data.record.deadline);
 let r=await student1.request(`/api/students/${s1}/exams/A`);assert.equal(r.data.questions.length,20);assert.equal(r.data.questions[0].answer,undefined);assert.equal(r.data.questions[0].explain,undefined);
 const answers=bank.exams[currentExamVersions.A].A.map(q=>q.answer);
 r=await student1.request(`/api/students/${s1}/exams/A/answers`,'PUT',{answers,revision:0,score:0});assert.equal(r.data.record.revision,1);
 const conflict=await student1.request(`/api/students/${s1}/exams/A/answers`,'PUT',{answers:Array(20).fill(''),revision:0});assert.equal(conflict.status,409);assert.equal(conflict.data.conflict,true);
 const submitted=await student1.request(`/api/students/${s1}/exams/A/submit`,'POST',{});assert.equal(submitted.data.record.score,120);assert.equal(submitted.data.record.correct,undefined);
 const duplicate=await student1.request(`/api/students/${s1}/exams/A/submit`,'POST',{});assert.equal(duplicate.data.record.date,submitted.data.record.date);
 r=await student1.request(`/api/students/${s1}/exams/A`);assert.equal(r.data.questions[0].answer,undefined);
 assert.equal((await student1.request(`/api/students/${s1}/exams/A/release`,'POST',{released:true})).status,403);
 assert.equal((await teacher1.request(`/api/students/${s1}/exams/A/release`,'POST',{released:true})).status,200);
 r=await student1.request(`/api/students/${s1}/exams/A`);assert.equal(r.data.questions[0].answer,'270');assert.equal(r.data.record.correct.filter(Boolean).length,20);
});
test('超时后禁止修改，定时任务自动提交，空白为0分',async()=>{
 await teacher1.request('/api/teacher/assign','POST',{studentId:s2,kind:'A',enabled:true});
 await student2.request(`/api/students/${s2}/exams/A/start`,'POST',{});
 await pool.query("UPDATE attempts SET deadline=now()-interval '1 second' WHERE student_id=$1",[s2]);
 const r=await student2.request(`/api/students/${s2}/exams/A/answers`,'PUT',{answers:bank.exams[currentExamVersions.A].A.map(q=>q.answer),revision:0});assert.equal(r.status,409);assert.equal(r.data.record.score,0);assert.equal(r.data.record.timedOut,true);
 await teacher1.request('/api/teacher/assign','POST',{studentId:s2,kind:'B',enabled:true});await student2.request(`/api/students/${s2}/exams/B/start`,'POST',{});
 await pool.query("UPDATE attempts SET deadline=now()-interval '1 second' WHERE student_id=$1 AND kind='B'",[s2]);await expireAttempts(pool);
 assert.equal((await student2.request('/api/students/'+s2)).data.exams.B.score,0);
});
test('前测新卷、教师答案与打印题源一致；已开始的旧A卷继续按旧版评分',async()=>{
 const key=await teacher1.request('/api/teacher/keys/A');assert.deepEqual(key.data,bank.exams.v3.A);
 const post=await teacher1.request('/api/teacher/keys/B');assert.deepEqual(post.data,bank.exams.v2.B);
 const created=await teacher1.request('/api/teacher/students','POST',{username:prefix+'oldA',name:'旧卷兼容测试',password,classId});
 assert.equal(created.status,201);const studentId=created.data.id;ids.push(studentId);
 const client=agent();await login(client,prefix+'oldA');await client.request('/api/password','POST',{current:password,password:password+'Old'});
 await teacher1.request('/api/teacher/assign','POST',{studentId,kind:'A',enabled:true});
 const attemptId=crypto.randomUUID();
 await pool.query("INSERT INTO attempts(id,student_id,kind,version,answers,deadline) VALUES($1,$2,'A','v2',$3,now()+interval '45 minutes')",[attemptId,studentId,JSON.stringify(Array(20).fill(''))]);
 const resumed=await client.request(`/api/students/${studentId}/exams/A/start`,'POST',{});
 assert.equal(resumed.data.record.id,attemptId);assert.equal(resumed.data.record.version,'v2');
 const questions=await client.request(`/api/students/${studentId}/exams/A`);assert.equal(questions.data.questions[0].text,bank.exams.v2.A[0].text);
 await client.request(`/api/students/${studentId}/exams/A/answers`,'PUT',{answers:bank.exams.v2.A.map(q=>q.answer),revision:0});
 const submitted=await client.request(`/api/students/${studentId}/exams/A/submit`,'POST',{});assert.equal(submitted.data.record.score,120);
 const report=await teacher1.request(`/api/students/${studentId}/exams/A`);assert.equal(report.data.questions[0].answer,'360');assert.equal(report.data.record.version,'v2');
});
test('旧档案预览、版本计分、重复导入保护与演示排除',async()=>{
 const raw={name:'旧学生',completed:[0],practice:{},exams:{A:{version:'v1',answers:bank.exams.v1.A.map(q=>q.answer),date:'2026-09-10'}},talk:{},notes:{}};
 const preview=await teacher1.request('/api/teacher/import/preview','POST',{student:raw});assert.equal(preview.data.exams[0].score,120);
 const body={student:raw,fingerprint:preview.data.fingerprint};assert.equal((await teacher1.request('/api/teacher/students/'+s1+'/import','POST',body)).status,200);
 assert.equal((await teacher1.request('/api/teacher/students/'+s1+'/import','POST',body)).status,409);
 const p=(await teacher1.request('/api/students/'+s1)).data;assert.equal(p.exams.A.score,120);assert.equal(p.history[0].record.version,'v1');
 assert.equal((await teacher1.request('/api/teacher/import/preview','POST',{student:{...raw,name:'验收演示'}})).status,400);
});
test('修改密码撤销其他会话，教师重置撤销学生会话',async()=>{
 const other=agent();assert.equal((await other.request('/api/login','POST',{username:prefix+'s1',password:password+'New'})).status,200);
 assert.equal((await student1.request('/api/password','POST',{current:password+'New',password:password+'Again'})).status,200);
 assert.equal((await other.request('/api/me')).status,401);
 assert.equal((await teacher1.request(`/api/teacher/students/${s1}/reset-password`,'POST',{password:'Reset-Password-2026'})).status,200);
 assert.equal((await student1.request('/api/me')).status,401);
});
test('登录兼容已设置的八位密码，不被新密码规则拦截',async()=>{
 const id=crypto.randomUUID();ids.push(id);const encoded=await argon2.hash('Test8pwd');
 await pool.query("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,'密码兼容检查',$3,'teacher',false)",[id,prefix+'eight',encoded]);
 const client=agent();assert.equal((await client.request('/api/login','POST',{username:prefix+'eight',password:'Test8pwd'})).status,200);
 assert.equal((await client.request('/api/me')).data.user.mustChange,false);
 assert.equal((await agent().request('/api/login','POST',{username:prefix+'eight',password:'bad-pass'})).status,401);
});
test('学生可用六位密码创建、首次改密及重置，五位不能通过',async()=>{
 const account=prefix+'short',client=agent();
 const create=p=>teacher1.request('/api/teacher/students','POST',{username:account,name:'短密码测试',password:p,classId});
 assert.equal((await create('Ab123')).status,400);
 const created=await create('Ab1234');assert.equal(created.status,201);ids.push(created.data.id);
 const loginResult=await client.request('/api/login','POST',{username:account,password:'Ab1234'});
 assert.equal(loginResult.status,200);assert.equal(loginResult.data.user.mustChange,true);
 assert.equal((await client.request('/api/content')).status,403);
 assert.equal((await client.request('/api/password','POST',{current:'Ab1234',password:'Cd123'})).status,400);
 assert.equal((await client.request('/api/password','POST',{current:'Ab1234',password:'Cd1234'})).status,200);
 assert.equal((await client.request('/api/content')).status,200);
 assert.equal((await client.request('/api/me')).data.user.mustChange,false);
 const reset=p=>teacher1.request(`/api/teacher/students/${created.data.id}/reset-password`,'POST',{password:p});
 assert.equal((await reset('Ef123')).status,400);
 assert.equal((await reset('Ef1234')).status,200);
 assert.equal((await client.request('/api/me')).status,401);
 const again=agent();assert.equal((await again.request('/api/login','POST',{username:account,password:'Ef1234'})).data.user.mustChange,true);
 assert.equal((await again.request('/api/password','POST',{current:'Ef1234',password:'Longer-Than-Ten'})).status,200);
 assert.equal((await teacher1.request('/api/password','POST',{current:password,password:'Gh1234'})).status,400);
});

test('网站不公开题库、配置和开发文件',async()=>{
 for(const path of ['/data.js','/exams.js','/exam-legacy.js','/server/schema.sql','/.env','/.runtime/教师首次登录-teacher.txt','/package.json'])assert.equal((await fetch(base+path)).status,404,path);
 assert.equal((await fetch(base+'/')).status,200);
});

test('课程按权限压缩，学生响应不包含教师答案，身份数据禁止共享缓存',async()=>{
 const plain=await teacher1.request('/api/content','GET',undefined,{'Accept-Encoding':'identity'});
 const response=await fetch(base+'/api/content',{headers:{Cookie:teacher1.cookie,'Accept-Encoding':'gzip'}});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),'gzip');
 assert.match(response.headers.get('vary'),/Accept-Encoding/);assert.equal(response.headers.get('cache-control'),'no-store');
 const compressedBytes=Number(response.headers.get('content-length'));
 assert.ok(compressedBytes<Buffer.byteLength(JSON.stringify(plain.data))/2);
 assert.deepEqual(await response.json(),plain.data);
 const studentContent=await student2.request('/api/content');
 assert.equal(studentContent.status,200);assert.equal(studentContent.data.lessons[0].videoGuide,undefined);
 assert.equal(studentContent.data.lessons[0].practice[0].answer,undefined);
});

test('教师工作台批量读取与单独档案一致，查询数不随人数增长且教师之间隔离',async()=>{
 const {teacherProfiles,profile}=require('../server/learning');
 let queries=0;
 const countingPool={query(...args){queries++;return pool.query(...args);}};
 const owner={id:ids[0],role:'teacher'};
 const batch=await teacherProfiles(countingPool,owner);
 assert.equal(queries,3);assert.ok(batch.length>=2);
 for(const item of batch)assert.deepEqual(item,await profile(pool,owner,item.id));
 const other=await teacher2.request('/api/teacher/overview');
 assert.equal(other.status,200);assert.deepEqual(other.data.students,[]);
});
test('学生资料编辑保留成绩、权限隔离、停用恢复及永久删除',async()=>{
 const created=await teacher1.request('/api/teacher/students','POST',{username:prefix+'manage',name:'管理测试',password,classId});
 assert.equal(created.status,201);const id=created.data.id;ids.push(id);
 const path='/api/teacher/students/'+id, client=agent();await login(client,prefix+'manage');
 await client.request('/api/password','POST',{current:password,password:password+'New'});
 const targetClass=await teacher1.request('/api/teacher/classes','POST',{name:'转入班级'});
 const foreignClass=await teacher2.request('/api/teacher/classes','POST',{name:'其他老师的班级'});
 for(const [method,body] of [['PATCH',{name:'越权修改'}],['PATCH',{accountDisabled:true}],['DELETE',{confirmUsername:prefix+'manage'}]]) {
  assert.equal((await teacher2.request(path,method,body)).status,404);
  assert.equal((await client.request(path,method,body)).status,403);
 }
 assert.equal((await teacher1.request(path,'PATCH',{name:' ',classId})).status,400);
 assert.equal((await teacher1.request(path,'PATCH',{role:'teacher'})).status,400);
 assert.equal((await teacher1.request(path,'PATCH',{accountDisabled:'true'})).status,400);
 assert.equal((await teacher1.request(path,'PATCH',{classId:foreignClass.data.id,name:'不应保存'})).status,404);
 assert.equal((await teacher1.request(path,'PATCH',{username:prefix+'s1',name:'不应保存'})).status,409);
 assert.equal((await teacher1.request('/api/students/'+id)).data.name,'管理测试');
 await teacher1.request('/api/teacher/assign','POST',{studentId:id,kind:'A',enabled:true});
 await client.request(`/api/students/${id}/exams/A/start`,'POST',{});
 await client.request(`/api/students/${id}/exams/A/submit`,'POST',{});
 await teacher1.request(`/api/students/${id}/lessons/0`,'PUT',{note:'应保留的课堂记录',completed:true});
 const prior=(await teacher1.request('/api/students/'+id)).data;
 assert.equal((await teacher1.request(path,'PATCH',{name:'新姓名',username:prefix+'renamed',classId:targetClass.data.id})).status,200);
 const updated=(await teacher1.request('/api/students/'+id)).data;
 assert.equal(updated.name,'新姓名');assert.equal(updated.classId,targetClass.data.id);
 assert.deepEqual(updated.exams,prior.exams);assert.deepEqual(updated.notes,prior.notes);assert.deepEqual(updated.completed,prior.completed);
 assert.equal((await client.request('/api/me')).status,401);
 assert.equal((await agent().request('/api/login','POST',{username:prefix+'manage',password:password+'New'})).status,401);
 assert.equal((await client.request('/api/login','POST',{username:prefix+'renamed',password:password+'New'})).status,200);
 assert.equal((await teacher1.request(path,'PATCH',{accountDisabled:true})).status,200);
 assert.equal((await client.request('/api/me')).status,401);
 assert.equal((await agent().request('/api/login','POST',{username:prefix+'renamed',password:password+'New'})).status,403);
 const stopped=(await teacher1.request('/api/teacher/overview')).data.students.find(s=>s.id===id);
 assert.equal(stopped.accountDisabled,true);assert.deepEqual(stopped.exams,prior.exams);
 assert.equal((await teacher1.request(path,'PATCH',{accountDisabled:false})).status,200);
 assert.equal((await client.request('/api/login','POST',{username:prefix+'renamed',password:password+'New'})).status,200);
 // 放入 AI 关联记录，验证永久删除能完整清理外键链。
 const questionId=crypto.randomUUID();
 await pool.query('INSERT INTO ai_questions(id,user_id,teacher_id,lesson,difficulty,problem) VALUES($1,$2,$3,0,1,$4)',[questionId,id,ids[0],JSON.stringify({text:'删除测试'})]);
 await pool.query('INSERT INTO ai_submissions(id,question_id,answer,correct) VALUES($1,$2,$3,false)',[crypto.randomUUID(),questionId,'1']);
 await pool.query('INSERT INTO ai_usage(user_id,day,used) VALUES($1,CURRENT_DATE,1)',[id]);
 assert.equal((await teacher1.request(path,'DELETE',{confirmUsername:'错误账号'})).status,400);
 assert.equal((await client.request('/api/me')).status,200);
 assert.equal((await teacher1.request(path,'DELETE',{confirmUsername:prefix+'renamed'})).status,200);
 assert.equal((await client.request('/api/me')).status,401);
 assert.equal((await agent().request('/api/login','POST',{username:prefix+'renamed',password:password+'New'})).status,401);
 assert.equal((await teacher1.request('/api/students/'+id)).status,404);
 for(const [table,key,value] of [['users','id',id],['students','user_id',id],['sessions','user_id',id],['attempts','student_id',id],['assignments','student_id',id],['ai_questions','user_id',id],['ai_usage','user_id',id],['ai_submissions','question_id',questionId]]) {
  assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE ${key}=$1`,[value])).rowCount,0,table);
 }
 assert.equal((await teacher1.request('/api/me')).status,200);
 assert.equal((await teacher1.request('/api/students/'+s1)).status,200);
});
test('教师学生预览复用学生权限，练习试做和读卷均不写入记录',async()=>{
 const created=await teacher1.request('/api/teacher/students','POST',{username:prefix+'preview',name:'预览测试',password,classId});
 const id=created.data.id;ids.push(id);const client=agent();await login(client,prefix+'preview');
 await client.request('/api/password','POST',{current:password,password:password+'New'});
 const headers={'X-Student-Preview':id};
 const preview=(path,method='GET',body)=>teacher1.request(path,method,body,headers);
 assert.equal((await teacher2.request('/api/content','GET',undefined,headers)).status,404);
 assert.equal((await client.request('/api/content','GET',undefined,headers)).status,403);
 assert.equal((await preview('/api/teacher/overview')).status,403);
 assert.equal((await preview('/api/students/'+s1)).status,404);
 const material=await preview('/api/content');assert.equal(material.status,200);
 assert.deepEqual(material.data,(await client.request('/api/content')).data);
 assert.equal(material.data.lessons[0].practice[0].answer,undefined);assert.equal(material.data.lessons[0].videoGuide,undefined);
 await teacher1.request(`/api/students/${id}/lessons/0`,'PUT',{note:'仅教师可见',completed:true});
 assert.deepEqual((await preview('/api/students/'+id)).data,(await client.request('/api/students/'+id)).data);
 const beforeData=(await pool.query('SELECT data FROM students WHERE user_id=$1',[id])).rows[0].data;
 const q=bank.lessons[0].practice[0];
 const check=await preview(`/api/students/${id}/practice/0/0`,'POST',{answer:q.answer,version:q.version||'v1'});
 assert.equal(check.status,200);assert.equal(check.data.correct,true);assert.equal(check.data.preview,true);
 assert.equal((await preview(`/api/students/${s1}/practice/0/0`,'POST',{answer:q.answer,version:q.version||'v1'})).status,404);
 for(const [path,method,body] of [
  [`/api/students/${id}/lessons/0`,'PUT',{prep:'不可保存'}],
  [`/api/students/${id}/games/shop`,'POST',{}],
  [`/api/students/${id}/exams/A/start`,'POST',{}],
  [`/api/students/${id}/exams/A/submit`,'POST',{}],
  [`/api/students/${id}/exams/A/answers`,'PUT',{answers:Array(20).fill('1'),revision:0}],
  ['/api/ai/generate','POST',{lesson:0,difficulty:1,count:1}],
  ['/api/password','POST',{current:password,password:password+'Changed'}],
  [`/api/teacher/students/${id}`,'DELETE',{confirmUsername:prefix+'preview'}]
 ])assert.equal((await preview(path,method,body)).status,403,path);
 assert.deepEqual((await pool.query('SELECT data FROM students WHERE user_id=$1',[id])).rows[0].data,beforeData);
 assert.equal((await preview(`/api/students/${id}/exams/A?previewPaper=1`)).status,404);
 await teacher1.request('/api/teacher/assign','POST',{studentId:id,kind:'A',enabled:true});
 const paper=await preview(`/api/students/${id}/exams/A?previewPaper=1`);
 assert.equal(paper.status,200);assert.equal(paper.data.questions.length,20);assert.equal(paper.data.questions[0].answer,undefined);
 assert.equal((await pool.query('SELECT 1 FROM attempts WHERE student_id=$1',[id])).rowCount,0);
 await client.request(`/api/students/${id}/exams/A/start`,'POST',{});
 await pool.query("UPDATE attempts SET deadline=now()-interval '1 second' WHERE student_id=$1",[id]);
 await preview(`/api/students/${id}/exams/A`);
 assert.equal((await pool.query('SELECT submitted_at FROM attempts WHERE student_id=$1',[id])).rows[0].submitted_at,null);
 await client.request(`/api/students/${id}/exams/A/submit`,'POST',{});
 assert.equal((await preview(`/api/students/${id}/exams/A`)).data.record.correct,undefined);
 assert.ok((await teacher1.request(`/api/students/${id}/exams/A`)).data.record.correct);
 await teacher1.request(`/api/students/${id}/exams/A/release`,'POST',{released:true});
 assert.deepEqual((await preview(`/api/students/${id}/exams/A`)).data.questions,(await client.request(`/api/students/${id}/exams/A`)).data.questions);
 assert.equal((await teacher1.request('/api/me')).data.user.role,'teacher');
});
after(async()=>{
 if(server)await new Promise(r=>server.close(r));
 if(pool){
  // 仅清理本次随机前缀所创建的测试账号及关联记录，不接触真实学生。
  await pool.query('DELETE FROM attempts WHERE student_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM assignments WHERE student_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM classes WHERE teacher_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await pool.end();
 }
});
