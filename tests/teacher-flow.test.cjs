const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {lessons,bank}=require('../server/content');

function sandbox(isTeacher=true){
 const nodes=new Map();
 const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',innerHTML:'',hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},querySelector(){return null;}});return nodes.get(id);};
 const context=vm.createContext({console,URL,setTimeout,clearTimeout,setInterval,clearInterval,document:{getElementById:element,addEventListener(){},body:element('body')},window:{addEventListener(){}},location:{hash:''}});
 for(const file of ['course-videos.js','figures.js','lesson-lab.js','games.js','teacher-flow.js','views.js','data-loader.js','app.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8').replace(/startSession\(\);\s*$/,''),context);
 context.materials={lessons:lessons(isTeacher),flow:bank.flow,testFlow:bank.testFlow};
 vm.runInContext(`teacher=${isTeacher};user={id:'teacher-one',name:'老师',role:teacher?'teacher':'student'};LESSONS=materials.lessons;FLOW=materials.flow;TEST_FLOW=materials.testFlow;
 const first={id:'first',name:'学生甲',completed:[],talk:{},notes:{},practice:{},games:{},exams:{},drafts:{},assignments:{},history:[],settings:{dates:{},videos:{}}};
 const second={...first,id:'second',name:'学生乙',talk:{},notes:{},completed:[]};state.students=[first,second];state.current='first';overview={classes:[],students:state.students};api=async url=>url==='/api/content'?materials:teacher?overview:first;`,context);
 return {context,element,run:code=>vm.runInContext(code,context)};
}
test('12节课的7个授课步骤可打开，学生不能进入教师授课路由',async()=>{
 const {context,element,run}=sandbox();
 for(let i=0;i<12;i++)for(let s=0;s<7;s++){
  context.location.hash=`#lesson/${i}/teach/${s}`;await run('render()');
  const html=element('main').innerHTML;assert.match(html,/class="teaching-room"/);assert.doesNotMatch(html,/undefined|NaN/);
  assert.ok(html.includes(`第${i+1}课`));
 }
 const student=sandbox(false);student.context.location.hash='#lesson/0/teach/6';await student.run('render()');
 assert.doesNotMatch(student.element('main').innerHTML,/finish-save|teaching-room/);
});
test('上台题先于对应提纲，母题回顾折叠，学生不收到教师参考答案',()=>{
 const t=sandbox(),s=sandbox(false);
 for(let i=0;i<12;i++){
  const html=t.run(`lessonId=${i};talkView()`);
  assert.ok(html.indexOf(bank.lessons[i].detail.talkChallenge)<html.indexOf('从这句话开始'));
  assert.equal(t.run('talkSupport(LESSONS[lessonId]).talk.length'),4);
  assert.ok(html.includes(lessons(true)[i].videoGuide.answer));
  assert.doesNotMatch(s.run(`lessonId=${i};talkView()`),/教师参考：|finish-save|talk-level/);
 }
 assert.doesNotMatch(t.run('lessonId=0;talkSupport(LESSONS[0]).talk.join()'),/支笔|2本本子/);
});
test('教师练习只查解析，学生保留作答入口且不显示正确答案',()=>{
 const t=sandbox(),s=sandbox(false);
 assert.doesNotMatch(t.run('practiceQuestion(LESSONS[0].practice[0],0,0)'),/<input|practice-check/);
 const html=s.run('practiceQuestion(LESSONS[0].practice[0],0,0)');
 assert.match(html,/practice-check/);assert.doesNotMatch(html,/参考答案：|查看本题解析/);
});
test('未知单价与重量设置默认折叠，原始订单总量仍可见',()=>{
 const t=sandbox();for(const type of ['shop','pairs','align','balance']){
  const html=t.run(`labView(0,'${type}')`);
  assert.match(html,/<details class="lab-parameter-disclosure">/);
  assert.doesNotMatch(html,/<details class="lab-parameter-disclosure" open/);
  assert.ok(html.indexOf('</details>')<html.indexOf('id="lab-picture"'));
 }
});
test('课末保存失败保留草稿，切换学生不串记录，重试成功才清除',async()=>{
 const {element,run}=sandbox();element('finish-level').value='追问后讲清';element('finish-note').value='甲需要检查所求';element('finish-completed').checked=true;
 run('rememberClassroomDraft()');
 run("state.current='second'");assert.equal(run('classroomValues().note'),'');
 run("state.current='first';api=async()=>{throw Error('模拟断网')}");
 await assert.rejects(run('saveClassroomRecord()'),/模拟断网/);assert.equal(run('classroomDrafts.size'),1);
 assert.match(element('finish-status').textContent,/保存失败/);
 run("api=async(url,options)=>{savedRequest={url,body:options.body};state.current='second';return {};}");
 await run('saveClassroomRecord()');
 assert.equal(run('savedRequest.url'),'/api/students/first/lessons/0');
 assert.equal(run('first.notes[0]'),'甲需要检查所求');assert.equal(run('second.notes[0]'),undefined);
 assert.equal(run('classroomDrafts.size'),0);assert.equal(run('first.completed.includes(0)'),true);
});
test('保存期间的新修改不会被旧请求清除，完成状态可保留未完成',async()=>{
 const {element,run}=sandbox();element('finish-note').value='第一份';element('finish-completed').checked=false;
 run("api=async()=>{classroomDrafts.set(draftKey(),{level:'',note:'新的修改',completed:false});return {};}");
 await run('saveClassroomRecord()');
 assert.equal(run('classroomValues().note'),'新的修改');assert.equal(run('first.completed.length'),0);
 assert.match(element('finish-status').textContent,/还有新的修改/);
});
