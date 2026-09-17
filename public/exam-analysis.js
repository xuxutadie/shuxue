/* 班级错题分析：异步加载不阻塞工作台，切换筛选或身份后丢弃旧响应。 */
const examAnalysisUI=(()=>{
 const states=new WeakMap();
 const filters={kind:'A',classId:'',version:''};
 const current=root=>!!root&&teacher&&root.isConnected&&document.getElementById('exam-analysis')===root&&states.get(root)?.owner===user?.id;
 function panel(){
  if(!teacher)return '';
  if(!overview.classes.some(c=>c.id===filters.classId))filters.classId='';
  return `<section class="panel exam-analysis" id="exam-analysis" aria-label="班级学情总览"><div class="section-head"><div><span class="tag">先看全班，再看每个孩子</span><h2>班级学情总览</h2></div><button type="button" class="quiet" data-analysis-action="refresh">刷新学情面板</button></div><div class="analysis-filters"><div><label for="analysis-kind">测评</label><select id="analysis-kind"><option value="A" ${filters.kind==='A'?'selected':''}>前测 A 卷（首测）</option><option value="B" ${filters.kind==='B'?'selected':''}>后测 B 卷</option></select></div><div><label for="analysis-class">统计班级</label><select id="analysis-class"><option value="">全部班级</option>${overview.classes.map(c=>`<option value="${c.id}" ${filters.classId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div><label for="analysis-version">试卷版本</label><select id="analysis-version" disabled><option>读取中…</option></select></div></div><p class="tiny">只统计已交卷的在线测评，包含停用学生；空题计为未答对并单独标注。不同版本分开统计，历史导入成绩不混入。姓名重名时可通过账号区分。</p><p data-analysis-status role="status">正在读取班级学情…</p><div data-analysis-body></div></section>`;
 }
 function groupView(group){
  const wrong=group.questions.filter(q=>q.wrongCount>0);
  const empty=wrong.length?'':'<div class="empty"><strong>本版本已交卷学生全部答对</strong>暂无需要集中训练的错题。</div>';
  return `${empty}<h3>题目详情与讲解</h3><p>按未答对人数从多到少排列。展开题目可查看完整题干、学生答案和讲解。</p><div class="analysis-question-list">${group.questions.map(q=>`<details id="analysis-question-${q.number}" class="analysis-question"><summary><span class="analysis-number">第 ${q.number} 题</span><span><b>${esc(q.topic)}</b><span class="analysis-bar" aria-hidden="true"><span style="width:${q.wrongRate}%"></span></span></span><span><strong>${q.wrongCount} / ${group.submittedCount} 人未答对</strong><small>错误率 ${q.wrongRate}% · 其中 ${q.blankCount} 人未作答</small></span><span class="analysis-names">${q.wrongStudents.slice(0,3).map(s=>esc(s.name)).join('、')}${q.wrongStudents.length>3?` 等${q.wrongStudents.length}人`:''}</span></summary><div class="analysis-detail"><p><button type="button" data-analysis-action="homework" data-number="${q.number}">设计变式作业</button></p><p class="qtext">${q.number}. ${q.text}</p>${q.svg||''}<div class="table-wrap"><table><thead><tr><th>学生</th><th>学生答案</th><th>查看记录</th></tr></thead><tbody>${q.wrongStudents.map(s=>`<tr><td>${esc(s.name)}<small>${esc(s.username)}</small></td><td>${s.blank?'<span class="tag">未作答</span>':esc(s.answer)}</td><td><button type="button" class="quiet" data-analysis-action="review" data-student="${s.id}">查看答题报告</button></td></tr>`).join('')}</tbody></table></div><details><summary>教师参考答案与解析</summary><div class="answer"><b>参考答案：${esc(q.answer)}</b><p>${esc(q.explain)}</p></div></details></div></details>`).join('')}</div>`;
 }
 function renderGroup(root){
  if(!current(root))return;
  const s=states.get(root),data=s.data,group=data.groups.find(g=>g.version===filters.version);
  const body=root.querySelector('[data-analysis-body]');
  root.querySelector('[data-analysis-status]').textContent=`当前范围共 ${data.totalStudents} 位学生，${data.submittedCount} 人已交卷，${data.pendingCount} 人尚未交卷。${group?`当前版本统计 ${group.submittedCount} 人。`:''}`;
  body.innerHTML=classOverviewView(data,group)+`<section class="class-answer-board" id="class-answer-board" tabindex="-1"><div class="section-head"><h3>全班答题一览</h3><span class="tiny">点击分数看报告，点击错题格看题目</span></div><div class="class-matrix-tools"><div><label for="analysis-student-search">找学生</label><input id="analysis-student-search" value="${esc(s.search||'')}" placeholder="姓名或登录账号"></div><div><label for="analysis-focus">查看范围</label><select id="analysis-focus">${[['all','全部学生'],['pending','尚未交卷'],['low','当前版本低于72分'],['wrong','当前版本有错题']].map(([v,label])=>`<option value="${v}" ${(s.focus||'all')===v?'selected':''}>${label}</option>`).join('')}</select></div><div class="class-legend"><span class="cell-correct">✓ 答对</span><span class="cell-wrong">× 答错</span><span class="cell-blank">空 未作答</span><span>— 无本版结果</span></div></div><div data-analysis-matrix>${classMatrixView(data,group,s.focus||'all',s.search||'')}</div></section>`+(group?groupView(group):'<div class="empty"><strong>还没有已交卷的测评</strong>上方名册仍显示全部学生。交卷后会自动补上成绩分布和逐题结果。</div>');
 }
 function renderMatrix(root){
  const s=states.get(root);if(!current(root)||!s.data)return;
  root.querySelector('[data-analysis-matrix]').innerHTML=classMatrixView(s.data,s.data.groups.find(g=>g.version===filters.version),s.focus||'all',s.search||'');
 }
 async function load(){
  const root=document.getElementById('exam-analysis');if(!root||!teacher)return;
  if(!states.has(root))states.set(root,{owner:user.id,revision:0,data:null});
  const s=states.get(root),revision=++s.revision;
  const kind=root.querySelector('#analysis-kind').value,classId=root.querySelector('#analysis-class').value;
  filters.kind=kind;filters.classId=classId;
  const version=root.querySelector('#analysis-version');version.disabled=true;
  root.querySelector('[data-analysis-status]').textContent='正在读取班级学情…';
  root.querySelector('[data-analysis-body]').innerHTML='';s.data=null;
  try{
   const data=await api(`/api/teacher/exam-analysis?kind=${encodeURIComponent(kind)}&classId=${encodeURIComponent(classId)}`);
   if(!current(root)||revision!==s.revision)return;
   s.data=data;
   if(!data.groups.some(g=>g.version===filters.version))filters.version=data.groups[0]?.version||'';
   version.innerHTML=data.groups.length?data.groups.map(g=>`<option value="${esc(g.version)}" ${filters.version===g.version?'selected':''}>${esc(g.version)} · ${g.submittedCount} 人已交卷</option>`).join(''):'<option>暂无已交卷试卷</option>';
   version.disabled=!data.groups.length;renderGroup(root);
  }catch(err){
   if(!current(root)||revision!==s.revision)return;
   version.innerHTML='<option>读取失败</option>';
   root.querySelector('[data-analysis-status]').textContent='错题统计读取失败，请点击“刷新学情面板”重试。';
  }
 }
 document.addEventListener('change',event=>{
  const root=event.target.closest?.('#exam-analysis');if(!current(root))return;
  if(['analysis-kind','analysis-class'].includes(event.target.id)){filters.version='';void load();}
  if(event.target.id==='analysis-focus'){states.get(root).focus=event.target.value;renderMatrix(root);}
  if(event.target.id==='analysis-version'){filters.version=event.target.value;renderGroup(root);}
 });
 document.addEventListener('input',event=>{
  if(event.target.id!=='analysis-student-search')return;
  const root=event.target.closest('#exam-analysis');if(!current(root))return;
  states.get(root).search=event.target.value;renderMatrix(root);
 });
 document.addEventListener('click',event=>{
  const b=event.target.closest?.('[data-analysis-action]');if(!b)return;
  const root=b.closest('#exam-analysis');if(!current(root))return;
  if(b.dataset.analysisAction==='refresh')void load();
  if(b.dataset.analysisAction==='homework'){b.disabled=true;homeworkUI.begin({kind:filters.kind,version:filters.version,classId:filters.classId,number:Number(b.dataset.number)}).finally(()=>{b.disabled=false;});}
  if(b.dataset.analysisAction==='filter'){
   const s=states.get(root);s.focus=b.dataset.filter;s.search='';root.querySelector('#analysis-focus').value=s.focus;root.querySelector('#analysis-student-search').value='';renderMatrix(root);
   root.querySelector('#class-answer-board').scrollIntoView({behavior:'smooth',block:'start'});
  }
  if(b.dataset.analysisAction==='student'){state.current=b.dataset.student;location.hash='student/'+b.dataset.student;}
  if(b.dataset.analysisAction==='question'){
   const card=root.querySelector('#analysis-question-'+Number(b.dataset.number));if(card){card.open=true;card.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  if(b.dataset.analysisAction==='review'&&states.get(root).data){state.current=b.dataset.student;location.hash='review/'+(b.dataset.kind||states.get(root).data.kind);}
 });
 return {panel,load};
})();
function examAnalysisPanel(){return examAnalysisUI.panel();}
function loadExamAnalysis(){return examAnalysisUI.load();}
