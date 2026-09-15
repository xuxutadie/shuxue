const crypto = require('node:crypto');
const argon2 = require('argon2');
const { transaction, fail, string } = require('./db');
const { teacher, ownedStudent, username, passwordValid } = require('./auth');
const { profile, teacherProfiles } = require('./learning');
const { bank, grade } = require('./content');
const blank = () => ({ completed: [], practice: {}, talk: {}, notes: {}, games: {}, history: [] });
async function ownClass(db, user, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) fail(404, '班级不存在。');
  const { rows } = await db.query('SELECT * FROM classes WHERE id=$1 AND teacher_id=$2', [id, user.id]);
  if (!rows[0]) fail(404, '班级不存在。'); return rows[0];
}
function legacyData(raw) {
  if (!raw || typeof raw.name !== 'string' || !raw.exams || !raw.practice || !Array.isArray(raw.completed)) fail(400, '请选择有效的旧版学生档案。');
  const data = blank();
  data.completed = [...new Set(raw.completed.filter(x => Number.isInteger(x) && x >= 0 && x < 12))];
  for (const [key, value] of Object.entries(raw.practice)) {
    if (!/^(?:[0-9]|1[01])-[0-2]$/.test(key) || !value || typeof value.answer !== 'string') fail(400, '旧练习记录不正确。');
    const [l, n] = key.split('-').map(Number);
    data.practice[key] = { answer: string(value.answer, 100, true), correct: value.correct === true, attempts: Math.max(1, Math.min(Number(value.attempts) || 1, 10000)), date: typeof value.date === 'string' ? value.date : '', imported: true };
  }
  for (let i = 0; i < 12; i++) {
    if (raw.notes?.[i] !== undefined) data.notes[i] = string(raw.notes[i], 5000, true);
    if (raw.talk?.[i]) data.talk[i] = { prep: string(raw.talk[i].prep || '', 5000, true), level: ['', '独立讲清', '追问后讲清', '需要重新学习'].includes(raw.talk[i].level) ? raw.talk[i].level : '' };
  }
  for (const t of ['shop','cycle','factor','area','chase','pasture','allocation']) if (raw.games?.[t]) data.games[t] = { date: String(raw.games[t].date || '').slice(0,100), imported: true };
  const all = [...Object.entries(raw.exams).map(([kind, record]) => ({ kind, record })), ...(Array.isArray(raw.history) ? raw.history : [])];
  if (all.length > 100) fail(400, '历史记录过多。');
  for (const h of all) {
    const r = h.record, version = r?.version || 'v1';
    if (!['A','B'].includes(h.kind) || !['v1','v2'].includes(version) || !Array.isArray(r?.answers) || r.answers.length !== 20 || r.answers.some(a => typeof a !== 'string' || a.length > 100)) fail(400, '旧试卷记录不正确。');
    data.history.push({ kind: h.kind, record: { answers: r.answers, version, date: String(r.date || '').slice(0,100), ...grade(h.kind, version, r.answers), imported: true } });
  }
  // 草稿不迁移为正式测评，避免把旧截止时间带入在线计时。
  return data;
}
function setupTeacher(app, pool) {
  app.use('/api/teacher', teacher);
  app.get('/api/teacher/exam-analysis', async(req,res)=>res.json(await require('./exam-analysis').examAnalysis(pool,req.user,req.query)));
  app.get('/api/teacher/overview', async (req, res) => {
    const [classes, students] = await Promise.all([
      pool.query('SELECT id,name,settings FROM classes WHERE teacher_id=$1 ORDER BY name', [req.user.id]),
      teacherProfiles(pool, req.user)
    ]);
    res.json({ classes: classes.rows, students });
  });
  app.post('/api/teacher/classes', async (req, res) => {
    const id = crypto.randomUUID(), name = string(req.body.name, 60);
    await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [id, req.user.id, name]); res.status(201).json({ id, name });
  });
  app.post('/api/teacher/students', async (req, res) => {
    const account = username(req.body.username), name = string(req.body.name, 40);
    if (!passwordValid(req.body.password, 'student')) fail(400, '初始密码需为6至128个字符。');
    const encoded = await argon2.hash(req.body.password, { type: argon2.argon2id });
    const id = crypto.randomUUID();
    await transaction(pool, async db => {
      await ownClass(db, req.user, req.body.classId);
      await db.query("INSERT INTO users(id,username,name,password_hash,role) VALUES($1,$2,$3,$4,'student')", [id, account, name, encoded]);
      await db.query('INSERT INTO students(user_id,class_id) VALUES($1,$2)', [id, req.body.classId]);
    }); res.status(201).json({ id, username: account });
  });
  app.patch('/api/teacher/students/:id', async (req, res) => {
    const allowed = ['name', 'username', 'classId', 'accountDisabled'];
    if (!Object.keys(req.body).length || Object.keys(req.body).some(k => !allowed.includes(k))) fail(400, '请选择要修改的学生资料。');
    const name = 'name' in req.body ? string(req.body.name, 40) : undefined;
    const account = 'username' in req.body ? username(req.body.username) : undefined;
    if ('accountDisabled' in req.body && typeof req.body.accountDisabled !== 'boolean') fail(400, '账号状态不正确。');
    await transaction(pool, async db => {
      const s = await ownedStudent(db, req.user, req.params.id, true);
      if ('classId' in req.body) await ownClass(db, req.user, req.body.classId);
      const classId = req.body.classId ?? s.class_id;
      const data = { ...s.data };
      if ('accountDisabled' in req.body) data.accountDisabled = req.body.accountDisabled;
      await db.query('UPDATE users SET name=$2,username=$3 WHERE id=$1', [s.user_id, name ?? s.name, account ?? s.username]);
      await db.query('UPDATE students SET class_id=$2,data=$3 WHERE user_id=$1', [s.user_id, classId, JSON.stringify(data)]);
      // 修改登录身份、转班或停用时撤销会话，重新登录后载入最新权限和资料。
      if (data.accountDisabled || (account !== undefined && account !== s.username) || classId !== s.class_id) {
        await db.query('DELETE FROM sessions WHERE user_id=$1', [s.user_id]);
      }
    });
    res.json({ ok: true });
  });
  app.delete('/api/teacher/students/:id', async (req, res) => {
    await transaction(pool, async db => {
      const s = await ownedStudent(db, req.user, req.params.id, true);
      if (req.body.confirmUsername !== s.username) fail(400, '请输入该学生的完整登录账号确认删除。');
      // 在同一事务中删除关联记录；任何一步失败都会回滚，不留下半份档案。
      await db.query('DELETE FROM sessions WHERE user_id=$1', [s.user_id]);
      await db.query('DELETE FROM attempts WHERE student_id=$1', [s.user_id]);
      await db.query('DELETE FROM assignments WHERE student_id=$1', [s.user_id]);
      await db.query('DELETE FROM students WHERE user_id=$1', [s.user_id]);
      // AI 题目、作答和用量已配置外键级联删除。
      await db.query("DELETE FROM users WHERE id=$1 AND role='student'", [s.user_id]);
    });
    res.json({ ok: true });
  });
  app.post('/api/teacher/students/:id/reset-password', async (req, res) => {
    await ownedStudent(pool, req.user, req.params.id);
    if (!passwordValid(req.body.password, 'student')) fail(400, '初始密码需为6至128个字符。');
    const encoded = await argon2.hash(req.body.password, { type: argon2.argon2id });
    await transaction(pool, async db => { await db.query('UPDATE users SET password_hash=$1,must_change=true WHERE id=$2', [encoded, req.params.id]); await db.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]); }); res.json({ ok: true });
  });
  app.post('/api/teacher/assign', async (req, res) => {
    const { kind, classId, studentId, enabled } = req.body;
    if (!['A','B'].includes(kind) || typeof enabled !== 'boolean' || (!classId && !studentId)) fail(400, '请选择学生或班级和试卷。');
    await transaction(pool, async db => {
      let ids;
      if (studentId) { await ownedStudent(db, req.user, studentId); ids = [studentId]; }
      else { await ownClass(db, req.user, classId); ids = (await db.query('SELECT user_id FROM students WHERE class_id=$1', [classId])).rows.map(s => s.user_id); }
      for (const id of ids) await db.query('INSERT INTO assignments(student_id,kind,enabled) VALUES($1,$2,$3) ON CONFLICT(student_id,kind) DO UPDATE SET enabled=$3', [id, kind, enabled]);
    }); res.json({ ok: true });
  });
  app.put('/api/teacher/classes/:id/settings', async (req, res) => {
    await ownClass(pool, req.user, req.params.id);
    const dates = {}, videos = {};
    for (let i = 0; i < 12; i++) {
      const d = req.body.dates?.[i] || bank.lessons[i].date, v = req.body.videos?.[i] || '';
      if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d))) fail(400, '课程日期不正确。');
      if (typeof v !== 'string' || v.length > 2000) fail(400, '视频地址不正确。');
      if (v) { let u; try { u = new URL(v); } catch { fail(400, '视频地址不正确。'); } if (!['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(u.protocol) || !/\.(mp4|webm)$/i.test(u.pathname) || u.username || u.password) fail(400, '请填写HTTPS的MP4或WebM直链。'); }
      dates[i] = d; videos[i] = v;
    }
    await pool.query('UPDATE classes SET settings=$2 WHERE id=$1', [req.params.id, JSON.stringify({ dates, videos })]); res.json({ ok: true });
  });
  app.post('/api/teacher/import/preview', (req, res) => {
    const data = legacyData(req.body.student);
    if (/验收|演示/.test(req.body.student.name)) fail(400, '这是演示档案，请选择真实学生。');
    res.json({ name: req.body.student.name, completed: data.completed.length, practice: Object.keys(data.practice).length, exams: data.history.map(h => ({ kind: h.kind, score: h.record.score, version: h.record.version })), fingerprint: crypto.createHash('sha256').update(JSON.stringify(req.body.student)).digest('hex') });
  });
  app.post('/api/teacher/students/:id/import', async (req, res) => {
    const raw = req.body.student, incoming = legacyData(raw);
    if (/验收|演示/.test(raw.name)) fail(400, '演示档案不进入正式统计。');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex');
    if (req.body.fingerprint !== fingerprint) fail(409, '导入内容已变化，请重新预览。');
    await transaction(pool, async db => {
      const target = await ownedStudent(db, req.user, req.params.id, true), data = target.data;
      if (data.imports?.includes(fingerprint)) fail(409, '这份档案已经导入过。');
      data.completed = [...new Set([...data.completed, ...incoming.completed])].sort((a,b) => a-b);
      for (const key of ['practice','talk','notes','games']) data[key] = { ...incoming[key], ...data[key] };
      data.history = [...(data.history || []), ...incoming.history]; data.imports = [...(data.imports || []), fingerprint];
      await db.query('UPDATE students SET data=$2 WHERE user_id=$1', [req.params.id, JSON.stringify(data)]);
    }); res.json({ ok: true });
  });
  app.get('/api/teacher/students/:id/history/:index', async (req, res) => {
    const s = await ownedStudent(pool, req.user, req.params.id), h = s.data.history[Number(req.params.index)];
    if (!h) fail(404, '记录不存在。'); res.json({ ...h, questions: bank.exams[h.record.version][h.kind] });
  });
  app.get('/api/teacher/export', async (req, res) => {
    const classes = (await pool.query('SELECT id,name,settings FROM classes WHERE teacher_id=$1', [req.user.id])).rows;
    const ids = (await pool.query('SELECT s.user_id FROM students s JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=$1', [req.user.id])).rows;
    const students = []; for (const s of ids) students.push(await profile(pool, req.user, s.user_id));
    res.json({ format: 'math-online-export-v1', date: new Date().toISOString(), classes, students });
  });
}
module.exports = { setupTeacher, legacyData };
