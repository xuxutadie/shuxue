const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { database, migrate, transaction } = require('./db');
const { username, passwordValid } = require('./auth');
async function main() {
  const pool = database();
  try {
    await migrate(pool);
    const account = username(process.argv[2] || 'teacher');
    const name = process.argv[3] || '徐徐老师';
    const password = process.env.INITIAL_TEACHER_PASSWORD || crypto.randomBytes(15).toString('base64url');
    if (!passwordValid(password)) throw new Error('初始密码至少10位。');
    const id = crypto.randomUUID(), encoded = await argon2.hash(password, { type: argon2.argon2id });
    await transaction(pool, async db => {
      await db.query("INSERT INTO users(id,username,name,password_hash,role) VALUES($1,$2,$3,$4,'teacher')", [id, account, name, encoded]);
      await db.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [crypto.randomUUID(), id, '五年级思维探索班']);
    });
    if (!process.env.INITIAL_TEACHER_PASSWORD) {
      const dir = path.join(__dirname, '..', '.runtime'); fs.mkdirSync(dir, { recursive: true });
      const output = path.join(dir, `教师首次登录-${account}.txt`);
      fs.writeFileSync(output, `教师账号：${account}\n初始密码：${password}\n请登录后立即修改；这份文件仅供首次登录，不应分享给学生。\n`, { mode: 0o600, flag: 'wx' });
      console.log('教师账号已创建，首次登录信息保存在 .runtime 目录。');
    } else console.log('教师账号已创建。');
  } finally { await pool.end(); }
}
main().catch(err => { console.error(err.code === '23505' ? '账号已存在，未覆盖现有账号。' : err.message); process.exitCode = 1; });
