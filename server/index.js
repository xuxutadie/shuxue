const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { database, migrate } = require('./db');
const { setupAuth } = require('./auth');
const { setupLearning } = require('./learning');
const { setupExams, expireAttempts } = require('./exams');
const { setupTeacher } = require('./teacher');
const { setupAiPractice } = require('./ai-practice');
function createApp(pool, options = {}) {
  const app = express(), production = process.env.NODE_ENV === 'production';
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const contentDirectives = { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], mediaSrc: ["'self'", 'https:', ...(production ? [] : ['http:'])], upgradeInsecureRequests: production ? [] : null };
  app.use(helmet({ contentSecurityPolicy: { directives: contentDirectives }, strictTransportSecurity: production ? undefined : false }));
  // GLB 内嵌贴图会被 Three.js 转为 blob；只为 3D 页面开放本地二进制资源。
  app.use('/world3d', helmet.contentSecurityPolicy({ directives: { ...contentDirectives, imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'", 'blob:'] } }));
  app.use(express.json({ limit: '5mb' }));
  app.get('/health', async (req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }); });
  app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  setupAuth(app, pool, production);
  require('./student-preview').setupStudentPreview(app, pool);
  setupLearning(app, pool); setupExams(app, pool); setupTeacher(app, pool);
  require('./world3d/routes.cjs').setupWorld3d(app,pool);
  setupAiPractice(app, pool, options);
  require('./homework').setupHomework(app, pool, options);
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在。' }));
  // 严格限定静态目录；开发文件、完整答案和本地备份不能经网站下载。
  app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', maxAge: 0 }));
  app.use((req,res) => res.status(404).send('页面不存在。'));
  app.use((err,req,res,next) => {
    const status = err.code === '23505' ? 409 : err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error('服务请求失败：', err.code || err.name);
    res.status(status).json({ error: err.code === '23505' ? '这个账号已经存在，请换一个。' : status < 500 ? err.message : '服务暂时不可用，请稍后重试。' });
  });
  return app;
}
async function start() {
  const pool = database(); await migrate(pool); await expireAttempts(pool);
  const timer = setInterval(() => expireAttempts(pool).catch(() => console.error('测评到期检查失败，将重试。')), 5000); timer.unref();
  const server = createApp(pool).listen(Number(process.env.PORT || 8766), process.env.HOST || '127.0.0.1', () => console.log(`思维实验室在线版已启动，端口 ${process.env.PORT || 8766}`));
  const close = () => { clearInterval(timer); server.close(() => pool.end().then(() => process.exit(0))); };
  process.on('SIGTERM', close); process.on('SIGINT', close);
}
if (require.main === module) start().catch(err => { console.error('启动失败：', err.code || err.message); process.exitCode = 1; });
module.exports = { createApp };
