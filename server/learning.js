const { transaction, fail, string } = require('./db');
const { ownedStudent, teacher } = require('./auth');
const { bank, lessons, correct } = require('./content');
const { pack } = require('./exams');
const { separatePracticeVersions } = require('./practice-history');
const { gzipSync } = require('node:zlib');
// 课程只在部署更新时变化，按权限分别准备响应，避免重复序列化和传输。
const contentResponses = new Map();
function lessonOf(v) { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n >= 12) fail(400, '课程不存在。'); return n; }
async function profile(pool, user, id) {
  const s = await ownedStudent(pool, user, id);
  const { rows } = await pool.query('SELECT * FROM attempts WHERE student_id=$1 ORDER BY kind', [id]);
  const a = await pool.query('SELECT kind,enabled FROM assignments WHERE student_id=$1', [id]);
  return packProfile(s, rows, a.rows, user);
}
function packProfile(s, rows, assignments, user) {
  const p = { ...s.data, id: s.user_id, name: s.name, username: s.username, classId: s.class_id, className: s.class_name, settings: s.settings, exams: {}, drafts: {}, assignments: Object.fromEntries(assignments.map(r => [r.kind, r.enabled])) };
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
async function teacherProfiles(pool, user) {
  // 每批查询都在数据库内限定教师，返回的数据不能跨班级所有者。
  const students = (await pool.query('SELECT s.*,u.name,u.username,c.teacher_id,c.settings,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=$1 ORDER BY s.user_id', [user.id])).rows;
  if (!students.length) return [];
  const [attempts, assignments] = await Promise.all([
    pool.query('SELECT a.* FROM attempts a JOIN students s ON s.user_id=a.student_id JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=$1 ORDER BY a.kind', [user.id]),
    pool.query('SELECT a.student_id,a.kind,a.enabled FROM assignments a JOIN students s ON s.user_id=a.student_id JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=$1', [user.id])
  ]);
  const group = rows => {
    const result = new Map();
    for (const row of rows) {
      if (!result.has(row.student_id)) result.set(row.student_id, []);
      result.get(row.student_id).push(row);
    }
    return result;
  };
  const examsByStudent = group(attempts.rows), assignmentsByStudent = group(assignments.rows);
  return students.map(s => packProfile(s, examsByStudent.get(s.user_id) || [], assignmentsByStudent.get(s.user_id) || [], user));
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
  app.get('/api/content', (req, res) => {
    const teacherContent = req.user.role === 'teacher';
    if (!contentResponses.has(teacherContent)) {
      const json = JSON.stringify({ lessons: lessons(teacherContent), flow: bank.flow, testFlow: bank.testFlow });
      contentResponses.set(teacherContent, { json, gzip: gzipSync(json) });
    }
    const content = contentResponses.get(teacherContent);
    res.type('application/json').vary('Accept-Encoding');
    if (req.acceptsEncodings('gzip', 'identity') === 'gzip') res.set('Content-Encoding', 'gzip').send(content.gzip);
    else res.send(content.json);
  });
  app.get('/api/students/:id', async (req, res) => res.json(await profile(pool, req.user, req.params.id)));
  app.post('/api/students/:id/variants/:lesson/:question',async(req,res)=>{
    if(req.user.role!=='student')fail(403,'请使用学生账号作答，教师可在学生预览中试做。');
    const l=lessonOf(req.params.lesson),n=Number(req.params.question);
    const {variants,matches}=require('./variant-practice');
    const q=variants(bank.lessons[l],l,true)[n];
    if(!Number.isInteger(n)||!q)fail(400,'题目不存在。');
    if(req.body.version!==q.version)fail(409,'变式题已更新，请刷新后再作答。');
    const answers=req.body.answers;
    if(!Array.isArray(answers)||answers.length!==q.inputs.length||answers.some(a=>typeof a!=='string'||!a.trim()||a.length>200))fail(400,'请填写每个问题的答案。');
    const result={answers,correct:answers.every((a,i)=>matches(a,q.inputs[i])),date:new Date().toISOString()};
    const feedback={explain:result.correct?q.explain:'',answer:result.correct?q.answer:''};
    if(req.studentPreview){await ownedStudent(pool,req.user,req.params.id);return res.json({...result,...feedback,preview:true});}
    res.json(await editProfile(pool,req,data=>{
      data.variantPractice||={};const key=l+'-'+n,previous=data.variantPractice[key];
      const same=previous?.version===q.version;
      if(previous&&!same){data.variantHistory||=[];data.variantHistory.push({key,...previous});}
      data.variantPractice[key]={...result,version:q.version,question:{text:q.text,title:q.title},
        firstCorrect:same?previous.firstCorrect:result.correct,attempts:same?previous.attempts+1:1,
        submissions:[...(same?previous.submissions||[]:[]),result].slice(-100)};
      return {...data.variantPractice[key],...feedback};
    }));
  });
  app.post('/api/students/:id/practice/:lesson/:question', async (req, res) => {
    if (req.user.role !== 'student') fail(403, '教师请在教案中查看答案，练习记录由学生提交。');
    const l = lessonOf(req.params.lesson), n = Number(req.params.question), q = bank.lessons[l].practice[n];
    if (!Number.isInteger(n) || !q) fail(400, '题目不存在。'); const answer = string(req.body.answer, 100);
    // 旧标签页不得把旧题答案提交给新版题目。
    if ((req.body.version || 'v1') !== (q.version || 'v1')) fail(409, '本课练习已更新，请刷新页面后按新题作答；原有作答记录会保留。');
    if (req.studentPreview) {
      await ownedStudent(pool, req.user, req.params.id);
      const matched = correct(answer, q.answer);
      return res.json({ answer, correct: matched, explain: matched ? q.explain : '', preview: true });
    }
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
module.exports = { setupLearning, profile, teacherProfiles, lessonOf };
