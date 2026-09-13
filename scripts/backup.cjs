/* 导出PostgreSQL自定义格式备份；凭据通过环境变量传给工具，不输出到日志。 */
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
if(!process.env.DATABASE_URL)throw new Error('请先提供DATABASE_URL。');
const root=path.resolve(__dirname,'..'),url=new URL(process.env.DATABASE_URL);
const pgBin=process.env.PG_BIN||path.join(root,'.runtime','postgres','pgsql','bin');
const executable=path.join(pgBin,process.platform==='win32'?'pg_dump.exe':'pg_dump');
const dir=path.join(root,'backups');fs.mkdirSync(dir,{recursive:true});
const output=path.join(dir,'math-lab-'+new Date().toISOString().replace(/[:.]/g,'-')+'.dump');
execFileSync(executable,['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',url.pathname.slice(1),'-Fc','-f',output],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},windowsHide:true,stdio:'pipe'});
console.log('数据库备份已保存：'+path.basename(output));
