/* 在全新校验数据库中恢复备份，不覆盖在线数据库。 */
const {Pool}=require('pg'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.argv.includes('--ui-test'))process.env.DATABASE_URL=process.env.DATABASE_URL.replace('/math_lab','/math_lab_ui_test');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),u=new URL(process.env.DATABASE_URL);
 const before=(await pool.query('SELECT (SELECT count(*) FROM users)::int AS users,(SELECT count(*) FROM students)::int AS students,(SELECT count(*) FROM attempts)::int AS attempts')).rows[0];
 execFileSync(process.execPath,['scripts/backup.cjs'],{env:process.env,stdio:'inherit',windowsHide:true});
 const dir=path.resolve('backups'),file=fs.readdirSync(dir).filter(f=>f.endsWith('.dump')).sort().at(-1);
 const db='math_restore_check_'+Date.now();await pool.query('CREATE DATABASE '+db);
 const tool=path.resolve('.runtime/postgres/pgsql/bin/pg_restore.exe');
 execFileSync(tool,['-h',u.hostname,'-p',u.port,'-U',decodeURIComponent(u.username),'-d',db,'--exit-on-error',path.join(dir,file)],{env:{...process.env,PGPASSWORD:decodeURIComponent(u.password)},stdio:'pipe',windowsHide:true});
 u.pathname='/'+db;const restored=new Pool({connectionString:u.href});
 const actual=(await restored.query('SELECT (SELECT count(*) FROM users)::int AS users,(SELECT count(*) FROM students)::int AS students,(SELECT count(*) FROM attempts)::int AS attempts')).rows[0];
 require('node:assert/strict').deepEqual(actual,before);console.log('备份恢复核对通过：'+JSON.stringify(actual)+'；校验库：'+db);await restored.end();await pool.end();
}
main().catch(err=>{console.error(err.code||err.message);process.exitCode=1;});
