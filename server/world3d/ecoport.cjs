// 第四张地图：题面只公开已知条件，操作方案、顺序和奖励由服务端核验。
const {fail}=require('../db');
const names=['星图桥','镜影货仓','疾风驿站','山路补给站','云端牧场','生态控制塔'];
const npcs=['测绘员露露','仓储机器人方方','导航员疾风','补给员阿岚','管理员禾禾','工程师澄澄'];
const topics=['格点面积、镜像与空间遮挡','面积倒推、镜像路线与正投影视图','同向追及与相遇位置','停留分段与经过时间','持续增长、净变化与反推','持续进水与分阶段排水'];
const stories=[
 '天文城的星图找到了生态港。露露请你修好星图桥，让大家穿过浓雾。',
 '桥已经连通！方方需要准确的图纸，才能恢复仓库的货物通道。',
 '货物准备好了，携带补给坐标的运输车却先出发了。帮疾风安排追赶。',
 '找到了补给路线。阿岚提醒你：机器人要停下来补给，运输车可不会等它。',
 '补给运到了牧场。禾禾需要你同时考虑每天长出的草和牛吃掉的草。',
 '牧场恢复了生机。澄澄请你稳定供水，让水渠和港口喷泉重新运行。'
];
const stages=[];
function add(station,level,kind,title,text,data,hint){
 stages.push({id:`eco-${station+1}-${level+1}`,station,level,kind,title,topic:topics[station],story:stories[station],text,data,hint,reward:[20,30,50][level]});
}
add(0,0,'bridge','拼回桥面','桥面图纸由7个完整方格和8个沿对角线切出的半格组成，各部分不重叠。每个方格边长2米。请把半格两两拼成整格，再预测桥面的总面积（平方米）。',{whole:7,halfCount:8,cellSide:2},'先检查每块半格是否恰好使用一次，再想一想：边长2米的整格，面积是几平方米？');
add(0,1,'mirror','移动后的镜像','图纸上有一条竖直镜面。A在镜面左侧5格、高度2格处，先向镜面移动2格得到B；每格长3厘米。先移动A，再把B的镜像C放好，并预测B与C的水平距离（厘米）。',{point:[-5,2],move:[2,0],cellLength:3},'先确定移动后的B。镜像点需要到镜面等距、在镜面另一侧，而且与B同高。');
add(0,2,'cubes','被挡住的货箱','四摞小正方体放在前后两排、左右两列。前排从左到右为3层、2层，后排从左到右为2层、4层。拿走前排左侧最上面的2块，再设置正前方左右两列的轮廓高度，预测剩余的总块数。',{heights:[[3,2],[2,4]],remove:{row:0,col:0,count:2}},'正面轮廓每列取前后两摞中较高的一摞。被挡住的块仍在仓库里，总块数要数四摞。');
add(1,0,'panels','反推补板数量','仓库平台已有8个完整方格，需要补入若干沿对角线切出的半格。每个方格边长3米，补完后平台面积必须为108平方米。请选择并放好所需的半格，不能重叠，再核验总面积。',{whole:8,cellSide:3,targetArea:108,maxAddedCells:8},'先把目标面积换成整格数量，再比较已有整格和目标整格；一整格需要几块半格？');
add(1,1,'beacons','修复双信标路线','竖直镜面左侧，A在左4格、高1格处，B在左2格、高5格处。把A向镜面移1格、向上移2格，B不动，再放置A和B的镜像。每格长2米，只能沿横竖格线走。请画出两个镜像间的一条最短路线，并预测路线长度（米）。',{points:[[-4,1],[-2,5]],move:[1,2],cellLength:2,bounds:{minX:-6,maxX:6,minY:0,maxY:6}},'先移动原点，再镜像。横向和竖向分别至少要走多少格？最短路线可以有不同的走法。');
add(1,2,'inventory','同样视图不同库存','底座有前后两排、左右两列，共4个位置，每处至少放1块相同小正方体，只能竖直堆叠。正前方看到左右两列高3层、4层；左侧看到前后两排高3层、4层。分别搭出同时满足两张正投影视图的最少和最多方案，并预测两种方案的块数。',{front:[3,4],side:[3,4],rows:2,cols:2,minHeight:1,maxHeight:4},'每摞同时受到所在行和列的轮廓限制。最少方案保留必要的最高摞，最多方案检查每个位置能否再加一块。');
add(2,0,'catch','追回运输车','运输车从起点以45米/分钟先走8分钟，机器人随后从同一起点以75米/分钟沿同一条路同向追赶，两者一直不停。请在同一时间轴上设置出发时刻，预测机器人出发后几分钟首次追上，以及相遇处距起点多少米。',{slow:45,fast:75,lead:8},'先把机器人出发的时刻记作0。运输车已经领先多少米？此后每过一分钟，差距减少多少米？');
add(2,1,'catch-check','先看中途差距','运输车以54米/分钟先走6分钟，机器人以90米/分钟从同一起点同向追赶，两者不停。请标记机器人追4分钟时两者的位置与差距，再预测从机器人出发算几分钟首次追上、相遇位置在哪里。',{slow:54,fast:90,lead:6,checkTime:4},'中途位置要从同一个起点量起。运输车的行走时间包括先走的时间，机器人只走了追赶的时间。');
add(2,2,'catch-bridge','能在桥前追上吗','运输车以48米/分钟先走5分钟，机器人随后以72米/分钟从同一起点同向追，两者不停。桥入口距起点600米。预测真正的相遇时刻和位置，再判断能否在运输车驶入桥前追上。',{slow:48,fast:72,lead:5,bridge:600},'先求真正追上的位置，再与桥入口的位置比较。速度更快，并不保证能在指定位置之前追上。');
add(3,0,'catch-rest','追赶者中途补给','运输车以45米/分钟先走8分钟，机器人以75米/分钟同向追赶。机器人先追6分钟，原地停2分钟，再以原速继续；运输车始终不停。请安排三个时间段并预测各段结束的差距，求总经过时间、实际行走时间和相遇位置。',{slow:45,fast:75,lead:8,phases:[{mode:'walk',minutes:6},{mode:'rest',minutes:2},{mode:'walk',minutes:null}]},'机器人停留时，运输车仍前进。先分别求追赶段减少的差距和停留段增加的差距，再安排最后的追赶。');
add(3,1,'catch-recover','找回缺失的停留记录','运输车以45米/分钟先走8分钟。机器人以90米/分钟同向追赶，先追3分钟，原地停留一段时间后按原速再追。运输车始终不停，机器人首次出发12分钟后追上。请补全停留和后续追赶时间，核对每段差距、实际行走时间及相遇位置。',{slow:45,fast:90,lead:8,elapsed:12,phases:[{mode:'walk',minutes:3},{mode:'rest',minutes:null},{mode:'walk',minutes:null}]},'相遇时运输车一共走了多久、走了多远？机器人走同样的路程需要实际行走多久？经过时间与行走时间之间差了什么？');
add(3,2,'catch-double','两次补给的完整追赶','运输车以40米/分钟先走6分钟，机器人以60米/分钟同向追。机器人追5分钟，停2分钟，再追4分钟，停1分钟，随后按原速追到首次追上；运输车不停。请安排五个时间段，预测每段结束的差距、总经过时间、实际行走时间和相遇位置。',{slow:40,fast:60,lead:6,phases:[{mode:'walk',minutes:5},{mode:'rest',minutes:2},{mode:'walk',minutes:4},{mode:'rest',minutes:1},{mode:'walk',minutes:null}]},'按时间顺序更新差距，不要把两次停留合并到错误的位置。最后核对机器人实际行走时间是否少于总经过时间。');
add(4,0,'pasture','看清每天净少多少','原有草48份，每天匀速长3份，9头牛每天每头吃1份，从相同起始时刻开始放牧。请在同一天里同时安排生长与吃草，预测每天草量净变化及几天恰好吃完。',{initial:48,growth:3,cows:9,perCow:1},'每天既有新长出的草，也有牛吃掉的草。草量每天真正减少多少，才能决定原有草能维持多久。');
add(4,1,'pasture-records','两份记录反推牧场','同一片草地用相同初始草量作两种独立方案比较：6头牛吃12天、10头牛吃6天，均恰好吃完。草每天匀速长，每头牛每天吃1份。对齐两份记录，求每天增长量、原有草量；再从相同初始量放14头牛，预测几天恰好吃完。两种记录并非先后连续放牧。',{records:[{cows:6,days:12},{cows:10,days:6}],perCow:1,trialCows:14},'先分别求两份记录的总吃草量。原有草量相同，两份记录的总量差来自多生长了多少天？');
add(4,2,'pasture-balance','草会增加、保持还是耗尽','原有草24份，每天长4份，每头牛每天吃1份。分别从相同初始量放3头、4头、6头牛。预测三种草量趋势、3头牛放6天后的草量，以及6头牛的耗尽时间；4头牛也观察6天。最后选择保持草量长期不减少时最多能放几头牛。三个试验均从24份开始。',{initial:24,growth:4,perCow:1,cows:[3,4,6],checkDays:6},'比较每天的生长与消耗。生长多于消耗、等于消耗、少于消耗时，草量会有什么不同？不减少不等于一定耗尽。');
add(5,0,'water','倒求排水速度','水箱原有54升水，每分钟持续流入3升。希望从开始排水起9分钟恰好排空。请保持进水阀开启，设置排水泵流量，并预测每分钟水量净变化和最终水量。',{initial:54,inflow:3,minutes:9},'每分钟真正排掉的是排水量减进水量。目标时间要求每分钟净减少多少，再想泵的排水流量。');
add(5,1,'water-phases','分阶段调节阀门','水箱原有60升水，进水始终为4升/分钟。先以10升/分钟排水5分钟；之后希望再过6分钟恰好排空。请预测第一段结束的剩余水量，接着设置第二段排水流量。第二段从第一段的剩余水量继续，不能重置水箱。',{initial:60,inflow:4,first:{outflow:10,minutes:5},secondMinutes:6},'第一段同时有进水和排水。把第一段实际剩余量交给第二段，再确定第二段每分钟需要净排多少。');
add(5,2,'water-records','恢复生态循环核心','同一水箱用相同初始水量作两种独立方案，进水速度相同且始终不变：每分钟排10升，12分钟恰好排空；每分钟排16升，6分钟恰好排空。比较两份记录，求进水速度和原有水量；再从相同初始量开始，希望8分钟排空，应设多大的排水流量？',{records:[{outflow:10,minutes:12},{outflow:16,minutes:6}],trialMinutes:8},'两份方案的原有水量相同。总排水量的差来自多进水了多少分钟？最终用原有水加新进水核对总排水量。');

