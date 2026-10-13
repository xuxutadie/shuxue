const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { database, migrate } = require('../server/db');
const { createApp } = require('../server/index');
const { paper } = require('../server/review-paper.cjs');
const review = require('../server/review-exams');

let pool, server, base, teacher, otherTeacher, classId, otherClassId;
const ids = [], classes = [], prefix = 'review_' + Date.now() + '_';

async function client(user) {
  const token = randomBytes(24).toString('hex'), csrf = randomBytes(24).toString('hex');
  await pool.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), user.id, csrf]);
  return async (path, method = 'GET', body, extra = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: 'math_session=' + token, 'X-CSRF-Token': csrf, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, data: await res.json() };
  };
}
async function makeUser(role, name, targetClass = classId) {
  const id = randomUUID(); ids.push(id);
  await pool.query('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,$5,false)', [id, prefix + ids.length, name, 'not-a-login-password', role]);
  if (role === 'student') await pool.query('INSERT INTO students(user_id,class_id,data) VALUES($1,$2,$3)', [id, targetClass, JSON.stringify({ completed: [], practice: {}, talk: {}, notes: {}, games: {}, history: [], sentinel: { keep: '其他学习记录' } })]);
  const user = { id, role, name }; user.request = await client(user); return user;
}
const path = (student, suffix = '') => '/api/students/' + student.id + '/exams/R' + suffix;
const keyAnswers = () => paper.questions.map(q => q.type === 'multiple' ? q.answer.join('') : typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer));
async function assignStudent(student, enabled = true) { return teacher.request('/api/teacher/assign', 'POST', { kind: 'R', studentId: student.id, enabled }); }
async function startStudent(student) { assert.equal((await assignStudent(student)).status, 200); const r = await student.request(path(student, '/start'), 'POST', { version: 'r1' }); assert.equal(r.status, 200); return r.data.record; }
async function rawData(student) { return (await pool.query('SELECT data FROM students WHERE user_id=$1', [student.id])).rows[0].data; }
async function setDeadline(student, delta = -1000) { const data = await rawData(student); data.reviewExam.attempt.deadline = new Date(Date.now() + delta).toISOString(); await pool.query('UPDATE students SET data=$2 WHERE user_id=$1', [student.id, JSON.stringify(data)]); }
function assertSafeQuestions(questions) {
  const hidden = /^(?:answer|explain|explanation|solution|correct|itemScores)$/;
  function visit(value) { if (!value || typeof value !== 'object') return; for (const [key, v] of Object.entries(value)) { assert.ok(!hidden.test(key), '未开放试卷泄漏字段：' + key); visit(v); } }
  questions.forEach(visit);
}

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error('回顾测评集成测试需要真实PostgreSQL测试数据库。');
  pool = database(); await migrate(pool);
  teacher = await makeUser('teacher', '回顾测评教师'); otherTeacher = await makeUser('teacher', '另一个教师');
  for (const owner of [teacher, otherTeacher]) { const id = randomUUID(); classes.push(id); await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [id, owner.id, '回顾测评测试班']); }
  [classId, otherClassId] = classes;
  server = createApp(pool).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (!pool) return;
  try {
    await pool.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM attempts WHERE student_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM assignments WHERE student_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM students WHERE user_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM classes WHERE id=ANY($1::uuid[])', [classes]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
  } finally { await pool.end(); }
});

