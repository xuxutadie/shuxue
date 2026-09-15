/* 原生 SVG 教学实验。不写入学习成绩，参数变化只用于观察与讲解。 */
const LAB_CONFIG = {
  align:{name:'两行配平实验',params:[['target','先对齐：1大零件、2小零件',1,2,1],['small','每个小零件重量（克）',3,7,5]],prompt:'上行2大3小，下行3大2小。先读图中总重量，选择对齐对象，观察两行数量和总重量一起变化。'},
  reflection:{name:'镜像等距实验',params:[['distance','原点在镜面左侧几格',3,5,4],['shift','向镜面移动几格',0,2,1]],prompt:'每格边长2厘米。先移动原点，再作镜像；比较两边到镜面的距离。'},
  stacks:{name:'遮挡与观察实验',params:[['front','前摞原来几层',2,5,4],['back','后摞几层',1,5,3],['remove','从前摞上方拿走几层',0,2,2]],prompt:'两摞沿同一条前后方向紧挨着放。先看摆放，再拿走前摞上方积木，最后观察正面轮廓。'},
  stopped:{name:'停留追赶实验',params:[['rest','快者中途停留几分钟',0,4,2]],prompt:'小明每分60米，先走5分；小华每分90米，追4分后停留，再按原速追。慢者全程不停。'},
  shop:{name:'水瓶茶杯消去实验',params:[['pen','每个茶杯的价格（元）',1,5,4]],prompt:'先观察3水瓶20茶杯与3水瓶16茶杯的两张订单，默认总价134元和118元；再逐步抵消相同费用。'},
  pairs:{name:'橡皮铅笔配套实验',params:[['pencil','每支铅笔的价格（角）',6,12,8]],prompt:'每套是一块橡皮和一支铅笔，价格固定3元。默认3橡皮5铅笔10.6元，4橡皮4铅笔12元；先配套，再找剩余。'},
  balance:{name:'复制订单实验',params:[['multiple','上单复制倍数',2,4,2],['pen','每支笔的价格（元）',1,5,3]],prompt:'先把整张订单复制，再对齐比较。数量和总价要一起变化。'},
  cycle:{name:'循环列车实验',params:[['n','目标车厢序号',1,40,27]],prompt:'先预测目标颜色，再观察光圈按红、黄、蓝、绿循环。'},
  factor:{name:'零件分组实验',params:[['group','每袋零件数',1,12,6]],prompt:'每次装满一袋，最后剩下的零件能告诉你是否整除。'},
  multiples:{name:'两盏闪灯实验',params:[['a','紫灯间隔（秒）',2,8,4],['b','蓝灯间隔（秒）',3,9,6]],prompt:'0秒两灯同时亮。先预测下一次同亮，沿时间轴验证。'},
  area:{name:'补形面积实验',params:[['corner','缺角边长（厘米）',1,4,2]],prompt:'先看原图，再补回缺角。拖动边长，比较长度与面积怎样变化。'},
  grid:{name:'半格拼合实验',params:[['side','单位格边长（厘米）',1,4,2]],prompt:'6个整格与4个沿对角线分出的半格，能拼成多少整格？'},
  chase:{name:'同向追赶实验',params:[['fast','小华速度（米/分钟）',60,120,90]],prompt:'以追赶开始为0分钟。小明领先300米，仍以60米/分钟向前走。'},
  pasture:{name:'生长中的草地',params:[['cows','牛的数量（头）',1,12,8]],prompt:'原有草30份，每天长2份，每头牛每天吃1份。先比较每日净变化。'},
  allocation:{name:'三家书店配货',params:[['a','甲店书本数',2,4,2],['b','乙店书本数',2,4,3],['c','丙店书本数',2,4,4]],prompt:'每家2～4本，总共9本。按甲店数量分类，收齐不同的分配方案。'}
};
const LESSON_LABS=['shop','align','cycle','factor','multiples','area','grid','stopped','pasture','allocation','cycle','multiples'];
const LAB_OPTIONS={0:['shop','pairs','balance'],6:['grid','reflection','stacks'],7:['chase','stopped'],10:['cycle','align','factor','multiples','area','grid','reflection','stacks','chase','stopped','pasture','allocation'],11:['multiples','cycle','align','area','reflection','stacks','chase','stopped','pasture','allocation']};
const chosenLab={};
let labState=null,labTimer=null;
const labNumber=n=>Number(n.toFixed(2));
const labGcd=(a,b)=>b?labGcd(b,a%b):a;
function labLimit(type,v){return type==='stopped'?10+3*v.rest:type==='cycle'?v.n-1:type==='multiples'?v.a*v.b/labGcd(v.a,v.b):type==='chase'?12:type==='pasture'?10:type==='allocation'?6:3;}
function svgText(x,y,text,size=18){return `<text x="${x}" y="${y}" font-size="${size}" fill="#393248">${esc(text)}</text>`;}
function svgRect(x,y,w,h,color,extra=''){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${color}" stroke="#393248" stroke-width="2" ${extra}/>`;}
function labSvg(label,inside){return `<svg viewBox="0 0 640 270" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${inside}</svg>`;}
function labMotion(attribute,from,to){return from===to?'':`<animate class="lab-motion" attributeName="${attribute}" from="${from}" to="${to}" dur="0.45s" fill="freeze"/>`;}
function bookOrder(y,books,pens,price,dim=false,commonPens=0){
  let items=svgText(14,y+24,`${books}本`);
  const booksSvg=Array.from({length:books},(_,i)=>svgRect(72+i*20,y,14,32,'#bba4ff')).join('');
  items+=`<g opacity="${dim ? 0.18 : 1}">${dim?labMotion('opacity',1,.18):''}${booksSvg}</g>`+svgText(242,y+24,'＋');
  for(let i=0;i<pens;i++)items+=`<g opacity="${dim && i < commonPens ? 0.18 : 1}">${dim&&i<commonPens?labMotion('opacity',1,.18):''}<path d="M${292+i*22} ${y+2}l7 2-8 26-6 4-1-7Z" fill="#ffd64f" stroke="#393248" stroke-width="2"/></g>`;
  return `<g>${items}${svgText(411,y+24,`${pens}支`)}${svgText(468,y+24,`＝${labNumber(price)}元`)}</g>`;
}

// 计算与绘图使用同一组参数，图上数值和验证答案不会分离。
function labModel(type,v,step=0,previous=step){
  let drawing='',caption='',formula='',question='',answer='';
  if(type==='align'){
    const m=v.target===1?[3,2]:[2,3],rows=[[2,3,16+3*v.small],[3,2,24+2*v.small]];
    rows.forEach(([big,small,weight],r)=>{const k=step?m[r]:1,y=60+r*75;drawing+=svgRect(18,y-28,600,60,r?'#9edcf5':'#ffd64f')+svgText(34,y+9,`${big*k}大 ＋ ${small*k}小 ＝ ${weight*k}克${step?'（原整行×'+k+'）':''}`,22);});
    const diff=v.target===1?5*v.small:40;
    drawing+=svgText(25,220,step>=2?`抵消相同的6个${v.target===1?'大':'小'}零件；差${diff}克对应5个${v.target===1?'小':'大'}零件`:'选定一种零件，让两行都变成6个，再比较。',19);
    caption=['先观察两行，不能直接把重量差当作一个零件','两行整份调整，数量与重量同时变化','相同部分抵消，数清剩下几个','代回两行原条件核验'][step];
    formula=`差重${diff}÷5＝${v.target===1?v.small:8}克；大8克，小${v.small}克`;
    question=`按当前对齐对象，相减后的重量差对应几个零件？`;answer='5';
  }
  if(type==='reflection'){
    const x0=320-v.distance*45,pos=v.distance-(step>=1?v.shift:0),x=320-pos*45,mirror=320+pos*45;
    for(let i=0;i<13;i++)drawing+=`<path d="M${50+i*45} 40V210" stroke="#d4cedd"/>`;
    drawing+=`<path d="M320 35V215" stroke="#393248" stroke-width="4"/>`+svgText(285,25,'镜面');
    drawing+=`<circle cx="${x}" cy="120" r="12" fill="#ff9274">${labMotion('cx',previous<1?x0:x,x)}</circle>`+svgText(x-25,165,step?'点B':'点A');
    if(step>=2)drawing+=`<circle cx="${mirror}" cy="120" r="12" fill="#bba4ff">${previous<2?labMotion('cx',x,mirror):''}</circle>`+svgText(mirror-25,165,'镜像C')+`<path d="M${x} 120H${mirror}" stroke="#393248" stroke-dasharray="5 5"/>`;
    drawing+=svgText(25,245,`移动后距镜面${v.distance-v.shift}格；每格2厘米。`);
    caption=['原点在镜面左侧','先向镜面移动，距离减少','镜像在另一侧，离镜面同样远','两点之间要计算左右两段距离'][step];
    formula=`B与C距离＝(${v.distance}−${v.shift})×2×2＝${(v.distance-v.shift)*4}厘米`;
    question='移动后的点B与它的镜像点C相距多少厘米？';answer=String((v.distance-v.shift)*4);
  }
  if(type==='stacks'){
    const front=v.front-(step>=1?v.remove:0),visible=Math.max(front,v.back);
    // 起初展开示意以便数清；对齐后，真正被遮住或拿走的部分不再画进轮廓。
    for(let i=0;i<v.back;i++){const x=step>=2?175:330,y=215-(i+1)*30;drawing+=`<rect x="${x}" y="${y}" width="60" height="30" rx="5" fill="#bba4ff" stroke="#393248" stroke-width="2" opacity="${step>=2&&i<front?0:1}">${labMotion('x',previous>=2?175:330,x)}</rect>`;}
    for(let i=0;i<v.front;i++){const opacity=i>=front?(step===1?.12:0):1;drawing+=`<rect x="175" y="${215-(i+1)*30}" width="60" height="30" rx="5" fill="#9edcf5" stroke="#393248" stroke-width="2" opacity="${opacity}">${previous<1?labMotion('opacity',1,opacity):''}</rect>`;}
    drawing+=(step>=2?svgText(155,242,`正面：${visible}层`):svgText(155,242,'前摞')+svgText(320,242,'后摞'))+svgText(20,25,step>=2?'沿正面方向看：取可见的最高层数':'前后摆放的两摞，先展开示意数清楚');
    drawing+=svgText(420,95,`前摞剩${front}层`)+svgText(420,140,`后摞${v.back}层`)+svgText(420,185,`总块数${front+v.back}块`);
    caption=['展开示意：分别数两摞','只拿走前摞上方指定层数','对齐观察，重叠部分由前摞挡住','正面最高层数与积木总数不同'][step];
    formula=`拿走后正面最高：${Math.max(v.front-v.remove,v.back)}层；总数：${v.front-v.remove+v.back}块`;
    question='拿走指定积木之后，正面轮廓最高有几层？';answer=String(Math.max(v.front-v.remove,v.back));
  }
  if(type==='stopped'){
    const duration=labLimit(type,v),maxPosition=300+60*duration,walking=t=>t<=4?t:t<=4+v.rest?4:t-v.rest;
    const slow=300+60*step,fast=90*walking(step),x=d=>40+d/maxPosition*550;
    [slow,fast].forEach((d,i)=>{const y=90+i*85;drawing+=`<path d="M40 ${y}H590" stroke="#bbb4ca" stroke-width="3"/><circle cx="${x(d)}" cy="${y}" r="14" fill="${i?'#ff9274':'#bba4ff'}">${labMotion('cx',x(i?90*walking(previous):300+60*previous),x(d))}</circle>`+svgText(40,y-30,`${i?'小华':'小明'}：${d}米`);});
    drawing+=svgText(20,235,`经过${step}分；小华实际走${walking(step)}分；差距${slow-fast}米`);
    caption=step===duration?'两人位置相同，追上了！':step<=4?'正常追赶：每分缩小30米':step<=4+v.rest?'小华停留：小明继续走，每分扩大60米':'恢复追赶：每分缩小30米';
    formula=`先追4分剩180米；停${v.rest}分后差${180+60*v.rest}米；总时间4＋${v.rest}＋${(180+60*v.rest)/30}＝${duration}分`;
    question='从小华首次出发到追上，共经过几分钟？';answer=String(duration);
  }
  if(type==='shop'){
    const cup=v.pen,upper=54+20*cup,lower=54+16*cup;
    // 一杯一图，16个共同茶杯与4个多出的茶杯分组着色。
    [20,16].forEach((count,row)=>{
      const y=48+row*72,dim=step>=2;
      drawing+=`<g opacity="${dim?.2:1}">${svgText(16,y+22,'3个水瓶',17)}</g>`+svgText(125,y+22,'＋');
      for(let n=0;n<count;n++)drawing+=`<g opacity="${dim&&n<16?.2:1}"><path d="M${160+n*14} ${y+8}h10l-1 20h-8Z" fill="${n<16?'#9edcf5':'#ff9274'}" stroke="#393248"/></g>`;
      drawing+=svgText(452,y+22,`＝${row?lower:upper}元`,19)+svgText(160,y+49,`${count}个茶杯`,14);
    });
    drawing+=svgText(16,25,step>=2?'抵消共同的3个水瓶和16个茶杯':'与视频例题1相同的两张订单',18);
    drawing+=svgText(16,220,step>=2?`多4个茶杯 ↔ 多${4*cup}元`:'先找相同部分，再观察多出的茶杯',19);
    drawing+=svgText(16,253,step>=3?`茶杯${cup}元；水瓶（${lower}－16×${cup}）÷3＝18元`:'商品数量固定，修改茶杯单价会同步改变总价。',16);
    caption=['观察原始订单，总价134元与118元对应默认单价','上下对齐：每单都有3个水瓶','相同费用抵消，价差只对应4个茶杯','先求茶杯4元，再求水瓶18元；参数变化时按当前数值核验'][step];
    formula=`（${upper}－${lower}）÷（20－16）＝${cup}元/个；水瓶18元`;
    question='当前两单的总价相差多少元？';answer=String(4*cup);
  }
  if(type==='pairs'){
    const pencil=v.pencil/10,rubber=3-pencil,total=labNumber(9+2*pencil);
    drawing=svgText(16,28,'与视频例题2相同：先配成一套',20);
    drawing+=svgRect(16,45,608,53,'#9edcf5')+svgText(30,78,`4块橡皮＋4支铅笔＝12元 → 4套`,21);
    drawing+=svgRect(16,112,608,53,'#ffd64f')+svgText(30,145,`3块橡皮＋5支铅笔＝${total}元`,21);
    if(step>=1)drawing+=svgText(25,198,step>=2?`3套共9元 ＋ 剩下2支铅笔${labNumber(2*pencil)}元`:'每套：1块橡皮＋1支铅笔＝12÷4＝3元',20);
    if(step>=3)drawing+=svgText(25,242,`铅笔${pencil}元；橡皮3－${pencil}＝${labNumber(rubber)}元`,21);
    caption=['完整读两种买法','4块橡皮与4支铅笔配成4套，每套3元','第一种买法圈出3套，还剩2支铅笔','先求铅笔，再从一套的价格中扣出橡皮单价'][step];
    formula=`铅笔：（${total}－3×3）÷2＝${pencil}元；橡皮：3－${pencil}＝${labNumber(rubber)}元`;
    question='当前一块橡皮的单价是多少元？';answer=String(labNumber(rubber));
  }
  if(type==='balance'){
    const multi=type==='balance'?v.multiple:1,book=type==='balance'?4:3.5;
    const p1=type==='balance'?1:3,p2=type==='balance'?multi+1:5;
    const total1=2*book+p1*v.pen,total2=2*multi*book+p2*v.pen;
    const copied=type==='balance'&&step>=1, count=copied?multi:1, diff=p2-p1*multi;
    drawing=svgText(14,25,copied?`上单所有项目 × ${multi}`:'把同一种商品上下对齐')+bookOrder(48,2*count,p1*count,total1*count,step>=2,p1*multi)+bookOrder(112,2*multi,p2,total2,step>=2,p1*multi);
    drawing+=svgText(20,204,step>=2?`多 ${diff} 支笔 ↔ 多 ${labNumber(total2-total1*multi)} 元`:'先找出相同部分，再比较两单的差');
    drawing+=svgText(20,242,step>=3?`每支笔：${labNumber(total2-total1*multi)} ÷ ${diff} ＝ ${v.pen} 元`:'请先说出你的预测，再继续演示');
    caption=['观察原始订单',type==='balance'?'复制整张订单，金额也倍乘':'上下对齐相同数量', '消去相同的本子，再比较笔数差','价差除以数量差，求出单价'][step];
    formula=`（${labNumber(total2)}－${labNumber(total1*multi)}）÷（${p2}－${p1*multi}）＝${v.pen}元/支`;
    question=`当前两单的总价相差多少元？${type==='balance'?'（先把上单按所选倍数扩大）':''}`;answer=String(labNumber(total2-total1*multi));
  }
  if(type==='cycle'){
    const current=step+1,colors=['#ff9274','#ffd64f','#9edcf5','#8adeb5'],names=['红','黄','蓝','绿'];
    drawing=svgText(20,30,`目标：第${v.n}节；正在观察：第${current}节`);
    colors.forEach((c,i)=>{drawing+=svgRect(55+i*142,85,100,65,c)+svgText(86+i*142,126,names[i],24)+svgText(69+i*142,182,`第${i+1}位`);});
    drawing+=`<rect x="${48+(step%4)*142}" y="78" width="114" height="79" rx="12" fill="none" stroke="#393248" stroke-width="4">${labMotion('x',48+(previous%4)*142,48+(step%4)*142)}</rect>`;
    drawing+=svgText(20,232,`${current}＝4×${Math.floor(current/4)}＋${current%4}；${current%4===0?'整组末尾':'余数表示组内位置'}`);
    caption=`第${current}节是${names[step%4]}色；目标第${v.n}节可以先用除法预测。`;
    formula=`${v.n}÷4＝${Math.floor(v.n/4)}……${v.n%4} → ${names[(v.n-1)%4]}`;
    question=`第${v.n}节车厢是什么颜色？（填颜色名称）`;answer=names[(v.n-1)%4];
  }
  if(type==='factor'){
    const g=v.group,full=Math.floor(24/g),rem=24%g,shown=step===3?full:Math.floor(full*step/3);
    drawing=svgText(18,28,`24件；每袋${g}件；已标出${shown}个完整袋`);
    for(let n=0;n<24;n++){
      const idx=Math.floor(n/g),inside=idx<shown,color=inside?['#bba4ff','#9edcf5','#ffd64f'][idx%3]:'#e7e5eb';
      const x=30+(n%12)*50,y=75+Math.floor(n/12)*60;
      drawing+=`<circle cx="${x}" cy="${y}" r="19" fill="${color}" stroke="#393248" stroke-width="1.5"/>`+svgText(x-8,y+6,inside?idx+1:'·',16);
    }
    drawing+=svgText(18,200,'相同颜色与袋号表示同一袋；灰色表示尚未装入。',17)+svgText(18,240,step===3?`装满${full}袋，剩${rem}件${rem?' → 不能整除':' → 刚好整除'}`:'点下一步，逐批标出装好的袋子');
    caption=step===3?`${g}${rem?'不是':'是'}24的因数。`:'先猜是否有剩余，再开始装袋。';formula=`24＝${g}×${full}＋${rem}`;
    question=`每袋${g}件，24件装满整袋后剩几件？`;answer=String(rem);
  }
  if(type==='multiples'){
    const limit=labLimit(type,v),x=t=>55+t/limit*540;
    [v.a,v.b].forEach((period,row)=>{const y=82+row*94,c=row?'#9edcf5':'#bba4ff';drawing+=svgText(12,y-24,row?'蓝灯':'紫灯')+`<path d="M55 ${y}H595" stroke="#bbb4ca" stroke-width="3"/>`;
      for(let t=0;t<=limit;t+=period)drawing+=`<circle cx="${x(t)}" cy="${y}" r="${t===step?12:5}" fill="${c}" stroke="#393248"/>`;
      drawing+=`<circle cx="620" cy="${y}" r="14" fill="${step%period===0?c:'#eee'}" stroke="#393248"/>`;
    });
    drawing+=`<path d="M${x(step)} 44V200" stroke="#f07557" stroke-width="3"/>`+svgText(20,232,`当前${step}秒；${step>0&&step%v.a===0&&step%v.b===0?'两灯再次同亮！':'0秒是起点，要找之后的同亮时刻。'}`,17);
    caption=`${step}秒：紫灯${step%v.a===0?'亮':'灭'}，蓝灯${step%v.b===0?'亮':'灭'}。`;
    formula=`${v.a}和${v.b}的最小公倍数＝${limit}`;question='0秒同时亮过之后，第一次再次同亮是第几秒？';answer=String(limit);
  }
  if(type==='area'){
    const c=v.corner,s=30,x=60,y=40,w=240,h=180;
    drawing=`<path d="M${x} ${y}H${x+w-c*s}V${y+c*s}H${x+w}V${y+h}H${x}Z" fill="#9edcf5" stroke="#393248" stroke-width="3"/>`;
    if(step>=1)drawing+=svgRect(x+w-c*s,y,c*s,c*s,'#ffd64f',`opacity="${step===2?1:.55}" stroke-dasharray="5 4"`);
    drawing+=svgText(130,245,'8厘米')+svgText(10,135,'6',20)+svgText(338,72,`缺角边长：${c}厘米`)+svgText(338,118,`缺角面积：${c}×${c}＝${c*c}`)+svgText(338,166,'整体面积：8×6＝48')+svgText(338,218,step===3?`剩余面积：${48-c*c}`:'先预测，再点下一步');
    caption=['蓝色区域才是原图，右上角缺了一块。','黄色补角凑出完整长方形。','补入部分不属于原图，必须扣除。','整体减缺角；用平方厘米作单位。'][step];
    formula=`8×6－${c}×${c}＝${48-c*c}平方厘米`;question='当前蓝色原图的面积是多少平方厘米？';answer=String(48-c*c);
  }
  if(type==='grid'){
    for(let n=0;n<6;n++)drawing+=svgRect(55+(n%3)*50,60+Math.floor(n/3)*50,50,50,'#9edcf5');
    const before=['270,60 320,60 270,110','340,60 390,110 340,110','270,140 320,140 270,190','340,140 390,190 340,190'];
    const after=['270,60 320,60 270,110','320,60 320,110 270,110','270,140 320,140 270,190','320,140 320,190 270,190'];
    before.forEach((points,i)=>{const target=step>=1?after[i]:points;drawing+=`<polygon points="${target}" fill="${i%2?'#ffd64f':'#bba4ff'}" stroke="#393248" stroke-width="2">${previous<1&&step>=1?labMotion('points',points,target):''}</polygon>`;});
    drawing+=svgText(20,28,'蓝色：6个整格；紫色与黄色：4个半格')+svgText(420,95,`每格边长${v.side}厘米`,16)+svgText(420,140,`每格面积${v.side*v.side}`,16)+svgText(20,238,step>=1?'4个半格配成2格 → 共8格；图中每个单位格的比例相同。':'先看四个半格，再把它们两两拼合。',16);
    caption=step===0?'这些三角形沿方格对角线切出，每个确实是半格。':`等效格数8不变；每格面积${v.side*v.side}，总面积${8*v.side*v.side}平方厘米。`;
    formula=`（6＋4÷2）×${v.side}×${v.side}＝${8*v.side*v.side}平方厘米`;question='当前图形的实际面积是多少平方厘米？';answer=String(8*v.side*v.side);
  }
  if(type==='chase'){
    const slow=300+60*step,fast=v.fast*step,x=d=>40+d/1600*550;
    drawing=svgText(20,28,`追赶开始后${step}分钟；两条轨道共用距离刻度`);
    [slow,fast].forEach((d,i)=>{const y=85+i*90;drawing+=`<path d="M40 ${y}H590" stroke="#bbb4ca" stroke-width="3"/>`;
      drawing+=`<circle cx="${x(d)}" cy="${y}" r="15" fill="${i?'#bba4ff':'#ffd64f'}" stroke="#393248" stroke-width="2">${labMotion('cx',x(i?v.fast*previous:300+60*previous),x(d))}</circle>`+svgText(40,y-25,`${i?'小华':'小明'}：${d}米`);
    });
    drawing+=svgText(20,238,`小明位置－小华位置＝${slow-fast}米${slow-fast<0?'（小华已超过）':''}`);
    caption=slow===fast?'两人到达同一位置，追上了！':v.fast===60?'速度相同，差距始终是300米。':`每分钟缩小${v.fast-60}米。位置差变负时表示小华已超过。`;
    formula=v.fast===60?'速度差＝0，无法追上':`300÷（${v.fast}－60）＝${labNumber(300/(v.fast-60))}分钟${300%(v.fast-60)?'（约）':''}`;
    question='当前速度下，开始追赶1分钟后，小明还领先多少米？';answer=String(300-(v.fast-60));
  }
  if(type==='pasture'){
    const rate=v.cows-2,grass=Math.max(0,30-rate*step),old=Math.max(0,30-rate*previous),scale=3;
    drawing=svgText(20,30,`${v.cows}头牛；观察到第${step}天`)+svgRect(65,55,145,150,'#f3f0f8');
    drawing+=`<rect x="65" y="${205-grass*scale}" width="145" height="${grass*scale}" rx="5" fill="#8adeb5">${labMotion('height',old*scale,grass*scale)}${labMotion('y',205-old*scale,205-grass*scale)}</rect>`+svgText(83,239,`剩余${grass}份`);
    drawing+=svgText(270,80,'每天新长：＋2份')+svgText(270,128,`每天吃掉：－${v.cows}份`)+svgText(270,176,`每天净变化：${2-v.cows>0?'+':''}${2-v.cows}份`)+svgText(270,222,rate>0?`约${labNumber(30/rate)}天耗尽`:'草不会耗尽');
    caption=grass===0?'已耗尽，演示停留在0份；不再模拟缺草之后的放牧。':rate<=0?'生长不少于消耗，在此模型中草不会吃完。':`每天减少${rate}份；份表示一头牛一天的食量。`;
    formula=rate>0?`30÷（${v.cows}－2）＝${labNumber(30/rate)}天${30%rate?'（约）':''}`:`每天净变化${2-v.cows>=0?'+':''}${2-v.cows}份，不耗尽`;
    question='按当前牛数，放牧1天后有多少份草？';answer=String(30-rate);
  }
  if(type==='allocation'){
    const all=[[2,3,4],[2,4,3],[3,2,4],[3,3,3],[3,4,2],[4,2,3],[4,3,2]],a=[v.a,v.b,v.c],total=a.reduce((x,y)=>x+y,0);
    a.forEach((n,i)=>{drawing+=svgText(90+i*190,38,`${['甲','乙','丙'][i]}店：${n}本`);for(let j=0;j<n;j++)drawing+=svgRect(88+i*190,190-j*32,105,25,['#bba4ff','#ffd64f','#9edcf5'][i]);});
    drawing+=svgText(25,248,`共${total}本；${total===9?'满足总数9，可以收录':'需要总共9本，请继续调整'}`);
    caption=`先固定甲，再按乙递增检查。演示第${step+1}/7种：${all[step].join('、')}本。`;
    formula=`${v.a}＋${v.b}＋${v.c}＝${total}`;question='当前三家店共分到多少本书？';answer=String(total);
  }
  return {svg:labSvg(caption,drawing),caption,formula,question,answer};
}

// 对齐对象、复制倍数属于探索条件；未知单价和重量在学生推理后才展开。
function labControls(type,config){
  const secret=key=>['shop','pairs','balance','align'].includes(type)&&['pen','pencil','small'].includes(key);
  const render=params=>`<div class="lab-controls">${params.map(([key,label,min,max])=>`<label for="lab-${key}">${label}：<output id="lab-value-${key}">${labState.values[key]}</output><input id="lab-${key}" data-lab-param="${key}" type="range" min="${min}" max="${max}" step="1" value="${labState.values[key]}"></label>`).join('')}</div>`;
  const hidden=config.params.filter(([key])=>secret(key));
  return render(config.params.filter(([key])=>!secret(key)))+(hidden.length?`<details class="lab-parameter-disclosure"><summary>推理完成后，再展开单价或重量设置做变式</summary><p>先根据两组总量求未知量；这里的设置用于验证与拓展。</p>${render(hidden)}</details>`:'');
}
function labView(lessonIndex,standaloneType){
  stopLab();const type=standaloneType||chosenLab[lessonIndex]||LESSON_LABS[lessonIndex],config=LAB_CONFIG[type];
  labState={type,lessonIndex,values:Object.fromEntries(config.params.map(([key,,,,value])=>[key,value])),step:0,found:[]};
  if(lessonIndex===10&&type==='area')labState.values.corner=3;
  labState.initialValues={...labState.values};
  const m=labModel(type,labState.values);
  return `<section class="panel lesson-lab"><div class="section-head"><div><span class="tag">先预测 · 再操作 · 说发现</span><h2>${config.name}</h2></div><span class="lab-symbol" aria-hidden="true">✦</span></div><p>${config.prompt}</p>${!standaloneType&&LAB_OPTIONS[lessonIndex]?`<label>选择本次要验证的知识点<select data-lab-select>${LAB_OPTIONS[lessonIndex].map(k=>`<option value="${k}" ${k===type?'selected':''}>${LAB_CONFIG[k].name}</option>`).join('')}</select></label>`:''}<p class="tiny">改变参数用于变式探索；正文例题仍按原题条件讲解。需要回到起点时，点“重置实验”。</p>${labControls(type,config)}<div id="lab-picture" class="lab-picture">${m.svg}</div><p id="lab-caption" class="lab-caption" role="status">${m.caption}</p><div class="controls"><button data-lab="previous" class="secondary">上一步</button><button data-lab="next">下一步</button><button data-lab="play" class="secondary" id="lab-play">播放动画</button><button data-lab="end" class="quiet">查看终点</button><button data-lab="reset" class="quiet">重置实验</button></div><label for="lab-time" class="lab-timeline">${['chase','pasture','multiples'].includes(type)?'时间':'演示进度'}：<output id="lab-time-label">0 / ${labLimit(type,labState.values)}</output><input id="lab-time" type="range" data-lab-time min="0" max="${labLimit(type,labState.values)}" step="1" value="0"></label><details class="lab-reason"><summary>操作后，展开计算依据</summary><p id="lab-formula" class="formula">${m.formula}</p><p>请先用自己的话解释，再用算式核对。动画不代替独立作答。</p></details>${type==='allocation'?'<div class="controls"><button data-lab="collect">收录当前方案</button><span id="lab-collected" role="status">已收录0 / 7种</span></div><div id="lab-solutions" class="lab-solutions"></div>':''}</section>`;
}
function stopLab(){clearInterval(labTimer);labTimer=null;const b=document.getElementById('lab-play');if(b)b.textContent='播放动画';}
function labPaint(previous=labState.step,resetPrediction=false){
  if(!labState)return;const m=labModel(labState.type,labState.values,labState.step,previous);
  document.getElementById('lab-picture').innerHTML=m.svg;
  document.getElementById('lab-caption').textContent=m.caption;
  document.getElementById('lab-formula').textContent=m.formula;
  const range=document.getElementById('lab-time'),max=labLimit(labState.type,labState.values);range.max=max;range.value=labState.step;
  document.getElementById('lab-time-label').textContent=`${labState.step} / ${max}`;
  const q=document.getElementById('game-question');if(q){q.textContent=m.question;if(resetPrediction){document.getElementById('game-feedback').textContent='';document.getElementById('game-answer').value='';}}
  // 尊重减少动态效果设置；仍保留手动调整与全部数学信息。
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)document.querySelectorAll('.lab-motion').forEach(node=>node.remove());
}
function labAdvance(next){
  const previous=labState.step;labState.step=Math.max(0,Math.min(labLimit(labState.type,labState.values),next));
  if(labState.type==='allocation'){
    const row=[[2,3,4],[2,4,3],[3,2,4],[3,3,3],[3,4,2],[4,2,3],[4,3,2]][labState.step];
    ['a','b','c'].forEach((key,i)=>{labState.values[key]=row[i];document.getElementById('lab-'+key).value=row[i];document.getElementById('lab-value-'+key).textContent=row[i];});
  }
  labPaint(previous,labState.type==='allocation');
}
function labAction(action){
  if(!labState)return;
  if(action==='play'){
    if(labTimer){stopLab();return;}
    if(labState.step>=labLimit(labState.type,labState.values))labAdvance(0);
    document.getElementById('lab-play').textContent='暂停动画';
    labTimer=setInterval(()=>{if(!document.getElementById('lab-picture'))return stopLab();labAdvance(labState.step+1);if(labState.step>=labLimit(labState.type,labState.values))stopLab();},800);return;
  }
  stopLab();
  if(action==='next')labAdvance(labState.step+1);
  if(action==='previous')labAdvance(labState.step-1);
  if(action==='end')labAdvance(labLimit(labState.type,labState.values));
  if(action==='reset'){
    LAB_CONFIG[labState.type].params.forEach(([key])=>{const value=labState.initialValues[key];labState.values[key]=value;document.getElementById('lab-'+key).value=value;document.getElementById('lab-value-'+key).textContent=value;});
    if(labState.type==='allocation'){labState.found=[];document.getElementById('lab-collected').textContent='已收录0 / 7种';document.getElementById('lab-solutions').textContent='';}
    labAdvance(0);labPaint(0,true);
  }
  if(action==='collect'){
    const row=[labState.values.a,labState.values.b,labState.values.c],label=document.getElementById('lab-collected');
    if(row.reduce((a,b)=>a+b,0)!==9){label.textContent='总数要是9本，请继续调整。';return;}
    if(labState.found.some(r=>r.join()===row.join())){label.textContent='这组已收录，请换一种。';return;}
    labState.found.push(row);labState.found.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);label.textContent=`已收录${labState.found.length} / 7种`;
    document.getElementById('lab-solutions').innerHTML=labState.found.map(r=>`<span class="tag">甲${r[0]} · 乙${r[1]} · 丙${r[2]}</span>`).join(' ');
  }
}
document.addEventListener('click',event=>{const b=event.target.closest('[data-lab]');if(b)labAction(b.dataset.lab);});
document.addEventListener('input',event=>{
  const el=event.target;if(!labState)return;
  if(el.hasAttribute('data-lab-select')){
    const lesson=labState.lessonIndex,type=el.value;
    if(!LAB_OPTIONS[lesson]?.includes(type))return;
    stopLab();chosenLab[lesson]=type;
    el.closest('.lesson-lab').outerHTML=labView(lesson);
    labPaint(0,true);return;
  }
  if(el.dataset.labParam){stopLab();const key=el.dataset.labParam,def=LAB_CONFIG[labState.type].params.find(p=>p[0]===key);if(!def)return;labState.values[key]=Math.max(def[2],Math.min(def[3],Number(el.value)));document.getElementById('lab-value-'+key).textContent=labState.values[key];labState.step=0;labPaint(0,true);}
  if(el.hasAttribute('data-lab-time')){stopLab();labAdvance(Number(el.value));}
});
