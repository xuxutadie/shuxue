const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createLearningDataSource } = require('../public/data-loader');
const { lessons, bank } = require('../server/content');
const teacher = { id: 'teacher-one', role: 'teacher' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('首次请求并行，连点共享请求，切页复用课程与30秒内的档案', async () => {
 let time = 0;
 const calls = [], pending = [];
 const loader = createLearningDataSource(url => { calls.push(url); const task = deferred(); pending.push(task); return task.promise; }, { now: () => time });
 const first = loader.load(teacher), second = loader.load(teacher);
 await Promise.resolve();
 assert.deepEqual(calls, ['/api/content', '/api/teacher/overview']);
 pending[0].resolve('课程'); pending[1].resolve('档案');
 assert.deepEqual(await first, await second);
 time = 29999; await loader.load(teacher); assert.equal(calls.length, 2);
 time = 30000; const expired = loader.load(teacher); await Promise.resolve();
 assert.equal(calls.length, 3); assert.equal(calls[2], '/api/teacher/overview');
 pending[2].resolve('新档案'); assert.equal((await expired).records, '新档案');
});

test('保存成功后刷新档案；旧请求不能覆盖保存后数据', async () => {
 const old = deferred(); let reads = 0;
 const loader = createLearningDataSource(url => url === '/api/content' ? '课程' : ++reads === 1 ? old.promise : '保存后档案');
 const first = loader.load(teacher); await Promise.resolve();
 loader.invalidate(); old.resolve('保存前档案');
 assert.equal((await first).records, '保存后档案');
 assert.equal(reads, 2);
 await loader.load(teacher, { fresh: true }); assert.equal(reads, 3);
});

test('退出或切换账号不复用教师数据，不接收上一账号的迟到响应', async () => {
 const old = deferred(); let contentReads = 0;
 const loader = createLearningDataSource(url => url === '/api/content' ? ++contentReads === 1 ? old.promise : '学生课程' : url);
 const previous = loader.load(teacher); await Promise.resolve();
 loader.reset();
 const next = await loader.load({ id: 'student-two', role: 'student' });
 assert.equal(next.content, '学生课程'); assert.equal(next.records, '/api/students/student-two');
 old.resolve('教师答案'); await assert.rejects(previous, error => error.obsolete === true);
 assert.deepEqual(await loader.load({ id: 'student-two', role: 'student' }), next);
});

test('网络失败不留下永久失败的缓存，下次点击能恢复', async () => {
 let fail = true;
 const loader = createLearningDataSource(async url => { if (fail) throw new Error('断网'); return url; });
 await assert.rejects(loader.load(teacher), /断网/); fail = false;
 assert.equal((await loader.load(teacher)).content, '/api/content');
});

// 用真实页面代码验证请求数量、导航和保存后的刷新，不依赖浏览器插件。
function page() {
 const nodes = new Map(), listeners = new Map(), calls = [];
 const element = id => {
  if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', hidden: false, style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, focus(){}, querySelector(){ return null; } });
  return nodes.get(id);
 };
 const material = { lessons: lessons(true), flow: bank.flow, testFlow: bank.testFlow };
 const context = vm.createContext({ console, URL, setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async (url, options) => {
   calls.push({ url, method: options.method || 'GET' });
   await new Promise(resolve => setTimeout(resolve, 30));
   return { ok: true, json: async () => url === '/api/content' ? material : url === '/api/teacher/overview' ? { classes: [], students: [] } : { ok: true } };
  }, document: { getElementById: element, addEventListener(name, handler){ listeners.set(name, handler); }, body: element('body') },
  window: { addEventListener(){} }, location: { hash: '#courses' } });
 for (const name of ['course-videos.js', 'figures.js', 'lesson-lab.js', 'games.js', 'teacher-flow.js', 'views.js', 'data-loader.js', 'class-dashboard.js','exam-analysis.js','practice-workspace.js','homework-text.js','homework.js','app.js']) {
  vm.runInContext(fs.readFileSync('public/' + name, 'utf8').replace(/^startSession\(\);/m, ''), context);
 }
 const run = code => vm.runInContext(code, context);
 run("user={id:'teacher-one',role:'teacher',name:'老师'};teacher=true;");
 return { run, context, calls, element };
}

test('真实页面切换各教学环节不再重复请求；保存后重新读取档案但不重下课程', async () => {
 const p = page(); await p.run('render()');
 assert.equal(p.calls.length, 2);
 for (const hash of ['#lesson/0/learn', '#lesson/0/guide', '#lesson/0/talk', '#lesson/0/work', '#lesson/1/teach/0', '#courses']) {
  p.context.location.hash = hash; await p.run('render()');
  assert.doesNotMatch(p.element('main').innerHTML, /暂时没能加载|undefined|NaN/);
 }
 assert.equal(p.calls.length, 2);
 await p.run("api('/api/teacher/classes',{method:'POST',body:{name:'测试'}})");
 await p.run('render()');
 assert.equal(p.calls.filter(x => x.url === '/api/content').length, 1);
 assert.equal(p.calls.filter(x => x.url === '/api/teacher/overview').length, 2);
});

test('学生测评并入练习页，旧入口兼容，测评与错题不出现课程筛选',async()=>{
 const p=page();p.context.material={lessons:lessons(false),flow:bank.flow,testFlow:bank.testFlow};
 p.run("teacher=false;user={id:'student-one',role:'student',name:'学生'};var learner={id:'student-one',name:'学生',completed:[],practice:{},talk:{},notes:{},games:{},history:[],exams:{},drafts:{},assignments:{},settings:{dates:{},videos:{}}};api=async url=>url==='/api/content'?material:learner;");
 p.context.location.hash='#exams';await p.run('render()');assert.equal(p.context.location.hash,'practice/exams');
 p.context.location.hash='#practice/exams';await p.run('render()');
 const html=p.element('main').innerHTML;
 assert.match(html,/前测 A 卷/);assert.match(html,/后测 B 卷/);assert.equal((html.match(/<h1>/g)||[]).length,1);assert.doesNotMatch(html,/id="practice-course"/);
 assert.doesNotMatch(p.element('nav').innerHTML,/#exams/);assert.match(p.element('nav').innerHTML,/#practice/);
 p.context.location.hash='#practice/wrong';await p.run('render()');assert.match(p.element('main').innerHTML,/id="exam-wrong-list"/);assert.doesNotMatch(p.element('main').innerHTML,/id="practice-course"/);
});

test('教师切换学生后使用与学生直接登录相同的页面外观，只额外显示返回教师端',()=>{
 const p=page();
 p.run(`var learner={id:'student-one',username:'xiaoming',name:'小明',className:'五年级思维班',completed:[],practice:{},talk:{},notes:{},games:{},history:[],exams:{},drafts:{},assignments:{},settings:{dates:{},videos:{}}};
   route='home';state.students=[learner];state.current=learner.id;overview={classes:[],students:[learner]};`);
 const view=()=>JSON.parse(p.run(`JSON.stringify({
   nav:document.getElementById('nav').innerHTML,
   role:document.getElementById('role-badge').textContent,
   identity:document.getElementById('identity').textContent,
   selectorHidden:document.getElementById('student').hidden,
   refreshHidden:document.getElementById('refresh-data').hidden,
   accountHidden:document.getElementById('account-button').hidden,
   logoutHidden:document.getElementById('logout').hidden,
   bannerHidden:document.getElementById('student-preview-banner').hidden
 })`));
 p.run(`user={id:learner.id,username:learner.username,role:'student',name:learner.name,mustChange:false};teacher=false;previewStudentId=null;shell();`);
 const studentView=view(),studentAccount=p.run('passwordView()');
 p.run(`user={id:'teacher-one',username:'teacher',role:'teacher',name:'老师',mustChange:false};teacher=false;previewStudentId=learner.id;shell();`);
 assert.deepEqual(view(),studentView);
 assert.equal(p.element('student-preview-toggle').hidden,false);
 assert.equal(p.element('student-preview-toggle').textContent,'返回教师端');
 assert.equal(p.element('student-preview-banner').innerHTML,'');
 assert.equal(p.run('passwordView()'),studentAccount);
});