test('回顾测评布置和开考受账号所有权限制，班级批量布置不跨教师', async () => {
  const student = await makeUser('student', '布置隔离学生'), peer = await makeUser('student', '同班学生'), outsider = await makeUser('student', '其他老师学生', otherClassId);
  assert.equal((await student.request(path(student, '/start'), 'POST', {})).status, 403);
  assert.equal((await student.request('/api/teacher/assign', 'POST', { kind: 'R', studentId: student.id, enabled: true })).status, 403);
  assert.equal((await otherTeacher.request('/api/teacher/assign', 'POST', { kind: 'R', studentId: student.id, enabled: true })).status, 404);
  assert.equal((await teacher.request('/api/teacher/assign', 'POST', { kind: 'R', classId: otherClassId, enabled: true })).status, 404);
  assert.equal((await teacher.request('/api/teacher/assign', 'POST', { kind: 'R', classId, enabled: true })).status, 200);
  assert.equal((await rawData(student)).reviewExam.enabled, true); assert.equal((await rawData(peer)).reviewExam.enabled, true); assert.equal((await rawData(outsider)).reviewExam, undefined);
  assert.equal((await peer.request(path(student))).status, 404);
  assert.equal((await otherTeacher.request(path(student))).status, 404);
  assert.equal((await teacher.request(path(student, '/start'), 'POST', {})).status, 403);
  assert.equal((await assignStudent(peer, false)).status, 200); assert.equal((await rawData(peer)).reviewExam.enabled, false);
});

test('学生预览可以查看已布置的空白卷，但不建记录、不计时、不写入或到期交卷', async () => {
  const student = await makeUser('student', '只读预览学生'); await assignStudent(student);
  const before = await rawData(student), header = { 'X-Student-Preview': student.id };
  let r = await teacher.request(path(student) + '?previewPaper=1', 'GET', undefined, header);
  assert.equal(r.status, 200); assert.equal(r.data.preview, true); assert.equal(r.data.record.id, null); assert.equal(r.data.record.deadline, null); assert.equal(r.data.questions.length, 25); assertSafeQuestions(r.data.questions);
  assert.deepEqual(await rawData(student), before);
  for (const [suffix, method, body] of [['/start', 'POST', {}], ['/answers', 'PUT', { answers: keyAnswers(), revision: 0 }], ['/submit', 'POST', {}]]) assert.equal((await teacher.request(path(student, suffix), method, body, header)).status, 403);
  await startStudent(student); await setDeadline(student);
  r = await teacher.request(path(student), 'GET', undefined, header); assert.equal(r.status, 200); assert.equal(r.data.record.date, null);
  assert.equal((await rawData(student)).reviewExam.attempt.submitted_at, null);
});

test('回顾测评服务端计时60分钟，重复或并发开考复用同一个记录与截止时间', async () => {
  const student = await makeUser('student', '幂等开考学生'); await assignStudent(student);
  const [a, b] = await Promise.all([student.request(path(student, '/start'), 'POST', {}), student.request(path(student, '/start'), 'POST', {})]);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(a.data.record.id, b.data.record.id); assert.equal(a.data.record.deadline, b.data.record.deadline);
  const attempt = (await rawData(student)).reviewExam.attempt;
  assert.equal(Date.parse(attempt.deadline) - Date.parse(attempt.started_at), 60 * 60000); assert.equal(a.data.record.score, null);
  const read = await student.request(path(student)); assertSafeQuestions(read.data.questions); assert.equal(read.data.record.correct, undefined); assert.equal(read.data.record.itemScores, undefined);
  const p = await student.request('/api/students/' + student.id); assert.equal(p.data.assignments.R, true); assert.equal(p.data.drafts.R.id, attempt.id); assert.equal(p.data.reviewExam, undefined);
  assert.equal((await assignStudent(student, false)).status, 409); assert.equal((await rawData(student)).reviewExam.enabled, true);
});

