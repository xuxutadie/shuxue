const {randomUUID}=require('node:crypto');
const {fail,string}=require('../db');
const {worldPlan}=require('./world.cjs');
const {judgeCampGame,gameTitles,gameTopics}=require('./camp-games.cjs');
const {townCourses,campCourses,courses,questions,firstQuestions,isAnswer}=require('./content.cjs');
const adventure=require('./adventure.cjs');
function initial(){return {version:1,records:{},runs:{},active:null,repairs:{}};}
function campaign(s,demo=false){
 const passed=q=>!!s.records[q.id]?.passed;
 const first={total:firstQuestions.length,correct:firstQuestions.filter(passed).length};
 first.unlocked=demo||first.correct===first.total;
 const repaired=i=>!!s.repairs[i]?.passed||campCourses[i].questions.every(passed);
 const missions=campCourses.map((c,i)=>({id:c.id,title:gameTitles[i],total:c.questions.length,correct:c.questions.filter(passed).length,repaired:repaired(i),unlocked:demo||first.unlocked&&campCourses.slice(0,i).every((_,j)=>repaired(j))}));
 return {first,missions,complete:first.unlocked&&missions.every(m=>m.repaired)};
}
function rowsForPlan(s){
 // 推荐算法使用首答和最近一次结果，掌握标记单独保留，不因历史截断丢失。
 return Object.entries(s.records).flatMap(([qid,r])=>{
  const q=questions.get(qid);if(!q)return [];
  const rows=[r.first,...(r.count>1?[r.last]:[])];
  return rows.map(a=>({...a,qid,snapshot:JSON.stringify(q)}));
 }).sort((a,b)=>a.created.localeCompare(b.created));
}
function publicRun(s){
 const r=s.runs[s.active];if(!r)return null;
 const q=questions.get(r.qids[r.index]);
 return {id:r.id,courseId:s.active,courseTitle:r.title,version:r.revision,index:r.index,total:r.qids.length,seconds:r.seconds,hints:r.hints,draft:r.draft,note:r.note,
  ...(r.story?{storyStep:adventure.chapter.steps[r.index],lesson:adventure.lesson(r),optional:!!r.transferOptional,bakery:r.bakery||null}:{}),
  result:r.result?{...r.result,...(!r.story||r.result.correct||r.result.revealed?{answer:q.answer,explanation:r.story?adventure.explanation(r):q.explanation}:{})}:null,
  question:{id:q.id,topic:q.topic,level:q.level,title:q.title,text:q.text,source:q.source,hints:q.hints.slice(0,r.hints)}};
}
function view(s,{demo=false,readonly=false,name='探索家'}={}){
 const rows=rowsForPlan(s),world=worldPlan(townCourses,rows,!!s.runs[s.active]);
 if(demo)world.diagnosticDone=true;
 world.campaign=campaign(s,demo);
 world.adventure=adventure.view(s);
 if(!world.adventure.done)world.tasks=[{kind:'course',courseId:adventure.chapter.courseId,title:'帮助米米准备救援口粮',reason:'完成四项准备，获得口粮箱与下一站的线索。'}];
 return {world,run:publicRun(s),name,demo,readonly,courses:courses.map(c=>({id:c.id,title:c.title,description:c.description,count:c.questions.length,unlocked:!c.id.startsWith('camp-')||world.campaign.missions.find(m=>m.id===c.id)?.unlocked})),
  report:{questions:Object.entries(s.records).map(([qid,r])=>({qid,title:questions.get(qid)?.title,count:r.count,passed:r.passed,firstCorrect:r.first.correct,firstHints:r.first.hints,last:r.last,history:r.history})),repairs:Object.entries(s.repairs).map(([index,r])=>({title:gameTitles[index],passed:r.passed,count:r.count,history:r.history}))}};
}
function start(s,courseId,demo=false){
 const c=courses.find(c=>c.id===courseId);
 let qs,title;
 if(courseId===adventure.chapter.courseId){qs=adventure.base;title=adventure.chapter.title;adventure.ensure(s);}
 else if(c){qs=c.questions;title=c.title;const mission=campCourses.findIndex(x=>x.id===c.id);if(mission>=0&&!campaign(s,demo).missions[mission].unlocked)fail(403,'请先完成前面的关卡。');}
 else if(courseId==='stage-one-retry'){qs=firstQuestions.filter(q=>!s.records[q.id]?.passed).slice(0,6);title='补齐小镇未通关题';}
 else if(courseId==='review-due'){
  // 与小镇推荐保持一致：错题、看提示答对和看过解析的题，隔天再独立尝试。
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  qs=[...questions.values()].filter(q=>{const a=s.records[q.id]?.last;return a&&(!a.correct||a.hints||a.revealed)&&new Date(Date.parse(a.created)+8*3600000).toISOString().slice(0,10)<today;}).slice(0,6);title='记忆花园 · 再想一次';
 }
 else fail(404,'没有找到这个游戏任务。');
 if(!qs.length)fail(400,'当前没有需要补做的题目。');
 if(!s.runs[courseId])s.runs[courseId]={id:randomUUID(),revision:0,title,qids:qs.map(q=>q.id),index:0,seconds:0,hints:0,draft:'',note:'',result:null,...(courseId===adventure.chapter.courseId?{story:true}: {})};
 s.active=courseId;return publicRun(s);
}
function runAction(s,body){
 const r=s.runs[s.active];
 if(!r||r.id!==body.runId||r.revision!==body.revision)fail(409,'另一页面已更新进度，请先载入最新记录。');
 if(!['draft','hint','submit','reveal','next','retry','transfer'].includes(body.action))fail(400,'未知的答题操作。');
 const q=questions.get(r.qids[r.index]);
 if(body.action==='transfer'){
  if(!r.story||!r.result?.correct||adventure.lesson(r).isVariant)fail(400,'先独立完成本题，再尝试同类新题。');
  r.qids[r.index]=adventure.variants[r.index].id;Object.assign(r,{transferOptional:true,result:null,draft:'',note:'',hints:0,bakery:null,seconds:0});r.revision++;return {completed:false};
 }
 if(body.action==='retry'){
  if(!r.story||!r.result||r.result.correct)fail(400,'当前不需要重试。');
  // 看解析后换成已有题库中的同类变式，保留原题型，不能抄答案领取奖励。
  if(r.result.revealed){r.qids[r.index]=q.id===adventure.base[r.index].id?adventure.variants[r.index].id:adventure.base[r.index].id;r.bakery=null;}
  Object.assign(r,{result:null,...(r.result.revealed?{draft:'',hints:0}:{})});r.revision++;return {completed:false};
 }
 if(body.action==='next'){
  // 选做入口仅在主线答对后开放，结束选做不会影响已完成的主线。
  if(!r.result&&!r.transferOptional)fail(400,'请先提交本题，或选择学习解析。');
  if(r.story&&!r.result?.correct&&!r.transferOptional)fail(400,'先完成这项准备，再进行下一项。');
  if(r.story&&r.index+1===r.qids.length)adventure.complete(s);
  if(r.index+1===r.qids.length){delete s.runs[s.active];s.active=Object.keys(s.runs)[0]||null;return {completed:true};}
  Object.assign(r,{index:r.index+1,transferOptional:false,seconds:0,hints:0,draft:'',note:'',result:null,bakery:null});r.revision++;return {completed:false};
 }
 if(r.result)fail(409,'本题已经提交，请先进入下一题。');
 r.draft=string(body.answer??r.draft,100,true);r.note=string(body.note??r.note,1000,true);
 if(r.story&&body.bakery!==undefined)r.bakery=adventure.cleanBoard(body.bakery);
 if(body.seconds!==undefined){if(!Number.isFinite(body.seconds)||body.seconds<0||body.seconds>86400)fail(400,'思考时间不正确。');r.seconds=Math.max(r.seconds,Math.round(body.seconds));}
 if(body.action==='hint')r.hints=Math.min(2,r.hints+1);
 if(['submit','reveal'].includes(body.action)){
  const revealed=body.action==='reveal';if(!revealed&&!r.draft)fail(400,'请先填写你的答案。');
  const learningError=r.story?adventure.checkLearning(r):'';
  const a={answer:r.draft,note:r.note,seconds:r.seconds,hints:r.hints,revealed,correct:!revealed&&!learningError&&isAnswer(r.draft,q.answer),...(r.story?{work:{...r.bakery?.work},workLabels:adventure.lesson(r)}:{}),created:new Date().toISOString()};
  const record=s.records[q.id]||{first:a,count:0,passed:false,history:[]};
  record.count++;record.last=a;record.passed ||= a.correct;record.history=[...record.history,a].slice(-5);s.records[q.id]=record;
  r.result={correct:a.correct,revealed,...(r.story?{reward:a.correct?adventure.award(s,r):0,feedback:learningError||'观察结果正确，再用这些数量核对最后的总数。'}:{})};
 }
 r.revision++;return {completed:false};
}
function submitGame(s,body,demo=false){
 const i=body.mission;
 if(!Number.isInteger(i)||i<0||i>5||! /^[0-9a-f-]{36}$/i.test(body.attemptId||''))fail(400,'操作记录格式不正确。');
 const record=s.repairs[i]||{passed:false,count:0,history:[]};
 const payload=JSON.stringify(body.config),old=record.history.find(a=>a.id===body.attemptId);
 if(old){if(old.payload!==payload)fail(409,'同一次验证不能更换方案。');return {correct:old.correct,feedback:old.feedback};}
 if(!campaign(s,demo).missions[i].unlocked)fail(403,'请先修复前面的设施。');
 if(!Number.isFinite(body.seconds)||body.seconds<0||body.seconds>86400||payload?.length>4000)fail(400,'操作记录过长或时间不正确。');
 let result;try{result=judgeCampGame(i,body.config);}catch{fail(400,'操作方案不正确，请重新检查。');}
 record.count++;record.passed ||= result.correct;
 record.history=[...record.history,{id:body.attemptId,payload,...result,seconds:Math.round(body.seconds),created:new Date().toISOString()}].slice(-30);s.repairs[i]=record;return result;
}
module.exports={initial,campaign,view,start,runAction,submitGame};