const record=(s,id)=>s.ecoport?.records?.[id];
function earned(s){
 return stages.reduce((sum,q)=>sum+(record(s,q.id)?.passed?q.reward:0),0)+(stages.every(q=>record(s,q.id)?.passed)?100:0);
}
function view(s,unlocked=false,demo=false){
 unlocked=!!(unlocked||demo);
 const completed=stages.filter(q=>record(s,q.id)?.passed).length,active=stages.findIndex(q=>!record(s,q.id)?.passed);
 return {unlocked,demo:!!demo,completed,total:18,complete:completed===18,active,revision:s.ecoport?.revision||0,earned:earned(s),
  stations:names.map((title,i)=>({title,npc:npcs[i],story:stories[i],topic:topics[i],repaired:stages.filter(q=>q.station===i).every(q=>record(s,q.id)?.passed),unlocked:unlocked&&(demo||active<0||i<=Math.floor(active/3)),completed:stages.filter(q=>q.station===i&&record(s,q.id)?.passed).length})),
  stages:unlocked?stages.map(q=>({...q,data:structuredClone(q.data),passed:!!record(s,q.id)?.passed,count:record(s,q.id)?.count||0})):[]};
}
const integer=(n,min=-100000,max=1000000)=>Number.isInteger(n)&&n>=min&&n<=max;
const number=n=>typeof n==='number'&&Number.isFinite(n);
const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((n,i)=>n===b[i]);
const point=(p,expected)=>Array.isArray(p)&&p.length===2&&p.every(n=>integer(n))&&same(p,expected);
const layout=h=>Array.isArray(h)&&h.length===2&&h.every(row=>Array.isArray(row)&&row.length===2&&row.every(n=>integer(n,0,20)));
const sumLayout=h=>h.flat().reduce((sum,n)=>sum+n,0);
function satisfiesViews(heights,d){
 return layout(heights)&&heights.flat().every(n=>n>=d.minHeight&&n<=d.maxHeight)&&
  same([Math.max(heights[0][0],heights[1][0]),Math.max(heights[0][1],heights[1][1])],d.front)&&
  same([Math.max(...heights[0]),Math.max(...heights[1])],d.side);
}
// 按两个正投影的约束枚举边界，不以单一摆放模板作为正确答案。
function inventoryBounds(d){
 let min=Infinity,max=-Infinity;
 for(let a=d.minHeight;a<=d.maxHeight;a++)for(let b=d.minHeight;b<=d.maxHeight;b++)for(let c=d.minHeight;c<=d.maxHeight;c++)for(let e=d.minHeight;e<=d.maxHeight;e++){
  const h=[[a,b],[c,e]];if(satisfiesViews(h,d)){min=Math.min(min,a+b+c+e);max=Math.max(max,a+b+c+e);}
 }return {min,max};
}
function simpleCatch(d,c){
 return c.slowStart===-d.lead&&c.fastStart===0&&integer(c.catchTime,1)&&
  (d.fast-d.slow)*c.catchTime===d.slow*d.lead&&c.meeting===d.fast*c.catchTime&&c.meeting===d.slow*(d.lead+c.catchTime);
}
function phasedCatch(d,c){
 if(!Array.isArray(c.phases)||c.phases.length!==d.phases.length)return false;
 let gap=d.slow*d.lead,elapsed=0,walking=0;
 for(let i=0;i<c.phases.length;i++){
  const p=c.phases[i],fixed=d.phases[i];
  if(!p||p.mode!==fixed.mode||!integer(p.minutes,1,10000)||(fixed.minutes!==null&&p.minutes!==fixed.minutes))return false;
  if(p.mode==='walk'){walking+=p.minutes;gap-=(d.fast-d.slow)*p.minutes;}
  else gap+=d.slow*p.minutes;
  elapsed+=p.minutes;
  if(p.gap!==gap||(i<c.phases.length-1&&gap<=0))return false;
 }
 return gap===0&&c.elapsed===elapsed&&c.walking===walking&&(d.elapsed===undefined||elapsed===d.elapsed)&&c.meeting===d.fast*walking&&c.meeting===d.slow*(d.lead+elapsed);
}
function verify(q,c){
 if(!c||typeof c!=='object'||Array.isArray(c))return false;
 const d=q.data;
 switch(q.kind){
  case 'bridge':{
   if(!Array.isArray(c.pairs)||c.pairs.length!==d.halfCount/2||!c.pairs.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>integer(n,0,d.halfCount-1))))return false;
   const pieces=c.pairs.flat();return new Set(pieces).size===d.halfCount&&c.area===(d.whole+d.halfCount/2)*d.cellSide*d.cellSide;
  }
  case 'mirror':{
   const moved=[d.point[0]+d.move[0],d.point[1]+d.move[1]],mirror=[-moved[0],moved[1]];
   return point(c.moved,moved)&&point(c.mirror,mirror)&&c.distance===Math.abs(moved[0]-mirror[0])*d.cellLength;
  }
  case 'cubes':{
   if(!layout(c.heights))return false;const h=structuredClone(d.heights);h[d.remove.row][d.remove.col]-=d.remove.count;
   return c.heights.every((row,i)=>same(row,h[i]))&&same(c.front,[Math.max(h[0][0],h[1][0]),Math.max(h[0][1],h[1][1])])&&c.total===sumLayout(h);
  }
  case 'panels':{
   if(!Array.isArray(c.halves)||c.halves.length>d.maxAddedCells*2||!c.halves.every(p=>Array.isArray(p)&&p.length===2&&integer(p[0],0,d.maxAddedCells-1)&&integer(p[1],0,1)))return false;
   return new Set(c.halves.map(p=>p.join(','))).size===c.halves.length&&c.area===d.targetArea&&(d.whole+c.halves.length/2)*d.cellSide*d.cellSide===d.targetArea;
  }
  case 'beacons':{
   const moved=[d.points[0][0]+d.move[0],d.points[0][1]+d.move[1]],a=[-moved[0],moved[1]],b=[-d.points[1][0],d.points[1][1]];
   if(!point(c.moved,moved)||!Array.isArray(c.mirrors)||c.mirrors.length!==2||!point(c.mirrors[0],a)||!point(c.mirrors[1],b)||!Array.isArray(c.path))return false;
   const steps=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);if(c.path.length!==steps||c.distance!==steps*d.cellLength)return false;
   let [x,y]=a;for(const direction of c.path){if(!['E','W','N','S'].includes(direction))return false;x+=direction==='E'?1:direction==='W'?-1:0;y+=direction==='N'?1:direction==='S'?-1:0;if(x<d.bounds.minX||x>d.bounds.maxX||y<d.bounds.minY||y>d.bounds.maxY)return false;}
   return x===b[0]&&y===b[1];
  }
  case 'inventory':{
   if(!satisfiesViews(c.min,d)||!satisfiesViews(c.max,d))return false;const bounds=inventoryBounds(d);
   return c.minTotal===sumLayout(c.min)&&c.maxTotal===sumLayout(c.max)&&c.minTotal===bounds.min&&c.maxTotal===bounds.max;
  }
  case 'catch':return simpleCatch(d,c);
  case 'catch-check':return simpleCatch(d,c)&&c.checkSlow===d.slow*(d.lead+d.checkTime)&&c.checkFast===d.fast*d.checkTime&&c.checkGap===c.checkSlow-c.checkFast;
  case 'catch-bridge':return simpleCatch(d,c)&&typeof c.beforeBridge==='boolean'&&c.beforeBridge===(c.meeting<d.bridge);
  case 'catch-rest':case 'catch-recover':case 'catch-double':return phasedCatch(d,c);
  case 'pasture':return c.growth===d.growth&&c.consumption===d.cows*d.perCow&&c.netChange===c.growth-c.consumption&&integer(c.days,1)&&c.remaining===0&&d.initial+c.netChange*c.days===0;
  case 'pasture-records':{
   if(!Array.isArray(c.records)||c.records.length!==2||!c.records.every((r,i)=>r&&r.days===d.records[i].days&&r.consumed===d.records[i].cows*d.perCow*r.days))return false;
   return integer(c.growth,0)&&integer(c.initial,1)&&d.records.every((r,i)=>c.initial+c.growth*r.days===c.records[i].consumed)&&c.cows===d.trialCows&&integer(c.days,1)&&c.initial+c.growth*c.days===c.cows*d.perCow*c.days;
  }
  case 'pasture-balance':{
   if(!Array.isArray(c.trials)||c.trials.length!==d.cows.length||new Set(c.trials.map(t=>t?.cows)).size!==d.cows.length)return false;
   if(!c.trials.every(t=>{
    if(!t||!d.cows.includes(t.cows))return false;const change=d.growth-t.cows*d.perCow,trend=change>0?'increase':change===0?'steady':'decrease';
    if(t.trend!==trend||!integer(t.days,1)||!integer(t.remaining,0))return false;
    return change>=0?t.days===d.checkDays&&t.remaining===d.initial+change*t.days:t.remaining===0&&d.initial+change*t.days===0;
   }))return false;
   return c.sustainable===Math.floor(d.growth/d.perCow);
  }
  case 'water':return c.inflow===d.inflow&&integer(c.outflow,1)&&c.netChange===c.inflow-c.outflow&&c.minutes===d.minutes&&c.remaining===0&&d.initial+c.netChange*c.minutes===0;
  case 'water-phases':{
   if(!Array.isArray(c.phases)||c.phases.length!==2)return false;let remaining=d.initial;
   for(let i=0;i<2;i++){
    const p=c.phases[i];if(!p||p.inflow!==d.inflow||!integer(p.outflow,1)||p.minutes!==(i===0?d.first.minutes:d.secondMinutes)||(i===0&&p.outflow!==d.first.outflow))return false;
    remaining+=(p.inflow-p.outflow)*p.minutes;if(p.remaining!==remaining||(i===0&&remaining<=0))return false;
   }return remaining===0;
  }
  case 'water-records':{
   if(!Array.isArray(c.records)||c.records.length!==2||!c.records.every((r,i)=>r&&r.outflow===d.records[i].outflow&&r.minutes===d.records[i].minutes&&r.totalOut===r.outflow*r.minutes))return false;
   return integer(c.inflow,0)&&integer(c.initial,1)&&c.records.every(r=>c.initial+c.inflow*r.minutes===r.totalOut)&&c.minutes===d.trialMinutes&&integer(c.outflow,1)&&c.totalOut===c.outflow*c.minutes&&c.totalOut===c.initial+c.inflow*c.minutes&&c.remaining===0;
  }
  default:return false;
 }
}
const display=n=>number(n)?String(n):'未填';
const coords=p=>Array.isArray(p)&&p.length===2?`(${p.map(display).join('，')})`:'未放置';
function describe(q,c){
 if(q.kind==='bridge')return `配成${Array.isArray(c.pairs)?c.pairs.length:0}组，面积${display(c.area)}平方米`;
 if(q.kind==='mirror')return `原点${coords(c.moved)}，镜像${coords(c.mirror)}，间距${display(c.distance)}厘米`;
 if(q.kind==='cubes')return `四摞${layout(c.heights)?c.heights.map(r=>r.join('、')).join(' / '):'未设置'}，总计${display(c.total)}块`;
 if(q.kind==='panels')return `放置${Array.isArray(c.halves)?c.halves.length:0}片半格，面积${display(c.area)}平方米`;
 if(q.kind==='beacons')return `原点${coords(c.moved)}，镜像${Array.isArray(c.mirrors)?c.mirrors.map(coords).join('、'):'未设置'}，路线${Array.isArray(c.path)?c.path.map(v=>({E:'东',W:'西',N:'北',S:'南'})[v]||'?').join('→'):'未绘制'}，${display(c.distance)}米`;
 if(q.kind==='inventory')return `最少摆法${layout(c.min)?c.min.map(r=>r.join('、')).join(' / '):'未设置'}，${display(c.minTotal)}块；最多摆法${layout(c.max)?c.max.map(r=>r.join('、')).join(' / '):'未设置'}，${display(c.maxTotal)}块`;
 if(q.kind.startsWith('catch'))return c.phases?`时间段${Array.isArray(c.phases)?c.phases.map(p=>`${p?.mode==='walk'?'追赶':'停留'}${display(p?.minutes)}分钟 / 差${display(p?.gap)}米`).join('；'):'未设置'}；经过${display(c.elapsed)}分钟，走${display(c.walking)}分钟，相遇${display(c.meeting)}米`:`追${display(c.catchTime)}分钟，相遇${display(c.meeting)}米${q.kind==='catch-check'?`，中途差${display(c.checkGap)}米`:q.kind==='catch-bridge'?`，桥前判断${c.beforeBridge===true?'能':c.beforeBridge===false?'不能':'未选'}`:''}`;
 if(q.kind==='pasture')return `每天长${display(c.growth)}份、吃${display(c.consumption)}份，净变化${display(c.netChange)}份，${display(c.days)}天吃完`;
 if(q.kind==='pasture-records')return `每天长${display(c.growth)}份，原草${display(c.initial)}份，${display(c.cows)}头牛吃${display(c.days)}天`;
 if(q.kind==='pasture-balance')return `${Array.isArray(c.trials)?c.trials.map(t=>`${display(t?.cows)}头 / ${{increase:'增加',steady:'保持',decrease:'减少'}[t?.trend]||'未选'} / ${display(t?.days)}天后${display(t?.remaining)}份`).join('；'):'尚未设置三种试验'}；长期最多${display(c.sustainable)}头`;
 if(q.kind==='water')return `每分钟进${display(c.inflow)}升、排${display(c.outflow)}升，${display(c.minutes)}分钟剩${display(c.remaining)}升`;
 if(q.kind==='water-phases')return Array.isArray(c.phases)?c.phases.map((p,i)=>`第${i+1}段排${display(p?.outflow)}升/分钟，${display(p?.minutes)}分钟后剩${display(p?.remaining)}升`).join('；'):'尚未设置两段流量';
 return `每分钟进${display(c.inflow)}升，原水${display(c.initial)}升，最后每分钟排${display(c.outflow)}升，${display(c.minutes)}分钟排${display(c.totalOut)}升`;
}
function judge(q,c){
 let correct=false;try{correct=verify(q,c);}catch{correct=false;}
 return {correct,description:describe(q,c&&typeof c==='object'&&!Array.isArray(c)?c:{}).slice(0,800),feedback:correct?'方案符合全部条件！设施获得了修复能量。':q.hint};
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function submit(s,body,unlocked,demo=false){
 if(!unlocked&&!demo)fail(403,'先完成云海天文城的六站修复，再乘飞艇前往生态港。');
 const q=stages.find(q=>q.id===body?.stageId),hintsUsed=body?.hintsUsed??0;
 if(!q||typeof body.attemptId!=='string'||!uuid.test(body.attemptId)||!body.config||typeof body.config!=='object'||Array.isArray(body.config)||JSON.stringify(body.config).length>6000||!number(body.seconds)||body.seconds<0||body.seconds>86400||!integer(hintsUsed,0,20)||!integer(body.revision,0))fail(400,'操作记录不正确，请重新检查。');
 const payload=JSON.stringify(body.config),old=record(s,q.id);
 // 跨关卡检查提交编号，重试必须保持同一个关卡与方案。
 for(const stage of stages){
  const repeat=record(s,stage.id)?.history?.find(a=>a.id===body.attemptId);
  if(!repeat)continue;
  if(stage.id!==q.id||repeat.payload!==payload)fail(409,'同一次提交不能更换关卡或方案。');
  return {correct:repeat.correct,description:repeat.description,feedback:repeat.feedback,reward:0,stageId:q.id,stationComplete:repeat.correct&&stages.filter(v=>v.station===q.station).every(v=>record(s,v.id)?.passed),complete:stages.every(q=>record(s,q.id)?.passed)};
 }
 if(body.revision!==(s.ecoport?.revision||0))fail(409,'另一页面已更新进度，请关闭卡片后刷新地图。');
 const active=stages.find(q=>!record(s,q.id)?.passed);
 if(!demo&&q.id!==active?.id)fail(403,old?.passed?'这项挑战已经完成。':'请先完成当前挑战。');
 const result=judge(q,body.config),before=earned(s),now=new Date().toISOString();
 const entry=old||{passed:false,count:0,firstCorrect:false,firstSuccessAt:null,firstSuccessTime:null,hintsUsed:0,history:[]};
 entry.count++;if(entry.count===1)entry.firstCorrect=result.correct;
 entry.hintsUsed=(entry.hintsUsed||0)+hintsUsed;
 if(result.correct&&!entry.passed){entry.passed=true;entry.firstSuccessAt=entry.count;entry.firstSuccessTime=now;}
 entry.history.push({id:body.attemptId,payload,...result,seconds:Math.round(body.seconds),hintsUsed,created:now});entry.history=entry.history.slice(-30);
 s.ecoport??={revision:0,records:{}};s.ecoport.records??={};s.ecoport.records[q.id]=entry;s.ecoport.revision=(s.ecoport.revision||0)+1;
 return {...result,reward:earned(s)-before,stageId:q.id,stationComplete:result.correct&&stages.filter(v=>v.station===q.station).every(v=>record(s,v.id)?.passed),complete:stages.every(q=>record(s,q.id)?.passed)};
}
function report(s){
 return stages.map(q=>{const r=record(s,q.id);return {id:q.id,title:q.title,station:q.station,level:q.level,topic:q.topic,passed:!!r?.passed,count:r?.count||0,firstCorrect:!!r?.firstCorrect,firstSuccessAt:r?.firstSuccessAt||null,firstSuccessTime:r?.firstSuccessTime||null,hintsUsed:r?.hintsUsed||0,history:(r?.history||[]).map(({payload,id,...a})=>a)};});
}
module.exports={stages,view,submit,earned,report,judge};
