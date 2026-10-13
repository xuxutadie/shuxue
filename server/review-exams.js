const { randomUUID } = require('node:crypto');
const { transaction, fail } = require('./db');
const { ownedStudent } = require('./auth');
const { paper, gradeReview, publicQuestions } = require('./review-paper.cjs');

const KIND = 'R', VERSION = 'r1', QUESTION_COUNT = 25;
const blankAnswers = () => Array(QUESTION_COUNT).fill('');

function checkVersion(attempt) {
  if (attempt && (attempt.kind !== KIND || attempt.version !== VERSION)) fail(409, '这份回顾测评的版本不受支持，请联系老师。');
}
function checkRequest(req) {
  if (req.params.kind && req.params.kind !== KIND) fail(400, '试卷不存在。');
  if (req.body?.version !== undefined && req.body.version !== VERSION) fail(409, '试卷版本已变化，请刷新后继续。');
}
function studentOnly(req) {
  if (req.studentPreview || req.user.role !== 'student' || req.user.id !== req.params.id) fail(403, '请由学生本人登录后进行测评，预览不会保存记录。');
}
function teacherOnly(user) {
  if (user.role !== 'teacher') fail(403, '此功能仅教师可用。');
}
function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT || answers.some(a => typeof a !== 'string' || a.length > 500)) fail(400, '请检查25道题的答案格式及长度。');
}
function validateWorkings(workings) {
  if (workings !== undefined && (!Array.isArray(workings) || workings.length !== QUESTION_COUNT || workings.some(a => typeof a !== 'string' || a.length > 1000))) fail(400, '解题过程需为25项，每题最多1000字。');
}

// 学生只接收自己的作答；正确情况和分题得分在老师开放讲评后才显示。
function pack(attempt, isTeacher) {
  if (!attempt) return null;
  checkVersion(attempt);
  const record = {
    id: attempt.id || null, kind: KIND, version: VERSION,
    answers: [...attempt.answers], workings: [...(attempt.workings || blankAnswers())],
    revision: attempt.revision, startedAt: attempt.started_at || null,
    deadline: attempt.deadline ? new Date(attempt.deadline).getTime() : null,
    date: attempt.submitted_at || null, score: attempt.submitted_at ? attempt.score : null,
    released: attempt.released === true, timedOut: attempt.timed_out === true
  };
  if (attempt.submitted_at && (isTeacher || attempt.released)) {
    record.correct = [...attempt.correct];
    record.itemScores = [...attempt.itemScores];
  }
  return record;
}
function profile(data, isTeacher = false) {
  const review = data.reviewExam;
  return { enabled: review?.enabled === true, record: pack(review?.attempt, isTeacher) };
}
function hasActive(data) {
  const attempt = data?.reviewExam?.attempt;
  return !!attempt && !attempt.submitted_at && Number.isFinite(Date.parse(attempt.deadline)) && Date.parse(attempt.deadline) > Date.now();
}
async function activeForStudent(db, id) {
  const row = (await db.query('SELECT data FROM students WHERE user_id=$1', [id])).rows[0];
  return hasActive(row?.data);
}
function finalize(attempt, timedOut = false) {
  if (attempt.submitted_at) return false;
  checkVersion(attempt);
  const result = gradeReview(attempt.answers);
  Object.assign(attempt, result, { submitted_at: new Date().toISOString(), timed_out: timedOut });
  return true;
}
async function store(db, student) {
  await db.query('UPDATE students SET data=$2 WHERE user_id=$1', [student.user_id, JSON.stringify(student.data)]);
}
function response(attempt, req, extra = {}) {
  return { record: pack(attempt, req.user.role === 'teacher' && !req.studentPreview), serverTime: Date.now(), ...extra };
}

