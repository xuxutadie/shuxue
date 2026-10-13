// 第三张地图：公开题面与服务端判题分离，进度保存在原有个人游戏档案。
const {fail}=require('../db');
const names=['飞艇码头','星灯长廊','齿轮工坊','镜光花园','气象观测台','中央天文塔'];
const stories=['营地的信号传到了云海！先校准飞艇的配重，送来维修能源。','能源卸下了，但长廊星灯的顺序被风打乱。接好灯，大家才能通行。','道路亮起来了。让传动齿轮同时回到标记处，启动动力装置。','动力已经恢复。转动镜面，把阳光送到花园的接收器。','观测器亮起，几份气象记录却互相矛盾。找出正确的信号来源。','收到准确坐标了！把能源送到天文塔，重新点亮云海星图。'];
const topics=['等量关系与消去','周期规律','公倍数与共同周期','方向与直角转弯','假设与逻辑推理','有序尝试与路线规划'];
const stages=[];
function add(station,level,kind,text,data,hint){stages.push({id:`sky-${station+1}-${level+1}`,station,level,kind,title:`${names[station]} · 挑战${level+1}`,topic:topics[station],story:stories[station],text,data,hint,reward:[10,20,30][level]});}
[[2,6,18],[3,8,29],[4,12,44]].forEach(([capsules,fixed,total],l)=>add(0,l,'balance',`左侧有${capsules}个同样重的能源罐和${fixed}千克配重，右侧有${total}千克配重，天平平衡。先同时移走两侧相同重量，再平均分成${capsules}组，调整单罐配重，使每组重新平衡。每个能源罐重多少千克？`,{capsules,fixed,total},'两侧同时减去相同重量后，还剩下什么？平均分组时，两侧要除以相同的组数。'));
[[['黄','蓝','粉'],14],[['蓝','黄','黄','粉'],23],[['粉','蓝','黄','蓝','黄'],37]].forEach(([pattern,start],l)=>add(1,l,'pattern',`灯光按屏幕上的顺序循环。第1盏从最左边开始。请修复第${start}、${start+1}、${start+2}盏灯，依次设置它们的颜色。`,{pattern,start,colors:['黄','蓝','粉']},'先找完整的一组，再看目标位置落在这一组的第几盏。整除时是组内最后一盏。'));
[[4,6],[6,8],[6,8,10]].forEach((periods,l)=>add(2,l,'gear',`齿轮分别每${periods.join('、')}秒转一圈。0秒时标记同时朝上。请调整时间，找到它们第一次重新同时朝上的时刻（不包括0秒）。`,{periods,max:periods.length===3?120:48},'分别找每个周期的倍数，再找最早重复出现的正数。可以用按钮逐秒观察标记。'));
[1,2,3].forEach((count,l)=>add(3,l,'mirror',`阳光从左侧入口向右照射。点击${count}面镜子，把它们转成“／”或“＼”，让光线经过镜面转弯，最后到达标有★的接收器。每次反射转一个直角，光线不能离开花园。`,{width:6,height:5,mirrors:[[2,1],[2,3],[4,3]].slice(0,count),goal:[[2,4],[5,3],[4,0]][l]},'从入口开始一段一段追踪：镜子改变行进方向，不是把光直接传送到接收器。'));
[
 {people:['北站','东站','西站'],claims:[{set:[0]},{set:[1]},{set:[0],not:true}],trueCount:2},
 {people:['晴站','雨站','风站'],claims:[{set:[0]},{set:[1]},{set:[2],not:true},{set:[0],not:true}],trueCount:1},
 {people:['甲站','乙站','丙站','丁站'],claims:[{set:[0,2]},{set:[1],not:true},{set:[2]},{set:[3],not:true}],trueCount:3}
].forEach((data,l)=>add(4,l,'logic',`只有一个观测站发出了正确的定位信号。下面${data.claims.length}条记录中恰好${data.trueCount}条是真的。请假设信号来自哪个站，并逐条标记在这个假设下记录是真还是假。`,data,'先选一个站作为假设，再逐条核对；真话数量必须与题目完全一致。'));
[
 {size:4,blocked:[[1,1]],via:[[2,1]],routes:1},
 {size:5,blocked:[[1,1],[3,3]],via:[[2,1],[3,2]],routes:1},
 {size:6,blocked:[[1,1],[2,3],[4,4]],via:[[2,2],[4,3]],routes:2}
].forEach((data,l)=>add(5,l,'route',`从左下角出发，只能向东或向北移动，每次走一格。避开×，经过所有◆补给点，到达右上角★。请设计${data.routes===2?'两条不同的路线':'一条路线'}，为天文塔送去能源。`,data,'按固定顺序尝试岔路。遇到封路可以撤回；要先经过每个补给点，再抵达终点。'));
const record=(s,id)=>s.observatory?.records?.[id];
function earned(s){return stages.reduce((sum,q)=>sum+(record(s,q.id)?.passed?q.reward:0),0)+(stages.every(q=>record(s,q.id)?.passed)?60:0);}
function view(s,unlocked=false){
 const completed=stages.filter(q=>record(s,q.id)?.passed).length;
 const active=stages.findIndex(q=>!record(s,q.id)?.passed);
 return {unlocked,completed,total:18,complete:completed===18,active,revision:s.observatory?.revision||0,earned:earned(s),stations:names.map((title,i)=>({title,story:stories[i],topic:topics[i],repaired:stages.filter(q=>q.station===i).every(q=>record(s,q.id)?.passed),unlocked:unlocked&&(active<0||i<=Math.floor(active/3)),completed:stages.filter(q=>q.station===i&&record(s,q.id)?.passed).length})),stages:unlocked?stages.map(q=>({...q,passed:!!record(s,q.id)?.passed,count:record(s,q.id)?.count||0})):[]};
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
function trace(data,turns){
 let x=0,y=1,dx=1,dy=0;const path=[[x,y]],seen=new Set();
 for(let n=0;n<80;n++){
  if(x===data.goal[0]&&y===data.goal[1])return {hit:true,path};
  const k=data.mirrors.findIndex(p=>p[0]===x&&p[1]===y);
  if(k>=0){if(turns[k]===1)[dx,dy]=[dy,dx];else [dx,dy]=[-dy,-dx];}
  const key=[x,y,dx,dy].join(',');if(seen.has(key))break;seen.add(key);x+=dx;y+=dy;
  if(x<0||y<0||x>=data.width||y>=data.height)break;path.push([x,y]);
 }return {hit:false,path};
}
function judge(q,c){
 const d=q.data;let correct=false,description='';
 if(q.kind==='balance'){correct=c.removed===d.fixed&&c.groups===d.capsules&&Number.isInteger(c.unit)&&c.unit*d.capsules===d.total-d.fixed;description=`同时移走${c.removed}千克，分${c.groups}组，每罐${c.unit}千克`;}
 if(q.kind==='pattern'){correct=Array.isArray(c.colors)&&c.colors.length===3&&c.colors.every((v,i)=>v===d.pattern[(d.start+i-1)%d.pattern.length]);description=`灯光方案：${(c.colors||[]).join('、')}`;}
 if(q.kind==='gear'){correct=c.time===d.periods.reduce((a,b)=>a*b/gcd(a,b),1);description=`选择${c.time}秒`;}
 if(q.kind==='mirror'){correct=Array.isArray(c.turns)&&c.turns.length===d.mirrors.length&&c.turns.every(v=>v===1||v===-1)&&trace(d,c.turns).hit;description=`镜面：${(c.turns||[]).map(v=>v===1?'＼':'／').join('、')}`;}
 if(q.kind==='logic'){const truths=d.claims.map(a=>a.set.includes(c.person)!==!!a.not);correct=Number.isInteger(c.person)&&c.person>=0&&c.person<d.people.length&&truths.filter(Boolean).length===d.trueCount&&Array.isArray(c.truth)&&c.truth.length===truths.length&&truths.every((v,i)=>c.truth[i]===v);description=`假设${d.people[c.person]||'未选择'}，判断：${(c.truth||[]).map(v=>v?'真':'假').join('、')}`;}
 if(q.kind==='route'){
  const paths=c.paths;correct=Array.isArray(paths)&&paths.length===d.routes&&paths.every(steps=>{
   if(!Array.isArray(steps)||steps.length!==2*(d.size-1))return false;
   let x=0,y=0;const visits=new Set(['0,0']);
   for(const step of steps){if(!['E','N'].includes(step))return false;step==='E'?x++:y++;if(x>=d.size||y>=d.size||d.blocked.some(p=>p[0]===x&&p[1]===y))return false;visits.add(`${x},${y}`);}
   return x===d.size-1&&y===d.size-1&&d.via.every(p=>visits.has(p.join(',')));
  })&&new Set(paths.map(p=>p.join(''))).size===d.routes;
  description=`路线：${(paths||[]).map(p=>p.map(v=>v==='E'?'东':'北').join('→')).join('；')}`;
 }
 return {correct,description,feedback:correct?'方案验证通过，装置恢复了一部分能量！':q.hint};
}
function submit(s,body,unlocked){
 if(!unlocked)fail(403,'先完成星光探险营的六站修复，再前往天文城。');
 const q=stages.find(q=>q.id===body.stageId);
 if(!q||typeof body.attemptId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.attemptId)||!body.config||typeof body.config!=='object'||Array.isArray(body.config)||JSON.stringify(body.config).length>3000||!Number.isFinite(body.seconds)||body.seconds<0||body.seconds>86400)fail(400,'操作记录不正确，请重新检查。');
 const payload=JSON.stringify(body.config),old=record(s,q.id),repeat=old?.history.find(a=>a.id===body.attemptId);
 if(repeat){if(repeat.payload!==payload)fail(409,'同一次提交不能更换方案。');return {correct:repeat.correct,description:repeat.description,feedback:repeat.feedback,reward:0,stageId:q.id,stationComplete:q.level===2&&repeat.correct,complete:stages.every(q=>record(s,q.id)?.passed)};}
 if(body.revision!==(s.observatory?.revision||0))fail(409,'另一页面已更新进度，请关闭卡片后刷新地图。');
 const active=stages.find(q=>!record(s,q.id)?.passed);
 if(q.id!==active?.id)fail(403,old?.passed?'这项挑战已经完成。':'请先完成当前挑战。');
 let result;try{result=judge(q,body.config);}catch{fail(400,'操作方案格式不正确。');}
 const before=earned(s),entry=old||{passed:false,count:0,firstCorrect:false,firstSuccessAt:null,history:[]};
 entry.count++;if(entry.count===1)entry.firstCorrect=result.correct;
 if(result.correct){entry.passed=true;entry.firstSuccessAt=entry.count;}
 entry.history.push({id:body.attemptId,payload,...result,seconds:Math.round(body.seconds),created:new Date().toISOString()});entry.history=entry.history.slice(-30);
 s.observatory??={revision:0,records:{}};s.observatory.records[q.id]=entry;s.observatory.revision++;
 return {...result,reward:earned(s)-before,stageId:q.id,stationComplete:q.level===2&&result.correct,complete:stages.every(q=>record(s,q.id)?.passed)};
}
function report(s){return stages.map(q=>{const r=record(s,q.id);return {id:q.id,title:q.title,topic:q.topic,passed:!!r?.passed,count:r?.count||0,firstCorrect:!!r?.firstCorrect,firstSuccessAt:r?.firstSuccessAt||null,history:(r?.history||[]).map(({payload,id,...a})=>a)};});}
module.exports={stages,view,submit,earned,report,judge,trace};