test('100分评分、解题过程、幂等交卷与教师开放讲评保持一致', async () => {
  const student = await makeUser('student', '满分学生'); await startStudent(student);
  const workings = Array(25).fill(''); workings[22] = '先画图，再按两个条件列出关系。';
  let r = await student.request(path(student, '/answers'), 'PUT', { version: 'r1', answers: keyAnswers(), workings, revision: 0, score: -10 });
  assert.equal(r.status, 200); assert.equal(r.data.record.revision, 1); assert.equal(r.data.record.score, null);
  r = await student.request(path(student, '/submit'), 'POST', { version: 'r1' }); assert.equal(r.status, 200); assert.equal(r.data.record.score, 100); assert.equal(r.data.record.correct, undefined); assert.equal(r.data.record.itemScores, undefined); assert.equal(r.data.record.workings[22], workings[22]);
  const date = r.data.record.date;
  assert.equal((await student.request(path(student, '/submit'), 'POST', {})).data.record.date, date);
  const beforeRelease = await student.request(path(student)); assertSafeQuestions(beforeRelease.data.questions);
  const teacherRead = await teacher.request(path(student)); assert.equal(teacherRead.data.record.correct.filter(Boolean).length, 25); assert.equal(teacherRead.data.record.itemScores.reduce((a, b) => a + b, 0), 100); assert.ok(teacherRead.data.questions[0].answer !== undefined);
  assert.equal((await student.request(path(student, '/release'), 'POST', { released: true })).status, 403);
  assert.equal((await otherTeacher.request(path(student, '/release'), 'POST', { released: true })).status, 404);
  assert.equal((await teacher.request(path(student, '/release'), 'POST', { released: 'yes' })).status, 400);
  assert.equal((await teacher.request(path(student, '/release'), 'POST', { released: true })).status, 200);
  r = await student.request(path(student)); assert.equal(r.data.record.correct.filter(Boolean).length, 25); assert.ok(r.data.questions[0].answer !== undefined);
  assert.equal((await teacher.request(path(student, '/release'), 'POST', { released: false })).status, 200);
  assertSafeQuestions((await student.request(path(student))).data.questions);
  assert.deepEqual((await rawData(student)).sentinel, { keep: '其他学习记录' });
});

test('应用题按两个小问各5分评分，未开放时不泄露分题得分', async () => {
  const student = await makeUser('student', '应用题部分分'); await startStudent(student);
  const answers = Array(25).fill(''), question = paper.questions[22];
  const correctParts = typeof question.answer === 'string' ? JSON.parse(question.answer) : question.answer;
  assert.equal(correctParts.length, 2); answers[22] = JSON.stringify([correctParts[0], '999999']);
  assert.equal((await student.request(path(student, '/answers'), 'PUT', { answers, revision: 0 })).status, 200);
  const r = await student.request(path(student, '/submit'), 'POST', {}); assert.equal(r.data.record.score, 5); assert.equal(r.data.record.itemScores, undefined);
  const seen = await teacher.request(path(student)); assert.equal(seen.data.record.itemScores[22], 5); assert.equal(seen.data.record.correct[22], false);
});

test('答案长度、试卷版本和修订冲突校验，超时只按已保存的答案交卷', async () => {
  const student = await makeUser('student', '并发及截止学生'); await startStudent(student);
  assert.equal((await student.request(path(student, '/answers'), 'PUT', { answers: [], revision: 0 })).status, 400);
  assert.equal((await student.request(path(student, '/answers'), 'PUT', { answers: keyAnswers(), workings: Array(25).fill('字'.repeat(1001)), revision: 0 })).status, 400);
  assert.equal((await student.request(path(student, '/answers'), 'PUT', { version: 'r2', answers: keyAnswers(), revision: 0 })).status, 409);
  const saved = Array(25).fill(''); saved[0] = keyAnswers()[0];
  assert.equal((await student.request(path(student, '/answers'), 'PUT', { answers: saved, revision: 0 })).data.record.revision, 1);
  const conflict = await student.request(path(student, '/answers'), 'PUT', { answers: keyAnswers(), revision: 0 }); assert.equal(conflict.status, 409); assert.equal(conflict.data.conflict, true); assert.deepEqual(conflict.data.record.answers, saved);
  await setDeadline(student);
  const late = await student.request(path(student, '/answers'), 'PUT', { answers: keyAnswers(), revision: 1 }); assert.equal(late.status, 409); assert.equal(late.data.expired, true); assert.equal(late.data.record.timedOut, true); assert.deepEqual(late.data.record.answers, saved); assert.equal(late.data.record.score, paper.questions[0].points);
  assert.equal((await rawData(student)).reviewExam.attempt.revision, 1);
});

