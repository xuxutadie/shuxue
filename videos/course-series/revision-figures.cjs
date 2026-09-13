// 修订课的数量关系图：每个动作对应复制、抵消、分段移动或总量守恒。
module.exports=function revisedFigure(s,h){
 const {C,text,box,g,show,move,pulse,svgPath,wrap}=h;
 const t=(x,y,v,n=32)=>text(x,y,v,n), phase=s.data.phase;
 const card=(id,x,y,w,ht,c,label)=>g(id,box(x,y,w,ht,c)+t(x+18,y+ht/2+11,label));
 const dot=(id,x,y,c,r=20)=>g(id,`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${C.ink}" stroke-width="3"/>`);
 let a='';
 if(s.kind==='align'){
  const other=phase==='other', rows=other?[[2,3,31,2],[3,2,34,3]]:[[2,3,31,3],[3,2,34,2]];
  a+=t(45, sixty(),'一行就是一份完整条件',38);
  for(let r=0;r<2;r++){
   const [b,c,w,m]=rows[r],y=140+r*230;
   a+=g('old'+r,t( sixty(),y,`${b}大 ＋ ${c}小 ＝ ${w}克`,35));
   a+=g('new'+r,t( sixty(),y,`${b*m}大 ＋ ${c*m}小 ＝ ${w*m}克`,35));
   const cue=phase==='cancel'?0:other?1:2;
   move('old'+r,{opacity:0},cue,.5);show('new'+r,cue,.5,{});
   a+=card('times'+r,720,y-45,170,70,C.coral,`整行×${m}`);show('times'+r,cue,0);
   for(let i=0;i<b*m;i++){
    a+=g(`b${r}-${i}`,`<rect x="${ sixty()+i*48}" y="${y+ thirty()}" width="35" height="65" rx="6" fill="${C.purple}" stroke="${C.ink}" stroke-width="3"/>`);
    if(i>=b)show(`b${r}-${i}`,cue,1+i*.13,{x:-b*48});
    if(phase==='cancel')move(`b${r}-${i}`,{opacity:.12},0,3+i*.08);
    if(other&&i<4)move(`b${r}-${i}`,{opacity:.12},2,2+i*.08);
   }
   for(let i=0;i<c*m;i++){
    a+=dot(`c${r}-${i}`,555+(i%6)*55,y+55+Math.floor(i/6)* sixty(),C.yellow,17);
    if(i>=c)show(`c${r}-${i}`,cue,1+i*.13,{x:-70});
    if(phase==='cancel'&&i<4)move(`c${r}-${i}`,{opacity:.12},0,4+i*.12);
    if(other)move(`c${r}-${i}`,{opacity:.12},2,1+i*.08);
   }
  }
  a+=g('result',t( eighty(),620,phase==='cancel'?'5个小零件 ↔ 25克':other?'5个大零件 ↔ 40克':'数量、重量必须一起变化',36));show('result',phase==='multiply'?3:2,1);
  return a;
 }
 if(s.kind==='bundle'){
  a+=t(45, sixty(),'合并后的数量，正好配成相同的套',36);
  for(let i=0;i<5;i++){
   const x= eighty()+i*175;
   a+=g('big'+i,`<rect x="${x}" y="150" width="60" height="90" rx="10" fill="${C.purple}" stroke="${C.ink}" stroke-width="3"/>`);
   a+=dot('small'+i,x+ thirty(),390,C.yellow,24);
   a+=g('set'+i,`<rect x="${x-15}" y="125" width="135" height="230" rx="20" fill="none" stroke="${C.ink}" stroke-width="4" stroke-dasharray="8 6"/>`);
   move('small'+i,{x:35,y:- ninety(),duration:1.3},1,1+i*.2);show('set'+i,1,2+i*.2,{});
  }
  a+=card('sum',150,470,680, ninety(),C.mint,'5套＝75克 → 1套＝15克');show('sum',1,4);
  move('set4',{opacity:.12},2,1);move('big4',{opacity:.12},2,1);move('small4',{opacity:.12},2,1);
  a+=g('four',t(160,620,'目标4套：15×4＝60克',38));show('four',2,2);
  return a;
 }
 if(s.kind==='factor-square'){
  [[1,36],[2,18],[3,12],[4,9],[6,6]].forEach(([x,y],i)=>{
   a+=card('left'+i, ninety(), sixty()+i*105,160,75,C.yellow,String(x))+card('right'+i,620, sixty()+i*105,160,75,C.blue,String(y));
   a+=svgPath('join'+i,`M270 ${97+i*105}H600`,C.ink,3);
   show('left'+i,i<4?0:1,i<4?i*1.4:1,{x:- sixty()});show('right'+i,i<4?0:1,i<4?i*1.4:1,{x: sixty()});show('join'+i,i<4?0:1,i<4?i*1.4:1);
  });
  move('left4',{x:220},1,4);move('right4',{x:-310,opacity:0},1,4);
  move('join4',{opacity:0},1,4);
  a+=g('count',t(200,635,'4对×2 ＋ 1个 ＝ 9个不同因数',34));show('count',2,2);return a;
 }
 if(s.kind==='sync-count'){
  a+=t(45,65,'把每一次重合留在同一条时间线上',35);
  for(let row=0;row<2;row++){
   const y=200+row*210,interval=row?8:6;
   a+=svgPath('axis'+row,`M70 ${y}H920`,C.ink,4)+t( seventy(),y-65,`每${interval}秒闪`,32);
   for(let n=0;n<=72;n+=interval){const x= seventy()+n*11;
    a+=dot(`light${row}-${n}`,x,y,row?C.blue:C.purple,n%24===0?19:10);
    if(n)show(`light${row}-${n}`,n<=24?0:1,n<=24?n/interval*.45:(n-24)/interval*.45,{y:-40});
    if(n%24===0)a+=t(x-12,y+ fifty(),String(n),28);
   }
  }
  [24,48,72].forEach((n,i)=>{a+=svgPath('mark'+i,`M${ seventy()+n*11} 150V455`,C.coral,5);show('mark'+i,2,1+i*.5);});
  a+=g('count',t(210,570,'0秒不算；24、48、72，共3次',34));show('count',2,3);
  a+=g('limit',`<path d="M840 135V470" stroke="${C.ink}" stroke-width="3" stroke-dasharray="8 6"/>`+t(650,625,'终点改为70秒 → 2次', thirty()));show('limit',3,1);return a;
 }
 if(s.kind==='area-notch'){
  const x=180,y=130,u=75;
  a+=t(45,65,'补回缺口，再试着重新分割',36);
  a+=g('bottom',`<rect x="${x}" y="${y+3*u}" width="${8*u}" height="${3*u}" fill="${C.blue}" stroke="${C.ink}" stroke-width="4"/>`);
  a+=g('left',`<rect x="${x}" y="${y}" width="${3*u}" height="${3*u}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="4"/>`);
  a+=g('right',`<rect x="${x+5*u}" y="${y}" width="${3*u}" height="${3*u}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="4"/>`);
  a+=g('hole',`<rect x="${x+3*u}" y="${y}" width="${2*u}" height="${3*u}" fill="${C.coral}" stroke="${C.ink}" stroke-width="3"/>`);
  move('hole',{opacity:.12},0,4);a+=g('dims',t(420,110,'长8厘米', thirty())+t(45,370,'宽6厘米',28)+t(415,175,'2厘米',28)+t(420,285,'深3',28));
  a+=svgPath('cut',`M${x- thirty()} ${y+3*u}H${x+8*u+ thirty()}`,C.ink,5);show('cut',1,1);
  move('left',{y:- thirty()},2,1);move('right',{x:-2*u,y:- thirty()},2,1);
  move('hole',{opacity:0},2,1);move('dims',{opacity:0},2,1);
  a+=g('sum',t(200,635,'下方24 ＋ 上方18 ＝ 42平方厘米',34));show('sum',3,1);return a;
 }
 if(s.kind==='chase-stop'){
  const scale=.62,x= ninety(),ys=[220,415];
  a+=t(45,65,'同一个标尺：两人的位置与差距',36);
  ys.forEach((y,i)=>{a+=svgPath('road'+i,`M80 ${y}H920`,C.ink,4)+t( eighty(),y- fifty(),i?'小华 90米/分':'小明 60米/分', thirty());});
  a+=dot('slow',x+300*scale,ys[0],C.purple,26)+dot('fast',x,ys[1],C.coral,26);
  a+=g('gap',`<rect x="${x}" y="295" width="${300*scale}" height="30" fill="${C.yellow}"/>`);
  if(phase==='stages'){
   const stages=[[4,240,360,180,1],[6,360,360,300,2],[16,960,1260,0,3]];
   stages.forEach(([time,slow,fast,gap,cue],i)=>{
    move('slow',{x:slow*scale,duration:i===2?5:2},cue,1);move('fast',{x:fast*scale,duration:i===2?5:2},cue,1);
    move('gap',{x:fast*scale,scaleX:gap/300,transformOrigin:'left center',duration:i===2?5:2},cue,1);
    a+=g('stage'+i,t( ninety(),550,`${['追4分钟','再停2分钟','再追10分钟'][i]}：差距${gap}米；经过${time}分钟`,34));show('stage'+i,cue,1);if(i<2)move('stage'+i,{opacity:0},cue+1,0);
   });
  }else{
   move('slow',{x:960*scale,duration:5},0,1);move('fast',{x:1260*scale,duration:5},0,1);move('gap',{opacity:0},0,1);
   a+=g('same',`<path d="M${x+1260*scale} 150V460" stroke="${C.mint}" stroke-width="8"/>`);show('same',2,1);
   a+=g('verify',t(120,570,'小华走14分；小明走21分 → 都是1260米',32));show('verify',2,2);
  }
  a+=t( eighty(),120,'停留期间：快者不动，慢者继续走', thirty());return a;
 }
 if(s.kind==='reservoir'){
  a+=t(45,65,'把储备下降与进、出水分开',36);
  a+=g('tank',`<path d="M230 150V535H730V150" fill="none" stroke="${C.ink}" stroke-width="7"/>`);
  a+=g('water',`<rect x="235" y="235" width="490" height="295" fill="${C.blue}"/>`);
  move('water',{scaleY:0,transformOrigin:'center bottom',duration:6},0,4);
  a+=g('incoming',`<path d="M90 180H300V245" fill="none" stroke="${C.mint}" stroke-width="16"/>`+t( sixty(),130,'进2升/分', thirty()));show('incoming',1,0);
  a+=g('outgoing',`<path d="M650 440H850V510" fill="none" stroke="${C.coral}" stroke-width="16"/>`+t(680,590,'排7升/分', thirty()));show('outgoing',1,3);
  a+=card('net',300,390,360, ninety(),C.yellow,'储备每分少5升');show('net',1,5);
  a+=g('total',t(170,635,'30 ＋ 2×6 ＝ 7×6 ＝ 42升',34));show('total',2,2);return a;
 }
 if(s.kind==='average-shift'){
  const vals=[2,3,4,7];
  a+=t(45,65,'四家店：总量16本，平均每家4本',35);
  vals.forEach((v,i)=>{
   for(let j=0;j<v;j++){a+=g(`book${i}-${j}`,`<rect x="${100+i*220}" y="${535-(j+1)* fifty()}" width="120" height="50" fill="${[C.blue,C.purple,C.yellow,C.coral][i]}" stroke="${C.ink}" stroke-width="2"/>`);if(i===3)show(`book${i}-${j}`,0,j*.15,{x:80});}
   a+=g('before'+i,t(110+i*220,590,['甲2本','乙3本','丙4本','丁7本'][i], thirty()));
   a+=g('after'+i,t(110+i*220,590,['甲4本','乙4本','丙4本','丁4本'][i], thirty()));
   move('before'+i,{opacity:0},2,1);show('after'+i,2,4);
  });
  [[4,0,2],[5,0,3],[6,1,3]].forEach(([j,i,b],k)=>move(`book3-${j}`,{x:(i-3)*220,y:(j-b)* fifty(),duration:2},2,1+k*.4));
  a+=svgPath('level','M80 335H915',C.ink,4);show('level',1,3);return a;
 }
 if(s.kind==='diagnostic-cycle'){
  a+=t(45,65,'先缩小到一个周期，再看整组边界',35);
  ['红','黄','蓝','绿'].forEach((n,i)=>{a+=card('car'+i, sixty()+i*225,175,190,120,[C.coral,C.yellow,C.blue,C.mint][i],n)+t(95+i*225,350,`第${i+1}位`, thirty());});
  a+=g('ring',`<rect x="50" y="165" width="210" height="140" rx="23" fill="none" stroke="${C.ink}" stroke-width="6"/>`);
  move('ring',{x:675},1,2);move('ring',{x:0},2,5);
  a+=card('wrong',110,440,770, ninety(),C.coral,'余0不是首位；36绿，37才是红');show('wrong',2,1);return a;
 }
 if(s.kind==='diagnostic-average'){
  a+=t(45,65,'八十的总量，要分成五份',38);
  for(let i=0;i<5;i++){
   a+=card('share'+i,55+i*180,200,150,140,i===4?C.coral:C.blue,i===4?'新增':'原份');
   if(i===4)show('share'+i,1,1,{x:-180});
   a+=g('value'+i,t(100+i*180,405,'16', forty()));show('value'+i,1,4+i*.15);
  }
  a+=card('total',150,500,690, ninety(),C.yellow,'80÷5＝16；16×5＝80');show('total',2,1);return a;
 }
 if(s.kind==='diagnostic-plan'){
  const names=['找错因','补方法','自己讲','用新题验'];
  names.forEach((n,i)=>{const x= sixty()+(i%2)*465,y=100+Math.floor(i/2)*245;a+=card('step'+i,x,y,380,150,[C.yellow,C.blue,C.purple,C.mint][i],n);show('step'+i,i,.5,{x:i%2? ninety():- ninety()});});
  a+=g('arrow',`<path d="M440 175H505M705 260V325M510 420H440" stroke="${C.ink}" stroke-width="5" fill="none"/>`);show('arrow',1,2);return a;
 }
 if(s.kind==='method-map'||s.kind==='method-check'){
  const rows=s.kind==='method-map'?[['共同整分','24和32','8包'],['周期位置','26÷3余2','方形'],['还原总量','11×4−30','14分']]:[['8包','每包3蓝＋4黄','全部整分'],['第26个','24→25→26','三角→圆→方'],['第4次14分','(30＋14)÷4','原平均11']];
  rows.forEach((row,i)=>{
   const y=110+i*170;a+=card('left'+i, forty(),y,250,105,[C.yellow,C.blue,C.purple][i],row[0]);
   a+=g('arrow'+i,`<path d="M305 ${y+50}H345" stroke="${C.ink}" stroke-width="5"/>`);show('arrow'+i,i,1);
   a+=g('middle'+i,t(360,y+ forty(),row[1], thirty()));show('middle'+i,i,2,{x:- forty()});
   a+=g('result'+i,t(360,y+ ninety(),row[2], thirty()));show('result'+i,i,4,{x: forty()});
  });return a;
 }
 if(s.kind==='operator-nested'){
  a+=card('rule', sixty(), eighty(),835, ninety(),C.purple,'a ★ b ＝ 2 × a ＋ b');
  a+=card('inner', ninety(),255,330,110,C.yellow,'2 ★ 3 ＝ 7');show('inner',0,1);
  a+=g('seven',t( ninety(),450,'7',64));show('seven',0,4,{y:- ninety()});move('seven',{x:450,y:-130,duration:1.5},1,2);
  a+=g('outer',t(655,320,'★ 4', fifty()));show('outer',1,0);
  a+=card('result',250,490,590, ninety(),C.mint,'2×7＋4＝18');show('result',1,5);return a;
 }
 return null;
};
function twenty(){return 20;}function thirty(){return 30;}function forty(){return 40;}function fifty(){return 50;}function sixty(){return 60;}function seventy(){return 70;}function eighty(){return 80;}function ninety(){return 90;}
