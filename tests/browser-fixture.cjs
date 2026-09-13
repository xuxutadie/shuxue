/* 浏览器检查专用数据库，与真实教师班级完全分开。 */
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { migrate } = require('../server/db');
async function main(){
 const admin=new Pool({connectionString:process.env.DATABASE_URL});
 const exists=await admin.query("SELECT 1 FROM pg_database WHERE datname='math_lab_ui_test'");if(!exists.rowCount)await admin.query('CREATE DATABASE math_lab_ui_test');await admin.end();
 process.env.DATABASE_URL=process.env.DATABASE_URL.replace('/math_lab','/math_lab_ui_test');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});await migrate(pool);
 const encoded=await argon2.hash('Browser-Test-2026');
 let t=(await pool.query("SELECT id FROM users WHERE username='ui_teacher'")).rows[0]?.id;
 if(!t){t=randomUUID();await pool.query("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,'ui_teacher','界面测试老师',$2,'teacher',false)",[t,encoded]);const c=randomUUID();await pool.query('INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)',[c,t,'界面演练班（仅测试）']);for(const [account,name] of [['ui_student','小禾（测试）'],['ui_student2','小宇（测试）']]){const id=randomUUID();await pool.query("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES($1,$2,$3,$4,'student',false)",[id,account,name,encoded]);await pool.query('INSERT INTO students(user_id,class_id) VALUES($1,$2)',[id,c]);await pool.query("INSERT INTO assignments(student_id,kind,enabled) VALUES($1,'A',true)",[id]);}}
 await pool.end();process.env.PORT='8767';require('node:child_process').execFileSync(process.execPath,['server/index.js'],{env:process.env,stdio:'inherit',windowsHide:true});
}
main().catch(err=>{console.error(err.code||err.message);process.exitCode=1;});
