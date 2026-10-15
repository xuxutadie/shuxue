const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const eco=require('../server/world3d/ecoport.cjs');
const solutions=require('./fixtures/ecoport-solutions.cjs');

// 用轻量 DOM 执行真实事件。服务器题面与判定也使用正式模块，避免两套示例互相验证。
function page(index=0,options={}){
 const listeners=new Map(),frames=new Map(),calls=[];let serial=0,now=0,markup='',elements=[];
 function element(tag,attributes={}){
  const attributesCopy={...attributes},dataset={};for(const [key,value] of Object.entries(attributes))if(key.startsWith('data-'))dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  const node={tagName:tag.toUpperCase(),dataset,value:attributes.value||'',disabled:'disabled' in attributes,textContent:'',innerHTML:'',classList:{add(){},remove(){}},
   hasAttribute:key=>key in attributesCopy,setAttribute(key,value){attributesCopy[key]=value;},getAttribute:key=>attributesCopy[key],focus(){},closest(selector){return selector.split(',').some(part=>this.matches(part))?this:null;},
   matches(selector){selector=selector.trim();if(selector.startsWith('[')){const match=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return !!match&&this.hasAttribute(match[1])&&(match[2]===undefined||attributesCopy[match[1]]===match[2]);}return selector===tag;}};return node;
 }
 const box={hidden:false,scrollTop:0,append(node){markup+=`<p>${node.textContent}</p>`;},addEventListener(name,handler){listeners.set(name,handler);},removeEventListener(name,handler){if(listeners.get(name)===handler)listeners.delete(name);},querySelectorAll(selector){return elements.filter(node=>selector.split(',').some(part=>node.matches(part)));},querySelector(selector){if(selector==='.eco-feedback')return {textContent:''};if(selector==='[data-eco-visual]'&&markup.includes('<div data-eco-visual>'))return {set innerHTML(value){markup=markup.replace(/<div data-eco-visual>[\s\S]*?<\/div>/,()=>`<div data-eco-visual>${value}</div>`);}};return elements.find(node=>node.matches(selector));}};
 Object.defineProperty(box,'innerHTML',{get:()=>markup,set(value){markup=value;elements=[];for(const match of value.matchAll(/<(button|input|circle)\b([^>]*)>/g)){const attributes={};for(const pair of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[pair[1]]=pair[2]??'';elements.push(element(match[1],attributes));}}});
 const context=vm.createContext({document:{createElement:()=>({textContent:''})},console,Math,Set,Array,Number,String,JSON,structuredClone,crypto:{randomUUID},performance:{now:()=>now},requestAnimationFrame(callback){const id=++serial;frames.set(id,callback);return id;},cancelAnimationFrame(id){frames.delete(id);},setTimeout,clearTimeout,GameAudio:{controls:()=>'<button type="button" data-sound-action="music">音乐</button>',update(){}}});
 vm.runInContext(fs.readFileSync('public/world3d/ecoport.js','utf8'),context);const api=vm.runInContext('ThinkingEcoport',context),q=eco.stages[index],state={};let latest=eco.view(state,true,!!options.demo),closed=0;
 const submit=async payload=>{calls.push(structuredClone(payload));if(options.submit)return options.submit(payload,state);const out=eco.submit(state,payload,true,!!options.demo);latest=eco.view(state,true,!!options.demo);return {...out,state:{world:{ecoport:latest,playground:{balance:eco.earned(state)}}}};};
 const stop=api.task(box,q,latest,{submitEco:submit,readonly:!!options.readonly,openNext(){closed++;}},async()=>{},()=>{closed++;});
 const click=async attributes=>{const target=element('button',attributes);await listeners.get('click')?.({target});};
 function input(path,value){const target=element('input',{'data-eco-value':path,value:String(value)});listeners.get('input')?.({target});}
 function frame(time){now=time;const active=[...frames.values()];frames.clear();for(const callback of active)callback(time);}
 return {api,q,box,calls,click,input,stop,frame,frames,get state(){return state;},get html(){return markup;},get closed(){return closed;}};
}

test('18关操作台都有完整题面，预测默认空白，不把验收方案放进学生页面',()=>{
 for(let index=0;index<eco.stages.length;index++){
  const p=page(index),config=p.api.initialConfig(p.q);assert.match(p.html,/我的解题操作台/);assert.ok(p.html.includes(p.q.text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));
  assert.equal(p.api.predictionReady(p.q,config),false,p.q.id);assert.equal(eco.judge(p.q,config).correct,false,p.q.id);assert.doesNotMatch(p.html,/正确答案|标准答案|参考答案/);p.stop();
 }
});
test('三角形需要真正配对；答错能撤销重试，同次失败请求保留方案',async()=>{
 const p=page();assert.equal((p.html.match(/data-eco-triangle=/g)||[]).length,8);
 p.input('area',44);await p.click({'data-eco-test':''});assert.equal(p.state.ecoport.records[p.q.id].passed,false);
 for(let index=0;index<8;index+=2){await p.click({'data-eco-triangle':String(index)});await p.click({'data-eco-triangle':String(index+1)});}
 await p.click({'data-eco-undo':''});await p.click({'data-eco-test':''});assert.equal(p.calls.at(-1).config.pairs.length,3);
 await p.click({'data-eco-triangle':'6'});await p.click({'data-eco-triangle':'7'});await p.click({'data-eco-test':''});assert.equal(p.state.ecoport.records[p.q.id].passed,true);assert.equal(p.state.ecoport.records[p.q.id].count,3);assert.match(p.html,/星光/);
 p.stop();
});
test('镜像摆点和双信标路线由真实操作提交，支持不同最短走法',async()=>{
 const p=page(4,{demo:true});
 await p.click({'data-eco-grid':'-3,3'});await p.click({'data-eco-target':'mirror0'});await p.click({'data-eco-grid':'3,3'});await p.click({'data-eco-target':'mirror1'});await p.click({'data-eco-grid':'2,5'});
 for(const direction of ['N','W','N'])await p.click({'data-eco-step':direction});p.input('distance',6);await p.click({'data-eco-test':''});
 assert.equal(p.state.ecoport.records[p.q.id].passed,true);assert.deepEqual(p.calls[0].config.path,['N','W','N']);p.stop();
});
test('库存最少和最多各保存自己的四摞，投影视图来自真实搭建',async()=>{
 const p=page(5,{demo:true});
 for(const [mode,layout] of [['min',[[3,1],[1,4]]],['max',[[3,3],[3,4]]]]){
  await p.click({'data-eco-inventory':mode});
  for(let row=0;row<2;row++)for(let col=0;col<2;col++)for(let level=1;level<layout[row][col];level++)await p.click({'data-eco-stack':`${row},${col},1`});
 }
 assert.match(p.html,/当前正面正投影/);assert.match(p.html,/当前左侧正投影/);p.input('minTotal',9);p.input('maxTotal',13);await p.click({'data-eco-test':''});assert.equal(p.state.ecoport.records[p.q.id].passed,true);p.stop();
});
test('18关均能通过页面提供的操作提交有效方案，数值和选择不会丢失',async()=>{
 for(let index=0;index<eco.stages.length;index++){
  const p=page(index,{demo:true}),answer=solutions[index];
  if(p.q.kind==='bridge')for(const pair of answer.pairs)for(const triangle of pair)await p.click({'data-eco-triangle':String(triangle)});
  if(p.q.kind==='mirror'){await p.click({'data-eco-grid':answer.moved.join(',')});await p.click({'data-eco-target':'mirror'});await p.click({'data-eco-grid':answer.mirror.join(',')});}
  if(p.q.kind==='cubes'){await p.click({'data-eco-remove':'0,0'});await p.click({'data-eco-remove':'0,0'});}
  if(p.q.kind==='panels')for(const half of answer.halves)await p.click({'data-eco-panel':half.join(',')});
  if(p.q.kind==='beacons'){
   await p.click({'data-eco-grid':answer.moved.join(',')});for(let i=0;i<2;i++){await p.click({'data-eco-target':'mirror'+i});await p.click({'data-eco-grid':answer.mirrors[i].join(',')});}for(const step of answer.path)await p.click({'data-eco-step':step});
  }
  if(p.q.kind==='inventory')for(const type of ['min','max']){await p.click({'data-eco-inventory':type});for(let row=0;row<2;row++)for(let col=0;col<2;col++)for(let height=1;height<answer[type][row][col];height++)await p.click({'data-eco-stack':`${row},${col},1`});}
  async function fill(value,prefix=''){
   for(const [key,next] of Object.entries(value)){
    const path=prefix?prefix+'.'+key:key;
    if(next&&typeof next==='object'){await fill(next,path);continue;}
    if(p.html.includes(`data-eco-value="${path}"`))p.input(path,next);
    else if(p.html.includes(`data-eco-pick="${path}"`))await p.click({'data-eco-pick':path,'data-eco-choice':String(next)});
   }
  }
  await fill(answer);await p.click({'data-eco-test':''});assert.equal(p.state.ecoport.records[p.q.id].passed,true,p.q.id+': '+p.html);p.stop();
 }
});
test('未作预测不能播放追赶；播放学生错误预测，不自动求相遇时间',async()=>{
 const p=page(6,{demo:true});assert.match(p.html,/data-eco-play disabled/);await p.click({'data-eco-play':''});assert.equal(p.frames.size,0);
 p.input('slowStart',-8);p.input('fastStart',0);p.input('catchTime',4);p.input('meeting',300);await p.click({'data-eco-play':''});assert.equal(p.frames.size,1);p.frame(3000);
 assert.match(p.html,/第 4.0 分钟 · 相差 240.0 米/);assert.doesNotMatch(p.html,/第 12.0 分钟/);assert.equal(p.calls.length,0);p.stop();
});
test('动画每帧只更新图示，保留输入框与声音按钮的原始节点',async()=>{
 const p=page(6,{demo:true});p.input('catchTime',4);p.input('meeting',300);const field=p.box.querySelector('[data-eco-value="catchTime"]'),sound=p.box.querySelector('[data-sound-action]');await p.click({'data-eco-play':''});p.frame(500);p.frame(1500);
 assert.equal(p.box.querySelector('[data-eco-value="catchTime"]'),field);assert.equal(p.box.querySelector('[data-sound-action]'),sound);assert.match(p.html,/第 2.0 分钟/);p.stop();
});
test('模拟遵守停留和同时生长消耗，第二水段连接真实余量',()=>{
 const p=page();
 const rest=p.api.simulate(eco.stages[9],solutions[9],8/17);assert.equal(rest.slow-rest.fast,270);assert.equal(rest.fast,450);
 const twoRest=p.api.simulate(eco.stages[11],solutions[11]);assert.equal(twoRest.time,21);assert.equal(twoRest.fast,1080);assert.equal(twoRest.slow,1080);
 const pasture=p.api.simulate(eco.stages[12],{...solutions[12],days:2});assert.equal(pasture.amount,36);
 const tank=p.api.simulate(eco.stages[16],{phases:[{inflow:4,outflow:10,minutes:5,remaining:999},{inflow:4,outflow:9,minutes:6,remaining:999}]},5/11);assert.ok(Math.abs(tank.amount-30)<1e-8);assert.equal(p.api.simulate(eco.stages[16],solutions[16]).amount,0);p.stop();
});
test('增长与平衡三个试验独立开始，0净变化不会出现除零',()=>{
 const p=page(14);const result=p.api.simulate(p.q,solutions[14]);assert.equal(result.trials[0].amount,30);assert.equal(result.trials[1].amount,24);assert.equal(result.trials[2].amount,0);assert.ok(result.trials.every(trial=>Number.isFinite(trial.amount)));p.stop();
});
test('只读页面不能操作、提交或播放，声音开关仍可使用',async()=>{
 const p=page(6,{readonly:true});p.input('catchTime',12);await p.click({'data-eco-play':''});await p.click({'data-eco-test':''});assert.equal(p.frames.size,0);assert.equal(p.calls.length,0);assert.match(p.html,/教师独立试玩/);assert.equal(p.box.querySelector('[data-sound-action]').disabled,false);p.stop();
});
test('网络失败复用提交编号，改方案后新建编号，提示使用随记录保存',async()=>{
 const p=page(0,{submit:async()=>{throw Error('连接暂时中断');}});await p.click({'data-eco-hint':''});await p.click({'data-eco-test':''});await p.click({'data-eco-test':''});assert.equal(p.calls[0].attemptId,p.calls[1].attemptId);assert.equal(p.calls[0].hintsUsed,1);
 p.input('area',40);await p.click({'data-eco-test':''});assert.notEqual(p.calls[2].attemptId,p.calls[1].attemptId);assert.match(p.html,/连接暂时中断/);p.stop();
});
test('关闭任务会停止动画并移除事件，教师选关只出现在独立试玩',async()=>{
 const p=page(15,{demo:true});p.input('outflow',8);p.input('netChange',-5);p.input('remaining',9);await p.click({'data-eco-play':''});assert.equal(p.frames.size,1);p.stop();assert.equal(p.frames.size,0);await p.click({'data-eco-test':''});assert.equal(p.calls.length,0);
 const world={ecoport:eco.view({},true,true),observatory:{completed:18}};assert.match(p.api.html(world,true),/data-eco-stage/);assert.doesNotMatch(p.api.html(world,false),/data-eco-stage/);assert.equal((p.api.html(world,true).match(/<option value="eco-/g)||[]).length,18);
});