async function handle(pool, req, action) {
  checkRequest(req);
  if (!['read', 'start', 'save', 'submit', 'release'].includes(action)) fail(400, '测评操作不存在。');
  if (req.studentPreview && action !== 'read') fail(403, '当前为学生预览，不会开始计时或保存测评。');
  if (['start', 'save', 'submit'].includes(action)) studentOnly(req);
  if (action === 'release') {
    teacherOnly(req.user);
    if (typeof req.body?.released !== 'boolean') fail(400, '请选择是否开放讲评。');
  }
  if (action === 'save') {
    validateAnswers(req.body?.answers); validateWorkings(req.body?.workings);
    if (!Number.isInteger(req.body?.revision) || req.body.revision < 0) fail(400, '答案版本不正确。');
  }
  return transaction(pool, async db => {
    // 与A/B卷开考、账号管理和其他学习记录共用学生行锁，保护整份JSON档案。
    const student = await ownedStudent(db, req.user, req.params.id, action !== 'read' || !req.studentPreview);
    const review = student.data.reviewExam;
    let attempt = review?.attempt;
    checkVersion(attempt);
    if (action === 'read') {
      if (!attempt) {
        if (!req.studentPreview || req.query?.previewPaper !== '1' || !review?.enabled) fail(404, '请先开始这份回顾测评。');
        attempt = { kind: KIND, version: VERSION, answers: blankAnswers(), workings: blankAnswers(), revision: 0, released: false };
      } else if (!req.studentPreview && !attempt.submitted_at && Date.parse(attempt.deadline) <= Date.now()) {
        finalize(attempt, true); await store(db, student);
      }
      const canReview = attempt.submitted_at && ((req.user.role === 'teacher' && !req.studentPreview) || attempt.released);
      return response(attempt, req, { questions: canReview ? structuredClone(paper.questions) : publicQuestions(), ...(req.studentPreview ? { preview: true } : {}) });
    }
    if (action === 'start') {
      if (!review?.enabled) fail(403, '老师尚未布置这份回顾测评。');
      if (attempt) {
        if (!attempt.submitted_at && Date.parse(attempt.deadline) <= Date.now()) { finalize(attempt, true); await store(db, student); }
        return response(attempt, req);
      }
      const running = await db.query('SELECT 1 FROM attempts WHERE student_id=$1 AND submitted_at IS NULL AND deadline>now()', [req.params.id]);
      if (running.rowCount) fail(409, '请先完成正在进行的测评。');
      const now = Date.now();
      attempt = {
        id: randomUUID(), kind: KIND, version: VERSION, answers: blankAnswers(), workings: blankAnswers(), revision: 0,
        started_at: new Date(now).toISOString(), deadline: new Date(now + paper.durationMinutes * 60000).toISOString(),
        submitted_at: null, score: null, correct: null, itemScores: null, released: false, timed_out: false
      };
      review.attempt = attempt; await store(db, student);
      return response(attempt, req);
    }
    if (!attempt) fail(404, '回顾测评尚未开始。');
    if (action === 'release') {
      if (!attempt.submitted_at) fail(400, '学生尚未交卷。');
      attempt.released = req.body.released; await store(db, student);
      return response(attempt, req, { ok: true });
    }
    if (action === 'save') {
      if (attempt.submitted_at || Date.parse(attempt.deadline) <= Date.now()) {
        if (finalize(attempt, true)) await store(db, student);
        return response(attempt, req, { status: 409, expired: true, error: '测评已结束，已按服务器保存的答案交卷。' });
      }
      if (attempt.revision !== req.body.revision) return response(attempt, req, { status: 409, conflict: true, error: '另一页面更新了答案，请载入最新记录后继续。' });
      attempt.answers = [...req.body.answers];
      if (req.body.workings !== undefined) attempt.workings = [...req.body.workings];
      attempt.revision++; await store(db, student);
      return response(attempt, req);
    }
    if (finalize(attempt, Date.parse(attempt.deadline) <= Date.now())) await store(db, student);
    return response(attempt, req);
  });
}

async function assign(pool, user, body) {
  teacherOnly(user);
  const { kind, classId, studentId, enabled } = body;
  if (kind !== KIND || typeof enabled !== 'boolean' || (!classId && !studentId) || (classId && studentId)) fail(400, '请选择一个学生或班级，以及回顾测评的布置状态。');
  return transaction(pool, async db => {
    let ids;
    if (studentId) { await ownedStudent(db, user, studentId); ids = [studentId]; }
    else {
      if (!/^[0-9a-f-]{36}$/i.test(classId)) fail(404, '班级不存在。');
      if (!(await db.query('SELECT id FROM classes WHERE id=$1 AND teacher_id=$2', [classId, user.id])).rowCount) fail(404, '班级不存在。');
      ids = (await db.query('SELECT user_id FROM students WHERE class_id=$1 ORDER BY user_id', [classId])).rows.map(s => s.user_id);
    }
    for (const id of ids) {
      const student = await ownedStudent(db, user, id, true);
      // 已经开始的卷不能通过撤回来清空、换卷或绕过截止时间。
      if (!enabled && student.data.reviewExam?.attempt) fail(409, '已有学生开始这份测评，不能撤回。');
      student.data.reviewExam ||= {};
      student.data.reviewExam.enabled = enabled;
      await store(db, student);
    }
    return { ok: true };
  });
}

async function expireReviewAttempts(pool) {
  const candidates = await pool.query("SELECT user_id FROM students WHERE data->'reviewExam'->'attempt' IS NOT NULL AND data->'reviewExam'->'attempt'->>'submitted_at' IS NULL");
  for (const candidate of candidates.rows) await transaction(pool, async db => {
    const student = (await db.query('SELECT user_id,data FROM students WHERE user_id=$1 FOR UPDATE SKIP LOCKED', [candidate.user_id])).rows[0];
    const attempt = student?.data.reviewExam?.attempt;
    if (!attempt || attempt.submitted_at || !Number.isFinite(Date.parse(attempt.deadline)) || Date.parse(attempt.deadline) > Date.now()) return;
    if (finalize(attempt, true)) await store(db, student);
  });
}

module.exports = { handle, assign, profile, hasActive, activeForStudent, expireReviewAttempts };