test('A/B卷和回顾测评互斥，未到期回顾测评同时阻止AI提示和游戏', async () => {
  const student = await makeUser('student', '测评互斥学生'); await assignStudent(student);
  await pool.query("INSERT INTO attempts(id,student_id,kind,version,answers,deadline) VALUES($1,$2,'A','v3',$3,now()+interval '45 minutes')", [randomUUID(), student.id, JSON.stringify(Array(20).fill(''))]);
  assert.equal((await student.request(path(student, '/start'), 'POST', {})).status, 409);
  await pool.query("UPDATE attempts SET deadline=now()-interval '1 second' WHERE student_id=$1", [student.id]);
  assert.equal((await student.request(path(student, '/start'), 'POST', {})).status, 200);
  assert.equal(review.hasActive(await rawData(student)), true); assert.equal(await review.activeForStudent(pool, student.id), true);
  assert.equal((await teacher.request('/api/teacher/assign', 'POST', { kind: 'B', studentId: student.id, enabled: true })).status, 200);
  assert.equal((await student.request('/api/students/' + student.id + '/exams/B/start', 'POST', {})).status, 409);
  assert.equal((await student.request('/api/world3d/' + student.id)).status, 403);
  await student.request(path(student, '/submit'), 'POST', {});
  assert.equal(review.hasActive(await rawData(student)), false); assert.equal(await review.activeForStudent(pool, student.id), false);
  assert.equal((await student.request('/api/students/' + student.id + '/exams/B/start', 'POST', {})).status, 200);
});

test('定时到期交卷和profile序列化不泄漏未开放讲评，保留其他学生与学习数据', async () => {
  const expired = await makeUser('student', '自动交卷学生'), running = await makeUser('student', '未到期学生');
  await startStudent(expired); await startStudent(running); await setDeadline(expired);
  await review.expireReviewAttempts(pool);
  const data = await rawData(expired), other = await rawData(running);
  assert.ok(data.reviewExam.attempt.submitted_at); assert.equal(data.reviewExam.attempt.score, 0); assert.equal(data.reviewExam.attempt.timed_out, true); assert.equal(other.reviewExam.attempt.submitted_at, null);
  const packed = review.profile(data, false); assert.equal(packed.record.score, 0); assert.equal(packed.record.correct, undefined); assert.equal(packed.record.itemScores, undefined); assert.equal(packed.record.answers.length, 25);
  assert.equal(review.profile(data, true).record.correct.length, 25); assert.deepEqual(data.sentinel, { keep: '其他学习记录' });
  const api = await expired.request('/api/students/' + expired.id); assert.equal(api.data.reviewExam, undefined); assert.equal(api.data.exams.R.score, 0); assert.equal(api.data.exams.R.correct, undefined);
  const id = data.reviewExam.attempt.id; await review.expireReviewAttempts(pool); assert.equal((await rawData(expired)).reviewExam.attempt.id, id);
});

test('回顾测评期间AI状态标记被阻止，生成请求先受测评守卫限制，提交后恢复', async () => {
  const student = await makeUser('student', 'AI测评守卫学生');
  assert.equal((await student.request('/api/ai/status')).data.blocked, false);
  await startStudent(student);
  const status = await student.request('/api/ai/status'); assert.equal(status.status, 200); assert.equal(status.data.blocked, true);
  const blocked = await student.request('/api/ai/generate', 'POST', { lesson: 0, difficulty: 3, count: 1 });
  assert.equal(blocked.status, 403); assert.match(blocked.data.error, /测评/);
  assert.equal((await student.request(path(student, '/submit'), 'POST', {})).status, 200);
  const restored = await student.request('/api/ai/status'); assert.equal(restored.status, 200); assert.equal(restored.data.blocked, false);
});

