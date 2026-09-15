/* 学生练习统一入口：固定题、变式题逐题作答，完成后进入同页 AI 拔高。 */
let practiceCourse=0,practiceIndex=0,practiceTab='work';
function startPracticeLesson(i){practiceCourse=i;practiceIndex=0;practiceTab='work';}
function practiceItems(i){return [...LESSONS[i].practice.map((q,j)=>({q,j,type:'fixed'})),...(LESSONS[i].variantPractice||[]).map((q,j)=>({q,j,type:'variant'}))];}
function practiceRecord(i,item){const records=item.type==='fixed'?pupil()?.practice:pupil()?.variantPractice,r=records?.[i+'-'+item.j];return r&&(r.version||'v1')===(item.q.version||'v1')?r:null;}
function practiceProgress(i){const items=practiceItems(i);return {total:items.length,done:items.filter(item=>practiceRecord(i,item)).length};}
function variantQuestion(q,i,j,number){
 const saved=practiceRecord(i,{q,j,type:'variant'}),key=i+'-'+j;
 return `<div class="question variant-exercise" id="variant-${key}"><span class="tag">变式练习 · 第${number}题</span><p class="qtext">${changedStem(q.text,q.changed)}</p><p class="tiny">填写结果；题目要求的解释、画图或列举过程写在草稿纸上。红字标出改变的条件。</p><form id="variant-form-${key}" data-variant-form data-lesson="${i}" data-question="${j}">${q.inputs.map((f,k)=>`<div class="field"><label for="variant-${key}-${k}">${esc(f.label)}</label>${f.options?`<select id="variant-${key}-${k}" name="answer${k}" required><option value="">请选择</option>${f.options.map(o=>`<option value="${esc(o)}" ${saved?.answers[k]===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input id="variant-${key}-${k}" name="answer${k}" value="${esc(saved?.answers[k]||'')}" maxlength="200" autocomplete="off" required>`}</div>`).join('')}<button type="submit">检查答案</button><p class="form-error" role="alert"></p></form><div class="variant-feedback" role="status">${saved?`<p class="answer">${saved.correct?'✓ 结果正确，请再检查草稿中的理由。':'还需要再想一想。'}</p>`:''}</div></div>`;
}
function practiceTabs(){return `<div class="tabs" role="group" aria-label="练习环节">${[['work','独立练习'],['ai','AI 拔高'],['wrong','我的错题']].map(([id,label])=>`<button type="button" class="${practiceTab===id?'active':''}" data-practice-tab="${id}">${label}</button>`).join('')}</div>`;}
function studentPracticePanel(i){
 practiceCourse=i;const progress=practiceProgress(i),items=practiceItems(i);practiceIndex=Math.max(0,Math.min(practiceIndex,items.length-1));
 let content;
 if(practiceTab==='ai'){
  const canEnter=progress.done===progress.total||!!previewStudentId;
  content=canEnter?aiPracticePage({embedded:true,course:i,difficulty:3}):`<section class="panel"><h2>完成本课练习，再挑战 AI 拔高题</h2><p>已尝试 ${progress.done} / ${progress.total} 题。剩余题目完成后，就能在这里生成本课的新题。</p><button type="button" data-practice-tab="work">继续独立练习</button></section>`;
 }else if(practiceTab==='wrong')content=practiceWrongList();
 else{
  const item=items[practiceIndex];
  content=`<section class="panel" id="student-practice-work"><div class="section-head"><h2>第 ${practiceIndex+1} / ${items.length} 题 · ${item.type==='variant'?'变式练习':'独立练习'}</h2><span id="practice-progress" class="tag">已尝试 ${progress.done} / ${progress.total} 题</span></div><p class="tiny">可以打草稿。先独立作答，再检查答案。</p><div class="practice-numbers" aria-label="选择练习题">${items.map((it,k)=>`<button type="button" class="${k===practiceIndex?'active':''}" data-practice-index="${k}" aria-label="第${k+1}题${practiceRecord(i,it)?'，已尝试':''}" aria-current="${k===practiceIndex?'step':'false'}">${k+1}${practiceRecord(i,it)?' ✓':''}</button>`).join('')}</div>${item.type==='fixed'?practiceQuestion(item.q,i,item.j):variantQuestion(item.q,i,item.j,practiceIndex+1)}<div class="controls"><button type="button" class="secondary" data-practice-index="${practiceIndex-1}" ${practiceIndex===0?'disabled':''}>上一题</button>${practiceIndex<items.length-1?`<button type="button" data-practice-index="${practiceIndex+1}">下一题 →</button>`:'<button type="button" data-practice-tab="ai">进入 AI 拔高练习 →</button>'}</div></section>`;
 }
 return `<div id="practice-workspace">${practiceTabs()}${content}</div>`;
}
function practiceWrongList(){
 const wrong=[];LESSONS.forEach((l,i)=>practiceItems(i).forEach((item,index)=>{const r=practiceRecord(i,item);if(r&&!r.correct)wrong.push({i,index,item,r});}));
 return `<section class="panel"><h2>需要再练的题 · ${wrong.length} 道</h2>${wrong.length?wrong.map(({i,index,item,r})=>`<article class="question"><span class="tag">第${i+1}课 · ${item.type==='variant'?'变式题':'固定题'}</span><p>${item.type==='variant'?changedStem(item.q.text,item.q.changed):item.q.text}</p>${item.type==='fixed'?item.q.svg||'':''}<p class="tiny">上次答案：${esc(item.type==='variant'?r.answers.join('；'):r.answer)}</p><button type="button" data-practice-retry="${i}" data-practice-index="${index}">重新练习这道题</button></article>`).join(''):'<div class="empty">暂时没有待复习的固定题或变式题。AI 题的尝试记录在“AI 拔高”中查看。</div>'}</section>`;
}
function refreshPracticeProgress(){
 const el=document.getElementById('practice-progress');if(!el)return;
 const p=practiceProgress(practiceCourse);el.textContent=`已尝试 ${p.done} / ${p.total} 题`;
 document.querySelectorAll('.practice-numbers button').forEach(b=>{const k=Number(b.dataset.practiceIndex),done=!!practiceRecord(practiceCourse,practiceItems(practiceCourse)[k]);b.textContent=`${k+1}${done?' ✓':''}`;b.setAttribute('aria-label',`第${k+1}题${done?'，已尝试':''}`);});
}
// 变式单独统计，保留原有36道固定练习的统计口径。
function variantPracticeDetails(student){
 const rows=LESSONS.flatMap((l,i)=>(l.variantPractice||[]).flatMap((q,j)=>{const r=student.variantPractice?.[i+'-'+j];return r&&r.version===q.version?[{q,i,j,r}]:[];}));
 if(!rows.length)return '';
 return `<section class="panel"><h2>变式练习记录</h2><p>已尝试 ${rows.length} 题，${rows.filter(x=>!x.r.correct).length} 题需要再练。</p>${rows.map(({q,i,j,r})=>`<details class="question"><summary>第${i+1}课 · 变式${j+1} · ${r.correct?'结果正确':'需要再练'} · ${r.attempts}次尝试</summary><p>${changedStem(q.text,q.changed)}</p><p>最近答案：${esc(r.answers.join('；'))}</p><p class="tiny">系统检查填写结果，草稿中的解释与过程需由老师核对。</p>${teacher?`<p>参考答案：${esc(q.answer)}</p><p>${esc(q.explain)}</p>`:''}<ol>${(r.submissions||[]).map(a=>`<li>${esc(a.answers.join('；'))} · ${a.correct?'正确':'再想一想'}</li>`).join('')}</ol></details>`).join('')}</section>`;
}
document.addEventListener('click',async event=>{
 const b=event.target.closest?.('[data-practice-tab],[data-practice-index]');if(!b||teacher)return;
 if(b.dataset.practiceRetry!==undefined){practiceCourse=Number(b.dataset.practiceRetry);lessonId=practiceCourse;practiceTab='work';}
 if(b.dataset.practiceTab)practiceTab=b.dataset.practiceTab;
 if(b.dataset.practiceIndex!==undefined)practiceIndex=Number(b.dataset.practiceIndex);
 if(b.dataset.practiceRetry!==undefined&&location.hash.startsWith('#lesson/')&&location.hash!==`#lesson/${practiceCourse}/work`){location.hash=`lesson/${practiceCourse}/work`;return;}
 await render();document.getElementById('practice-workspace')?.scrollIntoView({block:'start'});
});
document.addEventListener('change',async event=>{
 if(event.target.id!=='practice-course'||teacher)return;
 startPracticeLesson(Number(event.target.value));lessonId=practiceCourse;await render();document.getElementById('practice-workspace')?.scrollIntoView({block:'start'});
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches?.('[data-variant-form]'))return;event.preventDefault();if(teacher)return;
 const i=Number(form.dataset.lesson),j=Number(form.dataset.question),q=LESSONS[i].variantPractice[j],student=pupil(),submit=form.querySelector('[type=submit]');
 if(submit.disabled)return;submit.disabled=true;form.querySelector('.form-error').textContent='';
 try{
  const result=await api(`/api/students/${student.id}/variants/${i}/${j}`,{method:'POST',body:{version:q.version,answers:q.inputs.map((f,k)=>form.elements['answer'+k].value)}});
  if(!result.preview)student.variantPractice={...student.variantPractice,[i+'-'+j]:result};
  if(!form.isConnected||pupil()?.id!==student.id)return;
  form.parentElement.querySelector('.variant-feedback').innerHTML=`<div class="answer">${result.correct?'✓ 结果正确。'+esc(result.explain):'还没有答对，请检查题中条件和各项结果。'}<p class="tiny">${result.preview?'预览试做，不记录成绩':'已保存本次作答。题目中的解释与过程，请再和老师核对。'}</p></div>`;refreshPracticeProgress();
 }catch(err){if(form.isConnected)form.querySelector('.form-error').textContent=err.message;}finally{submit.disabled=false;}
});
