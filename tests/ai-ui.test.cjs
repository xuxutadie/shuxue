const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// 使用最小 DOM 验证异步页面边界和信息泄露，不需要额外浏览器依赖。
function harness(respond = async () => ({}), isTeacher = false) {
 const handlers = {}, roots = new Map(), calls = [];
 const context = vm.createContext({
  console, Set, WeakMap, Date, encodeURIComponent,
  user: { id: 'user-1' }, teacher: isTeacher, lessonId: 4,
  LESSONS: Array.from({ length: 12 }, (_, i) => ({ title: `课程${i + 1}` })),
  overview: { students: [{ id: 'student-1', name: '<小禾>', className: '五年级' }] },
  esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  title: (name, description, extra = '') => `<h1>${name}</h1><p>${description}</p>${extra}`,
  api: async (url, options = {}) => { calls.push({ url, options }); return respond(url, options); },
  document: { getElementById: id => roots.get(id) || null, addEventListener: (name, handler) => { handlers[name] = handler; } }
 });
 vm.runInContext(fs.readFileSync('public/ai-practice.js', 'utf8'), context);
 const run = text => vm.runInContext(text, context);
 function mount(kind = 'practice') {
  const id = kind === 'practice' ? 'ai-practice-page' : 'ai-settings-page';
  const nodes = new Map();
  const node = selector => {
   if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', disabled: false, value: '', checked: false, classList: { toggle() {} } });
   return nodes.get(selector);
  };
  const root = { id, isConnected: true, querySelector: node, querySelectorAll: () => [] };
  const form = node(kind === 'practice' ? '#ai-generate-form' : 'form');
  form.id = kind === 'practice' ? 'ai-generate-form' : 'ai-settings-form';
  form.elements = Object.fromEntries(['rules', 'lesson', 'difficulty', 'count', 'answer', 'endpoint', 'model', 'dailyLimit', 'enabled', 'apiKey'].map(k => [k, { value: '', checked: false }]));
  Object.assign(form.elements.rules, { checked: true });
  form.elements.lesson.value = '4'; form.elements.difficulty.value = '2'; form.elements.count.value = '1';
  form.querySelector = node; form.closest = () => root;
  node('#ai-count').value = '1';
  roots.set(id, root);
  return { root, node, form };
 }
 return { context, run, mount, handlers, calls, roots };
}
const available = { enabled: true, configured: true, encryptionReady: true, blocked: false, remaining: 10, used: 0, dailyLimit: 10 };
const question = { id: 'q-1', lesson: 0, difficulty: 1, text: '<script>危险文本</script>求总数。', unit: '个', hints: ['先看看条件。'], hintCount: 1, answer: '私有标准答案', explanation: '完整解答不允许展示', submissions: [{ answer: '<b>我填的数</b>', correct: false, date: '' }] };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('练习页默认当前课程、12课可选，规则醒目且没有自由聊天入口', () => {
 const h = harness(undefined, true), html = h.run('aiPracticePage()');
 assert.match(html, /value="4" selected/);
 assert.equal((html.match(/第 \d+ 课/g) || []).length, 12);
 assert.match(html, /不会展示标准答案或完整解答/);
 assert.match(html, /前测、后测作答期间暂停/);
 assert.match(html, /&lt;小禾&gt;/);
 assert.doesNotMatch(html, /data-action=|textarea|type="password"/);
});

test('活跃测评时不读取历史，禁用出题', async () => {
 const h = harness(async () => ({ ...available, blocked: true })), p = h.mount();
 await h.run('loadAiPractice()');
 assert.deepEqual(h.calls.map(c => c.url), ['/api/ai/status']);
 assert.equal(p.node('[type="submit"]').disabled, true);
 assert.match(p.node('[data-ai-status]').innerHTML, /独立测评进行中/);
});

