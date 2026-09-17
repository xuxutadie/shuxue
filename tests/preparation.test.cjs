const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { bank } = require('../server/content');

test('新版前测20题保持知识点顺序，全部换题且独立核对答案与图示',()=>{
 const questions=bank.exams.v3.A;
 assert.equal(questions.length,20);
 assert.deepEqual(questions.map(q=>q.topic),bank.exams.v2.A.map(q=>q.topic));
 for(let i=0;i<20;i++){assert.notEqual(questions[i].text,bank.exams.v2.A[i].text);assert.ok(questions[i].explain.length>20);assert.equal(Boolean(questions[i].svg),Boolean(bank.exams.v2.A[i].svg));}
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 const differences=[];for(let a=1;a<=36;a++)for(let b=a;b<=36;b++)if(gcd(a,b)===3&&a*b/gcd(a,b)===36)differences.push(b-a);
 const totals=[];for(let total=0;total<100;total++)if(Math.round(total/5*10)===68)totals.push(total);
 assert.deepEqual(totals,[34]);
 const oddMinimum=[];for(let a=11;a<100;a+=2)for(let b=a+2;b<100;b+=2)for(let c=b+2;c<100;c+=2)if(a+b+c===239)oddMinimum.push(a);
 let energy=40;for(let i=0;i<11;i++)energy+=[-3,6,1][i%3];
 const expected=[2.7*100,['圆形','星形','爱心','月亮','太阳'][(58-1)%5],'07:25',12%9,Math.min(...oddMinimum),energy,8**2-2**2,(48-2*((66-48)/3))/3,(6+10)*4/2,Math.min(...differences),totals[0],(36+39+63+69+93+96)/6,(17+8)/5,10*9/2,54/.9,(16/2)*4,7-3,70*4/(110-70),(40-12)/2,(4*12-2*12)/(10-2)];
 assert.deepEqual(questions.map(q=>q.answer),expected.map(String));
 assert.match(questions[2].svg,/07:25/);assert.match(questions[6].svg,/草坪边长8米/);assert.match(questions[8].svg,/上底6/);assert.match(questions[13].svg,/长10厘米/);
 const {grade}=require('../server/content');assert.equal(grade('A','v3',expected.map(String)).score,120);
 assert.equal(grade('A','v2',bank.exams.v2.A.map(q=>q.answer)).score,120);
});

function page() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: false, style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, focus(){}, querySelector(){ return null; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    console, URL, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { getElementById: element, addEventListener(){}, body: element('body') },
    window: { addEventListener(){} }, location: { hash: '#courses' }
  });
  for (const file of ['figures.js', 'lesson-lab.js', 'games.js', 'teacher-flow.js', 'views.js', 'data-loader.js', 'class-dashboard.js','exam-analysis.js','practice-workspace.js','homework-text.js','homework.js','app.js']) {
    let source = fs.readFileSync('public/' + file, 'utf8');
    if (file === 'app.js') source = source.replace(/startSession\(\);\s*$/, '');
    vm.runInContext(source, context);
  }
  context.content = { lessons: bank.lessons, flow: bank.flow, testFlow: bank.testFlow };
  vm.runInContext(`user={id:'teacher',role:'teacher',name:'备课老师',mustChange:false};teacher=true;
    api=async url=>{if(url==='/api/content')return content;if(url==='/api/teacher/overview')return {classes:[],students:[]};throw Error('备课不应请求学生数据：'+url);};`, context);
  return { context, element };
}
test('没有学生和班级时，教师仍可查看12节课程', async () => {
  const { context, element } = page();
  await vm.runInContext('render()', context);
  const html = element('main').innerHTML;
  assert.doesNotMatch(html, /先创建一位学生/);
  assert.equal((html.match(/<article class="course">/g) || []).length, 12);
});
test('12节课的全部备课环节均不依赖学生记录', async () => {
  const { context, element } = page();
  for (let i = 0; i < 12; i++) {
    for (const tab of ['learn', 'talk', 'game', 'work', 'guide']) {
      context.location.hash = `#lesson/${i}/${tab}`;
      await vm.runInContext('render()', context);
      const html = element('main').innerHTML;
      assert.match(html, new RegExp(bank.lessons[i].title), `${i}/${tab}`);
      assert.doesNotMatch(html, /先创建一位学生|data-action="(?:complete|note-save|talk-save)"|undefined/, `${i}/${tab}`);
      if (tab === 'guide') {assert.match(html, /练习答案与讲解/);assert.ok(html.includes(bank.lessons[i].detail.talkChallenge),'教案需包含本次上台完整题');}
      if (tab === 'work') assert.equal((html.match(/class="question"/g) || []).length, 3);
    }
  }
});
test('选择学生后仍可记录教师评价和课堂进度', async () => {
  const { context, element } = page();
  vm.runInContext(`const sample={id:'student',name:'学生',completed:[],practice:{},talk:{0:{prep:'相减再检查',level:'独立讲清'}},notes:{},games:{},history:[],settings:{dates:{},videos:{}}};
    api=async url=>url==='/api/content'?content:{classes:[],students:[sample]};`, context);
  context.location.hash = '#lesson/0/talk'; await vm.runInContext('render()', context);
  assert.match(element('main').innerHTML, /data-action="complete"/);
  assert.match(element('main').innerHTML, /data-action="talk-save"/);
  assert.match(element('main').innerHTML, /相减再检查/);
  context.location.hash = '#lesson/0/guide'; await vm.runInContext('render()', context);
  assert.match(element('main').innerHTML, /data-action="note-save"/);
});

