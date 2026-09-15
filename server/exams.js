const { randomUUID } = require('node:crypto');
const { transaction, fail } = require('./db');
const { ownedStudent, teacher } = require('./auth');
const { bank, grade, publicQuestion, currentExamVersions } = require('./content');
function kindOf(kind) { if (!['A','B'].includes(kind)) fail(400, '试卷不存在。'); return kind; }
async function finalize(db, row, timedOut = false) {
  if (row.submitted_at) return row;
  const g = grade(row.kind, row.version, row.answers);
  const { rows } = await db.query('UPDATE attempts SET submitted_at=now(),score=$2,correct=$3,timed_out=$4 WHERE id=$1 RETURNING *', [row.id, g.score, JSON.stringify(g.correct), timedOut]);
  return rows[0];
}
async function expireAttempts(pool) {
  await transaction(pool, async db => {
    const { rows } = await db.query('SELECT * FROM attempts WHERE submitted_at IS NULL AND deadline<=now() FOR UPDATE SKIP LOCKED');
    for (const row of rows) await finalize(db, row, true);
  });
  await pool.query('DELETE FROM sessions WHERE expires_at<=now()');
}
function pack(row, isTeacher) {
  if (!row) return null;
  const result = { id: row.id, kind: row.kind, version: row.version, answers: row.answers, revision: row.revision, deadline: new Date(row.deadline).getTime(), date: row.submitted_at, score: row.score, released: row.released, timedOut: row.timed_out };
  if (row.submitted_at && (isTeacher || row.released)) result.correct = row.correct;
  return result;
}
function setupExams(app, pool) {
  app.get('/api/students/:id/exams/:kind', async (req, res) => {
    const kind = kindOf(req.params.kind);
    await ownedStudent(pool, req.user, req.params.id);
    if (req.studentPreview) {
      // 预览读卷不启动计时，也不触发到期交卷；保留原卷版本和讲评开放规则。
      let row = (await pool.query('SELECT * FROM attempts WHERE student_id=$1 AND kind=$2', [req.params.id, kind])).rows[0];
      if (!row) {
        const assigned = (await pool.query('SELECT enabled FROM assignments WHERE student_id=$1 AND kind=$2', [req.params.id, kind])).rows[0];
        if (!assigned?.enabled || req.query.previewPaper !== '1') fail(404, '学生尚未开始这份测评。');
        row = { kind, version: currentExamVersions[kind], answers: Array(20).fill(''), revision: 0, deadline: new Date(Date.now()+45*60000), released: false };
      }
      return res.json({ record: pack(row, false), questions: bank.exams[row.version][kind].map(q => row.submitted_at && row.released ? q : publicQuestion(q)), serverTime: Date.now(), preview: true });
    }
    const row = await transaction(pool, async db => {
      const { rows } = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND kind=$2 FOR UPDATE', [req.params.id, kind]);
      return rows[0] && !rows[0].submitted_at && new Date(rows[0].deadline) <= new Date() ? finalize(db, rows[0], true) : rows[0];
    });
    if (!row) fail(404, '请先开始测评。');
    const canReview = row.submitted_at && (req.user.role === 'teacher' || row.released);
    res.json({ record: pack(row, req.user.role === 'teacher'), questions: bank.exams[row.version][kind].map(q => canReview ? q : publicQuestion(q)), serverTime: Date.now() });
  });
  app.post('/api/students/:id/exams/:kind/start', async (req, res) => {
    const kind = kindOf(req.params.kind);
    // 教师只负责布置，学生亲自开始以确定45分钟计时。
    if (req.user.role !== 'student' || req.params.id !== req.user.id) fail(403, '请由学生登录后开始测评。');
    const row = await transaction(pool, async db => {
      await ownedStudent(db, req.user, req.params.id, true);
      const assigned = await db.query('SELECT enabled FROM assignments WHERE student_id=$1 AND kind=$2', [req.params.id, kind]);
      if (!assigned.rows[0]?.enabled) fail(403, '老师尚未布置这份测评。');
      const old = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND kind=$2', [req.params.id, kind]);
      if (old.rows[0]) return old.rows[0];
      const running = await db.query('SELECT id FROM attempts WHERE student_id=$1 AND submitted_at IS NULL AND deadline>now()', [req.params.id]);
      if (running.rowCount) fail(409, '请先完成正在进行的测评。');
      const { rows } = await db.query("INSERT INTO attempts(id,student_id,kind,answers,deadline,version) VALUES($1,$2,$3,$4,now()+interval '45 minutes',$5) RETURNING *", [randomUUID(), req.params.id, kind, JSON.stringify(Array(20).fill('')), currentExamVersions[kind]]);
      return rows[0];
    });
    res.json({ record: pack(row, false), serverTime: Date.now() });
  });
  app.put('/api/students/:id/exams/:kind/answers', async (req, res) => {
    const kind = kindOf(req.params.kind);
    if (req.user.role !== 'student' || req.params.id !== req.user.id) fail(403, '只能保存自己的答案。');
    const { answers, revision } = req.body;
    if (!Array.isArray(answers) || answers.length !== 20 || answers.some(x => typeof x !== 'string' || x.length > 100) || !Number.isInteger(revision)) fail(400, '答案格式不正确。');
    const result = await transaction(pool, async db => {
      const { rows } = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND kind=$2 FOR UPDATE', [req.params.id, kind]);
      const row = rows[0]; if (!row) fail(404, '测评尚未开始。');
      if (row.submitted_at || new Date(row.deadline) <= new Date()) { return { expired: true, record: pack(await finalize(db, row, true), false) }; }
      if (row.revision !== revision) return { conflict: true, record: pack(row, false) };
      const updated = await db.query('UPDATE attempts SET answers=$2,revision=revision+1 WHERE id=$1 RETURNING *', [row.id, JSON.stringify(answers)]);
      return { record: pack(updated.rows[0], false) };
    });
    res.status(result.conflict || result.expired ? 409 : 200).json({ ...result, error: result.conflict ? '另一页面更新了答案，请载入最新记录后继续。' : result.expired ? '测评已结束，已按服务器保存的答案交卷。' : undefined });
  });
  app.post('/api/students/:id/exams/:kind/submit', async (req, res) => {
    const kind = kindOf(req.params.kind);
    if (req.user.role !== 'student' || req.params.id !== req.user.id) fail(403, '只能提交自己的试卷。');
    const row = await transaction(pool, async db => {
      const { rows } = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND kind=$2 FOR UPDATE', [req.params.id, kind]);
      if (!rows[0]) fail(404, '测评尚未开始。');
      return finalize(db, rows[0], new Date(rows[0].deadline) <= new Date());
    });
    res.json({ record: pack(row, false) });
  });
  app.post('/api/students/:id/exams/:kind/release', teacher, async (req, res) => {
    const kind = kindOf(req.params.kind); await ownedStudent(pool, req.user, req.params.id);
    if (typeof req.body.released !== 'boolean') fail(400, '请选择是否开放。');
    const result = await pool.query('UPDATE attempts SET released=$3 WHERE student_id=$1 AND kind=$2 AND submitted_at IS NOT NULL', [req.params.id, kind, req.body.released]);
    if (!result.rowCount) fail(400, '学生尚未交卷。'); res.json({ ok: true });
  });
  app.get('/api/teacher/keys/:kind', teacher, (req, res) => { const kind=kindOf(req.params.kind); res.json(bank.exams[currentExamVersions[kind]][kind]); });
}
module.exports = { setupExams, expireAttempts, pack };
