const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const result={kind:'A',totalStudents:2,submittedCount:1,pendingCount:1,groups:[{
 version:'v3',submittedCount:1,questions:[{number:2,topic:'周期',text:'第二题完整题目',svg:'',answer:'5',explain:'分组找余数',wrongCount:1,blankCount:1,wrongRate:100,
  wrongStudents:[{id:'s1',name:'<小宁>',username:'student1',answer:'',blank:true}]}],
 students:[{id:'s1',name:'<小宁>',username:'student1',className:'五年级',score:114,wrongNumbers:[2],blankNumbers:[2]}]
}]};
function harness(request=async()=>result){
 const nodes=new Map(),handlers={},calls=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',innerHTML:'',textContent:'',disabled:false});return nodes.get(key);};
 const root={isConnected:true,querySelector:node};node('#analysis-kind').value='A';
 const ctx=vm.createContext({teacher:true,user:{id:'teacher-one'},overview:{classes:[]},state:{},location:{hash:'#home'},encodeURIComponent,
  esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  document:{getElementById:()=>root,addEventListener:(name,fn)=>handlers[name]=fn},
  api:async url=>{calls.push(url);return request(url);}});
 for(const f of ['class-dashboard.js','exam-analysis.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx);
 return {ctx,node,root,handlers,calls,run:code=>vm.runInContext(code,ctx)};
}
test('错题面板呈现空题、学生题号和完整解析，姓名进行转义',async()=>{
 const h=harness();await h.run('loadExamAnalysis()');
 assert.match(h.node('[data-analysis-status]').textContent,/1 人尚未交卷/);
 const html=h.node('[data-analysis-body]').innerHTML;
 assert.match(html,/第二题完整题目/);assert.match(html,/错误率 100%/);assert.match(html,/其中 1 人未作答/);
 assert.match(html,/第2题未作答/);assert.match(html,/&lt;小宁&gt;/);assert.doesNotMatch(html,/<小宁>/);
 assert.match(html,/分组找余数/);assert.match(html,/查看答题报告/);
});
test('快速切换前后测时迟到响应不能覆盖当前统计',async()=>{
 let resolveOld;
 const h=harness(url=>url.includes('kind=A')?new Promise(resolve=>resolveOld=resolve):Promise.resolve({...result,kind:'B',groups:[]}));
 const first=h.run('loadExamAnalysis()');h.node('#analysis-kind').value='B';await h.run('loadExamAnalysis()');
 resolveOld(result);await first;
 assert.match(h.node('[data-analysis-body]').innerHTML,/还没有已交卷/);
 assert.doesNotMatch(h.node('[data-analysis-body]').innerHTML,/第二题完整题目/);
});
test('统计读取失败可重试，切换到学生视角后旧响应不渲染',async()=>{
 let failed=true;const h=harness(async()=>{if(failed)throw new Error('offline');return result;});
 await h.run('loadExamAnalysis()');assert.match(h.node('[data-analysis-status]').textContent,/读取失败/);
 failed=false;await h.run('loadExamAnalysis()');assert.match(h.node('[data-analysis-body]').innerHTML,/第二题完整题目/);
 let resolveOld;const delayed=harness(()=>new Promise(resolve=>resolveOld=resolve));
 const loading=delayed.run('loadExamAnalysis()');delayed.ctx.teacher=false;resolveOld(result);await loading;
 assert.equal(delayed.node('[data-analysis-body]').innerHTML,'');assert.equal(delayed.run('examAnalysisPanel()'),'');
});
test('同版全对显示明确结果，报告跳转绑定点击的学生与测评',async()=>{
 const group={...result.groups[0],questions:result.groups[0].questions.map(q=>({...q,wrongCount:0})),students:result.groups[0].students.map(s=>({...s,wrongNumbers:[],blankNumbers:[]}))};
 const h=harness(async()=>({...result,groups:[group]}));await h.run('loadExamAnalysis()');
 assert.match(h.node('[data-analysis-body]').innerHTML,/本版本已交卷学生全部答对/);
 const button={dataset:{analysisAction:'review',student:'s1'},closest:()=>h.root};
 h.handlers.click({target:{closest:()=>button}});
 assert.equal(h.ctx.state.current,'s1');assert.equal(h.ctx.location.hash,'review/A');
});

test('总览统计不混入旧卷或未交卷，答题矩阵支持筛选、空题与成绩零分',()=>{
 const h=harness(),group={version:'v3',submittedCount:2,questions:[{number:1,topic:'周期',wrongCount:1},{number:2,topic:'周期',wrongCount:1}],students:[
  {id:'s1',name:'小禾',score:0,wrongNumbers:[1,2],blankNumbers:[2]},
  {id:'s2',name:'小林',score:120,wrongNumbers:[],blankNumbers:[]}]};
 h.ctx.data={kind:'A',totalStudents:4,submittedCount:3,pendingCount:1,groups:[group],students:[
  {id:'s1',name:'小禾',username:'a',className:'一班',status:'submitted',version:'v3',scores:{A:0,B:60}},
  {id:'s2',name:'小林',username:'b',className:'一班',status:'submitted',version:'v3',scores:{A:120,B:null}},
  {id:'old',name:'旧卷学生',username:'c',className:'一班',status:'submitted',version:'v2',scores:{A:108,B:null}},
  {id:'pending',name:'待测学生',username:'d',className:'一班',status:'assigned',scores:{A:null,B:null}}]};
 h.ctx.group=group;
 const overview=h.run('classOverviewView(data,group)');assert.match(overview,/60.0/);assert.match(overview,/50% 未答对/);assert.match(overview,/完成 75%/);assert.doesNotMatch(overview,/NaN/);
 const matrix=h.run('classMatrixView(data,group)');assert.match(matrix,/小禾第2题未作答/);assert.match(matrix,/小林第1题答对/);assert.match(matrix,/其他版本/);assert.match(matrix,/待开始/);assert.match(matrix,/>0<\/button>/);assert.match(matrix,/\+60/);
 const low=h.run("classMatrixView(data,group,'low')");assert.match(low,/小禾/);assert.doesNotMatch(low,/小林|旧卷学生|待测学生/);
 const pending=h.run("classMatrixView(data,group,'pending')");assert.match(pending,/待测学生/);assert.doesNotMatch(pending,/data-analysis-action="review"/);
 assert.match(h.run("classMatrixView(data,group,'all','找不到')"),/没有符合/);
 const empty=h.run("classOverviewView({totalStudents:0,submittedCount:0,pendingCount:0,groups:[]},null)");assert.doesNotMatch(empty,/NaN|Infinity/);assert.match(empty,/暂无已交卷数据/);
});

test('点击后测分数打开后测报告，筛选名册不额外读取全班数据',async()=>{
 const h=harness();await h.run('loadExamAnalysis()');
 h.handlers.click({target:{closest:()=>({dataset:{analysisAction:'review',student:'s1',kind:'B'},closest:()=>h.root})}});
 assert.equal(h.ctx.location.hash,'review/B');
 h.handlers.change({target:{id:'analysis-focus',value:'pending',closest:()=>h.root}});
 assert.equal(h.calls.length,1);assert.match(h.node('[data-analysis-matrix]').innerHTML,/没有符合筛选/);
});

test('回顾测评面板使用100分与60分线，完整展示选择项和应用小问',async()=>{
 const data={kind:'R',totalScore:100,totalStudents:2,submittedCount:2,pendingCount:0,students:[
  {id:'r1',name:'小白',username:'review1',status:'submitted',scores:{R:59}},
  {id:'r2',name:'小雨',username:'review2',status:'submitted',scores:{R:60}}],groups:[{
  version:'r1',submittedCount:2,students:[
   {id:'r1',name:'小白',score:59,wrongNumbers:[1,23],blankNumbers:[]},
   {id:'r2',name:'小雨',score:60,wrongNumbers:[23],blankNumbers:[]}],questions:[
   {number:1,type:'multiple',topic:'等量',text:'请选择所有正确关系',options:[{value:'A',text:'两组同倍扩大'},{value:'B',text:'仅一项扩大'}],answer:['A'],explain:'各项一起扩大',wrongCount:1,blankCount:0,wrongRate:50,wrongStudents:[{id:'r1',name:'小白',username:'review1',answer:'B',blank:false}]},
   {number:23,type:'application',topic:'消去',text:'根据两张订单作答',parts:[{text:'每支笔多少钱？',points:5},{text:'每本本子多少钱？',points:5}],answer:['4','6'],explain:'先相减再代回',wrongCount:2,blankCount:0,wrongRate:100,wrongStudents:[{id:'r1',name:'小白',username:'review1',answer:'["4","5"]',blank:false}]}]}]};
 const h=harness(async()=>data);h.node('#analysis-kind').value='R';await h.run('loadExamAnalysis()');
 const html=h.node('[data-analysis-body]').innerHTML;
 assert.match(html,/59.5/);assert.match(html,/\/ 100/);assert.match(html,/低于60分/);assert.doesNotMatch(html,/120|72分|设计变式作业/);
 assert.match(html,/两组同倍扩大/);assert.match(html,/每本本子多少钱/);assert.match(html,/（1）4；（2）5/);assert.match(html,/（1）4；（2）6/);
 assert.match(html,/data-kind="R"/);assert.doesNotMatch(html,/<th scope="col">变化/);
 h.ctx.reviewData=data;h.ctx.reviewGroup=data.groups[0];
 const low=h.run("classMatrixView(reviewData,reviewGroup,'low')");assert.match(low,/小白/);assert.doesNotMatch(low,/小雨/);
});
