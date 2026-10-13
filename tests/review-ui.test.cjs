'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {bank,lessons}=require('../server/content');
const {paper,publicQuestions,gradeReview}=require('../server/review-paper.cjs');

// 执行真实页面函数与事件，检查输入、保存和报告之间的数据流。
function page(){
 const nodes=new Map(),listeners=new Map();
 const element=id=>{
  if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',hidden:false,style:{},isConnected:true,value:'',
   classList:{add(){},remove(){},toggle(name,value){this[name]=value;}},addEventListener(){},focus(){},querySelector(){return null;}});
  return nodes.get(id);
 };
 const document={getElementById:id=>id==='homework-page'?null:element(id),addEventListener(name,handler){listeners.set(name,[...(listeners.get(name)||[]),handler]);},body:element('body')};
 const context=vm.createContext({document,window:{addEventListener(){},scrollTo(){}},location:{hash:'#practice/exams',origin:'http://localhost'},console,URL,Date,Math,Set,WeakMap,
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}});
 for(const name of ['course-videos.js','figures.js','lesson-lab.js','games.js','teacher-flow.js','views.js','data-loader.js','class-dashboard.js','exam-analysis.js','practice-workspace.js','homework-text.js','homework.js','app.js']){
  vm.runInContext(fs.readFileSync('public/'+name,'utf8').replace(/^startSession\(\);/m,''),context);
 }
 Object.assign(context,{materials:{lessons:lessons(false),flow:bank.flow,testFlow:bank.testFlow},questions:publicQuestions(),keys:paper.questions,oldQuestions:bank.exams.v3.A,requests:[],student:{id:'student-one',name:'小雨',username:'xiaoyu',className:'五年级',settings:{dates:{},videos:{}},completed:[],exams:{},drafts:{},assignments:{R:true},history:[],practice:{},variantPractice:{},talk:{},notes:{},games:{}}});
 const run=code=>vm.runInContext(code,context);
 run(`user={id:student.id,role:'student',name:student.name};teacher=false;state.students=[student];state.current=student.id;LESSONS=materials.lessons;
  api=async(url,options={})=>{requests.push({url,...options});if(url==='/api/content')return materials;if(url==='/api/teacher/overview')return {classes:[],students:[]};if(url.endsWith('/answers'))return {record:{revision:4}};return student;};`);
 function session(kind='R',answers=Array(kind==='R'?25:20).fill('')){
  context.draft={record:{kind,answers,workings:Array(answers.length).fill(''),revision:3,deadline:Date.now()+60*60*1000},questions:kind==='R'?publicQuestions():bank.exams.v3.A,studentId:'student-one',dirty:false,edit:0};
  run('examSession=draft;');
 }
 function input(attr,dataset,value,checked=true){context.input={dataset,value,checked,hasAttribute:name=>name===attr};run('recordExamInput(input)');}
 return {context,element,run,session,input,listeners};
}

test('学生测评入口同时展示回顾性测试和原前后测，教师无学生也可查看答案及打印入口',async()=>{
 const p=page();await p.run('render()');const student=p.element('main').innerHTML;
 assert.match(student,/回顾性测试/);assert.match(student,/25题 · 100分 · 60分钟/);assert.match(student,/20题 · 120分 · 45分钟/);
 assert.match(student,/data-kind="R"/);assert.doesNotMatch(student,/教师答案|打印学生卷/);
 p.run("teacher=true;user={id:'teacher',role:'teacher',name:'老师'};");p.context.location.hash='#exams';await p.run('render()');
 const teacher=p.element('main').innerHTML;assert.doesNotMatch(teacher,/先创建一位学生|暂时没能加载/);
 assert.match(teacher,/data-action="exam-key"[^>]*data-kind="R"/);assert.match(teacher,/data-action="print-exam"[^>]*data-kind="R"/);
 assert.match(teacher,/data-action="assign-class"[^>]*data-kind="R"/);
});

