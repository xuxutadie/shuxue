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
 vm.runInContext(fs.readFileSync('public/exam-analysis.js','utf8'),ctx);
 return {ctx,node,root,handlers,calls,run:code=>vm.runInContext(code,ctx)};
}
test('错题面板呈现空题、学生题号和完整解析，姓名进行转义',async()=>{
 const h=harness();await h.run('loadExamAnalysis()');
 assert.match(h.node('[data-analysis-status]').textContent,/1 人尚未交卷/);
 const html=h.node('[data-analysis-body]').innerHTML;
 assert.match(html,/第二题完整题目/);assert.match(html,/错误率 100%/);assert.match(html,/其中 1 人未作答/);
 assert.match(html,/2（空）/);assert.match(html,/&lt;小宁&gt;/);assert.doesNotMatch(html,/<小宁>/);
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