test('历史只显示学生输入、正确与否和已展开提示，忽略私有答案字段并转义文本', async () => {
 const h = harness(async url => url.endsWith('/status') ? available : { questions: [question] }), p = h.mount();
 await h.run('loadAiPractice()');
 const html = p.node('[data-ai-questions]').innerHTML;
 assert.match(html, /&lt;script&gt;危险文本&lt;\/script&gt;/);
 assert.match(html, /&lt;b&gt;我填的数&lt;\/b&gt;/);
 assert.match(html, /先看看条件/);
 assert.doesNotMatch(html, /私有标准答案|完整解答不允许展示|<script>/);
});

test('离开页面后的响应不得覆盖新页面，也不会继续读取历史', async () => {
 let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })), old = h.mount();
 const pending = h.run('loadAiPractice()');
 old.root.isConnected = false; const next = h.mount();
 finish(available); await pending;
 assert.equal(h.calls.length, 1);
 assert.equal(next.node('[data-ai-questions]').innerHTML, '');
});

test('账号切换后丢弃上一账号的迟到响应', async () => {
 let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })), p = h.mount();
 const pending = h.run('loadAiPractice()'); h.context.user = { id: 'user-2' };
 finish(available); await pending;
 assert.equal(h.calls.length, 1); assert.equal(p.node('[data-ai-status]').innerHTML, '');
});

test('错误不展示服务商原文或密钥片段', async () => {
 const h = harness(async () => { throw Object.assign(new Error('供应商泄露 sk-secret-raw'), { status: 500 }); }), p = h.mount();
 await h.run('loadAiPractice()');
 assert.equal(p.node('[data-ai-message]').textContent, '这次请求没有完成，请稍后重试。');
 assert.doesNotMatch(p.node('[data-ai-message]').textContent, /sk-secret/);
});

test('出题等待中连击只发一次，课程难度和数量为受限数字参数', async () => {
 let finish;
 const h = harness(async url => url.endsWith('/status') ? available : url.endsWith('/generate') ? new Promise(resolve => { finish = resolve; }) : { questions: [] }), p = h.mount();
 await h.run('loadAiPractice()');
 const event = { target: p.form, preventDefault() {} };
 h.handlers.submit(event); h.handlers.submit(event);
 assert.equal(h.calls.filter(c => c.url.endsWith('/generate')).length, 1);
 const payload = h.calls.find(c => c.url.endsWith('/generate')).options.body;
 assert.equal(payload.lesson, 4); assert.equal(payload.difficulty, 2); assert.equal(payload.count, 1);
 finish({ questions: [question] }); await flush();
 assert.equal(p.node('[type="submit"]').disabled, false);
});

test('教师设置不回显服务器的密钥；保存留空时不覆盖已有密钥', async () => {
 const settings = { endpoint: 'https://example.com/v1', model: 'math', dailyLimit: 10, enabled: true, encryptionReady: true, configured: true, apiKey: '绝不回显的密钥' };
 const h = harness(async () => settings, true), p = h.mount('settings');
 await h.run('loadAiSettings()');
 assert.equal(p.form.elements.apiKey.value, '');
 assert.equal(p.form.elements.endpoint.value, settings.endpoint);
 h.handlers.submit({ target: p.form, preventDefault() {} }); await flush();
 const write = h.calls.find(c => c.options.method === 'PUT');
 assert.equal(Object.hasOwn(write.options.body, 'apiKey'), false);
 assert.equal(p.form.elements.apiKey.value, '');
 assert.match(p.node('[data-ai-message]').textContent, /设置已保存/);
});

test('保存失败也清空密钥输入，不把服务商错误写入页面', async () => {
 const h = harness(async (url, options) => { if (options.method === 'PUT') throw new Error('sk-secret-raw'); return { encryptionReady: true }; }, true), p = h.mount('settings');
 await h.run('loadAiSettings()'); p.form.elements.apiKey.value = 'sk-local-secret';
 h.handlers.submit({ target: p.form, preventDefault() {} }); await flush();
 assert.equal(p.form.elements.apiKey.value, '');
 assert.doesNotMatch(p.node('[data-ai-message]').textContent, /sk-/);
});

