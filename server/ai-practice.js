const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { transaction, fail, string } = require('./db');
const { teacher, ownedStudent } = require('./auth');
const provider = require('./ai-provider');
const { buildProblem, matchesAnswer } = require('./ai-templates');
const today = "(now() AT TIME ZONE 'Asia/Shanghai')::date";
const validId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

async function teacherId(db, user) {
 return user.role === 'teacher' ? user.id : (await ownedStudent(db, user, user.id)).teacher_id;
}
async function activeExam(db, user) {
 if (user.role !== 'student') return false;
 const r = await db.query('SELECT 1 FROM attempts WHERE student_id=$1 AND submitted_at IS NULL AND deadline>now() LIMIT 1', [user.id]);
 return r.rowCount > 0;
}
async function examGuard(db, user) {
 if (await activeExam(db, user)) fail(403, '正在进行正式测评，请交卷后再使用 AI 引导练习。');
}
async function settings(db, id) {
 return (await db.query('SELECT * FROM ai_settings WHERE teacher_id=$1', [id])).rows[0];
}
function safeSettings(config) {
 return { endpoint: config?.endpoint || 'https://api.openai.com/v1', model: config?.model || '',
  enabled: !!config?.enabled, dailyLimit: config?.daily_limit || 20,
  configured: !!config?.key_cipher, encryptionReady: provider.encryptionReady() };
}
async function allowed(db, user) {
 await examGuard(db, user);
 const owner = await teacherId(db, user), config = await settings(db, owner);
 if (!config?.enabled || !config.key_cipher) fail(403, '老师尚未开启 AI 引导练习。');
 if (!provider.encryptionReady()) fail(503, 'AI 配置暂时不可用，请联系老师。');
 return { owner, config };
}
// 逐项挑选公开字段，绝不把内部答案、完整提示或模型原文直接发送到浏览器。
function publicQuestion(row, submissions = []) {
 const p = row.problem;
 return { id: row.id, lesson: row.lesson, difficulty: row.difficulty, text: p.text, unit: p.unit,
  topic: p.topic, createdAt: row.created_at, hints: p.hints.slice(0, row.hint_count),
  hintCount: row.hint_count, totalHints: p.hints.length,
  submissions: submissions.map(s => ({ answer: s.answer, correct: s.correct, date: s.created_at })) };
}
async function history(db, id, owner) {
 const rows = (await db.query('SELECT * FROM ai_questions WHERE user_id=$1 AND teacher_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100', [id, owner])).rows;
 if (!rows.length) return [];
 const submissions = (await db.query('SELECT question_id,answer,correct,created_at FROM ai_submissions WHERE question_id=ANY($1::uuid[]) ORDER BY created_at,id', [rows.map(r => r.id)])).rows;
 return rows.map(row => publicQuestion(row, submissions.filter(s => s.question_id === row.id)));
}
async function question(db, user, id, owner) {
 if (!validId(id)) fail(404, '未找到这道练习题。');
 const row = (await db.query('SELECT * FROM ai_questions WHERE id=$1 AND user_id=$2 AND teacher_id=$3 FOR UPDATE', [id, user.id, owner])).rows[0];
 if (!row) fail(404, '未找到这道练习题。');
 return row;
}
async function reserve(pool, user, count, limit) {
 return transaction(pool, async db => {
  // 同一学生与测评开考共用学生行锁，避免已经开考后仍开始生成。
  if (user.role === 'student') await ownedStudent(db, user, user.id, true);
  await examGuard(db, user);
  await db.query(`INSERT INTO ai_usage(user_id,day) VALUES($1,${today}) ON CONFLICT DO NOTHING`, [user.id]);
  let row = (await db.query(`SELECT *,day::text AS day_key,pending_until>now() AS live FROM ai_usage WHERE user_id=$1 AND day=${today} FOR UPDATE`, [user.id])).rows[0];
  if (row.pending && row.live) fail(409, '上一组题目正在生成，请稍候。');
  // 进程中断遗留的预留额度，在下一次请求时自动归还。
  const used = Math.max(0, row.used - row.reserved);
  if (used + count > limit) fail(429, '今天的出题额度不足，请减少题数或明天再来。');
  const token = crypto.randomUUID();
  await db.query("UPDATE ai_usage SET used=$3,pending=$4,reserved=$5,pending_until=now()+interval '60 seconds' WHERE user_id=$1 AND day=$2", [user.id, row.day_key, used + count, token, count]);
  return { token, day: row.day_key };
 });
}
async function refund(pool, userId, reservation) {
 await pool.query('UPDATE ai_usage SET used=GREATEST(0,used-reserved),reserved=0,pending=NULL,pending_until=NULL WHERE user_id=$1 AND day=$2 AND pending=$3', [userId, reservation.day, reservation.token]);
}
function limiter(limit) {
 return rateLimit({ windowMs: 60000, limit, keyGenerator: req => req.user.id,
  standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '操作有些频繁，请稍等一分钟再试。' } });
}
function setupAiPractice(app, pool, options = {}) {
 const plan = (config, lesson, difficulty, count) => provider.requestPlan(config, lesson, difficulty, count, options.aiRequest);
 app.get('/api/ai/status', async (req, res) => {
  const owner = await teacherId(pool, req.user), config = await settings(pool, owner);
  const usage = (await pool.query(`SELECT used,reserved,pending_until>now() AS live FROM ai_usage WHERE user_id=$1 AND day=${today}`, [req.user.id])).rows[0];
  const used = usage ? Math.max(0, usage.used - (usage.live ? 0 : usage.reserved)) : 0;
  const dailyLimit = config?.daily_limit || 20;
  res.json({ enabled: !!config?.enabled, configured: !!config?.key_cipher, encryptionReady: provider.encryptionReady(),
   blocked: await activeExam(pool, req.user), dailyLimit, used, remaining: Math.max(0, dailyLimit - used), teacher: req.user.role === 'teacher' });
 });
 app.get('/api/ai/questions', async (req, res) => {
  const { owner } = await allowed(pool, req.user);
  res.json({ questions: await history(pool, req.user.id, owner) });
 });
 app.post('/api/ai/generate', limiter(8), async (req, res) => {
  const { lesson, difficulty, count } = req.body;
  if (!Number.isInteger(lesson) || lesson < 0 || lesson > 11 || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3 || !Number.isInteger(count) || count < 1 || count > 3) fail(400, '请选择有效课程、难度和题数（1～3题）。');
  const { owner, config } = await allowed(pool, req.user);
  const reservation = await reserve(pool, req.user, count, config.daily_limit);
  try {
   const seeds = await plan(config, lesson, difficulty, count), problems = [], seen = new Set();
   for (let seed of seeds) {
    let problem;
    for (let attempt = 0; attempt < 100; attempt++) {
     problem = buildProblem(lesson, difficulty, seed);
     if (!seen.has(problem.text)) break;
     seed = seed % 1000000000 + 1;
    }
    if (seen.has(problem.text)) fail(502, '本组题目重复，请重新生成。');
    seen.add(problem.text); problems.push(problem);
   }
   const questions = await transaction(pool, async db => {
    if (req.user.role === 'student') await ownedStudent(db, req.user, req.user.id, true);
    const current = await allowed(db, req.user);
    if (current.owner !== owner) fail(409, '班级已变更，请刷新后重试。');
    const usage = await db.query('SELECT 1 FROM ai_usage WHERE user_id=$1 AND day=$2 AND pending=$3 AND pending_until>now() FOR UPDATE', [req.user.id, reservation.day, reservation.token]);
    if (!usage.rowCount) fail(409, '本次出题已超时，请重新生成。');
    const result = [];
    for (const p of problems) {
     const row = (await db.query('INSERT INTO ai_questions(id,user_id,teacher_id,lesson,difficulty,problem) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [crypto.randomUUID(), req.user.id, owner, lesson, difficulty, JSON.stringify(p)])).rows[0];
     result.push(publicQuestion(row));
    }
    await db.query('UPDATE ai_usage SET reserved=0,pending=NULL,pending_until=NULL WHERE user_id=$1 AND day=$2 AND pending=$3', [req.user.id, reservation.day, reservation.token]);
    return result;
   });
   res.json({ questions });
  } catch (error) { await refund(pool, req.user.id, reservation); throw error; }
 });
 app.post('/api/ai/questions/:id/hint', limiter(30), async (req, res) => {
  const result = await transaction(pool, async db => {
   if (req.user.role === 'student') await ownedStudent(db, req.user, req.user.id, true);
   const { owner } = await allowed(db, req.user), row = await question(db, req.user, req.params.id, owner);
   const hintCount = Math.min(row.problem.hints.length, row.hint_count + 1);
   await db.query('UPDATE ai_questions SET hint_count=$2 WHERE id=$1', [row.id, hintCount]);
   return { hint: row.problem.hints[hintCount - 1], hintCount, totalHints: row.problem.hints.length };
  });
  res.json(result);
 });
 app.post('/api/ai/questions/:id/answer', limiter(30), async (req, res) => {
  const answer = string(req.body.answer, 120);
  const result = await transaction(pool, async db => {
   if (req.user.role === 'student') await ownedStudent(db, req.user, req.user.id, true);
   const { owner } = await allowed(db, req.user), row = await question(db, req.user, req.params.id, owner);
   const attempts = Number((await db.query('SELECT count(*) AS n FROM ai_submissions WHERE question_id=$1', [row.id])).rows[0].n);
   if (attempts >= 20) fail(429, '这道题已经尝试20次，请先与老师讨论思路。');
   const correct = matchesAnswer(answer, row.problem);
   const saved = (await db.query('INSERT INTO ai_submissions(id,question_id,answer,correct) VALUES($1,$2,$3,$4) RETURNING created_at', [crypto.randomUUID(), row.id, answer, correct])).rows[0];
   return { correct, date: saved.created_at };
  });
  res.json(result);
 });
 app.get('/api/teacher/ai-settings', teacher, async (req, res) => res.json(safeSettings(await settings(pool, req.user.id))));
 app.put('/api/teacher/ai-settings', teacher, async (req, res) => {
  const endpoint = provider.endpointUrl(string(req.body.endpoint, 500)).href;
  const model = string(req.body.model, 120);
  if (!/^[\w./:-]+$/.test(model) || typeof req.body.enabled !== 'boolean' || !Number.isInteger(req.body.dailyLimit) || req.body.dailyLimit < 1 || req.body.dailyLimit > 100) fail(400, '请检查模型名称、开关及每日题数（1～100）。');
  const apiKey = req.body.apiKey === undefined ? '' : string(req.body.apiKey, 500, true);
  if (apiKey && !/^[\x21-\x7e]{10,500}$/.test(apiKey)) fail(400, '请检查 API Key 的格式。');
  const config = await transaction(pool, async db => {
   await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
   const old = await settings(db, req.user.id);
   if (old?.key_cipher && !apiKey && new URL(old.endpoint).origin !== new URL(endpoint).origin) fail(400, '更换接口域名时，请同时填写对应服务商的 API Key。');
   const cipher = apiKey ? provider.encrypt(apiKey) : old?.key_cipher || null;
   if (req.body.enabled && !cipher) fail(400, '请先填写 API Key，再开启学生使用。');
   return (await db.query('INSERT INTO ai_settings(teacher_id,endpoint,model,key_cipher,enabled,daily_limit) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(teacher_id) DO UPDATE SET endpoint=EXCLUDED.endpoint,model=EXCLUDED.model,key_cipher=EXCLUDED.key_cipher,enabled=EXCLUDED.enabled,daily_limit=EXCLUDED.daily_limit,updated_at=now() RETURNING *', [req.user.id, endpoint, model, cipher, req.body.enabled, req.body.dailyLimit])).rows[0];
  });
  res.json(safeSettings(config));
 });
 app.post('/api/teacher/ai-settings/test', teacher, limiter(5), async (req, res) => {
  const config = await settings(pool, req.user.id);
  if (!config?.key_cipher) fail(400, '请先保存 AI 接口配置。');
  await plan(config, 0, 1, 1); res.json({ ok: true });
 });
 app.get('/api/teacher/students/:id/ai-questions', teacher, async (req, res) => {
  await ownedStudent(pool, req.user, req.params.id);
  res.json({ questions: await history(pool, req.params.id, req.user.id) });
 });
}
module.exports = { setupAiPractice, publicQuestion };
