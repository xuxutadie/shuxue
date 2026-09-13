const crypto = require('node:crypto');
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const { fail, string, transaction } = require('./db');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const random = () => crypto.randomBytes(32).toString('base64url');
// 学生至少6位；教师沿用原要求。登录时仍校验已有密码，不强制重设。
const passwordValid = (p, role = 'teacher') => typeof p === 'string' && p.length >= (role === 'student' ? 6 : 10) && p.length <= 128;
function username(value) { const v = string(value, 40).toLowerCase(); if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(v)) fail(400, '账号需为3至40位字母、数字、下划线或短横线。'); return v; }
const safeUser = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, mustChange: u.must_change });
function setupAuth(app, pool, production) {
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 8 * 3600000 };
  app.use('/api', async (req, res, next) => {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('math_session='))?.slice(13);
    if (token) {
      const found = await pool.query('SELECT u.*,s.csrf,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [hash(token)]);
      req.user = found.rows[0];
    }
    next();
  });
  // 修改请求只接受同源JSON；登录后的请求另外检查会话内的CSRF令牌。
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== expected) return next(Object.assign(new Error('请求来源不匹配。'), { status: 403 }));
    if (!req.is('application/json')) return next(Object.assign(new Error('请求格式不正确。'), { status: 415 }));
    if (req.user && req.headers['x-csrf-token'] !== req.user.csrf) return next(Object.assign(new Error('登录状态已更新，请刷新。'), { status: 403 }));
    next();
  });
  const limiter = rateLimit({ windowMs: 15 * 60000, limit: 20, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '尝试次数较多，请15分钟后再试。' } });
  app.post('/api/login', limiter, async (req, res) => {
    const account = username(req.body.username);
    // 登录验证已有密码摘要，不套用新密码设置规则，兼容经授权设置的既有密码。
    if (typeof req.body.password !== 'string' || !req.body.password.length || req.body.password.length > 128) fail(401, '账号或密码不正确。');
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [account]);
    const u = rows[0];
    if (!u || !await argon2.verify(u.password_hash, req.body.password)) fail(401, '账号或密码不正确。');
    const token = random(), csrf = random();
    await pool.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')", [hash(token), u.id, csrf]);
    res.cookie('math_session', token, cookieOptions).json({ user: safeUser(u), csrf });
  });
  app.post('/api/logout', async (req, res) => { if (req.user) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [req.user.token_hash]); res.clearCookie('math_session', cookieOptions).json({ ok: true }); });
  app.get('/api/me', (req, res) => { if (!req.user) fail(401, '请先登录。'); res.json({ user: safeUser(req.user), csrf: req.user.csrf }); });
  app.post('/api/password', limiter, async (req, res) => {
    if (!req.user) fail(401, '请先登录。');
    if (!passwordValid(req.body.password, req.user.role)) fail(400, `新密码需为${req.user.role === 'student' ? 6 : 10}至128个字符。`);
    if (typeof req.body.current !== 'string' || req.body.current.length > 128 || !await argon2.verify(req.user.password_hash, req.body.current)) fail(400, '原密码不正确。');
    if (req.body.password === req.body.current) fail(400, '请设置与初始密码不同的新密码。');
    const encoded = await argon2.hash(req.body.password, { type: argon2.argon2id });
    await transaction(pool, async db => { await db.query('UPDATE users SET password_hash=$1,must_change=false WHERE id=$2', [encoded, req.user.id]); await db.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [req.user.id, req.user.token_hash]); });
    res.json({ ok: true });
  });
  app.use('/api', (req, res, next) => { if (!req.user) return next(Object.assign(new Error('请先登录。'), { status: 401 })); if (req.user.must_change) return next(Object.assign(new Error('请先修改初始密码。'), { status: 403 })); next(); });
}
function teacher(req, res, next) { if (req.user.role !== 'teacher') return next(Object.assign(new Error('此功能仅教师可用。'), { status: 403 })); next(); }
async function ownedStudent(db, user, id, lock = false) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) fail(404, '未找到该学生。');
  const { rows } = await db.query(`SELECT s.*,u.name,u.username,c.teacher_id,c.settings,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.user_id=$1 ${lock ? 'FOR UPDATE OF s' : ''}`, [id]);
  const s = rows[0];
  if (!s || (user.role === 'student' ? user.id !== id : s.teacher_id !== user.id)) fail(404, '未找到该学生。');
  return s;
}
module.exports = { setupAuth, teacher, ownedStudent, username, passwordValid, safeUser };
