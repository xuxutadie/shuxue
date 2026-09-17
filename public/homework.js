/* 错题变式作业：教师先审核后发布；学生页面只读取公开题干与分级提示。 */
const homeworkUI = (() => {
 const states = new WeakMap();
 const dateText = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '不限时间';
 const localDate = value => { if (!value) return ''; const d = new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
 const active = root => root?.isConnected && document.getElementById('homework-page') === root && states.get(root)?.owner === user?.id && states.get(root)?.preview === previewStudentId;
 const action = (label, name, attrs = '') => `<button type="button" data-homework-action="${name}" ${attrs}>${label}</button>`;
 const stem = (source, text) => {
  return homeworkSegments(source,text).map(s=>s.changed?`<strong class="homework-change">${esc(s.text)}</strong>`:esc(s.text)).join('');
 };
 function page(id = '') {
  return `<section id="homework-page" data-id="${esc(id)}"><div class="section-head"><div><span class="tag">从错题出发，练会一种方法</span><h${teacher?'1':'2'}>${teacher?'变式作业':'老师布置的作业'}</h${teacher?'1':'2'}></div>${teacher?'<a href="#home">← 班级工作台</a>':'<a href="#practice/homework">作业列表</a>'}</div><p class="homework-message" role="status">正在读取作业…</p><div data-homework-body></div></section>`;
 }
 function message(root, text) { if(active(root))root.querySelector('.homework-message').textContent=text; }
 function list(items) {
  return `${teacher?'<p>在班级工作台展开错题，点击“设计变式作业”。先审核题目，再选择学生发布。</p>':'<p>可以打草稿；每道题提交后自动保存。提示只引导下一步，不展示标准答案。截止后仍可补做，会标记逾期。</p>'}${items.length?`<div class="homework-list">${items.map(h=>`<article class="panel homework-card"><span class="tag">${teacher?(h.status==='draft'?'待审核草稿':'已发布'):h.completedAt?'已完成，可巩固':'待完成'}</span><h3>${esc(h.title)}</h3><p>${esc(h.sourceLabel)}</p><p>${h.questionCount}道题 · 截止：${esc(dateText(h.dueAt))}</p><p class="tiny">${teacher?h.status==='draft'?'题目尚未发给学生':`完成 ${h.completedCount} / ${h.assignedCount} 人`:`已尝试 ${h.attempted} / ${h.total} 题${h.late?' · 逾期完成':''}`}</p><a class="homework-link" href="${teacher?'#homework/':'#practice/homework/'}${h.id}">${teacher?h.status==='draft'?'继续编辑与布置 →':'查看训练效果 →':h.completedAt?'查看与再练 →':'开始作业 →'}</a></article>`).join('')}</div>`:'<div class="panel empty">'+(teacher?'还没有变式作业，请从班级工作台的错题开始。':'暂时没有老师布置的变式作业。')+'</div>'}`;
 }
 function sourceView(h) {
  return `<details class="panel homework-source" open><summary>原题 · ${esc(h.sourceLabel)}</summary><p class="qtext">${esc(h.source.text)}</p>${h.source.svg||''}<details><summary>原题参考答案与解析（教师）</summary><p>${esc(h.source.answer)}</p><p>${esc(h.source.explain)}</p></details></details>`;
 }
 function editor(h) {
  const people=overview.students.filter(p=>!p.accountDisabled);
  return `<p><a href="#homework">← 全部变式作业</a></p><ol class="homework-steps"><li>选择错题</li><li class="active">编题与审核</li><li>指定学生发布</li><li>查看训练效果</li></ol>${sourceView(h)}<form id="homework-editor"><fieldset><section class="panel"><h2>1. 编写或生成变式题</h2><p>每份1～3题。AI 题目是草稿，请检查数学条件、唯一答案和解析后再发布。只发送原题内容给模型，不发送学生身份或答题记录。</p><label for="hw-title">作业名称</label><input id="hw-title" name="title" value="${esc(h.title)}" maxlength="100" required><div class="controls homework-generator"><label>难度<select name="difficulty"><option value="1">基础巩固</option><option value="2" selected>同难度变式</option><option value="3">拔高训练</option></select></label><label>题数<select name="count"><option value="1">1题</option><option value="2">2题</option><option value="3">3题</option></select></label>${action('AI 生成草稿','generate',h.questions.length?'disabled':'')}<a href="#ai-settings">AI 设置</a></div><p class="tiny">使用教师现有 AI 配置及每日额度；不配置 AI 也可手动编题。已有题目不会被重新生成覆盖。</p><div data-homework-questions>${h.questions.map((q,i)=>`<article class="homework-edit-question" data-hw-question="${i}"><div class="section-head"><h3>变式 ${i+1}</h3>${action('移除此题','remove',`class="quiet" data-index="${i}"`)}</div><label for="hw-text-${i}">完整题目（所有条件写全，只问一个填空结果）</label><textarea id="hw-text-${i}" name="text${i}" rows="4" maxlength="1200" required>${esc(q.text)}</textarea><div class="homework-stem-preview" data-hw-stem="${i}">${stem(h.source.text,q.text)}</div><p class="tiny">红字标记与原题不同的区域。学生看到的是完整题目。</p><div class="grid-two"><label>参考答案<input name="answer${i}" maxlength="120" required value="${esc(q.answer)}"></label><label>单位（可留空）<input name="unit${i}" maxlength="20" value="${esc(q.unit)}"></label></div><label>完整解析（仅教师可见）<textarea name="explain${i}" rows="3" maxlength="2000" required>${esc(q.explain)}</textarea></label></article>`).join('')}</div>${action('＋ 手动添加一道题','add',`class="secondary" ${h.questions.length>=3?'disabled':''}`)}</section><section class="panel"><h2>2. 选择学生与截止时间</h2><p>创建时默认选择原题答错或未作答的学生，可调整为个别学生或全班。</p><div class="controls"><label>快速选班<select data-hw-class><option value="">全部班级</option>${overview.classes.map(c=>`<option value="${c.id}" ${h.source.classId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>${action('选中该班学生','select-class','class="secondary"')}${action('清空选择','clear-students','class="quiet"')}</div><div class="homework-recipients">${people.map(p=>`<label><input type="checkbox" name="studentIds" value="${p.id}" ${h.studentIds.includes(p.id)?'checked':''}> <span><b>${esc(p.name)}</b><small>${esc(p.className)} · ${esc(p.username)}</small></span></label>`).join('')||'<p>还没有可布置的学生。</p>'}</div><label for="hw-due">截止时间（可不设置，按本机时区）</label><input id="hw-due" name="dueAt" type="datetime-local" value="${localDate(h.dueAt)}"><p class="tiny">截止后可补做并标记逾期，不影响正式测评分数。</p></section><section class="panel"><h2>3. 审核后发布</h2><p>学生只得到以下三步提示，不提供自由聊天或直接答案：</p><ol><li>列出已知条件，圈出所求的量。</li><li>回想方法，画图或建立关系。</li><li>代回条件检查；卡住时向老师说明思路。</li></ol><label class="homework-review"><input name="reviewed" type="checkbox">我已核对每题条件、答案、解析，以及提示不透露答案。</label><div class="controls">${action('保存草稿','save','class="secondary"')}${action('确认发布作业','publish')}</div><p class="tiny">发布后冻结题目和名单，保留学生作答依据。更换题目请从原题新建作业。</p></section></fieldset></form>`;
 }
 function report(h) {
  const n=h.students.length,done=h.students.filter(s=>s.completedAt).length,attempts=h.students.reduce((sum,s)=>sum+s.attempted,0),first=h.students.reduce((sum,s)=>sum+s.firstCorrect,0),latest=h.students.reduce((sum,s)=>sum+s.latestCorrect,0);
  return `<p><a href="#homework">← 全部变式作业</a></p><h2>${esc(h.title)}</h2><p>截止：${esc(dateText(h.dueAt))} · 发布后题目已冻结</p><div class="class-kpis"><article class="class-kpi"><span>作业完成</span><strong>${done}<small> / ${n}人</small></strong></article><article class="class-kpi"><span>首次答对</span><strong>${attempts?Math.round(first/attempts*100)+'%':'—'}</strong><small>${first} / ${attempts}道已尝试题</small></article><article class="class-kpi"><span>最近答对</span><strong>${attempts?Math.round(latest/attempts*100)+'%':'—'}</strong><small>${latest} / ${attempts}道已尝试题</small></article><article class="class-kpi"><span>全部变式首次答对</span><strong>${h.students.filter(s=>s.firstCorrect===h.questionCount).length}<small> 人</small></strong></article></div><p class="tiny">原题结果是发布时的同版本记录；未参加该版本显示“无同版记录”。首次结果可能使用提示，需结合下方提示次数判断是否独立掌握。</p><section class="panel"><h2>学生训练情况</h2>${h.students.length?`<div class="table-wrap"><table><thead><tr><th>学生</th><th>原题</th><th>尝试 / 总题</th><th>首次答对</th><th>最近答对</th><th>状态</th></tr></thead><tbody>${h.students.map(s=>`<tr><td>${esc(s.name)}<small>${esc(s.className)} · ${esc(s.username)}</small></td><td>${s.originalCorrect===null?'无同版记录':s.originalCorrect?'答对':'答错 / 空题'}</td><td>${s.attempted} / ${s.total}</td><td>${s.attempted?s.firstCorrect:'—'}</td><td>${s.attempted?s.latestCorrect:'—'}</td><td>${s.completedAt?(s.late?'逾期完成':'已完成'):h.dueAt&&Date.now()>Date.parse(h.dueAt)?'逾期未完成':'待完成'}</td></tr>`).join('')}</tbody></table></div>`:'<p>暂无可查看的学生记录。</p>'}${h.students.map(s=>`<details class="homework-attempts"><summary>${esc(s.name)} · 查看逐题答案与提示使用</summary>${h.questions.map((q,i)=>{const r=s.records[i];return `<h4>变式 ${i+1}</h4><p>${esc(q.text)}</p>${r?.submissions?.length?`<ol>${r.submissions.map(a=>`<li>${esc(a.answer)} · ${a.correct?'答对':'需再练'} · 作答前已看${a.hintCount||0}步提示 · ${esc(dateText(a.date))}</li>`).join('')}</ol>`:'<p>未作答</p>'}`;}).join('')}</details>`).join('')}</section>${sourceView(h)}<section class="panel"><h2>本次变式题与教师解析</h2>${h.questions.map((q,i)=>`<article class="question"><h3>变式 ${i+1}</h3><p>${stem(h.source.text,q.text)}</p><p>答案：${esc(q.answer)} ${esc(q.unit)}</p><p>${esc(q.explain)}</p></article>`).join('')}</section>`;
 }
 function work(h, index) {
  const q=h.questions[index],last=q.submissions.at(-1);
  return `<section class="panel"><h3>${esc(h.title)}</h3><p>已尝试 ${h.attempted} / ${h.total} 题 · 截止：${esc(dateText(h.dueAt))}</p>${h.completedAt?`<p class="notice">本份作业已完成${h.late?'（逾期补做）':''}，还可以继续巩固。老师会看到首次和最近结果。</p>`:''}<div class="practice-numbers">${h.questions.map((x,i)=>action(`${i+1}${x.submissions.length?' ✓':''}`,'question',`data-index="${i}" class="${i===index?'active':''}" aria-label="作业第${i+1}题"`)).join('')}</div><span class="tag">变式 ${index+1} / ${h.total}</span><p class="qtext homework-text">${q.segments.map(s=>s.changed?`<strong class="homework-change">${esc(s.text)}</strong>`:esc(s.text)).join('')}</p><p class="tiny">红字标出与原题不同的内容。可以打草稿；只填写最后结果${q.unit?'，单位：'+esc(q.unit):''}。</p><form id="homework-answer"><label for="hw-answer">我的答案</label><input id="hw-answer" name="answer" value="${esc(last?.answer||'')}" maxlength="120" required autocomplete="off"><button type="submit" ${previewStudentId?'disabled':''}>检查并保存</button></form>${last?`<p role="status" class="notice">${last.correct?'✓ 回答正确！试着讲一讲你的理由。':'还没有答对，检查题目条件后再试一次。'} 本次作答已保存。</p>`:''}<h4>分步提示 · ${q.hints.length} / 3</h4><p class="tiny">先独立尝试，提示只引导思路，不给最终答案。</p><ol>${q.hints.map(h=>`<li>${esc(h)}</li>`).join('')}</ol>${action('查看下一步提示','hint',`class="secondary" ${q.hints.length>=3||previewStudentId?'disabled':''}`)}${previewStudentId?'<p class="tiny">教师预览只查看，不写入学生的作答或提示记录。</p>':''}<div class="controls">${index>0?action('上一题','question',`data-index="${index-1}" class="quiet"`):''}${index<h.total-1?action('下一题 →','question',`data-index="${index+1}"`):'<a href="#practice/homework">返回作业列表</a>'}</div></section>`;
 }
 function paint(root) {
  if(!active(root))return; const s=states.get(root),h=s.data;
  root.querySelector('[data-homework-body]').innerHTML=h.items?list(h.items):teacher?(h.status==='draft'?editor(h):report(h)):work(h,s.index||0);
 }
 async function load() {
  const root=document.getElementById('homework-page');if(!root)return;
  const s={owner:user?.id,preview:previewStudentId,index:0};states.set(root,s);
  try { s.data=await api((teacher?'/api/teacher/homework':'/api/homework')+(root.dataset.id?'/'+encodeURIComponent(root.dataset.id):''));if(!active(root))return;paint(root);message(root,''); }
  catch(err){message(root,err.message);if(active(root))root.querySelector('[data-homework-body]').innerHTML=action('重新读取','reload','class="secondary"');}
 }
 function readEditor(root) {
  const s=states.get(root),f=root.querySelector('#homework-editor');
  const questions=[...f.querySelectorAll('[data-hw-question]')].map((node,i)=>({text:f.elements['text'+i].value,answer:f.elements['answer'+i].value,unit:f.elements['unit'+i].value,explain:f.elements['explain'+i].value}));
  return {revision:s.data.revision,title:f.elements.title.value,questions,studentIds:[...f.querySelectorAll('[name=studentIds]:checked')].map(el=>el.value),dueAt:f.elements.dueAt.value?new Date(f.elements.dueAt.value).toISOString():null};
 }
 async function save(root) {
  const s=states.get(root),data=await api('/api/teacher/homework/'+s.data.id,{method:'PUT',body:readEditor(root)});
  if(!active(root))return false;s.data=data;return true;
 }
 async function begin(source) {
  const owner=user?.id;
  try {const data=await api('/api/teacher/homework',{method:'POST',body:source});if(user?.id===owner&&teacher)location.hash='homework/'+data.id;}
  catch(err){toast(err.message);}
 }
 document.addEventListener('input',event=>{
  const root=event.target.closest?.('#homework-page');if(!active(root)||!teacher)return;
  const checkbox=root.querySelector('[name=reviewed]');if(checkbox&&event.target!==checkbox)checkbox.checked=false;
  if(event.target.name?.startsWith('text')){const i=event.target.name.slice(4),preview=root.querySelector(`[data-hw-stem="${i}"]`);if(preview)preview.innerHTML=stem(states.get(root).data.source.text,event.target.value);}
 });
 document.addEventListener('click',async event=>{
  const b=event.target.closest?.('[data-homework-action]'),root=b?.closest('#homework-page');if(!active(root)||b.disabled)return;
  const s=states.get(root),a=b.dataset.homeworkAction;if(s.busy)return;
  if(a==='reload'){void load();return;}
  if(a==='question'){s.index=Number(b.dataset.index);paint(root);return;}
  if(a==='select-class'||a==='clear-students'){
   const id=root.querySelector('[data-hw-class]').value;root.querySelectorAll('[name=studentIds]').forEach(el=>{el.checked=a==='select-class'&&(!id||overview.students.find(p=>p.id===el.value)?.classId===id);});root.querySelector('[name=reviewed]').checked=false;return;
  }
  if(a==='add'||a==='remove'){
   const fields=readEditor(root);Object.assign(s.data,fields);
   if(a==='add'&&s.data.questions.length<3)s.data.questions.push({text:'',answer:'',unit:'',explain:''});
   if(a==='remove')s.data.questions.splice(Number(b.dataset.index),1);paint(root);message(root,'修改尚未保存，请保存草稿。');return;
  }
  const reviewed=root.querySelector('[name=reviewed]')?.checked;
  if(a==='publish'&&!reviewed){message(root,'请先逐题审核，并勾选审核确认。');return;}
  const f=root.querySelector('#homework-editor'),difficulty=Number(f?.elements.difficulty?.value),count=Number(f?.elements.count?.value);
  s.busy=true;b.disabled=true;if(f)f.querySelector('fieldset').disabled=true;
  try {
   if(['save','generate','publish'].includes(a)){
    message(root,a==='generate'?'正在生成草稿，约需20秒；请稍候，题目不会自动发布。':'正在保存…');
    if(!await save(root))return;
    if(a!=='save')s.data=await api(`/api/teacher/homework/${s.data.id}/${a}`,{method:'POST',body:a==='generate'?{revision:s.data.revision,difficulty,count}:{revision:s.data.revision,reviewed:true}});
    if(!active(root))return;
    if(a==='publish')await load();else paint(root);
    message(root,a==='publish'?'已发布，所选学生可在“练习与错题 → 老师作业”中查看。':a==='generate'?'草稿已生成并保存，请逐题审核后发布。':'草稿已保存。');
   } else if(a==='hint'){
    s.data=await api(`/api/homework/${s.data.id}/questions/${s.index}/hint`,{method:'POST',body:{}});paint(root);message(root,'提示已展开。');
   }
  } catch(err){message(root,err.message);}finally{s.busy=false;if(active(root)){b.disabled=false;if(f?.isConnected)f.querySelector('fieldset').disabled=false;}}
 });
 document.addEventListener('submit',async event=>{
  if(event.target.id==='homework-editor'){event.preventDefault();return;}
  if(event.target.id!=='homework-answer')return;event.preventDefault();const form=event.target,root=form.closest('#homework-page'),s=states.get(root);if(!active(root)||s.busy||previewStudentId)return;
  s.busy=true;const b=form.querySelector('button');b.disabled=true;
  try {s.data=await api(`/api/homework/${s.data.id}/questions/${s.index}/answer`,{method:'POST',body:{answer:form.elements.answer.value}});paint(root);message(root,'本次答案已保存。');}
  catch(err){message(root,err.message);}finally{s.busy=false;b.disabled=false;}
 });
 return {page,load,begin};
})();
