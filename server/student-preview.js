const { ownedStudent } = require('./auth');
const { fail } = require('./db');

// 只在当前请求中使用学生视角，不创建学生登录会话，也不改变教师身份。
function setupStudentPreview(app, pool) {
 app.use('/api', async (req, res, next) => {
  const id = req.get('X-Student-Preview');
  if (!id) return next();
  if (req.user.role !== 'teacher') fail(403, '只有教师可以预览学生模式。');
  const student = await ownedStudent(pool, req.user, id);
  const practiceCheck = req.method === 'POST' && /^\/students\/[^/]+\/(?:practice|variants)\/\d+\/\d+$/.test(req.path);
  if (!['GET','HEAD'].includes(req.method) && !practiceCheck) fail(403, '当前为学生预览，不会保存学生记录。请返回教师模式进行管理。');
  req.studentPreview = true;
  req.user = { id, role: 'student', name: student.name, username: student.username };
  next();
 });
}
module.exports = { setupStudentPreview };
