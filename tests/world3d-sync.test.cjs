const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../server/world3d/engine.cjs');

// 使用真实答题引擎模拟服务器，仅替换网络和页面容器，复现响应丢失与多页冲突。
function harness(courseId='diagnostic'){
 const state=engine.initial();engine.start(state,courseId);
 const elements=new Map(),events={},calls=[];
 const element=()=>({value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(){},querySelector(){return null;},focus(){}});
 for(const id of ['app','answer','note','sync','toast'])elements.set(id,element());
 const document={body:{inert:false},hidden:false,getElementById:id=>elements.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
 const context=vm.createContext({document,location:{hash:'#practice',search:''},history:{replaceState(_a,_b,hash){context.location.hash=hash;}},window:{addEventListener(){},scrollTo(){}},URLSearchParams,structuredClone,AbortController,setTimeout,clearTimeout,setInterval(){},requestAnimationFrame(){},confirm:()=>true,
  GameDictation:{active:false,finish:async()=>{},cancel(){},controls:()=>''},GameAudio:{result(){},mode(){}},QuestionCard:{close(){}},GameCompletion:{close(){},show(){}},ThinkingTown:{dispose(){},html:()=>'',mount(){}},ThinkingExpedition:{dispose(){},html:()=>'',mount(){}},
  fetch:async(url,options)=>{
   const body=options.body&&JSON.parse(options.body);calls.push({url,body});
   if(h.failBefore){h.failBefore=false;throw Error('连接中断');}
   try{const extra=body?engine.runAction(state,body):{};const out={...engine.view(state),...extra};if(h.loseResponse){h.loseResponse=false;throw Error('响应丢失');}return {ok:true,json:async()=>out};}
   catch(e){if(!e.status)throw e;return {ok:false,status:e.status,json:async()=>({error:e.message})};}
  }});
 const source=fs.readFileSync('public/world3d/integration.js','utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('(async()=>{')),context);
 vm.runInContext(fs.readFileSync('public/world3d/completion.js','utf8'),context);
 const h={state,calls,context,elements,run:code=>vm.runInContext(code,context)};
 context.initialView=engine.view(state);
 h.run("accept(initialView);route='practice';owner='test';paint=()=>{};");
 h.answer=value=>{elements.get('answer').value=value;h.run('dirty=true;capture();');};
 return h;
}

test('草稿响应丢失后可以载入最新进度，不再被失败的保存队列阻塞',async()=>{
 const h=harness();h.answer('1000');h.loseResponse=true;
 await assert.rejects(h.run('saveDraft()'),/响应丢失/);
 const before=h.calls.length;await h.run("act('reload')");
 assert.equal(h.calls.length,before+1,'应重新读取服务器记录');
 assert.equal(h.run('practice.run.version'),1);assert.equal(h.run('practice.answer'),'1000');
 assert.equal(h.run('dirty'),false);
});

test('提交已成功但响应丢失，再次提交应恢复已保存结果并能进入下一题',async()=>{
 const h=harness();h.answer('1000');await h.run('saveDraft()');h.loseResponse=true;
 await h.run("act('submit')");assert.equal(engine.view(h.state).run.result.correct,true);
 await h.run("act('submit')");
 assert.equal(h.run('practice.run.result?.correct'),true,'遇到旧版本应读取已保存的答题结果');
 await h.run("act('next')");assert.equal(h.run('practice.run.index'),1);
 assert.equal(Object.values(h.state.records)[0].count,1,'恢复不能重复记录作答');
 assert.equal(h.context.document.body.inert,false);
});

test('另一个页面已前进，再点下一题只同步位置，不能多跳一题',async()=>{
 const h=harness();h.answer('1000');await h.run("act('submit')");
 const r=engine.view(h.state).run;engine.runAction(h.state,{runId:r.id,revision:r.version,action:'next'});
 await h.run("act('next')");
 assert.equal(h.run('practice.run.index'),1);assert.equal(engine.view(h.state).run.index,1);
});

test('草稿冲突时保留本页未提交的答案与思路，更新版本后允许再提交',async()=>{
 const h=harness();h.answer('1000');h.elements.get('note').value='先凑整';h.run('capture()');
 const r=engine.view(h.state).run;engine.runAction(h.state,{runId:r.id,revision:r.version,action:'draft',answer:'旧答案'});
 await h.run("act('submit')");
 assert.equal(h.run('practice.answer'),'1000');assert.equal(h.run('practice.note'),'先凑整');
 assert.equal(h.run('practice.run.version'),1);
 await h.run("act('submit')");assert.equal(h.run('practice.run.result?.correct'),true);
});

test('真正断网时不丢答案，网络恢复后可重新保存提交',async()=>{
 const h=harness();h.answer('1000');h.failBefore=true;await h.run("act('submit')");
 assert.equal(h.run('practice.answer'),'1000');assert.equal(h.run('dirty'),true);
 await h.run("act('submit')");assert.equal(h.run('practice.run.result.correct'),true);
});

test('米米委托提交响应丢失后恢复成功反馈、奖励和下一项准备',async()=>{
 const h=harness('story-bakery');h.answer('1000');
 h.run("practice.bakery={places:{0:0,1:1,2:0,3:1},work:{first:'500',second:'2'}};");
 await h.run('saveDraft()');h.loseResponse=true;await h.run("act('submit')");
 await h.run("act('submit')");assert.equal(h.run('practice.run.result.correct'),true);
 assert.equal(engine.view(h.state).world.adventure.points,10);
 await h.run("act('next')");assert.equal(h.run('practice.run.index'),1);
 assert.equal(engine.view(h.state).world.adventure.points,10);
});

test('读取最新进度也失败时保留本页输入，稍后可以再次恢复',async()=>{
 const h=harness();h.answer('尚未提交的答案');h.failBefore=true;
 await h.run("act('reload')");assert.equal(h.run('practice.answer'),'尚未提交的答案');
 assert.equal(h.run('dirty'),true);assert.equal(h.context.document.body.inert,false);
 await h.run("act('reload')");assert.equal(h.run('practice.run.index'),0);
});

test('另一页面已完成全部题目时只恢复完成状态，不重复提交',async()=>{
 const h=harness();h.answer('1000');await h.run("act('submit')");
 const {questions}=require('../server/world3d/content.cjs');
 while(h.state.active){const r=engine.view(h.state).run;if(!r.result)engine.runAction(h.state,{runId:r.id,revision:r.version,action:'submit',answer:questions.get(r.question.id).answer});const latest=engine.view(h.state).run;engine.runAction(h.state,{runId:latest.id,revision:latest.version,action:'next'});}
 await h.run("act('next')");assert.equal(h.run('practice'),null);assert.equal(Object.keys(h.state.records).length,6);
});
