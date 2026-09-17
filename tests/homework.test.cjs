const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { database, migrate } = require('../server/db');
const { createApp } = require('../server/index');
const { bank } = require('../server/content');
const { changedSegments, questionsInput, studentDetail } = require('../server/homework');
const provider = require('../server/ai-provider');
const ids = [], classes = [], prefix = 'hw_' + Date.now(), password = 'Homework-test-42!';
let pool, server, base, t1, t2, s1, s2, s3, homeworkId, handler, sent;
const originalKey = process.env.AI_ENCRYPTION_KEY;
process.env.AI_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const q = { text:'两盒彩笔和三本本子共27元，两盒彩笔和五本本子共35元。每本本子多少钱？', answer:'4', explain:'两组彩笔相同，相减得到两本本子共8元，每本4元。', unit:'元' };
const normal = body => ({choices:[{message:{content:JSON.stringify({questions:Array.from({length:JSON.parse(body.messages[1].content).题数},(_,i)=>({...q,text:q.text.replace('彩笔',i?'水彩笔':'彩笔')})),hints:['答案就是4元']})}}]});
function agent(){return {cookie:'',csrf:'',async request(path,method='GET',body,headers={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)this.csrf=data.csrf;return {status:r.status,data};
}};}
before(async()=>{
 pool=database();await Promise.all([migrate(pool),migrate(pool)]);
 const encoded=await argon2.hash(password);
 for(const suffix of ['t1','t2','s1','s2','s3']){const id=crypto.randomUUID();ids.push(id);await pool.query('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,$5,false)',[id,prefix+suffix,suffix,encoded,suffix[0]==='t'?'teacher':'student']);}
 for(let i=0;i<2;i++){const id=crypto.randomUUID();classes.push(id);await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)',[id,ids[i],'变式测试班'+i]);}
 for(let i=2;i<5;i++)await pool.query('INSERT INTO students(user_id,class_id) VALUES($1,$2)',[ids[i],classes[i===4?1:0]]);
 for(const id of ids.slice(2,4))await pool.query("INSERT INTO attempts(id,student_id,kind,version,answers,deadline,submitted_at,score,correct) VALUES($1,$2,'A','v3',$3,now(),now(),114,$4)",[crypto.randomUUID(),id,JSON.stringify(Array(20).fill('')),JSON.stringify(Array.from({length:20},(_,i)=>i!==7))]);
 handler=normal;server=createApp(pool,{aiRequest:async(config,body)=>{sent=body;return handler(body);}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 [t1,t2,s1,s2,s3]=Array.from({length:5},agent);
 for(const [i,c]of [t1,t2,s1,s2,s3].entries())assert.equal((await c.request('/api/login','POST',{username:prefix+['t1','t2','s1','s2','s3'][i],password})).status,200);
 await t1.request('/api/teacher/ai-settings','PUT',{endpoint:'https://api.example.com/v1',model:'test-model',apiKey:'test-only-homework-key',enabled:true,dailyLimit:30});
});
after(async()=>{
 if(server)await new Promise(r=>server.close(r));
 if(pool){await pool.query('DELETE FROM homework WHERE teacher_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM attempts WHERE student_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM assignments WHERE student_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM classes WHERE id=ANY($1::uuid[])',[classes]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await pool.end();}
 if(originalKey===undefined)delete process.env.AI_ENCRYPTION_KEY;else process.env.AI_ENCRYPTION_KEY=originalKey;
});
const source=()=>({kind:'A',version:'v3',number:8,classId:classes[0]});
const create=async()=>{const r=await t1.request('/api/teacher/homework','POST',source());assert.equal(r.status,201);return r.data;};
const edit=(h,extra={})=>t1.request('/api/teacher/homework/'+h.id,'PUT',{title:h.title,questions:h.questions,studentIds:h.studentIds,dueAt:null,revision:h.revision,...extra});

test('完整题干差异标记保留原文，教师输入验证与学生公开字段不泄漏答案',()=>{
 const seg=changedSegments('3本书共12元。每本多少钱？','5本书共20元。每本多少钱？');
 assert.equal(seg.map(s=>s.text).join(''),'5本书共20元。每本多少钱？');assert.ok(seg.some(s=>s.changed&&s.text.includes('5')));
 assert.throws(()=>questionsInput([{...q,text:'<script>恶意内容</script>'}]));assert.throws(()=>questionsInput([q,q]));
 const publicData=studentDetail({id:'x',source:{kind:'A',number:8,topic:'消去',text:'原题'},questions:[{...q,hints:['泄漏答案']}],records:{},status:'published'});
 assert.equal(publicData.questions[0].answer,undefined);assert.equal(publicData.questions[0].explain,undefined);assert.equal(publicData.source,undefined);assert.deepEqual(publicData.questions[0].hints,[]);
});
test('从实际试卷版本创建草稿，默认错题学生，教师和班级权限隔离',async()=>{
 assert.equal((await s1.request('/api/teacher/homework','POST',source())).status,403);
 assert.equal((await t2.request('/api/teacher/homework','POST',source())).status,404);
 assert.equal((await t1.request('/api/teacher/homework','POST',{...source(),version:'missing'})).status,404);
 const h=await create();homeworkId=h.id;assert.equal(h.source.text,bank.exams.v3.A[7].text);assert.deepEqual(h.studentIds.sort(),ids.slice(2,4).sort());assert.equal(h.status,'draft');
 assert.equal((await t2.request('/api/teacher/homework/'+h.id)).status,404);assert.equal((await s1.request('/api/homework/'+h.id)).status,404);
 assert.equal((await s1.request('/api/homework')).data.items.length,0);
});
test('AI草稿绑定原题且不发送学生资料，返回格式失败退额度，成功保存而不发布',async()=>{
 let h=(await t1.request('/api/teacher/homework/'+homeworkId)).data;
 const used=(await t1.request('/api/ai/status')).data.used;
 handler=()=>({choices:[{message:{content:'不是JSON'}}]});
 let r=await t1.request(`/api/teacher/homework/${h.id}/generate`,'POST',{revision:h.revision,difficulty:2,count:1});assert.equal(r.status,502);assert.equal((await t1.request('/api/ai/status')).data.used,used);
 handler=normal;r=await t1.request(`/api/teacher/homework/${h.id}/generate`,'POST',{revision:h.revision,difficulty:2,count:1});assert.equal(r.status,200);h=r.data;
 assert.equal(h.questions[0].text,q.text);assert.equal(h.questions[0].hints,undefined);assert.equal(h.status,'draft');assert.equal((await t1.request('/api/ai/status')).data.used,used+1);
 assert.ok(sent.messages[1].content.includes(bank.exams.v3.A[7].text));assert.ok(!sent.messages[1].content.includes(prefix));
 assert.equal((await edit({...h,revision:0})).status,409);
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/generate`,'POST',{revision:h.revision,difficulty:2,count:1})).status,409);
});
test('发布必须审核并保存，过期时间与跨教师名单拒绝，重复发布幂等',async()=>{
 let h=(await t1.request('/api/teacher/homework/'+homeworkId)).data;
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision})).status,400);
 h=(await edit(h,{studentIds:[ids[2],ids[4]]})).data;
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision,reviewed:true})).status,404);
 assert.equal((await pool.query('SELECT 1 FROM homework_students WHERE homework_id=$1',[h.id])).rowCount,0);
 h=(await edit(h,{studentIds:[ids[2]],dueAt:'2020-01-01T00:00:00Z'})).data;
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision,reviewed:true})).status,400);
 h=(await edit(h,{dueAt:new Date(Date.now()+86400000).toISOString()})).data;
 let r=await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision,reviewed:true});assert.equal(r.status,200);assert.equal(r.data.status,'published');
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision,reviewed:true})).status,200);
 assert.equal((await edit(h)).status,409);assert.equal((await pool.query('SELECT 1 FROM homework_students WHERE homework_id=$1',[h.id])).rowCount,1);
 assert.equal((await s2.request('/api/homework/'+h.id)).status,404);
 const detail=(await s1.request('/api/homework/'+h.id)).data;assert.equal(detail.questions[0].answer,undefined);assert.equal(detail.source,undefined);assert.equal(detail.questions[0].explain,undefined);
});
test('分步提示封顶且不返回标准答案，保留首次和最近结果，正式分数不变',async()=>{
 const path=`/api/homework/${homeworkId}/questions/0`;
 assert.equal((await t1.request(path+'/answer','POST',{answer:'4'})).status,403);
 assert.equal((await t1.request(path+'/answer','POST',{answer:'4'},{'X-Student-Preview':ids[2]})).status,403);
 assert.equal((await s2.request(path+'/answer','POST',{answer:'4'})).status,404);
 let r=await s1.request(path+'/answer','POST',{answer:'6'});assert.equal(r.status,200);assert.equal(r.data.firstCorrect,0);assert.equal(r.data.latestCorrect,0);assert.equal(r.data.attempted,1);assert.ok(r.data.completedAt);
 for(let n=1;n<=4;n++){r=await s1.request(path+'/hint','POST',{});assert.equal(r.status,200);assert.equal(r.data.questions[0].hints.length,Math.min(n,3));assert.ok(!r.data.questions[0].hints.join('').includes('4'));}
 r=await s1.request(path+'/answer','POST',{answer:'4元'});assert.equal(r.data.latestCorrect,1);assert.equal(r.data.firstCorrect,0);assert.equal(r.data.questions[0].submissions[1].hintCount,3);
 const report=(await t1.request('/api/teacher/homework/'+homeworkId)).data;assert.equal(report.students[0].originalCorrect,false);assert.equal(report.students[0].firstCorrect,0);assert.equal(report.students[0].latestCorrect,1);
 assert.equal((await pool.query("SELECT score FROM attempts WHERE student_id=$1 AND kind='A'",[ids[2]])).rows[0].score,114);
 const preview=await t1.request('/api/homework/'+homeworkId,'GET',undefined,{'X-Student-Preview':ids[2]});assert.equal(preview.status,200);assert.equal(preview.data.questions[0].answer,undefined);
});
test('正式测评期间不可读作业或用提示，转到其他教师后不可访问旧作业',async()=>{
 const attempt=crypto.randomUUID();await pool.query("INSERT INTO attempts(id,student_id,kind,version,answers,deadline) VALUES($1,$2,'B','v2','[]',now()+interval '45 minutes')",[attempt,ids[2]]);
 assert.equal((await s1.request('/api/homework')).status,403);assert.equal((await s1.request('/api/homework/'+homeworkId)).status,403);assert.equal((await s1.request(`/api/homework/${homeworkId}/questions/0/hint`,'POST',{})).status,403);
 await pool.query('DELETE FROM attempts WHERE id=$1',[attempt]);
 await pool.query('UPDATE students SET class_id=$2 WHERE user_id=$1',[ids[2],classes[1]]);
 assert.equal((await s1.request('/api/homework/'+homeworkId)).status,404);assert.equal((await t1.request('/api/teacher/homework/'+homeworkId)).data.students.length,0);
 await pool.query('UPDATE students SET class_id=$2 WHERE user_id=$1',[ids[2],classes[0]]);
});
test('手动编题无需模型，所有题作答才完成，逾期补做保留标记',async()=>{
 let h=await create();h=(await edit(h,{questions:[q,{...q,text:q.text.replace('彩笔','铅笔')}],studentIds:[ids[3]]})).data;
 assert.equal((await t1.request(`/api/teacher/homework/${h.id}/publish`,'POST',{revision:h.revision,reviewed:true})).status,200);
 await pool.query("UPDATE homework SET due_at=now()-interval '1 hour' WHERE id=$1",[h.id]);
 let r=await s2.request(`/api/homework/${h.id}/questions/0/answer`,'POST',{answer:'4'});assert.equal(r.data.completedAt,null);
 r=await s2.request(`/api/homework/${h.id}/questions/1/answer`,'POST',{answer:'0'});assert.ok(r.data.completedAt);assert.equal(r.data.late,true);assert.equal(r.data.latestCorrect,1);
 const history=(await s2.request('/api/homework')).data;assert.equal(history.items[0].attempted,2);assert.equal(history.items[0].questions,undefined);
});
test('AI生成期间另页更新草稿，旧结果不覆盖修改并归还额度',async()=>{
 const h=await create(),used=(await t1.request('/api/ai/status')).data.used;
 let release,entered;const waiting=new Promise(r=>entered=r);
 handler=body=>{entered();return new Promise(r=>release=()=>r(normal(body)));};
 const pending=t1.request(`/api/teacher/homework/${h.id}/generate`,'POST',{revision:h.revision,difficulty:2,count:1});
 await waiting;assert.equal((await edit(h,{title:'另一页已保存'})).status,200);release();
 assert.equal((await pending).status,409);
 const latest=(await t1.request('/api/teacher/homework/'+h.id)).data;assert.equal(latest.title,'另一页已保存');assert.deepEqual(latest.questions,[]);
 assert.equal((await t1.request('/api/ai/status')).data.used,used);handler=normal;
});
