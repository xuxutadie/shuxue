// 小镇进度从真实作答记录计算，不额外存储积分，也不按用时排名。
function worldPlan(courses, rows, active, timestamp=Date.now()) {
  const first=new Map(),last=new Map();
  for(const row of rows){if(!first.has(row.qid))first.set(row.qid,row);last.set(row.qid,row);}
  const independent=a=>!!a.correct&&!a.hints&&!a.revealed;
  const today=new Date(timestamp+8*3600000).toISOString().slice(0,10);
  const due=[...last.values()].filter(a=>JSON.parse(a.snapshot).kind!=='interactive'&&!independent(a)&&new Date(Date.parse(a.created)+8*3600000).toISOString().slice(0,10)<today);
  const parsed=courses.map(c=>({...c,questions:typeof c.questions==='string'?JSON.parse(c.questions):c.questions}));
  const diagnostic=parsed.find(c=>c.id==='diagnostic');
  const diagnosticDone=diagnostic?diagnostic.questions.every(q=>first.has(q.id)):true;
  const lessons=parsed.filter(c=>c.id!=='diagnostic').map(c=>({id:c.id,title:c.title,count:c.questions.length,
    topics:[...new Set(c.questions.map(q=>q.topic))],done:c.questions.filter(q=>first.has(q.id)).length,
    fresh:c.questions.filter(q=>!first.has(q.id)).length,level:c.questions.reduce((sum,q)=>sum+q.level,0)/c.questions.length}));
  const areas=Array.from({length:6},(_,topic)=>{
    const attempts=[...first.values()].filter(a=>JSON.parse(a.snapshot).topic===topic);
    const local=lessons.filter(c=>c.topics.includes(topic));
    return {topic,explored:attempts.length,independent:attempts.filter(independent).length,
      due:due.filter(a=>JSON.parse(a.snapshot).topic===topic).length,
      lessons:local,stamps:local.filter(c=>!c.fresh).length};
  });
  // 优先补充观察样本；已有样本中，先练需要帮助的方向，不贴能力标签。
  const rank=c=>c.topics.reduce((sum,t)=>sum+(areas[t].explored?areas[t].independent/areas[t].explored:0)-1/(areas[t].explored+1),0)/c.topics.length;
  const available=lessons.filter(c=>c.fresh).filter(c=>!c.id.startsWith('seed-1-')||!lessons.some(base=>base.id==='seed-0-'+c.id.slice(7)&&base.fresh)).sort((a,b)=>rank(a)-rank(b)||a.level-b.level||a.id.localeCompare(b.id));
  const tasks=[];
  if(active)tasks.push({kind:'continue',title:'接着上次的探索',reason:'你还有一段未完成的旅程，先把它走完。'});
  if(!diagnosticDone&&!active)tasks.push({kind:'course',courseId:diagnostic.id,title:'完成六方向起点摸底',reason:'每个方向先观察一道题，不用急着证明自己。'});
  if(due.length)tasks.push({kind:'review',title:'记忆花园 · 隔天再想一次',reason:`${due.length}道题到了复习时间，先独立尝试，再看提示。`});
  const picked=new Set();
  for(const c of available){if(tasks.length>=5)break;if(picked.has(c.topics[0]))continue;picked.add(c.topics[0]);tasks.push({kind:'course',courseId:c.id,title:c.title,reason:`还有${c.fresh}道未探索的新题，用新问题观察方法是否会用了。`,topic:c.topics[0]});}
  for(const c of available){if(tasks.length>=5)break;if(tasks.some(t=>t.courseId===c.id))continue;tasks.push({kind:'course',courseId:c.id,title:c.title,reason:'换一个问题，试着迁移自己的方法。',topic:c.topics[0]});}
  const pending=[...last.values()].filter(a=>JSON.parse(a.snapshot).kind!=='interactive'&&!independent(a)).length;
  return {areas,tasks,diagnosticDone,diagnosticProgress:diagnostic?{completed:diagnostic.questions.filter(q=>first.has(q.id)).length,total:diagnostic.questions.length}:null,dueCount:due.length,pendingCount:pending,
    explored:first.size,stamps:lessons.filter(c=>!c.fresh).length,totalStamps:lessons.length,
    exhausted:!available.length&&diagnosticDone,active:!!active,
    note:'这是接下来5次练习的建议，会随作答记录更新。每次建议：5分钟回顾、25分钟探索、10分钟休息、15分钟讲方法、5分钟总结；不需要坐满一小时。'};
}

module.exports={worldPlan};