test('配置停用、未配置或加密环境未就绪时不请求被后端禁止的个人历史', async () => {
 for (const state of [{ enabled: false }, { configured: false }, { encryptionReady: false }]) {
  const h = harness(async () => ({ ...available, ...state })), p = h.mount();
  await h.run('loadAiPractice()');
  assert.deepEqual(h.calls.map(c => c.url), ['/api/ai/status']);
  assert.equal(p.node('[type="submit"]').disabled, true);
  assert.equal(p.node('[data-ai-message]').textContent, '');
  assert.match(p.node('[data-ai-questions]').innerHTML, /练习空间暂未开放/);
 }
});

test('教师未创建学生也能显示本人试用及配置入口', () => {
 const h = harness(undefined, true); h.context.overview.students = [];
 const html = h.run('aiPracticePage()');
 assert.match(html, /我的教师试用记录/);
 assert.match(html, /href="#ai-settings"/);
 assert.doesNotMatch(html, /undefined|NaN/);
 const settings = h.run('aiSettingsPage()');
 assert.match(settings, /name="model"[^>]+maxlength="120"/);
 assert.match(settings, /name="apiKey"[^>]+maxlength="500"/);
 assert.match(settings, /data-ai-action="retry-settings"/);
});

test('停用配置后教师仍能只读查看所属学生历史', async () => {
 const h = harness(async url => url.endsWith('/status') ? { ...available, enabled: false } : { questions: [question] }, true), p = h.mount();
 await h.run('loadAiPractice()');
 h.handlers.change({ target: { id: 'ai-history-owner', value: 'student-1', closest: () => p.root } }); await flush();
 assert.equal(h.calls.at(-1).url, '/api/teacher/students/student-1/ai-questions');
 assert.equal(p.node('[data-ai-generator]').hidden, true);
 assert.match(p.node('[data-ai-questions]').innerHTML, /我填的数/);
 assert.doesNotMatch(p.node('[data-ai-questions]').innerHTML, /class="ai-answer-form"|data-ai-action="hint"/);
});

test('状态刷新失败后禁用生成，重试成功后恢复', async () => {
 let fail = false;
 const h = harness(async url => { if (fail) throw new Error('断网'); return url.endsWith('/status') ? available : { questions: [] }; }), p = h.mount();
 await h.run('loadAiPractice()'); assert.equal(p.node('[type="submit"]').disabled, false);
 const b = { dataset: { aiAction: 'refresh' }, disabled: false, closest: () => p.root }, event = { target: { closest: () => b } };
 fail = true; await h.handlers.click(event);
 assert.equal(p.node('[type="submit"]').disabled, true);
 assert.match(p.node('[data-ai-status]').textContent, /读取未完成/);
 fail = false; await h.handlers.click(event);
 assert.equal(p.node('[type="submit"]').disabled, false);
});

test('教师设置初次读取失败可以原页重试', async () => {
 let fail = true;
 const h = harness(async () => { if (fail) throw new Error('断网'); return { encryptionReady: true, model: 'math' }; }, true), p = h.mount('settings');
 p.node('fieldset').disabled = true;
 await h.run('loadAiSettings()'); assert.equal(p.node('fieldset').disabled, true);
 fail = false;
 const b = { dataset: { aiAction: 'retry-settings' }, disabled: false, closest: () => p.root };
 await h.handlers.click({ target: { closest: () => b } });
 assert.equal(p.node('fieldset').disabled, false);
 assert.equal(p.form.elements.model.value, 'math');
});

test('真实 app 全局提交处理器不会重复处理 AI 配置表单', async () => {
 const h = harness(async () => ({ encryptionReady: true, configured: true }), true), p = h.mount('settings');
 await h.run('loadAiSettings()');
 const aiSubmit = h.handlers.submit;
 const app = fs.readFileSync('public/app.js', 'utf8');
 const start = app.indexOf("document.addEventListener('submit',");
 const end = app.indexOf("document.addEventListener('click',", start);
 vm.runInContext(app.slice(start, end), h.context);
 const event = { target: p.form, preventDefault() {} };
 await h.handlers.submit(event); aiSubmit(event); await flush();
 assert.equal(h.calls.filter(c => c.options.method === 'PUT').length, 1);
});
