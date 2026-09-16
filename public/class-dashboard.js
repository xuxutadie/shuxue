/* 班级面板只组织现有测评数据，统计与答题明细共用同一份服务器结果。 */
const CLASS_STATUS={submitted:'已交卷',in_progress:'作答中',overdue:'待结算',assigned:'待开始',unassigned:'未布置'};
function classRoster(data){
 return data.students||data.groups.flatMap(g=>g.students.map(p=>({...p,status:'submitted',version:g.version,scores:{[data.kind]:p.score}})));
}
function classOverviewView(data,group){
 const students=group?.students||[],count=students.length,average=count?(students.reduce((sum,p)=>sum+p.score,0)/count).toFixed(1):'—';
 const low=students.filter(p=>p.score<72),rate=data.totalStudents?Math.round(data.submittedCount/data.totalStudents*100):0;
 const topics=new Map();
 (group?.questions||[]).forEach(q=>{if(!topics.has(q.topic))topics.set(q.topic,{name:q.topic,total:0,wrong:0,number:q.number,max:-1});const t=topics.get(q.topic);t.total+=count;t.wrong+=q.wrongCount;if(q.wrongCount>t.max){t.max=q.wrongCount;t.number=q.number;}});
 const weak=[...topics.values()].filter(t=>t.wrong).sort((a,b)=>b.wrong/b.total-a.wrong/a.total).slice(0,5);
 const bands=[[0,59],[60,71],[72,89],[90,107],[108,120]].map(([min,max])=>({label:`${min}–${max}分`,count:students.filter(p=>p.score>=min&&p.score<=max).length}));
 return `<div class="class-kpis">
  <article class="class-kpi"><span>本次交卷进度</span><strong>${data.submittedCount}<small> / ${data.totalStudents} 人</small></strong><div class="class-progress" role="img" aria-label="交卷率${rate}%"><i style="width:${rate}%"></i></div><small>当前班级范围 · 完成 ${rate}%</small></article>
  <button type="button" class="class-kpi" data-analysis-action="filter" data-filter="pending"><span>尚未交卷</span><strong>${data.pendingCount}<small> 人</small></strong><small>点击查看作答中、待开始和未布置</small></button>
  <article class="class-kpi"><span>当前试卷平均分</span><strong>${average}<small> / 120</small></strong><small>${count?`当前版本 · ${count} 份已交卷`:'暂无已交卷数据'}</small></article>
  <button type="button" class="class-kpi" data-analysis-action="filter" data-filter="low"><span>建议重点巩固</span><strong>${count?low.length:'—'}<small> 人</small></strong><small>当前版本低于72分 · 教学提醒</small></button>
 </div><div class="class-charts">
  <section class="class-chart"><h3>成绩分布</h3><p class="tiny">当前试卷版本，未交卷不计为0分。</p>${count?`<div class="class-distribution">${bands.map((b,i)=>`<div class="class-band"><b>${b.count}人</b><div class="class-column"><i class="band-${i}" style="height:${b.count/count*100}%"></i></div><span>${b.label}</span></div>`).join('')}</div>`:'<p class="empty">交卷后显示成绩分布</p>'}</section>
  <section class="class-chart"><h3>最需要巩固的知识点</h3><p class="tiny">错误与空题次数 ÷ 该知识点总作答机会。</p>${weak.length?weak.map(t=>{const percent=Math.round(t.wrong/t.total*100);return `<button type="button" class="class-topic" data-analysis-action="question" data-number="${t.number}"><span>${esc(t.name)}</span><strong>${percent}% 未答对</strong><span class="class-topic-bar"><i style="width:${percent}%"></i></span><small>${t.wrong} / ${t.total} 次 · 点击看代表错题</small></button>`;}).join(''):`<p class="empty">${count?'当前版本暂无错题':'交卷后显示知识点分析'}</p>`}</section>
 </div>`;
}
function classMatrixView(data,group,filter='all',search=''){
 const currentStudents=new Map((group?.students||[]).map(p=>[p.id,p])),questions=[...(group?.questions||[])].sort((a,b)=>a.number-b.number);
 const term=search.trim().toLowerCase();
 const students=classRoster(data).filter(p=>{
  const current=currentStudents.get(p.id);
  return (!term||`${p.name} ${p.username}`.toLowerCase().includes(term))&&(filter==='all'||filter==='pending'&&p.status!=='submitted'||filter==='low'&&current?.score<72||filter==='wrong'&&current?.wrongNumbers.length>0);
 });
 const scoreButton=(p,kind)=>p.scores?.[kind]===null||p.scores?.[kind]===undefined?'—':`<button type="button" class="quiet class-score" data-analysis-action="review" data-kind="${kind}" data-student="${esc(p.id)}" aria-label="查看${esc(p.name)}${kind==='A'?'前测':'后测'}报告">${p.scores[kind]}</button>`;
 return `<p class="tiny">显示 ${students.length} / ${data.totalStudents} 位学生。分数满分120；前后测变化用于教学参考。答题格只对应当前选择的试卷版本。</p>${students.length?`<div class="class-matrix-scroll" tabindex="0" role="region" aria-label="全班答题情况，可左右滚动"><table class="class-matrix"><thead><tr><th scope="col">学生 / 班级</th><th scope="col">前测</th><th scope="col">后测</th><th scope="col">变化</th><th scope="col">本次状态</th>${questions.map(q=>`<th scope="col"><button type="button" class="quiet" data-analysis-action="question" data-number="${q.number}" aria-label="查看第${q.number}题，${q.wrongCount}人未答对">${q.number}</button></th>`).join('')}<th scope="col">档案</th></tr></thead><tbody>${students.map(p=>{
  const current=currentStudents.get(p.id),a=p.scores?.A,b=p.scores?.B,both=Number.isFinite(a)&&Number.isFinite(b),diff=both?b-a:null;
  return `<tr><th scope="row"><b>${esc(p.name)}</b>${p.accountDisabled?' <span class="tag">已停用</span>':''}<small>${esc(p.className)} · ${esc(p.username)}</small></th><td>${scoreButton(p,'A')}</td><td>${scoreButton(p,'B')}</td><td>${both?`${diff>0?'+':''}${diff}`:'—'}</td><td><span class="class-state state-${p.status}">${p.status==='submitted'&&!current?'其他版本':CLASS_STATUS[p.status]||'待确认'}</span></td>${questions.map(q=>{
   if(!current)return '<td><span class="answer-cell cell-pending" aria-label="当前版本暂无已交卷答题结果">—</span></td>';
   const blank=current.blankNumbers.includes(q.number),wrong=current.wrongNumbers.includes(q.number),label=blank?'未作答':wrong?'答错':'答对';
   return `<td><button type="button" class="answer-cell ${blank?'cell-blank':wrong?'cell-wrong':'cell-correct'}" data-analysis-action="${wrong?'question':'review'}" data-number="${q.number}" data-student="${esc(p.id)}" data-kind="${data.kind}" aria-label="${esc(p.name)}第${q.number}题${label}" title="第${q.number}题 · ${label}">${blank?'空':wrong?'×':'✓'}</button></td>`;
  }).join('')}<td><button type="button" class="quiet" data-analysis-action="student" data-student="${esc(p.id)}">查看</button></td></tr>`;
 }).join('')}</tbody></table></div>`:'<div class="empty">没有符合筛选条件的学生。</div>'}`;
}
