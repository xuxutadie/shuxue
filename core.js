/* 本机记录按学生隔离。测评开始时保存绝对截止时间，刷新不会重置计时。 */
const STORAGE_KEY='math-lab-v1';
const freshStudent=name=>({id:'s'+Date.now()+Math.random().toString(36).slice(2,7),name,completed:[],practice:{},notes:{},exams:{},drafts:{},talk:{},games:{},history:[]});
function initialState(){const p=freshStudent('我的学生');return {version:1,current:p.id,students:[p],dates:{},videos:{}}}
let storageWarning=false;
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return initialState();const value=JSON.parse(raw);validateBackup(value);return value}catch(e){storageWarning=true;return initialState()}}
function validateBackup(s){if(!s||s.version!==1||!Array.isArray(s.students)||!s.students.length||s.students.length>100)throw Error('备份格式不正确');const ids=new Set();for(const p of s.students){if(typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!Array.isArray(p.completed)||p.completed.some(x=>!Number.isInteger(x)||x<0||x>11))throw Error('学生数据不正确');ids.add(p.id);for(const k of ['practice','notes','exams','drafts','talk','games'])if(!p[k]||typeof p[k]!=='object'||Array.isArray(p[k]))throw Error('缺少学习记录');if(p.history!==undefined&&(!Array.isArray(p.history)||p.history.length>100||p.history.some(h=>!h||!['A','B'].includes(h.kind)||!h.record||!Array.isArray(h.record.answers)||h.record.answers.length!==20||!h.record.answers.every(x=>typeof x==='string')||typeof h.record.date!=='string'||!['v1','v2'].includes(h.record.version||'v1'))))throw Error('历史测评记录不正确');for(const record of [...Object.values(p.exams),...Object.values(p.drafts)])if(record.version!==undefined&&!['v1','v2'].includes(record.version))throw Error('试卷版本不正确');for(const [k,e]of Object.entries(p.exams)){if(!['A','B'].includes(k)||!Array.isArray(e.answers)||e.answers.length!==20||!e.answers.every(x=>typeof x==='string')||typeof e.date!=='string')throw Error('测评记录不正确')}for(const [k,d]of Object.entries(p.drafts)){if(!['A','B'].includes(k)||!Number.isFinite(d.deadline)||!Array.isArray(d.answers)||d.answers.length!==20||!d.answers.every(x=>typeof x==='string'))throw Error('未完成测评格式不正确')}}if(!ids.has(s.current)||!s.dates||!s.videos)throw Error('备份设置不完整');
function lessonKey(k){return /^(?:[0-9]|1[01])$/.test(k)}
for(const [k,v]of Object.entries(s.dates))if(!lessonKey(k)||typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('课程日期不正确');
for(const [k,v]of Object.entries(s.videos))if(!lessonKey(k)||typeof v!=='string'||(v&&!safeVideo(v)))throw Error('视频地址不正确');
for(const p of s.students){
 for(const [k,v]of Object.entries(p.notes))if(!lessonKey(k)||typeof v!=='string')throw Error('课堂记录不正确');
 for(const [k,v]of Object.entries(p.talk))if(!lessonKey(k)||!v||typeof v.prep!=='string'||!['','独立讲清','追问后讲清','需要重新学习'].includes(v.level))throw Error('讲课记录不正确');
 for(const [k,v]of Object.entries(p.practice))if(!/^(?:[0-9]|1[01])-[0-2]$/.test(k)||!v||typeof v.answer!=='string'||typeof v.correct!=='boolean')throw Error('练习记录不正确');
 for(const [k,v]of Object.entries(p.games))if(!['shop','cycle','factor','area','chase','pasture','allocation'].includes(k)||!v||typeof v.date!=='string')throw Error('游戏记录不正确');
}
return true}
let state=loadState();
let teacher=false;
const pupil=()=>state.students.find(p=>p.id===state.current);
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true}catch{toast('保存失败：浏览器存储空间不足或被限制，请立即导出备份。');return false}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normal(v){let t=String(v??'').normalize('NFKC').trim().replace(/\s/g,'').replace(/：/g,':');if(t.endsWith('色'))t=t.slice(0,-1);return t}
function isCorrect(value,expected){const a=normal(value),b=normal(expected);if(!a)return false;if(/^\d{1,2}:\d{2}$/.test(b)&&/^\d{1,2}:\d{2}$/.test(a))return a.split(':').map(Number).join(':')===b.split(':').map(Number).join(':');if(/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(a)&&/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(b))return Number(a)===Number(b);return a===b}
function gradeExam(kind,answers,version=EXAM_VERSION){const correct=examQuestions(kind,version).map((q,i)=>isCorrect(answers[i],q.answer));return {correct,score:correct.filter(Boolean).length*6}}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',4200)}
function download(name,value,type='application/json'){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function safeVideo(v){try{const u=new URL(v,location.href);if(['http:','https:'].includes(u.protocol)&&/\.(mp4|webm)(\?|$)/i.test(u.href))return u.href}catch{}return ''}

// 既有记录未带版本时按第一版还原，不能用新答案重算旧成绩。
function recordVersion(record){return record?.version||'v1'}
function recordQuestions(kind,record){return examQuestions(kind,recordVersion(record))}
function scoreRecord(kind,record){return gradeExam(kind,record.answers,recordVersion(record))}