test('回顾测评班级分析保留100分制和应用题部分分错题，区分空白并严格限定教师', async () => {
  const analysisClass = randomUUID(); classes.push(analysisClass);
  await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [analysisClass, teacher.id, '回顾测评分析专用班']);
  const submitted = await makeUser('student', '分析部分分学生', analysisClass);
  const assigned = await makeUser('student', '分析未开始学生', analysisClass);
  const outsider = await makeUser('student', '其他教师已交卷学生', otherClassId);
  await startStudent(submitted); await assignStudent(assigned);
  const answers = Array(25).fill(''); answers[22] = JSON.stringify([paper.questions[22].parts[0].answer, '']); answers[23] = JSON.stringify(['', '']);
  assert.equal((await submitted.request(path(submitted, '/answers'), 'PUT', { answers, revision: 0 })).status, 200);
  assert.equal((await submitted.request(path(submitted, '/submit'), 'POST', {})).data.record.score, 5);
  assert.equal((await otherTeacher.request('/api/teacher/assign', 'POST', { kind: 'R', studentId: outsider.id, enabled: true })).status, 200);
  assert.equal((await outsider.request(path(outsider, '/start'), 'POST', {})).status, 200);
  assert.equal((await outsider.request(path(outsider, '/answers'), 'PUT', { answers: keyAnswers(), revision: 0 })).status, 200);
  assert.equal((await outsider.request(path(outsider, '/submit'), 'POST', {})).data.record.score, 100);

  const url = '/api/teacher/exam-analysis?kind=R&classId=' + analysisClass;
  const result = await teacher.request(url); assert.equal(result.status, 200);
  const panel = result.data; assert.equal(panel.totalScore, 100); assert.equal(panel.totalStudents, 2); assert.equal(panel.submittedCount, 1); assert.equal(panel.pendingCount, 1);
  assert.equal(panel.students.find(s => s.id === submitted.id).scores.R, 5);
  const awaiting = panel.students.find(s => s.id === assigned.id); assert.equal(awaiting.scores.R, null); assert.equal(awaiting.status, 'assigned');
  assert.equal(panel.students.some(s => s.id === outsider.id), false);
  const group = panel.groups.find(g => g.version === 'r1'); assert.equal(group.submittedCount, 1);
  const partial = group.questions.find(q => q.number === 23), blank = group.questions.find(q => q.number === 24);
  assert.equal(partial.points, 10); assert.equal(partial.wrongCount, 1); assert.equal(partial.blankCount, 0); assert.deepEqual(partial.wrongStudents.map(s => [s.id, s.blank]), [[submitted.id, false]]);
  assert.equal(blank.wrongCount, 1); assert.equal(blank.blankCount, 1); assert.equal(blank.wrongStudents[0].answer, JSON.stringify(['', ''])); assert.equal(blank.wrongStudents[0].blank, true);
  assert.equal((await otherTeacher.request(url)).status, 404); assert.equal((await submitted.request(url)).status, 403);
  const owned = await teacher.request('/api/teacher/exam-analysis?kind=R'); assert.equal(owned.status, 200); assert.equal(owned.data.students.some(s => s.id === outsider.id), false);

  const teacherProfile = (await teacher.request('/api/students/' + submitted.id)).data;
  assert.equal(teacherProfile.reviewExam, undefined); assert.equal(teacherProfile.exams.R.score, 5); assert.ok(teacherProfile.exams.R.topics); assert.equal(teacherProfile.exams.R.itemScores[22], 5);
  const studentProfile = (await submitted.request('/api/students/' + submitted.id)).data;
  assert.equal(studentProfile.reviewExam, undefined); assert.equal(studentProfile.exams.R.score, 5); assert.equal(studentProfile.exams.R.correct, undefined); assert.equal(studentProfile.exams.R.itemScores, undefined); assert.equal(studentProfile.exams.R.topics, undefined);
});