test('课堂时间保持120分钟，动画与验证安排在学生讲解前', () => {
  for (const flow of [bank.flow, bank.testFlow]) {
    assert.equal(flow.reduce((sum, row) => sum + row[1], 0), 120);
    const index = word => flow.findIndex(row => row[0].includes(word));
    assert.ok(index('动画') < index('上台'));
    assert.ok(index('互动') < index('上台'));
  }
  assert.equal(bank.testFlow.find(row => row[0] === '独立测评')[1], 45);
  assert.ok(bank.testFlow.findIndex(row => row[0] === '独立测评') < bank.testFlow.findIndex(row => row[0].includes('动画')));
});

test('课程修订保留第一课练习与40道测评，其余独立题单独标识', () => {
  const original = vm.createContext({});
  for (const file of ['data.js', 'exam-legacy.js', 'exams.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), original);
  const baseline = JSON.parse(vm.runInContext('JSON.stringify({practice:LESSONS.map(l=>l.practice),exams:EXAMS})', original));
  assert.deepEqual(bank.lessons[0].practice, baseline.practice[0]);
  assert.equal(bank.lessons.flatMap(l=>l.practice).length,36);
  for(let i=1;i<12;i++)for(let j=0;j<3;j++){
    assert.equal(bank.lessons[i].practice[j].version,'2026-09-r2');
    assert.notEqual(bank.lessons[i].practice[j].text,baseline.practice[i][j].text);
  }
  assert.deepEqual(bank.exams.v2, baseline.exams);
});

test('新的实验可比较两种配平路线、镜像距离、遮挡和停留追及',()=>{
 const {context}=page();
 const model=(type,values,step=3)=>{context.input={type,values,step};return vm.runInContext('labModel(input.type,input.values,input.step)',context);};
 assert.match(model('align',{target:1,small:5}).formula,/25÷5＝5/);
 assert.match(model('align',{target:2,small:5}).formula,/40÷5＝8/);
 assert.equal(model('reflection',{distance:4,shift:1}).answer,'12');
 assert.equal(model('stacks',{front:4,back:3,remove:2}).answer,'3');
 assert.equal(model('stopped',{rest:2},16).answer,'16');
 assert.match(model('stopped',{rest:2},16).caption,/追上/);
 assert.match(model('stopped',{rest:2},6).svg,/差距300米/);
});

test('第7课练习覆盖镜像空间，复盘页面按个人后测显示回学入口',async()=>{
 assert.match(bank.lessons[6].practice[1].topic,/镜像/);
 assert.match(bank.lessons[6].practice[2].topic,/空间/);
 const {context,element}=page();
 vm.runInContext(`const reviewed={id:'student',name:'学生',completed:[],practice:{},talk:{},notes:{},games:{},history:[],exams:{B:{score:72,topics:{行程:{correct:0,total:2},面积:{correct:2,total:2}}}},settings:{dates:{},videos:{}}};api=async url=>url==='/api/content'?content:{classes:[],students:[reviewed]};`,context);
 context.location.hash='#lesson/10/guide';await vm.runInContext('render()',context);
 const html=element('main').innerHTML;
 assert.match(html,/后测答对0\/2题/);assert.match(html,/回看第8课/);
 assert.doesNotMatch(html,/回看第6课/);
});

test('互动模型验证整除边界、面积单位、速度相同和草地不耗尽', () => {
  const { context } = page();
  const model = (type, values, step = 0) => {
    context.args = {type, values, step};
    return vm.runInContext('labModel(args.type,args.values,args.step)', context);
  };
  assert.equal(model('shop',{pen:5},3).answer,'20');
  assert.equal(model('balance',{pen:3,multiple:4},3).answer,'3');
  assert.equal(model('cycle',{n:28},27).answer,'绿');
  assert.equal(model('cycle',{n:1},0).answer,'红');
  assert.equal(model('factor',{group:5},3).answer,'4');
  assert.equal(model('factor',{group:6},3).answer,'0');
  assert.equal(model('multiples',{a:6,b:8},24).answer,'24');
  assert.equal(model('multiples',{a:4,b:4},4).answer,'4');
  assert.equal(model('area',{corner:3},3).answer,'39');
  assert.equal(model('grid',{side:3},3).answer,'72');
  assert.match(model('chase',{fast:60},12).formula,/无法追上/);
  assert.match(model('chase',{fast:90},10).caption,/追上了/);
  assert.match(model('chase',{fast:120},12).svg,/已超过/);
  assert.equal(model('pasture',{cows:1},10).answer,'31');
  assert.match(model('pasture',{cows:2},10).formula,/不耗尽/);
  assert.match(model('pasture',{cows:12},3).svg,/剩余0份/);
  assert.equal(model('allocation',{a:2,b:3,c:4}).answer,'9');
});

test('12课都有SVG、开场支架、具体追问与完整备课内容，参数范围内绘图有效', async () => {
  const {context,element}=page();
  for(let i=0;i<12;i++) {
    context.location.hash=`#lesson/${i}/learn`;await vm.runInContext('render()',context);
    const html=element('main').innerHTML;
    assert.match(html,/id="lab-picture"/);
    assert.ok(html.indexOf('id="lab-picture"')<html.indexOf('id="stage"'));
    assert.ok(bank.lessons[i].detail.questions.length>=2);
    assert.equal(bank.lessons[i].detail.talk.length,4);
  }
  const svgErrors=vm.runInContext(`(()=>{const errors=[];for(const [type,c] of Object.entries(LAB_CONFIG)){
    const values=Object.fromEntries(c.params.map(([key,,,,v])=>[key,v]));
    for(const [key,,min,max] of c.params)for(let value=min;value<=max;value++){
      values[key]=value;for(let step=0;step<=labLimit(type,values);step++){
        const model=labModel(type,values,step);if(/NaN|undefined|Infinity|(?:height|width)="-/.test(model.svg))errors.push(type+':'+value+':'+step);
      }
    }
  }return errors;})()`,context);
  assert.equal(svgErrors.length,0,JSON.stringify(svgErrors));
});

test('每课完整母题先于分析出现，练习页的母题与变式可逐题展开且默认折叠', async () => {
  const {context,element}=page();
  for(let i=0;i<12;i++) {
    const {mother,variants}=bank.lessons[i].detail, cards=mother.cards||[mother], variantCards=variants.flatMap(v=>v.cards||[v]);
    assert.ok(cards.every(m=>m.text.length>15 && m.asks.length>0));
    assert.equal(variants.length,2);
    for(const v of variantCards){assert.ok(v.text.length>35 && v.change && v.answer && v.explain);}
    for(const tab of ['learn','guide','work','talk','game']) {
      context.location.hash=`#lesson/${i}/${tab}`;await vm.runInContext('render()',context);
      const html=element('main').innerHTML,stem=html.indexOf(cards[0].text);
      for(const m of cards){assert.ok(html.includes(m.text),`${i}/${tab}缺完整母题`);for(const ask of m.asks)assert.ok(html.includes(ask));}
      const later={learn:'从题目中找出突破口',guide:'教学目标：',work:'独立练习 · 先尝试',talk:'从这句话开始',game:'先动手，再准备当老师'}[tab];
      assert.ok((tab==='talk'?html.indexOf(bank.lessons[i].detail.talkChallenge):stem)<html.indexOf(later),`${i}/${tab}必须先读当前题目再分析`);
      if(['learn','guide','work'].includes(tab))for(const v of variantCards)assert.ok(html.replace(/<[^>]+>/g,'').includes(v.text),`${i}/${tab}缺变式题干`);
      if(tab==='work') {
        assert.equal((html.match(/尝试后展开本题答案与步骤/g)||[]).length,cards.length+variantCards.length);
        assert.doesNotMatch(html,/<details class="(?:mother|variant)-solution[^>]*\sopen/);
        assert.equal((html.match(/class="question"/g)||[]).length,3);
      }
    }
  }
});

test('学生练习每次只出一道题，移除母题讲解和预先展开的解析', async () => {
  const {context,element}=page();
  vm.runInContext(`teacher=false;user={id:'student',role:'student',name:'学生',mustChange:false};
    const learner={id:'student',name:'学生',completed:[],practice:{},talk:{},notes:{},games:{},history:[],settings:{dates:{},videos:{}}};
    api=async url=>url==='/api/content'?content:learner;`,context);
  context.location.hash='#lesson/0/work';await vm.runInContext('render()',context);
  const html=element('main').innerHTML;
  assert.doesNotMatch(html,/mother-problem|lesson-variants|lesson-path|需要更多同类练习/);
  assert.equal((html.match(/data-action="practice-check"/g)||[]).length,1);
  assert.equal((html.match(/尝试后展开本题答案与步骤/g)||[]).length,0);
  assert.doesNotMatch(html,/<details class="(?:mother|variant)-solution[^>]*\sopen/);
  const independent=html.slice(html.indexOf('id="practice-0-0"'));
  assert.doesNotMatch(independent,/参考答案：|解题步骤：|查看本题解析/);
  for(const question of bank.lessons[0].practice)assert.ok(!independent.includes(question.explain));
});

test('第二课知识讲解先完成三道递增复习题，其他课程不出现该环节', async () => {
  const {context,element}=page();
  vm.runInContext(`teacher=false;user={id:'student',role:'student',name:'学生',mustChange:false};
    const learner={id:'student',name:'学生',completed:[],practice:{},talk:{},notes:{},games:{},history:[],settings:{dates:{},videos:{}}};
    api=async url=>url==='/api/content'?content:learner;`,context);

  context.location.hash='#lesson/1/learn';await vm.runInContext('render()',context);
  const lessonTwo=element('main').innerHTML;
  assert.match(lessonTwo,/上节课回顾 · 3题热身/);
  assert.match(lessonTwo,/第 1 \/ 3 题 · 基础计算/);
  assert.match(lessonTwo,/3盒彩笔和2把尺子共28元/);
  assert.ok(lessonTwo.indexOf('上节课回顾 · 3题热身')<lessonTwo.indexOf('这节课往前走一步'));
  assert.doesNotMatch(lessonTwo,/课前回顾参考答案|参考答案：4元|每把尺子4元/);

  for(const lesson of [0,2]){
    context.location.hash=`#lesson/${lesson}/learn`;await vm.runInContext('render()',context);
    assert.doesNotMatch(element('main').innerHTML,/上节课回顾 · 3题热身/);
  }
});

test('课前回顾检查答案但学生反馈不泄露标准答案', () => {
  const {context}=page();
  assert.equal(vm.runInContext("lessonWarmupCheck(0,'4元','')",context).status,'correct');
  const firstWrong=vm.runInContext("lessonWarmupCheck(0,'5','')",context);
  assert.equal(firstWrong.status,'wrong');
  assert.match(firstWrong.message,/哪一种物品数量完全相同/);
  assert.doesNotMatch(firstWrong.message,/4元|答案/);

  assert.equal(vm.runInContext("lessonWarmupCheck(1,'yes','')",context).status,'incomplete');
  assert.equal(vm.runInContext("lessonWarmupCheck(1,'yes','对应数量和总价分别相减')",context).status,'correct');
  const thirdWrong=vm.runInContext("lessonWarmupCheck(2,'35','')",context);
  assert.equal(thirdWrong.status,'wrong');
  assert.doesNotMatch(thirdWrong.message,/40元|答案/);

  vm.runInContext('lessonId=1',context);
  const finished=vm.runInContext('lessonWarmupPanel(3)',context);
  assert.match(finished,/三题热身完成/);
  assert.match(finished,/如果既不能直接消去/);
  assert.doesNotMatch(finished,/参考答案|4元|40元/);
});

test('第二课教师教案单独提供课前回顾答案和讲解', async () => {
  const {context,element}=page();
  context.location.hash='#lesson/1/guide';await vm.runInContext('render()',context);
  const html=element('main').innerHTML;
  assert.match(html,/课前回顾参考答案/);
  assert.match(html,/每把尺子4元/);
  assert.match(html,/1张成人票和1张儿童票共40元/);
  assert.ok(html.indexOf('课前回顾参考答案')<html.indexOf('本课母题'));
});
