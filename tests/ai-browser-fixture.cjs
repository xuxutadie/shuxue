/* 仅本地浏览器验收：独立数据库与模拟模型，不连接付费 AI。 */
const { Pool } = require('pg');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { migrate } = require('../server/db');
const { createApp } = require('../server/index');
const { encrypt } = require('../server/ai-provider');
async function main() {
 const admin = new Pool({ connectionString: process.env.DATABASE_URL });
 if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='math_lab_ai_ui_test'")).rowCount) await admin.query('CREATE DATABASE math_lab_ai_ui_test');
 await admin.end();
 const connection = new URL(process.env.DATABASE_URL); connection.pathname = '/math_lab_ai_ui_test';
 const pool = new Pool({ connectionString: connection.href }); await migrate(pool);
 process.env.AI_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
 const encoded = await argon2.hash('Browser-Test-2026'), people = [];
 for (const [username, name, role] of [['ui_teacher', '界面验收老师', 'teacher'], ['ui_student', '小禾（仅测试）', 'student']]) {
  const row = (await pool.query('INSERT INTO users(id,username,name,role,password_hash,must_change) VALUES($1,$2,$3,$4,$5,false) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id', [crypto.randomUUID(), username, name, role, encoded])).rows[0]; people.push(row.id);
 }
 let classId = (await pool.query('SELECT id FROM classes WHERE teacher_id=$1', [people[0]])).rows[0]?.id;
 if (!classId) { classId = crypto.randomUUID(); await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)', [classId, people[0], '独立界面测试班']); }
 await pool.query('INSERT INTO students(user_id,class_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [people[1], classId]);
 await pool.query("INSERT INTO ai_settings(teacher_id,endpoint,model,key_cipher,enabled,daily_limit) VALUES($1,'https://api.example.com/v1/chat/completions','local-mock-only',$2,true,100) ON CONFLICT(teacher_id) DO UPDATE SET key_cipher=EXCLUDED.key_cipher,enabled=true,daily_limit=100", [people[0], encrypt('not-a-real-api-key')]);
 let seed = 430;
 createApp(pool, { aiRequest: async (config, body) => {
  const request = body.messages[1].content;
  const result = request.startsWith('{') ? { questions: Array.from({ length: JSON.parse(request).题数 }, (_, i) => ({
   text: `计算：4.8×${25+i}＋4.8×${75-i}＝（　）。请填写计算结果。`, answer: '480', unit: '', explain: `两项都含有4.8，用乘法分配律合并：4.8×(${25+i}＋${75-i})＝4.8×100＝480。`
  })) } : { seeds: Array.from({ length: Number(request.match(/需要(\d)/)[1]) }, () => ++seed) };
  return { choices: [{ message: { content: JSON.stringify(result) } }] };
 } }).listen(8772, '127.0.0.1', () => console.log('模拟AI浏览器验收已启动：8772；不连接付费接口。'));
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
