// 仅汇总第一课练习是否已有作答，不读取或输出学生身份。
const { Pool } = require('pg');
(async () => {
 const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 try {
  const result = await pool.query("SELECT count(*)::int AS affected_students FROM students WHERE (data->'practice') ?| ARRAY['0-0','0-1','0-2']");
  console.log(JSON.stringify(result.rows[0]));
 } finally { await pool.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
