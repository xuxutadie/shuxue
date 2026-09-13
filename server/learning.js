const { transaction, fail, string } = require('./db');
const { ownedStudent, teacher } = require('./auth');
const { bank, lessons, correct } = require('./content');
const { pack } = require('./exams');
const { separatePracticeVersions } = require('./practice-history');
function lessonOf(v) { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n >= 12) fail(400, '课程不存在。'); return n; }
async function profile(pool, user, id) {
  const s = await ownedStudent(pool, user, id);
  const { rows } = await pool.query('SELECT * FROM attempts WHERE student_id=$1 ORDER BY kind', [id]);
  const a = await pool.query('SELECT kind,enabled FROM assignments WHERE student_id=$1', [id]);
  const p = { ...s.data, id, name: s.name, username: s.username, classId: s.class_id, className: s.class_name, settings: s.settings, exams: {}, drafts: {}, assignments: Object.fromEntries(a.rows.map(r => [r.kind, r.enabled])) };
  Object.assign(p, separatePracticeVersions(s.data));
  for (const row of rows) {
    const packed = pack(row, user.role === 'teacher');
    if (row.submitted_at && (user.role === 'teacher' || row.released)) {
      packed.topics = {};
      bank.exams[row.version][row.kind].forEach((q,i) => { packed.topics[q.topic] ||= { total: 0, correct: 0 }; packed.topics[q.topic].total++; if(row.correct[i]) packed.topics[q.topic].correct++; });
    }
    p[row.submitted_at ? 'exams' : 'drafts'][row.kind] = packed;
  }
  if (user.role !== 'teacher') { delete p.notes; p.notes = {}; p.history = []; p.practiceHistory = []; }
  return p;
}
async function editProfile(pool, req, action) {
  return transaction(pool, async db => {
    const s = await ownedStudent(db, req.user, req.params.id, true);
    const result = await action(s.data);
    await db.query('UPDATE students SET data=$2 WHERE user_id=$1', [req.params.id, JSON.stringify(s.data)]);
    return result || { ok: true };
  });
}
function setupLearning(app, pool) {
  app.get('/api/content', (req, res) => res.json({ lessons: lessons(req.user.role === 'teacher'), flow: bank.flow, testFlow: bank.testFlow }));
  app.get('/api/students/:id', async (req, res) => res.json(await profile(pool, req.user, req.params.id)));
  app.post('/api/students/:id/practice/:lesson/:question', async (req, res) => {
    if (req.user.role !== 'student') fail(403, '教师请在教案中查看答案，练习记录由学生提交。');
    const l = lessonOf(req.params.lesson), n = Number(req.params.question), q = bank.lessons[l].practice[n];
    if (!Number.isInteger(n) || !q) fail(400, '题目不存在。'); const answer = string(req.body.answer, 100);
    // 旧标签页不得把旧题答案提交给新版题目。
    if ((req.body.version || 'v1') !== (q.version || 'v1')) fail(409, '本课练习已更新，请刷新页面后按新题作答；原有作答记录会保留。');
    res.json(await editProfile(pool, req, data => {
      Object.assign(data, separatePracticeVersions(data));
      const key = `${l}-${n}`, previous = data.practice[key], result = { answer, correct: correct(answer, q.answer), date: new Date().toISOString() };
      data.practice[key] = { ...result, version: q.version || 'v1', question: { text: q.text, topic: q.topic, svg: q.svg || '' }, firstCorrect: previous ? (previous.firstCorrect ?? previous.correct) : result.correct, attempts: (previous?.attempts || 0) + 1, submissions: [...(previous?.submissions || []), result].slice(-100) };
      return { ...data.practice[key], explain: result.correct ? q.explain : '' };
    }));
  });
  app.put('/api/students/:id/lessons/:lesson', async (req, res) => {
    const l = lessonOf(req.params.lesson);
    const allowed = req.user.role === 'teacher' ? ['level', 'note', 'completed'] : ['prep'];
    if (Object.keys(req.body).some(k => !allowed.includes(k))) fail(403, '没有修改此记录的权限。');
    res.json(await editProfile(pool, req, data => {
      data.talk[l] ||= { prep: '', level: '' };
      if ('prep' in req.body) data.talk[l].prep = string(req.body.prep, 5000, true);
      if ('level' in req.body) { if (!['','独立讲清','追问后讲清','需要重新学习'].includes(req.body.level)) fail(400, '评价不正确。'); data.talk[l].level = req.body.level; }
      if ('note' in req.body) data.notes[l] = string(req.body.note, 5000, true);
      if ('completed' in req.body) { if (typeof req.body.completed !== 'boolean') fail(400, '状态不正确。'); data.completed = data.completed.filter(x => x !== l); if (req.body.completed) data.completed.push(l); data.completed.sort((a,b) => a-b); }
    }));
  });
  app.post('/api/students/:id/games/:type', async (req, res) => {
    if (req.user.role !== 'student') fail(403, '教师体验不会写入学生记录。');
    if (!['shop','cycle','factor','area','chase','pasture','allocation'].includes(req.params.type)) fail(400, '游戏不存在。');
    res.json(await editProfile(pool, req, data => { data.games[req.params.type] = { date: new Date().toISOString() }; }));
  });
}
module.exports = { setupLearning, profile, lessonOf };
