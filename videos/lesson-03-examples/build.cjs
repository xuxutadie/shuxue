// 复用已验收的配色、字幕、时间轴；此处只绘制走格子的教学图。
const path=require('node:path');
const build=require('../course-series/build.cjs');
function figure(s,h){
 const {C,text,box,g,show,move}=h;
 const t=(x,y,v,size=34)=>text(x,y,v,size);
 const marker=(name,x,y)=>g(name,`<path d="M ${x-16} ${y-15} L ${x+16} ${y-15} L ${x} ${y+6} Z" fill="${C.coral}" stroke="${C.ink}" stroke-width="3"/><circle cx="${x}" cy="${y-42}" r="23" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`);
 const numberLine=(from,to,x,y,step)=>`<path d="M ${x} ${y} H ${x+(to-from)*step}" stroke="${C.ink}" stroke-width="4"/>`+Array.from({length:to-from+1},(_,i)=>`<path d="M ${x+i*step} ${y-8} V ${y+8}" stroke="${C.ink}" stroke-width="3"/>`+t(x+i*step-15,y+45,from+i,28)).join('');
 const card=(name,x,y,w,label,color=C.yellow)=>g(name,box(x,y,w,80,color)+t(x+20,y+52,label));
 let out='';
 if(s.kind==='walk-pair'){
  out=t(55,85,'从10出发，先走4格，再退1格',38)+numberLine(10,15,95,325,150)+marker('pawn',95,310);
  move('pawn',{x:600,duration:3.2,ease:'none'},1,1.3);
  move('pawn',{x:450,duration:1.1,ease:'power1.inOut'},2,1.3);
  out+=card('forward',90,145,350,'第1次：＋4',C.blue)+card('back',510,145,340,'第2次：－1',C.purple);
  show('forward',1);show('back',2);
  out+=g('gain',`<path d="M 95 420 V 447 H 545 V 420" fill="none" stroke="${C.coral}" stroke-width="6"/>`+t(200,500,'最后前进了3格',40));show('gain',3,1);
  out+=card('pair',110,545,735,'一组 = 先＋4，再－1 → 最终＋3',C.mint);show('pair',4);
 }else if(s.kind==='walk-repeat'){
  out=t(55,78,'每做完一组，都前进3格',38);
  const rows=[[10,14,13],[13,17,16],[16,20,19]];
  rows.forEach((v,i)=>{const y=125+i*145,n='row'+i;
   out+=g(n,box(45,y,890,116,[C.blue,C.purple,C.mint][i])+t(65,y+43,`第${i+1}组`,30)+t(220,y+83,v[0],45)+t(350,y+83,'→',35)+t(450,y+83,v[1],45)+t(575,y+83,'→',35)+t(680,y+83,v[2],45)+t(340,y+30,'＋4',25)+t(565,y+30,'－1',25)+t(775,y+71,'＋3',42));
   show(n,i,1,{x:-30});
  });
  out+=card('total',80,575,820,'3格 ＋ 3格 ＋ 3格 = 9格',C.yellow);show('total',4);
 }else if(s.kind==='walk-seven'){
  out=t(55,82,'七张卡，代表七次操作',40);
  for(let i=0;i<7;i++){
   const x=48+i*130,n='op'+i;
   out+=g(n,t(x+12,153,`第${i+1}次`,26)+box(x,175,112,105,i%2?C.purple:C.blue)+t(x+22,244,i%2?'−1':'＋4',38));show(n,0,.5+i*.23);
  }
  for(let i=0;i<3;i++){
   const x=38+i*260,n='group'+i;
   out+=g(n,`<rect x="${x}" y="117" width="252" height="191" rx="20" fill="none" stroke="${C.coral}" stroke-width="5"/>`+t(x+78,350,`第${i+1}组`,30));show(n,i?2:1,i?.6+(i-1)*1.4:.6);
  }
  out+=card('left',600,415,335,'剩1次：＋4',C.yellow);show('left',3);
  out+=card('result',80,545,810,'6次后在19 → 第7次到23',C.mint);show('result',4,1);
 }else if(s.kind==='walk-formula'){
  out=t(55,85,'把动作变成算式，每个数有来处',36);
  const terms=[['start','10',90,'最初的位置',C.blue],['groups','＋3×3',315,'每组3格，共3组',C.mint],['last','＋4',680,'剩下一次',C.yellow]];
  terms.forEach(([name,value,x,label,color],i)=>{
   const width=name==='groups'?335:210;
   out+=g(name,box(x,200,width,145,color)+t(x+25,294,value,64)+t(x,420,label,32));show(name,i,.6,{y:30});
  });
  out+=card('result',75,535,840,'10 ＋ 9 ＋ 4 = 23',C.purple);show('result',3,1);
 }else if(s.kind==='walk-check'){
  out=t(55,85,'从起点出发，数箭头，不数位置',36);
  const values=[10,14,13,17,16,20,19,23];
  values.forEach((v,i)=>{
   const x=65+i*117,n='value'+i;
   out+=g(n,t(x,300,v,42)+(i? t(x-43,293,'→',30)+t(x-47,225,i%2?'＋4':'−1',23):''));show(n,0,.2+i*1.2);
  });
  out+=card('count',65,395,860,'8个位置，7个箭头 = 7次操作',C.blue);show('count',1);
  out+=card('rule',65,530,860,'先找完整组 → 再做剩下的一步',C.mint);show('rule',2);
 }
 return out;
}
build(__dirname,figure);
