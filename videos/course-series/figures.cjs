// 每个专题都有对应的数学图示；动作时间绑定旁白，不依赖播放时的计时器。
module.exports=function figure(s,h){
 const revised=require('./revision-figures.cjs')(s,h);if(revised!==null)return revised;
 const {C,text,box,g,show,move,pulse,svgPath,lineAt,wrap}=h,phase=s.data.phase;
 let out='';
 const t=(x,y,v,size=34)=>text(x,y,v,size);
 const block=(name,x,y,w,ht,color,label)=>g(name,box(x,y,w,ht,color)+(label?t(x+16,y+ht/2+12,label):''));
 const dot=(name,x,y,color,r=16)=>g(name,`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${C.ink}" stroke-width="3"/>`);
 const note=(v,y=620)=>wrap(45,y,v,32,27,42);
 const item=(name,x,y,kind)=>g(name,kind==='book'?`<rect x="${x}" y="${y}" width="38" height="52" rx="6" fill="${C.purple}" stroke="${C.ink}" stroke-width="3"/><path d="M${x+9} ${y}v52" stroke="${C.ink}" stroke-width="2"/>`:`<path d="M${x} ${y}h17v43l-8 13-9-13Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`);
 if(s.kind==='balance'){
  const triple=phase==='triple',n=triple?3:2,check=phase==='check';
  out+=t(40,65,check?'回到原条件':'让本子数量先变得相同',38);
  if(check){
   out+=block('money',70,130,820,110,C.blue,'11元＝两本本子的钱＋一支笔的钱');
   out+=block('penprice',650,295,190,95,C.yellow,'笔3元');show('penprice',0,2);
   out+=block('leftprice',140,295,380,95,C.purple,'本子总共8元');show('leftprice',1,3);
   out+=block('b1',160,455,200,95,C.mint,'每本4元')+block('b2',540,455,200,95,C.mint,'每本4元');
   show('b1',1,7,{y:-125});show('b2',1,7.4,{y:-125});
  }else{
   out+=g('oldlabel',t(45,115,'上：原来2本＋1支＝11元',34))+g('newlabel',t(45,115,`上：配平后${2*n}本＋${n}支＝${11*n}元`,34))+t(45,345,`下：${2*n}本＋${n+1}支＝${triple?36:25}元`,34);
   move('oldlabel',{opacity:0},phase==='cancel'?0:1,phase==='cancel'?0:1);show('newlabel',phase==='cancel'?0:1,phase==='cancel'?0:1,{});
   for(let i=0;i<2*n;i++){
    out+=item('topb'+i,90+i*53,160,'book')+item('botb'+i,90+i*53,395,'book');
    if(i>=2&&phase!=='cancel'){show('topb'+i,1,.5+(i-2)*.1,{x:-2*53});}
    if(phase==='cancel'||triple){move('topb'+i,{opacity:.15},phase==='cancel'?1:2,.1*i);move('botb'+i,{opacity:.15},phase==='cancel'?1:2,.1*i);}
   }
   for(let i=0;i<n+1;i++){
    if(i<n){out+=item('topp'+i,535+i*63,160,'pen');if(i>0&&phase!=='cancel')show('topp'+i,1,1+i*.1,{x:-63});}
    out+=item('botp'+i,535+i*63,395,'pen');
    if((phase==='cancel'||triple)&&i<n){move('topp'+i,{opacity:.15},phase==='cancel'?1:2,1+i*.12);move('botp'+i,{opacity:.15},phase==='cancel'?1:2,1+i*.12);}
   }
   out+=g('old',t(775,200,'11元',40));out+=g('new',t(775,200,`${11*n}元`,40));
   if(phase==='cancel'){move('old',{opacity:0},0,0);show('new',0,0,{});}else{move('old',{opacity:0},1,1);show('new',1,1,{});}
   out+=t(775,435,`${triple?36:25}元`,40);
   out+=g('times',box(350,250,400,65,C.coral)+t(370,294,`整份数量与钱一起 ×${n}`,29));show('times',1,0);
   if(phase==='cancel'||triple){move('botp'+n,{y:100,x:-85},2,1);out+=g('result',t(triple?710:650,540,'1支＝3元',34));show('result',2,2);}
   else out+=note('先造出相同部分，再比较差额。');
  }
 }
 if(s.kind==='cycle'){
  const colors=[C.coral,C.yellow,C.blue,C.mint],names=['红','黄','蓝','绿'];
  if(phase==='operations'){
   out+=t(45,72,'每两个箭头是一组操作',36);
   const vals=[10,14,13,17,16,20,19,23];
   vals.forEach((v,i)=>{const x=65+(i%4)*220,y=185+Math.floor(i/4)*230;out+=block('v'+i,x,y,110,83,colors[i%4],String(v));if(i)show('v'+i,i<4?0:2,(i%4)*1.1,{x:-55});if(i<7)out+=g('op'+i,t(x+117,y+53,i%2===0?'＋4':'−1',27));});
   out+=note('初始数10，七次操作后到23。');
  }else{
   out+=t(45,70,phase==='groups'?'一眼看出每组四节':'只看组内位置，不用从头数到尾',36);
   for(let row=0;row<(phase==='groups'?3:1);row++)for(let j=0;j<4;j++){
    const x=80+j*220,y=125+row*140;
    out+=block(`car${row}${j}`,x,y,145,86,colors[j],names[j]);out+=t(x+43,y+122,phase==='groups'?String(row*4+j+1):`第${j+1}位`,28);
   }
   out+=g('ring',`<rect x="70" y="115" width="165" height="106" rx="24" fill="none" stroke="${C.ink}" stroke-width="6"/>`);
   if(phase==='groups'){for(let i=1;i<12;i++)move('ring',{x:(i%4)*220,y:Math.floor(i/4)*140,duration:.6},1,i*.85);}
   if(phase==='remainder'){
    out+=block('six',110,375,730,84,C.purple,'前24节＝6个完整组');show('six',0,1);
    move('ring',{x:220},1,3);move('ring',{x:440},1,5);pulse('car02',2);
    out+=g('answer',t(180,550,'25红 → 26黄 → 27蓝',40));show('answer',1,1);
   }
   if(phase==='zero'){
    move('ring',{x:660},0,.4);out+=block('tail',110,375,730,84,C.mint,'第28节：第7组的最后一节');show('tail',0,2);
    out+=g('next',t(120,550,'第29节，才回到下一组的红色',38));show('next',2,3);move('ring',{x:0},2,3);
   }
  }
 }
 if(s.kind==='factor'){
  if(phase==='group'){
   out+=t(45,68,'24个零件，观察分组后的余数',36);
   for(let j=0;j<24;j++){
    const x=105+(j%8)*99,y=160+Math.floor(j/8)*88;
    out+=dot('part'+j,x,y,C.blue,21);
    const tx=95+(j%6)*125,ty=140+Math.floor(j/6)*100;
    move('part'+j,{x:tx-x,y:ty-y,duration:1.5},0,2+j*.025);
    const fx=j<20?95+(j%5)*130:160+(j-20)*150,fy=j<20?140+Math.floor(j/5)*100:550;
    move('part'+j,{x:fx-x,y:fy-y,duration:1.5},1,2+j*.025);
    if(j>=20)move('part'+j+' circle',{fill:C.coral},1,2);
    move('part'+j,{x:95+(j%4)*170-x,y:130+Math.floor(j/4)* seventy()-y,duration:1.5},2,3+j*.025);
    if(j>=20)move('part'+j+' circle',{fill:C.blue},2,3);
   }
   out+=g('sixlabel',t(60,575,'每排6个：4排，正好分完',34));show('sixlabel',0,4);move('sixlabel',{opacity:0},1,0);
   out+=g('left',t(685,560,'剩4个',34));show('left',1,4);move('left',{opacity:0},2,3);
   out+=g('fourlabel',t(60,585,'每排4个：6排，正好分完',34));show('fourlabel',2,5);
  }else if(phase==='pairs'||phase==='eighteen'){
   const pairs=phase==='pairs'?[[1,24],[2,12],[3,8],[4,6]]:[[1,18],[2,9],[3,6]];
   pairs.forEach(([a,b],i)=>{out+=block('a'+i,90,85+i*120,180,83,C.yellow,String(a))+block('b'+i,460,85+i*120,180,83,C.blue,String(b))+g('link'+i,t(335,139+i*120,'×',38)+t(720,139+i*120,`＝ ${phase==='pairs'?24:18}`,38));show('a'+i,0,i*2,{x:-80});show('b'+i,0,i*2,{x:80});show('link'+i,0,i*2+.8);});
   out+=note(phase==='pairs'?'从小因数开始，配对相遇后停止。':'18＝2×3×3；9是因数，但不是质数。');
  }else if(phase==='prime'){
   [['7','1、7','恰好2个',C.yellow],['8','1、2、4、8','多于2个',C.blue],['1','1','只有1个',C.purple]].forEach(([a,b,c,col],i)=>{out+=block('card'+i,55+i*305,115,275,350,col,'')+t(150+i*305,200,a,64)+t(78+i*305,295,b,29)+t(78+i*305,385,c,32);pulse('card'+i,i,1);});
   out+=note('大于1，并且恰有两个正因数，才是质数。');
  }else{
   const nodes=[['24',465,65],['4',245,230],['6',665,230],['2',140,440],['2',345,440],['2',575,440],['3',790,440]];
   [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]].forEach(([a,b],i)=>{const p=nodes[a],q=nodes[b];out+=svgPath('edge'+i,`M${p[1]+35} ${p[2]+60}L${q[1]+35} ${q[2]}`,C.ink,4);show('edge'+i,i<2?0:1,i*.22);});
   nodes.forEach(([v,x,y],i)=>{out+=block('node'+i,x,y,85,72,i<3?C.blue:C.yellow,v);if(i)show('node'+i,i<3?0:1,i*.23,{y:-55});});
   out+=note('拆到末端全是质数，再把它们乘回去。');
  }
 }
 if(s.kind==='multiples'){
  if(phase==='fruit'){
   out+=t(40,70,'六个礼包：每包水果组合完全相同',34);
   out+=g('factors',t(70,230,'苹果12：1、2、3、4、6、12',33)+t(70,370,'梨18：1、2、3、6、9、18',33)+t(70,480,'两行共有：1、2、3、6',36));move('factors',{opacity:0},2,1);
   for(let b=0;b<6;b++){
    const x=60+(b%3)*300,y=125+Math.floor(b/3)*210;
    out+=g('bag'+b,box(x,y,255,175,C.yellow));show('bag'+b,2,2+b*.12,{y:50});
    for(let j=0;j<5;j++){out+=dot(`f${b}-${j}`,x+45+(j%3)* seventy(),y+55+Math.floor(j/3)*65,j<2?C.coral:C.mint,20);show(`f${b}-${j}`,3,.5+b*.15+j*.05,{x:200-x,y:-80});}
   }
   out+=note('每包2个苹果、3个梨；六包全部分完。');
  }else if(phase==='lights'||phase==='variant'){
   const a=phase==='lights'?4:6,b=phase==='lights'?6:8,end=phase==='lights'?16:24,scale=800/end;
   out+=t(40,70,`两条时间线：每${a}秒和每${b}秒`,36);
   for(let row=0;row<2;row++){
    const y=205+row*220,k=row?b:a;out+=svgPath('axis'+row,`M70 ${y}H920`,C.ink,4);
    for(let n=0;n<=end;n+=k){out+=dot(`lamp${row}-${n}`,80+n*scale,y,row?C.blue:C.purple,22)+t(70+n*scale,y+65,String(n),27);if(n)show(`lamp${row}-${n}`,row===0?(phase==='lights'?0:2):(phase==='lights'?1:2),n/k*.75,{y:-45});}
   }
   const meet=phase==='lights'?12:24;out+=svgPath('common',`M${80+meet*scale} 145V480`,C.coral,8);show('common',phase==='lights'?2:2,phase==='lights'?2:7);out+=g('stamp',t(245,570,`首次再次重合：${meet}秒`,40));show('stamp',phase==='lights'?2:2,phase==='lights'?4:8);
  }else{
   out+=block('a',70,100,815,150,C.yellow,'分成相同礼包 → 找共同因数');
   out+=block('b',70,350,815,150,C.blue,'间隔再次相遇 → 找共同倍数');
   pulse('a',0,1);pulse('b',1,1);out+=note('先判断数的含义，再看“最多”或“首次”。');
  }
 }
 if(s.kind==='area'||s.kind==='review'&&['area','transfer'].includes(phase)){
  if(['triangle','slide'].includes(phase)){
   out+=t(45,70,'底与高，一定要互相对应',38);
   out+=svgPath('base','M100 465H900',C.ink,4)+svgPath('upper','M100 165H900',C.purple,3);
   out+=g('tri',`<polygon points="170,465 710,465 440,165" fill="${C.yellow}" stroke="${C.ink}" stroke-width="4"/>`);
   out+=svgPath('height','M440 165V465',C.ink,3)+t(460,330,'高4厘米',32)+t(335,535,'底6厘米',34);
   if(phase==='triangle'){
    out+=g('copy',`<polygon points="440,165 980,165 710,465" fill="${C.blue}" stroke="${C.ink}" stroke-width="4"/>`);show('copy',1,1,{x:-270,y:300,rotation:180});out+=note('相同的两块拼成整体，一个只占一半。');
   }else{
    move('tri polygon',{attr:{points:'170,465 710,465 780,165'},duration:3},0,2);
    move('height',{x:340,duration:3},0,2);move('tri polygon',{attr:{points:'170,465 710,465 310,165'},duration:3},1,2);move('height',{x:-130,duration:3},1,2);
    out+=note('上方顶点沿平行线移动，垂直高度不变。');
   }
  }else{
   const review=s.kind==='review',w=review?(phase==='area'?9:10):8,ht=review?(phase==='area'?5:6):6,c=review?(phase==='area'?3:2):(phase==='variant'?3:2),u=review?63: seventy(),x=120,y=115,W=w*u,H=ht*u;
   out+=t(45,65,'先标长度，再计算面积',38);
   out+=g('shape',`<path d="M${x} ${y}H${x+W-c*u}V${y+c*u}H${x+W}V${y+H}H${x}Z" fill="${C.blue}" stroke="${C.ink}" stroke-width="4"/>`);
   // 分割后改用每块自己的尺寸，不能继续把原外框尺寸贴在移动后的小块上。
   if(phase!=='split')out+=t(x+W/2-25,y-18,`${w}厘米`,31)+t(x-90,y+H/2,`${ht}厘米`,31)+t(x+W-c*u+10,y+35,`${c}厘米`,27);
   out+=g('corner',`<rect x="${x+W-c*u}" y="${y}" width="${c*u}" height="${c*u}" fill="${C.coral}" stroke="${C.ink}" stroke-width="3"/>`);
   if(phase==='cut') {show('corner',0,3,{x:100,y:-60});move('corner',{opacity:.08,x:70,y:-45},3,2);}
   else if(phase==='split'){
    move('corner',{opacity:.08},0,0);move('shape',{opacity:0},0,0);
    out+=g('bottom',`<rect x="${x}" y="${y+c*u}" width="${W}" height="${H-c*u}" fill="${C.blue}" stroke="${C.ink}" stroke-width="3"/>`+t(x+70,y+c*u+(H-c*u)/2,`${w}厘米 × ${ht-c}厘米`,32));
    out+=g('top',`<rect x="${x}" y="${y}" width="${W-c*u}" height="${c*u}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`+t(x+55,y+c*u/2,`${w-c}厘米 × ${c}厘米`,32));move('top',{x:-35,y:-10},1,2);
    out+=svgPath('cutline',`M${x} ${y+c*u}H${x+W}`,C.ink,5);show('cutline',0,2);
   }else{move('corner',{opacity:.1},0,0);pulse('corner',review?1:1,1);}
   out+=note(`${w}×${ht} − ${c}×${c} ＝ ${w*ht-c*c} 平方厘米`);
  }
 }
 if(s.kind==='grid'){
  if(['halves','unit','larger'].includes(phase)){
   const u=phase==='larger'?100:90;
   for(let i=0;i<6;i++)out+=g('sq'+i,`<rect x="${110+(i%3)*u}" y="${130+Math.floor(i/3)*u}" width="${u}" height="${u}" fill="${C.blue}" stroke="${C.ink}" stroke-width="3"/>`);
   for(let i=0;i<4;i++){
    const x=560+(i%2)*155,y=130+Math.floor(i/2)*160;
    const pts=i%2===0?`${x},${y} ${x+u},${y} ${x},${y+u}`:`${x+u},${y} ${x+u},${y+u} ${x},${y+u}`;
    out+=g('half'+i,`<polygon points="${pts}" fill="${i%2?C.purple:C.yellow}" stroke="${C.ink}" stroke-width="3"/>`);
    const destX=110+Math.floor(i/2)*u,destY=130+2*u;
    move('half'+i,{x:destX-x,y:destY-y,duration:1.6},phase==='halves'?1:0,1+(i*.25));
   }
   out+=t(75,75,'6个整格 ＋ 4个半格',38)+t(550,465,phase==='larger'?'一格：3×3＝9':'一格：2×2＝4',34);
   if(phase==='unit'){
    out+=g('unit',`<rect x="560" y="190" width="200" height="200" fill="${C.mint}" stroke="${C.ink}" stroke-width="4"/><path d="M660 190V390M560 290H760" stroke="${C.ink}" stroke-width="3"/>`);show('unit',0,4);out+=note('8格，每格4平方厘米，共32平方厘米。');
   }else out+=note(phase==='larger'?'形状占8格不变，格子变大，总面积72。':'两片平移拼合，面积既没有重叠，也没丢失。');
  }else if(phase==='mirror'){
   for(let i=0;i<9;i++)out+=`<path d="M${80+i*100} 100V530" stroke="#CBD0D5" stroke-width="1"/>`;
   for(let i=0;i<5;i++)out+=`<path d="M80 ${115+i*100}H880" stroke="#CBD0D5" stroke-width="1"/>`;
   out+=svgPath('axis','M480 75V550',C.ink,5)+t(415,60,'镜面',32);
   out+=dot('leftpoint',280,315,C.coral,20)+dot('rightpoint',680,315,C.coral,20);show('rightpoint',0,3,{x:-400});
   out+=svgPath('dist','M280 315H680',C.purple,4);show('dist',1,1);
   out+=t(330,285,'2格',30)+t(530,285,'2格',30);
   out+=g('arrow',`<path d="M160 465h140v-30l80 50-80 50v-30H160Z" fill="${C.blue}" stroke="${C.ink}" stroke-width="3"/>`);
   out+=g('mirrorarrow',`<path d="M800 465H660v-30l-80 50 80 50v-30h140Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/>`);show('mirrorarrow',2,3,{x:-440});out+=note('对应点到轴一样远，左右方向相反。');
  }else{
   out+=t(45,70,'先看摆放，再沿正面方向看',36);
   for(let i=0;i<2;i++)out+=block('rear'+i,550,370-i*80, eighty(), eighty(),C.purple,'');
   for(let i=0;i<3;i++)out+=block('front'+i,330,450-i*80, eighty(), eighty(),C.blue,'');
   out+=t(280,585,'前列3块',30)+t(520,585,'后列2块',30);
   for(let i=0;i<2;i++)move('rear'+i,{x:-220,y:80,opacity:.12,duration:2},1,2);
   out+=g('view',t(70,180,'正面：后列被遮挡',36));show('view',1,3);
  }
 }
 if(s.kind==='chase'){
  const variant=phase==='variant',lead=variant?240:300,slow=60,fast=variant?100:90,T=variant?6:10,scale=.82;
  out+=t(40,65,'同一路线 · 同一个位置标尺',36);
  [250,450].forEach((y,i)=>{const name=variant?(i?'小林':'小军'):(i?'小华':'小明');out+=svgPath('road'+i,`M70 ${y}H910`,C.ink,4)+t(40,y-65,name+(i?' / 快者':' / 慢者'),30);});
  out+=dot('slow',90+lead*scale,250,C.purple,27)+dot('fast',90,450,C.coral,27);
  out+=g('gap',`<rect x="90" y="315" width="${lead*scale}" height="32" rx="9" fill="${C.yellow}"/>`);
  out+=g('gaplabel',t(430,345,`领先${lead}米`,32));out+=t(75,520,'0',27)+t(808,520,'900米',27);
  if(phase==='gap'){
   for(let j=1;j<=2;j++){move('slow',{x:slow*j*scale,duration:2},j===1?0:2,2);move('fast',{x:fast*j*scale,duration:2},j===1?0:2,2);move('gap',{x:fast*j*scale,scaleX:(lead-(fast-slow)*j)/lead,transformOrigin:'left center',duration:2},j===1?0:2,2);}
   move('gaplabel',{opacity:0},0,2);out+=note('每分钟两人都前进，但差距减少30米。');
  }else if(phase==='meet'||variant){
   move('slow',{x:slow*T*scale,duration:7,ease:'none'},0,2);move('fast',{x:fast*T*scale,duration:7,ease:'none'},0,2);move('gap',{x:fast*T*scale,scaleX:0,transformOrigin:'left center',duration:7,ease:'none'},0,2);move('gaplabel',{opacity:0},0,2);
   out+=g('meet',t(230,600,`${T}分钟后，同在${fast*T}米处`,38));show('meet',1,1);
  }else out+=note('从快者出发时计时：领先距离已经存在。');
 }
 if(s.kind==='pasture'){
  if(['compare','growth'].includes(phase)){
   out+=t(40,65,'相同原草 ＋ 不同天数的新草',36);
   for(let row=0;row<2;row++){
    const y=145+row*240,n=row?10:20;
    out+=block('base'+row,70,y,450,88,C.purple,'原来的草相同');
    out+=block('grown'+row,520,y,n*15,88,C.mint,`${row?5:10}天新草`);show('grown'+row,row,2,{scaleX:0});out+=t(70,y+150,`${row?8:5}头 × ${row?5:10}天 ＝ ${row?40:50}份`,37);
    if(phase==='growth')move('base'+row,{opacity:.12},0,2);
   }
   out+=note('总量差10份，对应多生长的5天。');
  }else{
   const cows=phase==='eight'?8:phase==='steady'?2:12,net=cows-2;
   out+=t(45,70,`原草30份　每天长2份　${cows}头牛`,34);
   for(let i=0;i<30;i++){const x=90+(i%10)*80,y=150+Math.floor(i/10)*105;out+=block('grass'+i,x,y,58,65,C.mint,'');}
   out+=block('new1',370,500,58,65,C.yellow,'')+block('new2',465,500,58,65,C.yellow,'');
   show('new1',1,1,{y:70});show('new2',1,1.2,{y:70});move('new1',{y:-65,opacity:0},1,3);move('new2',{y:-65,opacity:0},1,3);
   if(net>0){for(let i=0;i<30;i++){const day=Math.floor(i/net),cue=day===0?1:2,offset=day===0?3:1+(day-1)*1.5;move('grass'+i,{opacity:.12,y:-20},cue,offset+(i%net)*.045);}}
   else{for(let i=0;i<30;i++)pulse('grass'+i,1,3+(i%10)*.02);}
   out+=note(net?`每天实际减少${net}份；${30/net}天储备归零。`:'每天长2份、吃2份，原草储备不减少。');
  }
 }
 if(s.kind==='allocation'){
  if(phase==='list'||phase==='extra'){
   out+=t(55,70,phase==='list'?'每一行，都按甲、乙、丙记录':'先给每家2本，再分剩下的3本',35);
   const rows=phase==='list'?[[2,3,4],[2,4,3],[3,2,4],[3,3,3],[3,4,2],[4,2,3],[4,3,2]]:[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0],[1,1,1]];
   rows.forEach((v,i)=>{const x=60+(i<4?0:470),y=130+(i<4?i:i-4)*110;out+=block('row'+i,x,y,405, eighty(),[C.yellow,C.blue,C.purple,C.mint][i%4],v.map((n,j)=>`${['甲','乙','丙'][j]} ${n}`).join('　'));show('row'+i,phase==='list'?(i<2?1:i<5?2:3):(i<6?2:3),i<2?i*1.2:i<5?(i-2)*1.2:(i-5)*1.2,{x:i<4?-100:100});});
   out+=note(phase==='list'?'按甲的数量分类：2种＋3种＋2种。':'额外(0,1,2)六种，(1,1,1)一种。');
  }else{
   const vals=phase==='average'?[8,10,15,15]:[10,10,10,18],unit=22;
   out+=t(40,65,'移多补少，总量保持不变',38);
   out+=svgPath('baseline','M65 535H910',C.ink,4);
   vals.forEach((v,i)=>{const x=100+i*220;
    for(let j=0;j<v;j++){const name=`u${i}-${j}`;out+=g(name,`<rect x="${x}" y="${535-(j+1)*unit}" width="115" height="${unit}" fill="${[C.blue,C.purple,C.yellow,C.coral][i]}" stroke="${C.ink}" stroke-width="1.3"/>`);}
    out+=g('val'+i,t(x+30,585,String(v),36));move('val'+i,{opacity:0},phase==='average'?2:2,2);out+=g('avg'+i,t(x+25,585,'12',36));show('avg'+i,2,5);
   });
   let extras=[],needs=[];vals.forEach((v,i)=>{for(let j=12;j<v;j++)extras.push([i,j]);for(let j=v;j<12;j++)needs.push([i,j]);});
   extras.forEach(([i,j],k)=>{const [a,b]=needs[k];move(`u${i}-${j}`,{x:(a-i)*220,y:(j-b)*unit,duration:2},2,2+k*.15);});
   out+=note('把总量平均分成4份，每份12。',635);
  }
 }
 if(s.kind==='review'&&!['area','transfer'].includes(phase)){
  if(['shop','verify'].includes(phase)){
   out+=t(45,68,'先比较差，再返回原题',38);
   out+=block('one',65,130,825,100,C.yellow,'2本＋3支＝25元')+block('two',65,300,825,100,C.blue,'2本＋5支＝31元');
   out+=svgPath('bridge','M120 238V295',C.ink,5);show('bridge',0,2);
   out+=block('answer',110,480,730,90,C.mint,phase==='shop'?'1本＋2支＝8＋6＝14元':'两组原条件全部吻合 ✓');show('answer',2,3,{y:-70});
  }else if(phase==='operator'){
   out+=block('rule',70,100,815,100,C.purple,'a ★ b ＝ 2 × a ＋ b');
   out+=block('a',150,275,210,110,C.yellow,'a 放3')+block('b',580,275,210,110,C.blue,'b 放4');
   move('a',{x:65,y:40},1,1);move('b',{x:-65,y:40},1,1);
   out+=block('value',150,485,650,90,C.mint,'2 × 3 ＋ 4 ＝ 10');show('value',1,4);
  }else{
   const labels=phase==='checklist'?['读清题目','说明方法','核对计算','回到条件']:phase==='talk'?['完整题目','画图说理','逐步计算','检查答案']:['读题整理','能做先做','标记卡点','回头检查'];
   labels.forEach((v,i)=>{const x=70+(i%2)*475,y=110+Math.floor(i/2)*250;out+=block('step'+i,x,y,370,150,[C.yellow,C.blue,C.purple,C.mint][i],`${i+1}　${v}`);show('step'+i,i,0,{x:i%2?100:-100});});
  }
 }
 return out;
};
function seventy(){return 70;}
function eighty(){return 80;}