test('回顾卷真实25题按五类展示，勾选和分问回填，学生DOM没有标准解析',()=>{
 const p=page(),answers=Array(25).fill('');answers[0]='B';answers[6]='AC';answers[10]='对';answers[22]='["6","23"]';p.session('R',answers);
 p.run("examSession.record.workings[22]='先对齐相同数量，再相减。';");
 const html=p.run('examView()');assert.equal((html.match(/id="q\d+"/g)||[]).length,25);assert.equal((html.match(/data-scroll="q/g)||[]).length,25);
 for(const section of ['单项选择题','多项选择题','判断题','填空题','应用题'])assert.match(html,new RegExp(section));
 assert.match(html,/60:00/);assert.match(html,/漏选2分/);assert.match(html,/data-exam-choice="6" value="A" checked/);assert.match(html,/data-exam-choice="6" value="C" checked/);
 assert.match(html,/data-exam-part="22" data-part="0"[^>]*value="6"/);assert.match(html,/data-exam-part="22" data-part="1"[^>]*value="23"/);
 assert.match(html,/先对齐相同数量，再相减/);assert.doesNotMatch(html,/正确答案|参考答案|readonly|disabled/);
 for(const q of paper.questions)assert.ok(!html.includes(q.explain));
});

test('多选勾选顺序不改变字母编码，取消勾选、应用分问和思路随同一次保存并回填',async()=>{
 const p=page();p.session();
 p.input('data-exam-choice',{examChoice:'6'},'C');p.input('data-exam-choice',{examChoice:'6'},'A');assert.equal(p.run('examSession.record.answers[6]'),'AC');
 p.input('data-exam-choice',{examChoice:'6'},'C',false);assert.equal(p.run('examSession.record.answers[6]'),'A');
 p.input('data-exam-part',{examPart:'22',part:'0'},'6');p.input('data-exam-part',{examPart:'22',part:'1'},'23');
 p.input('data-exam-working',{examWorking:'22'},'（26－18）÷2，再代回检查。');
 assert.equal(p.run('examSession.record.answers[22]'),'["6","23"]');assert.equal(p.element('answered-count').textContent,'已填写 2/25题');
 await p.run('saveAnswers()');const request=p.context.requests.find(x=>x.url.endsWith('/answers'));
 assert.equal(request.url,'/api/students/student-one/exams/R/answers');assert.equal(request.body.answers[6],'A');assert.equal(request.body.answers[22],'["6","23"]');
 assert.equal(request.body.workings[22],'（26－18）÷2，再代回检查。');assert.equal(request.body.workings.length,25);assert.equal(request.body.revision,3);
 assert.equal(p.run('examSession.record.revision'),4);assert.equal(p.run('examSession.dirty'),false);
 const html=p.run('examView()');assert.match(html,/data-exam-choice="6" value="A" checked/);assert.doesNotMatch(html,/data-exam-choice="6" value="C" checked/);assert.match(html,/（26－18）÷2，再代回检查。/);
});

test('预览允许试填但不开始倒计时、不发送答案或过程，A/B原填空保存不带workings',async()=>{
 const p=page();p.session();p.run("previewStudentId='student-one';");p.input('data-exam-choice',{examChoice:'0'},'B');p.input('data-exam-working',{examWorking:'22'},'预览思路');await p.run('saveAnswers()');
 assert.equal(p.context.requests.length,0);assert.equal(p.run('examSession.dirty'),false);let html=p.run('examView()');assert.match(html,/不计时/);assert.doesNotMatch(html,/data-action="exam-submit"/);
 p.run('previewStudentId=null;');p.session('A');p.input('data-exam-answer',{examAnswer:'0'},'27');await p.run('saveAnswers()');
 assert.equal(p.context.requests[0].url,'/api/students/student-one/exams/A/answers');assert.equal(p.context.requests[0].body.workings,undefined);
 html=p.run('examView()');assert.match(html,/45:00/);assert.equal((html.match(/data-exam-answer=/g)||[]).length,20);assert.equal((html.match(/（6分）/g)||[]).length,20);
});

test('倒计时根据服务器截止时间恢复，已填写统计识别空应用分问',()=>{
 const p=page();p.session();p.run('examSession.record.deadline=Date.now()+17*60*1000+20*1000;serverOffset=0;');p.run('examTick()');
 assert.match(p.element('exam-time').textContent,/^17:(19|20)$/);assert.equal(p.element('answered-count').textContent,'已填写 0/25题');
 p.input('data-exam-part',{examPart:'22',part:'0'},'6');assert.equal(p.element('answered-count').textContent,'已填写 1/25题');
 p.input('data-exam-part',{examPart:'22',part:'0'},'');assert.equal(p.element('answered-count').textContent,'已填写 0/25题');assert.equal(p.run('examSession.record.answers[22]'),'');
});

test('讲评和错题按分题分值显示多选漏选与应用小问得分，未开放时隐藏所有题面解析',()=>{
 const p=page(),answers=Array(25).fill('');answers[6]='A';answers[22]=JSON.stringify([paper.questions[22].answer[0],'99999']);
 const result=gradeReview(answers);p.context.review={record:{kind:'R',date:'2026-10-13',released:true,answers,workings:Array(25).fill(''),...result},questions:paper.questions};p.context.review.record.workings[22]='先相减，再检查单位。';
 let html=p.run('reviewPage(review)');assert.match(html,/部分正确 · 2\/4分/);assert.match(html,/部分正确 · 5\/10分/);assert.match(html,/应用题按小问结果自动计分，解题过程供老师查看/);assert.match(html,/先相减，再检查单位。/);
 html=p.run("examWrongSection(review,'R')");assert.match(html,/含未作答和部分得分/);assert.match(html,/第7题/);assert.match(html,/第23题/);assert.match(html,/2\/4分/);
 p.context.review.record.released=false;
 for(const expression of ['reviewPage(review)',"examWrongSection(review,'R')"]){html=p.run(expression);assert.match(html,/等待老师开放|讲评等待老师开放/);assert.doesNotMatch(html,/正确答案|第23题|先相减，再检查单位/);for(const q of paper.questions)assert.ok(!html.includes(q.explain));}
 p.run('teacher=true;');assert.match(p.run('reviewPage(review)'),/部分正确 · 5\/10分/);
});

test('打印学生卷保留完整选项、应用小问与作答空白，教师答案含完整题目与解说',()=>{
 const p=page(),html=p.run("examPrintPage(keys,'R')");assert.match(html,/25题 \/ 100分 \/ 60分钟/);assert.match(html,/作答：________________/);assert.match(html,/解题过程/);assert.match(html,/每小问5分/);
 for(const q of paper.questions){assert.ok(html.includes(q.text));for(const option of q.options||[])assert.ok(html.includes(option.text));for(const part of q.parts||[])assert.ok(html.includes(part.text));assert.ok(!html.includes(q.explain));}
 const key=p.run("examTeacherKey(keys,'R')");for(const q of paper.questions){assert.ok(key.includes(q.text));assert.ok(key.includes(q.explain));}
 const old=p.run("examPrintPage(oldQuestions,'A')");assert.match(old,/20题 \/ 120分 \/ 45分钟/);
});
