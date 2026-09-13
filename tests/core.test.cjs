// 核对计分、答案输入、课程总时长与备份边界，不依赖第三方测试包。
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({localStorage:{getItem:()=>null,setItem:()=>{}},console,URL,location:{href:'http://127.0.0.1:8765/'},Date,Math,setTimeout,clearTimeout});
vm.runInContext(['data.js','exam-legacy.js','exams.js','core.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n'),context);
const run=s=>vm.runInContext(s,context);
const expectedA=[360,'森林','09:45',2,49,68,72,15,30,4,36,44,6,42,50,30,2,12,11,4];
const expectedB=[480,'鼓','08:35',1,59,81,84,10,42,5,43,55,8,35,70,42,8,6,13,5];
for(const [kind,answers]of [['A',expectedA],['B',expectedB]]){
 assert.equal(run(`EXAMS.${kind}.length`),20);
 assert.deepEqual(JSON.parse(run(`JSON.stringify(EXAMS.${kind}.map(q=>q.answer))`)),answers.map(String));
 assert.equal(run(`gradeExam('${kind}',${JSON.stringify(answers.map(String))}).score`),120);
 assert.equal(run(`gradeExam('${kind}',Array(20).fill('')).score`),0);
 assert.equal(run(`gradeExam('${kind}',[${JSON.stringify(String(answers[0]))}]).score`),6);
}
for(const [a,b,want]of [['３.５０','3.5',true],['蓝色','蓝',true],[' 12：30 ','12:30',true],['01:05','1:05',true],['','0',false],['2元','2',false],['2abc','2',false],['0x10','16',false],['3.5001','3.5',false]])assert.equal(run(`isCorrect(${JSON.stringify(a)},${JSON.stringify(b)})`),want);
assert.equal(run('FLOW.reduce((s,x)=>s+x[1],0)'),120);
assert.equal(run('TEST_FLOW.reduce((s,x)=>s+x[1],0)'),120);
assert.equal(run('LESSONS.length'),12);
assert.equal(run('LESSONS.reduce((s,l)=>s+l.practice.length,0)'),36);
assert.equal(run('validateBackup(initialState())'),true);
assert.throws(()=>run('validateBackup({version:1,students:[]})'));
assert.throws(()=>run("{const s=initialState();s.students[0].drafts.A={answers:[],deadline:1};validateBackup(s)}"));
assert.equal(run("safeVideo('javascript:alert(1)')"),'');
assert.equal(run("safeVideo('https://example.com/watch?id=1')"),'');
assert.equal(run("safeVideo('https://example.com/a.mp4')"),'https://example.com/a.mp4');
// 独立枚举验证最值、公因数公倍数及四舍五入题的唯一答案。
function gcd(a,b){while(b)[a,b]=[b,a%b];return a}
for(const [sum,answer]of [[245,49],[255,59]]){const values=[];for(let a=11;a<=99;a+=2)for(let b=a+2;b<=99;b+=2)for(let c=b+2;c<=99;c+=2)if(a+b+c===sum)values.push(a);assert.equal(Math.min(...values),answer)}
for(const [g,l,diff]of [[4,48,4],[5,60,5]]){let min=Infinity;for(let a=1;a<=l;a++)for(let b=a;b<=l;b++)if(gcd(a,b)===g&&a*b/g===l)min=Math.min(min,b-a);assert.equal(min,diff)}
for(const [avg,total]of [[7.2,36],[8.6,43]]){const fits=[];for(let t=1;t<100;t++)if(Math.round(t/5*10)/10===avg)fits.push(t);assert.deepEqual(fits,[total])}
let schemes=0;for(let a=2;a<=4;a++)for(let b=2;b<=4;b++)for(let c=2;c<=4;c++)if(a+b+c===9)schemes++;assert.equal(schemes,7);
console.log('PASS: 40道答案、120分计分、输入规范、12课课时、备份边界、视频地址、枚举与舍入唯一性');

for(const k of ['A','B'])assert.equal(run(`EXAMS.${k}.every((q,i)=>q.text!==LEGACY_EXAMS.${k}[i].text)`),true);
assert.deepEqual(JSON.parse(run("JSON.stringify(EXAMS.A.map(q=>q.topic))")),JSON.parse(run("JSON.stringify(EXAMS.B.map(q=>q.topic))")));
assert.equal(run("scoreRecord('A',{answers:LEGACY_EXAMS.A.map(q=>q.answer)}).score"),120);
assert.equal(run("scoreRecord('A',{version:'v2',answers:EXAMS.A.map(q=>q.answer)}).score"),120);
assert.equal(run("scoreRecord('A',{answers:['125','丙','12：03','1','2','52','44','3.5','20','6','41.2','22','4','30','2.3','24','24','4','6','3']}).score"),60);
assert.equal(run("recordQuestions('A',{} )[0].answer"),'125');
assert.equal(run("recordQuestions('A',{version:'v2'})[0].answer"),'360');
console.log('PASS: 新旧40题全量更换、A/B专题对齐、旧记录仍为60分、新旧版本分别评分');
