/* AI 练习独立维护页面状态；固定题的答案与解析不经过此模块。 */
const aiPracticeUI = (() => {
 const pages = new WeakMap();
 const generating = new Set();
 const e = value => esc(value);
 const action = (label, name, extra = '') => `<button type="button" data-ai-action="${name}" ${extra}>${label}</button>`;
 const rules = () => `<aside class="ai-rules" aria-label="AI 练习规则"><span class="ai-sticker">先想一想，再问一步</span><h2>AI 陪你思考，答案由你找到。</h2><ol><li><b>只出新题、只给逐步提示。</b>不会展示标准答案或完整解答。</li><li>每题最多展开 3 级提示；先在草稿纸尝试，再提交自己的答案。</li><li><b>前测、后测作答期间暂停 AI 练习。</b>练习记录不计入测评分数。</li></ol></aside>`;
 const lessonOptions = selected => LESSONS.map((l, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>第 ${i + 1} 课 · ${e(l.title)}</option>`).join('');
 const previewing = () => typeof previewStudentId !== 'undefined' && !!previewStudentId;
 const viewOwner = () => previewing() ? user?.id + ':' + previewStudentId : user?.id;
 const isCurrent = root => root && root.isConnected && pages.has(root) && document.getElementById(root.id) === root && pages.get(root).owner === viewOwner();
 const message = (root, value, error = false) => {
  if (!isCurrent(root)) return;
  const box = root.querySelector('[data-ai-message]');
  box.textContent = value; box.classList.toggle('ai-error', error);
 };
 // 错误按状态转成固定文案，供应商响应、接口细节及密钥均不展示。
 const errorText = error => ({ 400: '设置或输入不符合要求，请检查后重试。', 401: '登录状态已失效，请重新登录。', 403: '当前不能使用此功能。若正在前后测，请先独立完成并交卷。', 409: '已有出题请求正在处理，请稍后刷新记录。', 429: '今日额度已用完，或操作太频繁，请稍后再试。', 503: 'AI 暂时不可用，请联系老师检查设置。' }[error?.status] || '这次请求没有完成，请稍后重试。');
 const ready = status => !!(status?.enabled && status.configured && status.encryptionReady && !status.blocked);
 function practicePage(options = {}) {
  const selected = Number.isInteger(options.course) && LESSONS[options.course] ? options.course : Number.isInteger(lessonId) && LESSONS[lessonId] ? lessonId : 0;
  const heading=options.embedded?'<h2>AI 拔高练习</h2><p>用本课的方法挑战新问题。遇到困难时，AI 只提示下一步。</p>':title('AI 引导练习', '选一道新题，把方法变成自己的本领。', teacher ? '<a class="ai-link" href="#ai-settings">教师 AI 设置 →</a>' : '');
  return `<div id="ai-practice-page" class="ai-page" ${options.embedded?`data-course="${selected}"`:""}>${heading}${rules()}<div class="ai-status" data-ai-status role="status">正在读取今日练习状态…</div>${teacher ? `<section class="panel ai-history-selector"><label for="ai-history-owner">查看谁的 AI 练习</label><select id="ai-history-owner"><option value="">我的教师试用记录</option>${overview.students.map(p => `<option value="${e(p.id)}">${e(p.name)} · ${e(p.className)}</option>`).join('')}</select><p class="tiny">教师试用保存在自己的账号；查看学生记录时只读。</p></section>` : ''}<section class="panel ai-generator" data-ai-generator><div class="section-head"><h2>今天，挑战哪一道？</h2><span class="tag">每次 1～3 题</span></div><form id="ai-generate-form"><div class="ai-form-grid"><div><label for="ai-lesson">练习课程</label><select id="ai-lesson" name="lesson" ${options.embedded?'disabled':''}>${lessonOptions(selected)}</select></div><div><label for="ai-difficulty">难度</label><select id="ai-difficulty" name="difficulty"><option value="1">1 · 基础巩固</option><option value="2">2 · 方法迁移</option><option value="3" ${options.difficulty===3?'selected':''}>3 · 竞赛拔高</option></select><p class="tiny">竞赛拔高包含隐藏条件、范围限制或分段推理。</p></div><div><label for="ai-count">题目数量</label><select id="ai-count" name="count"><option value="1">1 题</option><option value="2">2 题</option><option value="3">3 题</option></select></div></div><label class="ai-check"><input type="checkbox" name="rules" required>我已了解规则，会先独立尝试，不向 AI 索要答案。</label><button type="submit" disabled>生成我的新题 →</button><p class="tiny">出题可能需要约 20 秒。等待时可以切换页面，完成后回来查看记录。</p></form></section><p class="ai-message" data-ai-message role="status" aria-live="polite"></p><section class="panel ai-history"><div class="section-head"><h2>思考记录</h2>${action('刷新记录', 'refresh', 'class="quiet"')}</div><div data-ai-questions><p class="muted">正在准备练习空间…</p></div></section></div>`;
 }
 function availability(root) {
  const s = pages.get(root), status = s.status;
  const allowed = ready(status) && Number(status.remaining) >= Number(root.querySelector('#ai-count')?.value || 1);
  const form = root.querySelector('#ai-generate-form');
  if (form) form.querySelector('[type="submit"]').disabled = previewing() || !allowed || s.busy || generating.has(s.owner) || !form.elements.rules.checked;
  root.querySelectorAll('[data-ai-action="hint"], .ai-answer-form button').forEach(b => { b.disabled = previewing() || !ready(status) || s.busy || s.readOnly || s.pending.has(b.closest('[data-ai-question]')?.dataset.aiQuestion) || b.dataset.exhausted === 'true'; });
 }
 function statusView(root) {
  const s = pages.get(root), v = s.status;
  root.querySelector('[data-ai-status]').innerHTML = v.blocked ? '<b>独立测评进行中</b><span>请先完成前测或后测并交卷，再回来练习。现在无法出题、读取记录、获取提示或检查答案。</span>' : !v.enabled || !v.configured || !v.encryptionReady ? `<b>AI 练习尚未准备好</b><span>${teacher ? '请在教师 AI 设置中保存有效配置并启用。' : '请联系老师开启 AI 引导练习。'}</span>` : `<b>今日还可生成 ${e(v.remaining)} 题</b><span>已使用 ${e(v.used)} / ${e(v.dailyLimit)} 题 · ${teacher ? '教师试用额度' : '个人每日额度'}</span>`;
  if(previewing())message(root, '学生预览仅查看 AI 状态和已有记录，不生成新题或消耗学生额度。');
  availability(root);
 }
 function questionView(q, index, readOnly = false) {
  const hints = Array.isArray(q.hints) ? q.hints : [];
  const submissions = Array.isArray(q.submissions) ? q.submissions : [];
  const last = submissions[submissions.length - 1];
  const count = Math.min(3, Number(q.hintCount) || hints.length), id = e(q.id);
  const lesson = LESSONS[Number(q.lesson)];
  return `<article class="ai-question" data-ai-question="${id}"><div class="ai-question-top"><span class="ai-number">${String(index + 1).padStart(2, '0')}</span><div><span class="tag">${e(lesson?.title || q.topic || '数学思考')} · 难度 ${e(q.difficulty)}</span><p class="tiny">${e(q.createdAt ? new Date(q.createdAt).toLocaleString('zh-CN') : '')}</p></div></div><p class="ai-question-text">${e(q.text)}</p>${q.unit ? `<p class="tiny">作答单位：${e(q.unit)}</p>` : ''}${readOnly ? '' : `<form class="ai-answer-form" data-ai-id="${id}"><label>我的答案<input name="answer" aria-label="第 ${index + 1} 题我的答案" maxlength="120" autocomplete="off" required value="${e(last?.answer || '')}" placeholder="先写草稿，再填结果"></label><button type="submit" class="secondary">检查我的答案</button></form>`}<div class="ai-feedback" role="status">${last ? `<span class="ai-result ${last.correct ? 'ai-correct' : ''}">${last.correct ? '✓ 回答正确！试着讲一讲你的理由。' : '还没有答对。检查题目条件，再试一次。'}</span>` : '<span class="tiny">先独立尝试，遇到困难再看下一步提示。</span>'}</div><div class="ai-hints"><div class="section-head"><h3>思考提示 <small>${count} / 3</small></h3>${readOnly ? '' : action(count >= 3 ? '本题提示已全部展开' : `展开第 ${count + 1} 级提示`, 'hint', `class="ai-hint-button" data-id="${id}" data-exhausted="${count >= 3}" ${count >= 3 ? 'disabled' : ''}`)}</div>${hints.length ? `<ol>${hints.map(h => `<li>${e(h)}</li>`).join('')}</ol>` : '<p class="tiny">每次只打开一步，给自己留一点思考时间。</p>'}${count >= 3 ? '<p class="ai-hint-end">提示到这里。试着画图、检查条件，或把卡住的这一步讲给老师听。</p>' : ''}</div>${submissions.length ? `<details class="ai-attempts"><summary>我的尝试记录 · ${submissions.length} 次</summary><ol>${submissions.map(a => `<li><span>${e(a.answer)}</span><b>${a.correct ? '正确' : '再想一想'}</b></li>`).join('')}</ol></details>` : ''}</article>`;
 }
 function renderQuestions(root) {
  const s = pages.get(root);
  root.querySelector('[data-ai-questions]').innerHTML = s.questions.length ? s.questions.map((q, i) => questionView(q, i, s.readOnly)).join('') : `<div class="ai-empty"><span aria-hidden="true">✦</span><h3>${s.readOnly ? '这位学生还没有 AI 练习记录' : s.status?.blocked ? '交卷后再回来练习' : !ready(s.status) ? '练习空间暂未开放' : '给思考留下第一行记录'}</h3><p>${s.readOnly ? '学生在自己的账号完成尝试后，记录会显示在这里。' : !ready(s.status) ? '请按照上方状态说明完成准备，再刷新记录。' : '生成一道新题，从读懂题意开始。'}</p></div>`;
  availability(root);
 }
 async function refresh(root) {
  if (!isCurrent(root)) return;
  const s = pages.get(root), version = ++s.version;
  s.busy = true; availability(root);
  try {
   const status = await api('/api/ai/status');
   if (!isCurrent(root) || s.version !== version) return;
   s.status = status; statusView(root);
   if (status.blocked || !ready(status) && !s.readOnly) { s.questions = []; renderQuestions(root); message(root, previewing() ? '学生预览仅查看 AI 状态和已有记录，不生成新题或消耗学生额度。' : ''); return true; }
   const target = s.readOnly;
   const data = await api(target ? `/api/teacher/students/${encodeURIComponent(target)}/ai-questions` : '/api/ai/questions');
   if (!isCurrent(root) || s.version !== version) return;
   s.questions = (data.questions || []).filter(q => root.dataset?.course === undefined || Number(q.lesson) === Number(root.dataset.course)); renderQuestions(root); message(root, previewing() ? '学生预览仅查看 AI 状态和已有记录，不生成新题或消耗学生额度。' : ''); return true;
  } catch (error) {
   if (isCurrent(root) && s.version === version) { s.status = null; s.questions = []; renderQuestions(root); root.querySelector('[data-ai-status]').textContent = '状态读取未完成，请点击“刷新记录”重试。'; message(root, errorText(error), true); }
   return false;
  } finally { if (isCurrent(root) && s.version === version) { s.busy = false; availability(root); } }
 }
 async function loadPractice() {
  const root = document.getElementById('ai-practice-page');
  if (!root) return;
  pages.set(root, { owner: viewOwner(), status: null, questions: [], pending: new Set(), readOnly: '', busy: false, version: 0 });
  await refresh(root);
 }
 function settingsPage() {
  return `<div id="ai-settings-page" class="ai-page">${title('教师 AI 设置', '为自己与所属学生配置 AI 引导练习。', '<a class="ai-link" href="#ai-practice">试用 AI 练习 →</a>')}${rules()}<section class="panel ai-settings"><div class="ai-status" data-ai-settings-status role="status">正在读取设置…</div><form id="ai-settings-form" autocomplete="off"><fieldset disabled><div class="ai-form-grid ai-settings-grid"><div class="ai-wide"><label for="ai-endpoint">OpenAI 兼容接口 URL</label><input id="ai-endpoint" name="endpoint" type="url" maxlength="500" placeholder="https://api.example.com/v1" required><p class="tiny">填写服务商提供的 HTTPS 接口地址；更换域名时需同时填写对应密钥。</p></div><div><label for="ai-model">模型名称</label><input id="ai-model" name="model" placeholder="填写服务商提供的模型名称" maxlength="120" required></div><div><label for="ai-daily-limit">每人每日可生成题数</label><input id="ai-daily-limit" name="dailyLimit" type="number" min="1" max="100" step="1" required value="20"></div><div class="ai-wide"><label for="ai-api-key">API Key</label><input id="ai-api-key" name="apiKey" type="password" minlength="10" maxlength="500" autocomplete="new-password" placeholder="首次填写；留空保留已保存的密钥"><p class="tiny">密钥仅提交给服务器安全保存，不回显。每次保存后输入框会清空。</p></div></div><label class="ai-check"><input name="enabled" type="checkbox">开启 AI 引导练习，允许所属学生使用</label><div class="controls"><button type="submit">保存设置</button>${action('测试已保存配置', 'test-settings', 'class="secondary"')}</div><p class="tiny">先保存，再测试连接。测试使用服务器中的配置，不会生成学生练习题。</p></fieldset></form>${action('重新读取设置', 'retry-settings', 'class="quiet"')}<p class="ai-message" data-ai-message role="status" aria-live="polite"></p></section></div>`;
 }
 function applySettings(root, data) {
  const form = root.querySelector('form');
  form.elements.endpoint.value = data.endpoint || ''; form.elements.model.value = data.model || '';
  form.elements.dailyLimit.value = data.dailyLimit ?? 20; form.elements.enabled.checked = !!data.enabled;
  form.elements.apiKey.value = '';
  root.querySelector('[data-ai-settings-status]').textContent = !data.encryptionReady ? '密钥加密环境尚未就绪，请由平台管理员检查。' : `${data.configured ? '已保存密钥' : '尚未保存密钥'} · ${data.enabled ? '已开启 AI 练习' : 'AI 练习未开启'}`;
 }
 async function loadSettings() {
  const root = document.getElementById('ai-settings-page');
  if (!root) return;
  pages.set(root, { owner: viewOwner(), busy: true });
  try { const data = await api('/api/teacher/ai-settings'); if (!isCurrent(root)) return; applySettings(root, data); root.querySelector('fieldset').disabled = false; message(root, ''); }
  catch (error) { if (isCurrent(root)) root.querySelector('[data-ai-settings-status]').textContent = '设置读取未完成，请点击“重新读取设置”重试。'; message(root, errorText(error), true); }
  finally { if (isCurrent(root)) pages.get(root).busy = false; }
 }
 async function generate(root, form) {
  const s = pages.get(root);
  if (s.busy || s.readOnly || generating.has(s.owner) || form.querySelector('[type="submit"]').disabled) return;
  s.busy = true; generating.add(s.owner); availability(root); message(root, '正在准备新题，请稍等。你也可以先去其他课程看看。');
  try {
   await api('/api/ai/generate', { method: 'POST', body: { lesson: Number(form.elements.lesson.value), difficulty: Number(form.elements.difficulty.value), count: Number(form.elements.count.value) } });
   if (!isCurrent(root)) return;
   if (await refresh(root)) message(root, '新题已准备好。先读题，在草稿纸上试一试。');
  } catch (error) { message(root, errorText(error), true); }
  finally {
   generating.delete(s.owner);
   if (isCurrent(root)) { s.busy = false; availability(root); }
   // 返回同一账号的新页面时只解除等待状态，不把旧页面的数据写过去。
   const current = document.getElementById('ai-practice-page');
   if (current !== root && isCurrent(current)) { availability(current); if (pages.get(current).owner === s.owner) message(current, '上次出题请求已结束，请刷新记录查看结果。'); }
  }
 }
 async function questionAction(root, id, kind, answer) {
  const s = pages.get(root), version = s.version;
  if (s.readOnly || s.busy || !ready(s.status) || s.pending.has(id)) return;
  const q = s.questions.find(q => String(q.id) === id);
  if (!q || kind === 'hint' && Number(q.hintCount) >= 3) return;
  s.pending.add(id); availability(root); message(root, kind === 'hint' ? '正在展开下一步提示…' : '正在检查你的答案…');
  try {
   const data = await api(`/api/ai/questions/${encodeURIComponent(id)}/${kind}`, { method: 'POST', body: kind === 'answer' ? { answer } : {} });
   if (!isCurrent(root) || s.version !== version) return;
   if (kind === 'hint') { q.hints = [...(q.hints || []), data.hint]; q.hintCount = data.hintCount; }
   else q.submissions = [...(q.submissions || []), { answer, correct: data.correct === true, date: data.date }];
   // 只替换当前题目，保留其他题尚未提交的输入。
   const card = [...root.querySelectorAll('[data-ai-question]')].find(el => el.dataset.aiQuestion === id);
   const draft = kind === 'hint' ? card?.querySelector('[name="answer"]')?.value : undefined;
   if (card) {
    card.outerHTML = questionView(q, s.questions.indexOf(q));
    // 展开提示时保留学生尚未提交的答案，避免打断思考。
    if (draft !== undefined) {
     const updated = [...root.querySelectorAll('[data-ai-question]')].find(el => el.dataset.aiQuestion === id);
     const input = updated?.querySelector('[name="answer"]'); if (input) input.value = draft;
    }
   }
   message(root, kind === 'hint' ? '提示已展开。先试着完成这一步。' : data.correct ? '回答正确！试着说出你的思路。' : '还没有答对。检查条件，或展开下一步提示。');
  } catch (error) { if (s.version === version) message(root, errorText(error), true); }
  finally { s.pending.delete(id); if (isCurrent(root)) availability(root); }
 }
 async function saveSettings(root, form) {
  const s = pages.get(root); if (s.busy) return;
  const body = { endpoint: form.elements.endpoint.value.trim(), model: form.elements.model.value.trim(), enabled: form.elements.enabled.checked, dailyLimit: Number(form.elements.dailyLimit.value) };
  if (form.elements.apiKey.value.trim()) body.apiKey = form.elements.apiKey.value.trim();
  s.busy = true; root.querySelector('fieldset').disabled = true; message(root, '正在安全保存设置…');
  try {
   await api('/api/teacher/ai-settings', { method: 'PUT', body });
   if (!isCurrent(root)) return;
   form.elements.apiKey.value = '';
   const data = await api('/api/teacher/ai-settings');
   if (isCurrent(root)) { applySettings(root, data); message(root, '设置已保存。可以测试已保存配置。'); }
  } catch (error) { message(root, errorText(error), true); }
  finally { delete body.apiKey; form.elements.apiKey.value = ''; if (isCurrent(root)) { s.busy = false; root.querySelector('fieldset').disabled = false; } }
 }
 document.addEventListener('submit', event => {
  const form = event.target, root = form.closest('.ai-page');
  if (!root || !isCurrent(root)) return;
  if (!['ai-generate-form', 'ai-settings-form'].includes(form.id) && !form.classList.contains('ai-answer-form')) return;
  event.preventDefault();
  if (form.id === 'ai-generate-form') void generate(root, form);
  else if (form.id === 'ai-settings-form') void saveSettings(root, form);
  else if (form.elements.answer.value.trim()) void questionAction(root, form.dataset.aiId, 'answer', form.elements.answer.value.trim());
 });
 document.addEventListener('change', event => {
  const root = event.target.closest('#ai-practice-page'); if (!isCurrent(root)) return;
  if (event.target.id === 'ai-history-owner') {
   const s = pages.get(root); s.readOnly = event.target.value;
   root.querySelector('[data-ai-generator]').hidden = !!s.readOnly;
   root.querySelector('[data-ai-questions]').innerHTML = '<p class="muted">正在读取记录…</p>';
   void refresh(root);
  } else availability(root);
 });
 document.addEventListener('click', async event => {
  const b = event.target.closest('[data-ai-action]'); if (!b || b.disabled) return;
  const root = b.closest('.ai-page'); if (!isCurrent(root)) return;
  const s = pages.get(root);
  if (b.dataset.aiAction === 'retry-settings') { if (!s.busy) await loadSettings(); return; }
  if (b.dataset.aiAction === 'hint') { void questionAction(root, b.dataset.id, 'hint'); return; }
  if (b.dataset.aiAction === 'refresh') { if (!s.busy) await refresh(root); return; }
  if (b.dataset.aiAction === 'test-settings' && !s.busy) {
   s.busy = true; root.querySelector('fieldset').disabled = true; message(root, '正在测试已保存配置，请稍等…');
   try { await api('/api/teacher/ai-settings/test', { method: 'POST', body: {} }); message(root, '连接测试通过，可以开始 AI 引导练习。'); }
   catch (error) { message(root, errorText(error), true); }
   finally { if (isCurrent(root)) { s.busy = false; root.querySelector('fieldset').disabled = false; } }
  }
 });
 return { practicePage, loadPractice, settingsPage, loadSettings };
})();
function aiPracticePage(options) { return aiPracticeUI.practicePage(options); }
function loadAiPractice() { return aiPracticeUI.loadPractice(); }
function aiSettingsPage() { return aiPracticeUI.settingsPage(); }
function loadAiSettings() { return aiPracticeUI.loadSettings(); }
