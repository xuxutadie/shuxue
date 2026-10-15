const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const eco=require('../server/world3d/ecoport.cjs');

// 这些验收方案由题面独立计算，不从服务端私有答案表读取。
const configurations=require('./fixtures/ecoport-solutions.cjs');
const solution=q=>structuredClone(configurations[eco.stages.findIndex(v=>v.id===q.id)]);
const body=(s,q,config=solution(q),extra={})=>({stageId:q.id,config,revision:s.ecoport?.revision||0,seconds:3,attemptId:randomUUID(),hintsUsed:0,...extra});

test('生态港18关都有可验证方案，仅提交数字答案或空方案不通关',()=>{
 assert.equal(eco.stages.length,18);assert.equal(new Set(eco.stages.map(q=>q.id)).size,18);
 for(const [i,q] of eco.stages.entries()){
  assert.equal(q.id,`eco-${Math.floor(i/3)+1}-${i%3+1}`);
  assert.equal(eco.judge(q,solution(q)).correct,true,q.id);
  assert.equal(eco.judge(q,{}).correct,false,q.id);
  assert.equal(eco.judge(q,{answer:44,correct:true,demo:true}).correct,false,q.id);
 }
});
test('查看旧存档不会写入新地图数据；锁定学生不能提交',()=>{
 const s={records:{old:{passed:true}},observatory:{revision:7,records:{}}},before=JSON.stringify(s);
 assert.equal(eco.view(s).unlocked,false);assert.equal(eco.view(s).stages.length,0);
 assert.equal(eco.view(s,true).active,0);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>eco.submit(s,body(s,eco.stages[0]),false),{status:403});
 assert.equal(JSON.stringify(s),before);
});
test('学生按顺序完成，错答可重试并留下首次结果、答对次数及提示记录',()=>{
 const s={};assert.throws(()=>eco.submit(s,body(s,eco.stages[1]),true),{status:403});
 const q=eco.stages[0];assert.equal(eco.submit(s,body(s,q,{pairs:[[0,1]],area:44},{hintsUsed:1}),true).correct,false);
 assert.equal(eco.view(s,true).active,0);assert.equal(eco.submit(s,body(s,q),true).reward,20);
 const r=eco.report(s)[0];assert.equal(r.count,2);assert.equal(r.firstCorrect,false);assert.equal(r.firstSuccessAt,2);
 assert.equal(r.hintsUsed,1);assert.equal(r.history[0].hintsUsed,1);assert.equal(r.history.length,2);
 assert.equal(eco.view(JSON.parse(JSON.stringify(s)),true).active,1);
});
test('幂等提交不会重复记录或发奖，改变方案和陈旧版本均拒绝',()=>{
 const s={},q=eco.stages[0],payload=body(s,q);assert.equal(eco.submit(s,payload,true).reward,20);
 const saved=JSON.stringify(s);assert.equal(eco.submit(s,payload,true).reward,0);assert.equal(JSON.stringify(s),saved);
 assert.throws(()=>eco.submit(s,{...payload,config:{pairs:[],area:44}},true),{status:409});
 assert.throws(()=>eco.submit(s,{...body(s,eco.stages[1]),revision:0},true),{status:409});
 assert.throws(()=>eco.submit(s,body(s,q),true),{status:403});
 assert.throws(()=>eco.submit(s,{...body(s,eco.stages[1]),attemptId:payload.attemptId},true),{status:409});
 assert.equal(eco.earned(s),20);
});
test('18关逐站修复，首次奖励700；刷新和其他学生的存档互不影响',()=>{
 let s={records:{legacy:1}},reward=0;const other={};
 for(const [i,q] of eco.stages.entries()){
  const v=eco.view(s,true);assert.equal(v.active,i);assert.equal(v.stations[Math.floor(i/3)].unlocked,true);
  if(i<15)assert.equal(v.stations[Math.floor(i/3)+1].unlocked,false);
  const out=eco.submit(s,body(s,q),true);reward+=out.reward;
  assert.equal(out.stationComplete,q.level===2);assert.equal(out.complete,i===17);
  s=JSON.parse(JSON.stringify(s));
 }
 assert.equal(reward,700);assert.equal(eco.earned(s),700);assert.equal(eco.view(s,true).active,-1);
 assert.ok(eco.view(s,true).stations.every(v=>v.repaired));assert.equal(s.records.legacy,1);
 assert.equal(eco.view(other,true).completed,0);assert.equal(eco.earned(other),0);
});
test('教师可信试玩可自由选关，重复体验不重复获奖，浏览器demo字段不越权',()=>{
 const s={},q=eco.stages[17];assert.throws(()=>eco.submit(s,{...body(s,q),demo:true},true),{status:403});
 assert.equal(eco.submit(s,body(s,q),true,true).reward,50);assert.equal(eco.view(s,true,true).demo,true);
 assert.ok(eco.view(s,true,true).stations.every(v=>v.unlocked));
 assert.equal(eco.submit(s,body(s,q),true,true).reward,0);assert.equal(eco.earned(s),50);
 assert.equal(eco.view({},false,true).unlocked,true);
});
test('公开题面无标准答案、解法或学生历史；公开视图无法改变题库及存档',()=>{
 const s={};eco.submit(s,body(s,eco.stages[0]),true);
 const v=eco.view(s,true);assert.equal(v.stages[0].history,undefined);assert.equal(v.stages[0].firstCorrect,undefined);
 const publicJSON=JSON.stringify(v);assert.ok(!/"(?:answer|solution|correctConfig|payload|attemptId|firstSuccessAt|hintsUsed)"/.test(publicJSON));
 v.stages[0].data.whole=999;assert.equal(eco.stages[0].data.whole,7);
 v.stations[0].repaired=true;assert.equal(eco.view(s,true).stations[0].repaired,false);
 const r=eco.report(s)[0];assert.equal(r.history[0].payload,undefined);assert.equal(r.history[0].id,undefined);
});
test('拼合必须完整且无重复；补板可接受不同不重叠布局但拒绝重复半格',()=>{
 const bridge=eco.stages[0],panels=eco.stages[3];
 assert.equal(eco.judge(bridge,{pairs:[[7,0],[6,1],[5,2],[4,3]],area:44}).correct,true);
 assert.equal(eco.judge(bridge,{pairs:[[0,1],[1,2],[3,4],[5,6]],area:44}).correct,false);
 const alternative={halves:[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0]],area:108};
 assert.equal(eco.judge(panels,alternative).correct,true);alternative.halves[7]=[0,0];assert.equal(eco.judge(panels,alternative).correct,false);
});
test('镜像同高且等距，双信标接受全部最短路线而拒绝绕路',()=>{
 const mirror=eco.stages[1],beacons=eco.stages[4];
 assert.equal(eco.judge(mirror,{...solution(mirror),mirror:[3,3]}).correct,false);
 for(const path of [['W','N','N'],['N','W','N'],['N','N','W']])assert.equal(eco.judge(beacons,{...solution(beacons),path}).correct,true);
 assert.equal(eco.judge(beacons,{...solution(beacons),path:['E','W','W','N','N']}).correct,false);
 assert.equal(eco.judge(beacons,{...solution(beacons),mirrors:[[3,3],[2,4]]}).correct,false);
});
test('独立枚举所有立方体方案，最少最多须同时满足两张正投影视图',()=>{
 const q=eco.stages[5],layouts=[];
 for(let a=1;a<=4;a++)for(let b=1;b<=4;b++)for(let c=1;c<=4;c++)for(let d=1;d<=4;d++){
  if(Math.max(a,c)===3&&Math.max(b,d)===4&&Math.max(a,b)===3&&Math.max(c,d)===4)layouts.push({heights:[[a,b],[c,d]],total:a+b+c+d});
 }
 assert.equal(layouts.length,11);const min=Math.min(...layouts.map(v=>v.total)),max=Math.max(...layouts.map(v=>v.total));
 assert.equal(min,9);assert.equal(max,13);
 for(const low of layouts.filter(v=>v.total===min))for(const high of layouts.filter(v=>v.total===max)){
  assert.equal(eco.judge(q,{min:low.heights,max:high.heights,minTotal:min,maxTotal:max}).correct,true);
 }
 assert.equal(eco.judge(q,{...solution(q),min:[[3,0],[2,4]]}).correct,false);
 assert.equal(eco.judge(q,{...solution(q),min:[[3,2],[1,4]],minTotal:10}).correct,false);
 assert.equal(eco.judge(eco.stages[2],{...solution(eco.stages[2]),total:6}).correct,false);
});
test('停留段运输车继续走，经过时间、行走时间及相遇位置必须全部一致',()=>{
 for(const index of [9,10,11]){
  const q=eco.stages[index],c=solution(q);const rest=c.phases.find(p=>p.mode==='rest');rest.gap=0;
  assert.equal(eco.judge(q,c).correct,false);
  assert.equal(eco.judge(q,{...solution(q),walking:solution(q).elapsed}).correct,false);
 }
 const q=eco.stages[8];assert.equal(eco.judge(q,{...solution(q),beforeBridge:true}).correct,false);
 assert.equal(eco.judge(eco.stages[7],{...solution(eco.stages[7]),checkGap:324}).correct,false);
});
test('牧场与水箱守恒；独立试验不可串接，零净变化不能当作耗尽',()=>{
 const pasture=eco.stages[12];assert.equal(eco.judge(pasture,{...solution(pasture),consumption:6}).correct,false);
 const record=eco.stages[13];assert.equal(eco.judge(record,{...solution(record),growth:12}).correct,false);
 const balance=eco.stages[14],bad=solution(balance);bad.trials[1].remaining=0;assert.equal(eco.judge(balance,bad).correct,false);
 const reversed=solution(balance);reversed.trials.reverse();assert.equal(eco.judge(balance,reversed).correct,true);
 assert.equal(eco.judge(eco.stages[15],{...solution(eco.stages[15]),outflow:6}).correct,false);
 const water=eco.stages[16],reset=solution(water);reset.phases[0].remaining=60;assert.equal(eco.judge(water,reset).correct,false);
 assert.equal(eco.judge(eco.stages[17],{...solution(eco.stages[17]),outflow:9}).correct,false);
});
test('非法请求不破坏存档，历史有界但累计次数保留',()=>{
 const s={},q=eco.stages[0];
 for(const extra of [{attemptId:'------------------------------------'},{seconds:NaN},{seconds:-1},{hintsUsed:-1},{hintsUsed:21},{config:[]},{revision:'0'}]){
  assert.throws(()=>eco.submit(s,{...body(s,q),...extra},true));assert.equal(s.ecoport,undefined);
 }
 for(let i=0;i<35;i++)eco.submit(s,body(s,q,{pairs:[],area:44}),true);
 const r=eco.report(s)[0];assert.equal(r.count,35);assert.equal(r.history.length,30);
 assert.equal(eco.submit(s,body(s,q),true).correct,true);assert.equal(eco.report(s)[0].firstSuccessAt,36);
});

module.exports={configurations,solution,body};
