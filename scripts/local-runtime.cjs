/* 本机预览用PostgreSQL与服务启动器；生产环境使用独立凭据与容器部署。 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), originalRuntime = path.join(root, '.runtime');
fs.mkdirSync(originalRuntime, { recursive: true });
// Windows版PostgreSQL初始化不能可靠处理中文路径，使用指向同一目录的英文联接。
const runtime = path.join(os.homedir(), '.cache', 'math-lab-' + crypto.createHash('sha256').update(root).digest('hex').slice(0,10));
fs.mkdirSync(path.dirname(runtime), { recursive: true });
if (!fs.existsSync(runtime)) fs.symlinkSync(originalRuntime, runtime, 'junction');
if (fs.realpathSync(runtime) !== fs.realpathSync(originalRuntime)) throw new Error('数据库目录映射不匹配。');
const bin = path.join(runtime, 'postgres', 'pgsql', 'bin');
fs.mkdirSync(runtime, { recursive: true });
const configPath = path.join(runtime, 'local-config.json');
let config;
if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
else { config = { password: crypto.randomBytes(24).toString('hex'), port: 55432 }; fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 }); }
const dbPath = path.join(runtime, 'pgdata');
const run = (name,args,options={}) => execFileSync(path.join(bin,name+'.exe'),args,{cwd:runtime,windowsHide:true,stdio:'pipe',...options});
if (!fs.existsSync(path.join(dbPath,'PG_VERSION'))) {
 const pwfile = path.join(runtime, 'postgres-init-password.txt'); fs.writeFileSync(pwfile, config.password, { mode: 0o600 });
 run('initdb',['-D',dbPath,'-U','math_local','-A','scram-sha-256','--pwfile='+pwfile,'--encoding=UTF8','--locale=C']);
 fs.appendFileSync(path.join(dbPath,'postgresql.conf'), `\nlisten_addresses = '127.0.0.1'\nport = ${config.port}\n`);
}
try { run('pg_ctl',['-D',dbPath,'status']); }
catch { run('pg_ctl',['-D',dbPath,'-l',path.join(runtime,'postgres.log'),'-w','start'],{stdio:'ignore'}); }
process.env.DATABASE_URL=`postgresql://math_local:${config.password}@127.0.0.1:${config.port}/postgres`;
const { Pool } = require('pg');
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 // 系统刚恢复或同时打开两个启动窗口时，进程存在不代表数据库已经可连接。
 for(let attempt=0;attempt<20;attempt++){
  try{await pool.query('SELECT 1');break;}
  catch(err){if(!['57P03','ECONNREFUSED'].includes(err.code)||attempt===19)throw err;await new Promise(resolve=>setTimeout(resolve,250));}
 }
 const result=await pool.query("SELECT 1 FROM pg_database WHERE datname='math_lab'");
 if(!result.rowCount)await pool.query('CREATE DATABASE math_lab');
 await pool.end();
 process.env.DATABASE_URL=process.env.DATABASE_URL.replace('/postgres','/math_lab');
 if(process.argv[2]==='test')execFileSync(process.execPath,['--test','tests/online.test.cjs','tests/preparation.test.cjs','tests/course-videos.test.cjs','tests/teacher-flow.test.cjs','tests/navigation.test.cjs'],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
 else if(process.argv[2]==='teacher')execFileSync(process.execPath,['server/create-teacher.js',...process.argv.slice(3)],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
 else if(process.argv[2]==='run')execFileSync(process.execPath,process.argv.slice(3),{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
 else execFileSync(process.execPath,['server/index.js'],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
}
main().catch(err=>{console.error('本机启动未完成：',err.code||err.message);process.exitCode=1;});
