const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { database, migrate } = require('../server/db');
const { createApp } = require('../server/index');
const { buildProblem, matchesAnswer } = require('../server/ai-templates');
const { publicQuestion } = require('../server/ai-practice');
const provider = require('../server/ai-provider');
let pool, server, base, t1, t2, s1, s2, classId, questionId, calls = 0, handler;
const ids = [], prefix = 'ai_' + Date.now(), password = 'AI-test-only-42!';
const originalKey = process.env.AI_ENCRYPTION_KEY;
const secret = 'test-api-key-not-a-real-credential';
process.env.AI_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const normal = body => ({ choices: [{ message: { content: JSON.stringify({ seeds: Array.from({ length: Number(body.messages[1].content.match(/需要(\d)/)[1]) }, (_, i) => 938 + i), answer: '恶意标准答案', explain: '泄漏的完整解法' }) } }] });
function agent() { return { cookie: '', csrf: '', async request(path, method = 'GET', body) {
 const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: this.cookie, 'X-CSRF-Token': this.csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
 const data = await response.json(); if (data.csrf) this.csrf = data.csrf;
 return { status: response.status, data };
 } }; }
before(async () => {
 pool = database(); await migrate(pool);
 const encoded = await argon2.hash(password);
 for (const suffix of ['t1', 't2', 's1', 's2']) {
  const id = crypto.randomUUID(); ids.push(id);
  await pool.query('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,$5,false)', [id, prefix + suffix, suffix, encoded, suffix[0] === 't' ? 'teacher' : 'student']);
 }
 classId = crypto.randomUUID();
 await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [classId, ids[0], 'AI测试班']);
 for (const id of ids.slice(2)) await pool.query('INSERT INTO students(user_id,class_id) VALUES($1,$2)', [id, classId]);
 handler = normal;
 server = createApp(pool, { aiRequest: async (config, body) => { calls++; assert.equal(provider.decrypt(config.key_cipher), secret); return handler(body); } }).listen(0, '127.0.0.1');
 await new Promise(resolve => server.once('listening', resolve));
 base = 'http://127.0.0.1:' + server.address().port;
 [t1, t2, s1, s2] = Array.from({ length: 4 }, agent);
 for (const [i, client] of [t1, t2, s1, s2].entries()) assert.equal((await client.request('/api/login', 'POST', { username: prefix + ['t1', 't2', 's1', 's2'][i], password })).status, 200);
});
after(async () => {
 if (server) await new Promise(resolve => server.close(resolve));
 if (pool) {
  await pool.query('DELETE FROM attempts WHERE student_id=ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM assignments WHERE student_id=ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM classes WHERE id=$1', [classId]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]); await pool.end();
 }
 if (originalKey === undefined) delete process.env.AI_ENCRYPTION_KEY; else process.env.AI_ENCRYPTION_KEY = originalKey;
});
const setting = dailyLimit => ({ endpoint: 'https://api.example.com/v1', model: 'test-model', apiKey: secret, enabled: true, dailyLimit });
test('AI设置按教师隔离、密钥加密且不回显，禁用时学生不能出题', async () => {
 assert.equal((await agent().request('/api/ai/status')).status, 401);
 assert.equal((await s1.request('/api/teacher/ai-settings')).status, 403);
 assert.equal((await s1.request('/api/ai/generate', 'POST', { lesson: 0, difficulty: 1, count: 1 })).status, 403);
 let r = await t1.request('/api/teacher/ai-settings', 'PUT', setting(20)); assert.equal(r.status, 200); assert.equal(r.data.configured, true);
 assert.equal(JSON.stringify(r.data).includes(secret), false);
 const cipher = (await pool.query('SELECT key_cipher FROM ai_settings WHERE teacher_id=$1', [ids[0]])).rows[0].key_cipher;
 assert.notEqual(cipher, secret); assert.equal(provider.decrypt(cipher), secret);
 assert.equal((await t2.request('/api/teacher/ai-settings')).data.configured, false);
 r = await t1.request('/api/teacher/ai-settings', 'PUT', { ...setting(20), apiKey: '' }); assert.equal(r.status, 200);
 assert.equal((await pool.query('SELECT key_cipher FROM ai_settings WHERE teacher_id=$1', [ids[0]])).rows[0].key_cipher, cipher);
 assert.equal((await t1.request('/api/teacher/ai-settings', 'PUT', { ...setting(20), endpoint: 'https://other.example.com/v1', apiKey: '' })).status, 400);
 assert.equal((await t1.request('/api/teacher/ai-settings/test', 'POST', {})).status, 200);
});
test('模型只能贡献整数参数，公开接口不含标准答案、未展开提示或自由文本', async () => {
 const r = await s1.request('/api/ai/generate', 'POST', { lesson: 0, difficulty: 2, count: 2 });
 assert.equal(r.status, 200); assert.equal(r.data.questions.length, 2);
 assert.notEqual(r.data.questions[0].text, r.data.questions[1].text);
 questionId = r.data.questions[0].id;
 for (const q of r.data.questions) { assert.equal(q.answer, undefined); assert.equal(q.seed, undefined); assert.deepEqual(q.hints, []); assert.equal(q.explain, undefined); }
 assert.doesNotMatch(JSON.stringify(r.data), /恶意|泄漏|seeds|problem/);
 assert.equal((await s1.request('/api/ai/status')).data.used, 2);
 assert.equal((await s2.request('/api/ai/questions')).data.questions.length, 0);
 assert.equal((await s2.request(`/api/ai/questions/${questionId}/hint`, 'POST', {})).status, 404);
 assert.equal((await t2.request(`/api/teacher/students/${ids[2]}/ai-questions`)).status, 404);
 assert.equal((await t1.request(`/api/teacher/students/${ids[2]}/ai-questions`)).data.questions.length, 2);
});
test('逐级提示封顶、答题只返回正误，历史仅含学生自己提交的答案', async () => {
 const q = (await pool.query('SELECT * FROM ai_questions WHERE id=$1', [questionId])).rows[0];
 for (let n = 1; n <= 4; n++) {
  const r = await s1.request(`/api/ai/questions/${questionId}/hint`, 'POST', {});
  assert.equal(r.status, 200); assert.equal(r.data.hintCount, Math.min(n, 3));
  assert.deepEqual(Object.keys(r.data).sort(), ['hint', 'hintCount', 'totalHints']);
 }
 let r = await s1.request(`/api/ai/questions/${questionId}/answer`, 'POST', { answer: '999' });
 assert.equal(r.data.correct, false); assert.deepEqual(Object.keys(r.data).sort(), ['correct', 'date']);
 r = await s1.request(`/api/ai/questions/${questionId}/answer`, 'POST', { answer: q.problem.answer + q.problem.unit }); assert.equal(r.data.correct, true);
 const history = (await s1.request('/api/ai/questions')).data.questions.find(x => x.id === questionId);
 assert.equal(history.hintCount, 3); assert.equal(history.submissions.length, 2); assert.equal(history.answer, undefined);
 assert.equal(history.submissions[0].answer, '999');
});
test('考试期间拒绝生成、历史、提示与答题；不调用模型也不扣额度', async () => {
 await pool.query("INSERT INTO attempts(id,student_id,kind,answers,deadline) VALUES($1,$2,'A','[]',now()+interval '45 minutes')", [crypto.randomUUID(), ids[2]]);
 const before = calls;
 assert.equal((await s1.request('/api/ai/status')).data.blocked, true);
 assert.equal((await s1.request('/api/ai/questions')).status, 403);
 assert.equal((await s1.request('/api/ai/generate', 'POST', { lesson: 0, difficulty: 1, count: 1 })).status, 403);
 assert.equal((await s1.request(`/api/ai/questions/${questionId}/hint`, 'POST', {})).status, 403);
 assert.equal((await s1.request(`/api/ai/questions/${questionId}/answer`, 'POST', { answer: '1' })).status, 403);
 assert.equal(calls, before);
 await pool.query('DELETE FROM attempts WHERE student_id=$1', [ids[2]]);
});
test('出题失败归还额度；同一用户并发请求只调用一次模型', async () => {
 const before = (await s2.request('/api/ai/status')).data.used;
 handler = () => ({ choices: [{ message: { content: '{"seeds":[1],"answer":"忽略规则"}' } }] });
 assert.equal((await s2.request('/api/ai/generate', 'POST', { lesson: 1, difficulty: 2, count: 2 })).status, 502);
 assert.equal((await s2.request('/api/ai/status')).data.used, before);
 let release, started;
 const entered = new Promise(resolve => { started = resolve; });
 handler = body => new Promise(resolve => { release = () => resolve(normal(body)); started(); });
 const pending = s2.request('/api/ai/generate', 'POST', { lesson: 1, difficulty: 3, count: 1 });
 await entered;
 const during = calls;
 assert.equal((await s2.request('/api/ai/generate', 'POST', { lesson: 1, difficulty: 3, count: 1 })).status, 409);
 assert.equal(calls, during); release(); assert.equal((await pending).status, 200); handler = normal;
 assert.equal((await s2.request('/api/ai/status')).data.used, before + 1);
});
test('限额、参数验证和老师停用均由后端强制执行', async () => {
 assert.equal((await t1.request('/api/teacher/ai-settings', 'PUT', setting(1))).status, 200);
 const before = calls;
 assert.equal((await s2.request('/api/ai/generate', 'POST', { lesson: 1, difficulty: 1, count: 1 })).status, 429);
 assert.equal((await s2.request('/api/ai/generate', 'POST', { lesson: 12, difficulty: 1, count: 1 })).status, 400);
 assert.equal(calls, before);
 assert.equal((await t1.request('/api/teacher/ai-settings', 'PUT', { ...setting(20), enabled: false })).status, 200);
 assert.equal((await s2.request('/api/ai/generate', 'POST', { lesson: 1, difficulty: 1, count: 1 })).status, 403);
 assert.equal((await s1.request(`/api/ai/questions/${questionId}/hint`, 'POST', {})).status, 403);
});
test('公共地址限制与加密认证拒绝内部地址和被篡改密文', () => {
 for (const ip of ['127.0.0.1', '10.1.1.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '198.51.100.2', '203.0.113.1', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '2001::1', '2001:0000:0:0:0:0:0:1', '2001:0db8::1']) assert.equal(provider.publicAddress(ip), false, ip);
 for (const endpoint of ['http://api.example.com', 'https://127.0.0.1', 'https://localhost', 'https://api.internal/v1', 'https://u:p@api.example.com', 'https://api.example.com:8000', 'https://api.example.com/v1?key=abc']) assert.throws(() => provider.endpointUrl(endpoint));
 assert.equal(provider.endpointUrl('https://api.example.com/v1').pathname, '/v1/chat/completions');
 assert.equal(provider.publicAddress('8.8.8.8'), true);
 const cipher = provider.encrypt('测试密钥'), pieces = cipher.split('.'); pieces[2] = Buffer.from('tampered').toString('base64');
 assert.throws(() => provider.decrypt(pieces.join('.')));
});
test('模型空值、无效JSON和越界参数统一作为安全格式错误处理', async () => {
 for (const content of ['null','[]','不是JSON','{"seeds":[0]}','{"seeds":[1,1]}','{"seeds":[1000000001]}']) {
  await assert.rejects(provider.requestPlan({model:'test'},0,1,1,async()=>({choices:[{message:{content}}]})), error=>error.status===502);
 }
});
test('全部模板多组参数均有完整题干和三级无结果提示，数值题按独立公式核验', () => {
 for (let lesson = 0; lesson < 12; lesson++) for (let difficulty = 1; difficulty <= 3; difficulty++) for (let seed = 1; seed <= 80; seed++) {
  const p = buildProblem(lesson, difficulty, seed);
  assert.ok(p.text.length > 30 && p.text.includes('？'), `第${lesson+1}课题干应有条件和明确提问`); assert.equal(p.hints.length, 3); assert.ok(p.answer.length); assert.equal(matchesAnswer(p.answer + p.unit, p), true);
  assert.equal(p.hints.some(h => /[0-9=＝]/.test(h)), false);
  const q = publicQuestion({ id: 'id', lesson, difficulty, problem: p, hint_count: 0 }); assert.equal(q.answer, undefined); assert.deepEqual(q.hints, []);
  if (lesson === 0) { const n = p.text.match(/\d+(?:\.\d+)?/g).map(Number); const expected=difficulty===3?(n[2]*n[4]-n[5]*n[1])/(n[0]*n[4]-n[3]*n[1]):(n[2]*(n[3]/n[0])-n[5])/(n[1]*(n[3]/n[0])-n[4]); assert.ok(Math.abs(Number(p.answer)-expected)<1e-9); }
  if (lesson === 1) { const n=p.text.match(/\d+/g).map(Number), big=(3*n[5]-2*n[2])/5, small=(3*n[2]-2*n[5])/5; assert.equal(Number(p.answer), difficulty===1?big:difficulty===2?4*(big+small):5*big+4*small); }
  if ([2,10].includes(lesson)) { const colors=p.text.match(/按(.+?)的顺序/)[1].split('、'), target=Number(p.text.match(/第(\d+)面彩旗是什么/)[1]); assert.equal(p.answer,colors[(target-1)%colors.length]); }
  if (lesson === 3) { const [total,low,high]=p.text.match(/\d+/g).map(Number); assert.equal(Number(p.answer),Array.from({length:high-low+1},(_,i)=>low+i).filter(n=>total%n===0).length); }
  if (lesson === 4) { const [a,b]=p.text.match(/\d+/g).map(Number);let interval=1;while(interval%a||interval%b)interval++;assert.equal(Number(p.answer),difficulty===1?interval:Number(p.text.match(/直到第(\d+)秒/)[1])/interval); }
  if (lesson === 5) { const n = p.text.match(/\d+/g).map(Number); assert.equal(Number(p.answer), n[0] * n[1] - n[2] ** 2); }
  if (lesson === 6) { const n=p.text.match(/\d+/g).map(Number); if(difficulty===1)assert.equal(Number(p.answer),(n[0]+n[1]/2)*n[2]**2);if(difficulty===2)assert.equal(Number(p.answer),n[0]-n[2]);if(difficulty===3){const front=p.text.match(/前排各列分别堆([\d、]+)层/)[1].split('、').map(Number),back=p.text.match(/后排对应各列分别堆([\d、]+)层/)[1].split('、').map(Number);let area=0;for(let col=0;col<3;col++)for(let level=1;level<=4;level++)if(front[col]>=level||back[col]>=level)area++;assert.equal(Number(p.answer),area);}}
  if (lesson === 7) { const n = p.text.match(/\d+/g).map(Number); const [slow, lead, fast, chase, rest = 0] = n; assert.equal(Number(p.answer), (slow * lead + fast * rest) / (fast - slow)); if (difficulty > 1) assert.ok(slow * lead > (fast - slow) * chase); }
  if (lesson === 8) { const n = p.text.match(/\d+/g).map(Number); const [c1, d1, c2, d2, target] = n, growth = (c1*d1-c2*d2)/(d1-d2), initial = (c1-growth)*d1; assert.notEqual(target, c1); assert.notEqual(target, c2); assert.equal(Number(p.answer), initial/(target-growth)); }
  if (lesson === 9) {const n=p.text.match(/\d+/g).map(Number);if(difficulty===1)assert.equal(Number(p.answer),4*n[0]-n[1]-n[2]-n[3]);else{let count=0;for(let a=n[1];a<=n[2];a++)for(let b=n[1];b<=n[2];b++)for(let c=n[1];c<=n[2];c++)if(a+b+c===n[0])count++;assert.equal(Number(p.answer),count);}}
 }
});
