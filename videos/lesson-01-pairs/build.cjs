// 用真实旁白时间驱动教学动画；每个图形变化都对应一个数学理由。
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const scenes=read('script.json'),voice=read('voice-meta.json');
const C={ink:'#243047',cream:'#FFF9E9',blue:'#45C7FF',yellow:'#FFD43B',purple:'#B395FF',mint:'#62DDB5',coral:'#FF8666'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const box=(x,y,w,h,fill='white')=>`<rect x="${x+5}" y="${y+5}" width="${w}" height="${h}" rx="22" fill="${C.ink}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${fill}" stroke="${C.ink}" stroke-width="3"/>`;
const text=(x,y,value,size=36,weight=600,anchor='start',fill=C.ink)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(value)}</text>`;
const multiline=(x,y,lines,size=38,gap=60)=>lines.map((v,i)=>text(x,y+i*gap,v,size,500)).join('');
const glyph=kind=>({
 bottle:`<rect x="15" y="4" width="28" height="10" rx="3" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/><rect x="10" y="15" width="38" height="53" rx="10" fill="${C.blue}" stroke="${C.ink}" stroke-width="3"/><path d="M20 25V54" stroke="white" stroke-width="5" stroke-linecap="round"/>`,
 cup:`<path d="M9 18H42V54Q42 65 25 65Q9 65 9 54Z" fill="${C.coral}" stroke="${C.ink}" stroke-width="3"/><path d="M43 26H49Q60 27 55 40Q52 45 43 44" fill="none" stroke="${C.ink}" stroke-width="4"/><path d="M16 26V50" stroke="white" stroke-width="4" stroke-linecap="round"/>`,
 eraser:`<path d="M9 17L44 8L54 50L19 62Z" fill="${C.purple}" stroke="${C.ink}" stroke-width="3"/><path d="M13 34L48 25L52 43L17 52Z" fill="white" stroke="${C.ink}" stroke-width="2"/>`,
 pencil:`<path d="M20 10Q20 4 29 4Q38 4 38 10V51L29 68L20 51Z" fill="${C.yellow}" stroke="${C.ink}" stroke-width="3"/><path d="M20 17H38M29 21V50M24 59H34" stroke="${C.ink}" stroke-width="2.5"/>`
})[kind];
let scene,code,events;
const id=n=>`${scene.id}-${n}`;
const group=(n,s)=>`<g id="${id(n)}">${s}</g>`;
const item=(n,kind,x,y,scale=1)=>group(n,`<g transform="translate(${x} ${y}) scale(${scale})">${glyph(kind)}</g>`);
const at=(cue,offset=0)=>{const line=scene.lines.find(l=>l.cue===cue);if(!line)throw Error('缺少旁白标记 '+cue);return +(line.start+offset).toFixed(3);};
function tween(name,props,cue,offset=0){const t=at(cue,offset);code+=`tl.to('#${id(name)}',${JSON.stringify({duration:.8,ease:'power2.inOut',...props})},${t});`;events.push({subject:name,time:t,props});}
function show(name,cue,offset=0,from={y:20}){code+=`gsap.set('#${id(name)}',${JSON.stringify({opacity:0,...from})});`;tween(name,{opacity:1,x:0,y:0,duration:.7,ease:'power2.out'},cue,offset);}
function draw(name,cue,offset=0){code+=`gsap.set('#${id(name)}',{strokeDasharray:1800,strokeDashoffset:1800});`;tween(name,{strokeDashoffset:0,duration:1.2,ease:'none'},cue,offset);}
function pulse(name,cue,offset=0){tween(name,{scale:1.07,transformOrigin:'50% 50%',duration:.45,yoyo:true,repeat:1},cue,offset);}
const label=(n,x,y,w,h,lines,fill=C.mint,size=36)=>group(n,box(x,y,w,h,fill)+multiline(x+25,y+48,lines,size,52));
function order(n,y,title,a,b,total,kindA='bottle',kindB='cup',aCount=3){
 let out=box(20,y,1700,180)+text(50,y+42,title,29)+text(1360,y+103,total+'元',57,800);
 out+=text(225,y+42,a,28)+text(620,y+42,b,28);
 for(let j=0;j<aCount;j++)out+=item(`${n}-a${j}`,kindA,205+j*74,y+66,.9);
 const count=kindB==='cup'?(n==='one'?20:16):20;
 for(let j=0;j<count;j++)out+=item(`${n}-b${j}`,kindB,590+(j%10)*57,y+48+Math.floor(j/10)*60,.75);
 return out;
}
function question(kind){
 if(kind==='book')return box(20,12,1700,270)+multiline(60,73,[
 '学校第一次买了3个水瓶和20个茶杯，共用去134元；',
 '第二次买了同样的3个水瓶和16个茶杯，共用去118元。',
 '水瓶和茶杯的单价各是多少元？'],42,76);
 return box(20,12,1700,270)+multiline(60,73,[
 '小磊买3块橡皮，5支铅笔需付10.6元。若他买同品种的',
 '4块橡皮，4支铅笔需付12元，则一块橡皮的价格是',
 '________元。'],42,76);
}
function readScene(contest=false){
 let s=question(contest?'contest':'book');
 s+=group('underline1',`<path d="M${contest?245:352} 88H${contest?1050:1290}" stroke="${C.yellow}" stroke-width="9" stroke-linecap="round"/>`);
 s+=group('underline2',`<path d="M70 164H1270" stroke="${C.blue}" stroke-width="9" stroke-linecap="round"/>`);
 const a=contest?'3块橡皮 ＋ 5支铅笔':'3个水瓶 ＋ 20个茶杯',b=contest?'4块橡皮 ＋ 4支铅笔':'3个水瓶 ＋ 16个茶杯';
 s+=label('order1',40,327,1640,105,[`第一次：${a} ＝ ${contest?'10.6':'134'}元`],C.yellow,42);
 s+=label('order2',40,470,1640,105,[`第二次：${b} ＝ ${contest?'12':'118'}元`],C.blue,42);
 s+=group('note',text(65,647,contest?'先找容易入手的条件：4块橡皮与4支铅笔。':'总价：整次购买的钱　　单价：一个商品的价格',34));
 draw('underline1','first');draw('underline2','second');show('order1','first',2,{x:-150});show('order2','second',3,{x:150});show('note',contest?'compare':'meaning');
 return s;
}
function pairScene(){
 let s=order('one',15,'第一次','3个水瓶','20个茶杯','134')+order('two',238,'第二次','3个水瓶','16个茶杯','118');
 s+=group('water-links',[0,1,2].map(j=>`<path d="M${229+j*74} 144V303" stroke="${C.blue}" stroke-width="6" stroke-dasharray="10 9"/>`).join(''));
 show('water-links','books',3,{});
 for(let j=0;j<3;j++){tween(`one-a${j}`,{opacity:.14},'books',7+j*.18);tween(`two-a${j}`,{opacity:.14},'books',7+j*.18);}
 for(let j=0;j<16;j++){tween(`one-b${j}`,{opacity:.13},'cups',3+j*.12);tween(`two-b${j}`,{opacity:.13},'cups',3+j*.12);}
 tween('water-links',{opacity:0},'cups');
 for(let j=16;j<20;j++){const x=590+(j%10)*57,y=15+48+60;const destX=360+(j-16)*150;pulse(`one-b${j}`,'extra');tween(`one-b${j}`,{x:destX-x,y:487-y,scale:1.5,transformOrigin:'50% 50%'},'extra',2);}
 s+=group('extra-label',text(65,549,'只多出',40)+text(1040,555,'4个茶杯',46,800));show('extra-label','extra',2);
 s+=label('difference',60,593,1600,75,['134 − 118 ＝ 16元　→　对应多出的4个茶杯'],C.yellow,38);show('difference','money');
 return s;
}
function shareScene(){
 let s=label('total',420,15,920,100,['4个茶杯的总价：16元'],C.yellow,46);
 for(let j=0;j<4;j++){
  const x=250+j*365;s+=item('cup'+j,'cup',x,230,1.8);
  s+=group('coin'+j,box(x-50,390,190,80,C.yellow)+text(x+45,446,'4元',42,800,'middle'));
  s+=group('arrow'+j,`<path d="M875 127L${x+43} 225" stroke="${C.ink}" stroke-width="4" fill="none"/>`);
  draw('arrow'+j,'split',j*.6);show('coin'+j,'split',2+j*.7,{x:850-x,y:-240});pulse('cup'+j,'split',2+j*.7);
 }
 s+=label('formula',60,510,1610,88,['(134 − 118) ÷ (20 − 16) ＝ 16 ÷ 4 ＝ 4元'],C.blue,42);show('formula','formula',2);
 s+=group('reason',text(80,652,'先确认：金额差只对应一种商品的数量差。',37));show('reason','reason');return s;
}
function backScene(){
 let s=text(50,55,'第二次：3个水瓶 ＋ 16个茶杯 ＝ 118元',41,700);
 s+=box(50,100,1630,135);
 // 金额条按54:64分配宽度，留出6像素分隔，避免图示比例误导。
 s+=group('cupbar',`<rect x="799" y="178" width="847" height="42" rx="15" fill="${C.coral}"/>`+text(1222,157,'茶杯：16 × 4 ＝ 64元',36,700,'middle'));
 s+=group('bottlebar',`<rect x="78" y="178" width="715" height="42" rx="15" fill="${C.blue}"/>`+text(435,157,'水瓶：剩下54元',34,700,'middle'));
 show('cupbar','cupcost',2,{x:250});show('bottlebar','remaining',2,{x:-150});
 for(let j=0;j<3;j++){s+=item('bottle'+j,'bottle',285+j*465,272,1.25);s+=group('price'+j,text(322+j*465,415,'18元',42,800,'middle'));show('price'+j,'bottle',1+j*.5,{y:-90});}
 s+=label('check1',55,460,1620,85,['第一次：3 × 18 ＋ 20 × 4 ＝ 134元  ✓'],C.yellow,42);
 s+=label('check2',55,566,1620,85,['第二次：3 × 18 ＋ 16 × 4 ＝ 118元  ✓'],C.mint,42);
 show('check1','check1',2,{x:-90});show('check2','check2',2,{x:90});return s;
}
function trapScene(){
 let s=box(20,15,810,255)+box(900,15,820,255)+text(55,65,'第一次：10.6元',39,800)+text(930,65,'第二次：12元',39,800);
 for(let j=0;j<3;j++)s+=item('ea'+j,'eraser',70+j*85,110,1);
 for(let j=0;j<5;j++)s+=item('pa'+j,'pencil',380+j*76,110,1);
 for(let j=0;j<4;j++)s+=item('eb'+j,'eraser',925+j*85,110,1);
 for(let j=0;j<4;j++)s+=item('pb'+j,'pencil',1290+j*76,110,1);
 s+=label('diff',260,310,1200,93,['12 − 10.6 ＝ 1.4元'],C.yellow,47);show('diff','difference',1);
 s+=group('new-eraser',box(60,445,720,107,C.purple)+text(90,512,'多买1块橡皮：多付钱',39));show('new-eraser','more',1,{x:-130});pulse('eb3','more',1);
 s+=group('less-pencil',box(960,445,720,107,C.blue)+text(990,512,'少买1支铅笔：少付钱',39));show('less-pencil','less',1,{x:130});tween('pa4',{y:70,opacity:.2},'less',1);
 s+=group('note',text(125,636,'差额包含两种变化，不能直接当成橡皮单价。',41,800));show('note','conclusion');return s;
}
function multipleScene(){
 let s=label('goal',180,12,1390,100,['先消去铅笔：让两边的铅笔一样多'],C.purple,42);
 s+=text(50,206,'每份5支',38)+text(50,399,'每份4支',38);
 for(let j=0;j<4;j++){s+=group('top'+j,box(295+j*330,148,235,102,j===3?C.yellow:'white')+text(413+j*330,216,String((j+1)*5)+'支',46,800,'middle')+text(413+j*330,293,(j+1)+'份',31,500,'middle'));show('top'+j,'five',j*1.5,{x:-110});}
 for(let j=0;j<5;j++){s+=group('bottom'+j,box(295+j*265,343,222,102,j===4?C.yellow:'white')+text(406+j*265,411,String((j+1)*4)+'支',46,800,'middle')+text(406+j*265,488,(j+1)+'份',31,500,'middle'));show('bottom'+j,'four',j*1.3,{x:-110});}
 s+=label('meet',135,555,1460,95,['20是5和4的公倍数：第一单×4，第二单×5'],C.mint,39);show('meet','meet');pulse('top3','meet');pulse('bottom4','meet',.4);return s;
}
function copyScene(which){
 const a=which==='a',count=a?4:5,erasers=a?3:4,pencils=a?5:4,price=a?'10.6':'12',sum=a?'42.4':'60';
 let s=label('original',35,15,1650,100,[`原订单：${erasers}块橡皮 ＋ ${pencils}支铅笔 ＝ ${price}元`],a?C.yellow:C.blue,40);
 for(let j=0;j<count;j++){
  const x=55+j*(a?420:335),w=a?370:300;
  let card=box(x,180,w,215,'white')+text(x+25,224,`第${j+1}份`,30)+text(x+25,274,`${erasers}块橡皮`,34)+text(x+25,322,`${pencils}支铅笔`,34)+text(x+25,370,`${price}元`,38,800);
  card+=`<circle cx="${x+w-50}" cy="216" r="17" fill="${a?C.yellow:C.blue}" stroke="${C.ink}" stroke-width="3"/>`;
  s+=group('copy'+j,card);show('copy'+j,'copies',.35+j*.85,{x:50-x,y:-160});
  // 每一份保持商品和总价作为同一组移动，避免误导为只扩大一种商品。
  tween('copy'+j,{y:40,scale:.96,transformOrigin:'50% 50%'},'sum',j*.13);
 }
 s+=label('sum',45,480,1630,96,[`${erasers}×${count}＝${erasers*count}块橡皮　${pencils}×${count}＝20支铅笔　${price}×${count}＝${sum}元`],C.mint,37);show('sum','sum',1,{y:90});
 s+=group('rule',text(75,654,a?'整单×4：商品数量与总价一起扩大。':'两组都有20支同品种铅笔，费用相同。',39,800));show('rule','rule');return s;
}
function eliminateScene(){
 let s=box(20,15,1700,210)+box(20,265,1700,210)+text(50,53,'第一单×4',30)+text(50,303,'第二单×5',30);
 s+=text(255,53,'12块橡皮',29)+text(885,53,'20支铅笔',29)+text(255,303,'20块橡皮',29)+text(885,303,'20支铅笔',29);
 s+=text(1470,143,'42.4元',48,800)+text(1470,393,'60元',48,800);
 for(let row=0;row<2;row++){
  const ey=row?325:75;
  for(let j=0;j<(row?20:12);j++)s+=item(`e${row}-${j}`,'eraser',250+(j%10)*54,ey+Math.floor(j/10)*63,.73);
  for(let j=0;j<20;j++)s+=item(`p${row}-${j}`,'pencil',885+(j%10)*50,ey+Math.floor(j/10)*63,.7);
 }
 for(let j=0;j<20;j++){tween(`p0-${j}`,{opacity:.13},'pencils',1+j*.11);tween(`p1-${j}`,{opacity:.13},'pencils',1+j*.11);}
 for(let j=0;j<12;j++){tween(`e0-${j}`,{opacity:.13},'erasers',1+j*.13);tween(`e1-${j}`,{opacity:.13},'erasers',1+j*.13);}
 for(let j=12;j<20;j++)pulse(`e1-${j}`,'difference',.3+(j-12)*.12);
 s+=label('difference',45,510,1635,78,['多8块橡皮，多付60 − 42.4 ＝ 17.6元'],C.yellow,41);show('difference','difference',1);
 s+=group('answer',text(230,655,'每块橡皮：17.6 ÷ 8 ＝ 2.2元',53,800));show('answer','unit',2,{x:-100});
 return s;
}
function verifyScene(){
 let s=label('eraserprice',30,15,785,100,['橡皮：每块2.2元'],C.purple,43)+group('pencilprice',box(915,15,790,100,C.yellow)+text(945,79,'铅笔：每支0.8元',43));show('pencilprice','pencil',4);
 s+=label('pencilcalc',45,164,1640,93,['(12 − 4 × 2.2) ÷ 4 ＝ 0.8元'],C.blue,42);show('pencilcalc','pencil',1);
 s+=label('first',45,302,1640,90,['第一次：3 × 2.2 ＋ 5 × 0.8 ＝ 10.6元  ✓'],C.mint,40);show('first','first',2,{x:-90});
 s+=label('second',45,432,1640,90,['第二次：4 × 2.2 ＋ 4 × 0.8 ＝ 12元  ✓'],C.mint,40);show('second','second',2,{x:90});
 s+=group('summary',text(90,635,'整理条件 → 创造相同 → 消去求解 → 代回检验',40,800));show('summary','summary');return s;
}
function challengeScene(){
 // 结尾题干全部可见，不预先标注倍数、方法或参考答案。
 let s=box(25,15,1690,435)+multiline(70,90,[
 '小宁准备给学习小组购买文具。买5块橡皮和3支铅笔',
 '需要14.9元；如果改买同品种的3块橡皮和5支铅笔，',
 '需要13.1元。商品单价保持不变，购买时没有折扣。',
 '一块橡皮和一支铅笔的价格各是多少元？',
 '请写出计算过程，并说明自己的方法为什么成立。'],40,76);
 s+=label('prepare',70,503,1600,125,['暂停视频，用草稿纸画图、计算。','准备好以后，上台讲清思路，并检验两组条件。'],C.mint,36);
 return s;
}
// 配套法专用画面：每件商品在分组前后保持身份，避免凭空增减。
function bundleScene(){
 let s=label('condition',50,20,1630,100,['4块橡皮 ＋ 4支铅笔 ＝ 12元'],C.blue,46);
 for(let j=0;j<4;j++){
  const x=185+j*380;
  s+=item('e'+j,'eraser',x,210,1.35)+item('p'+j,'pencil',x,365,1.35);
  s+=group('ring'+j,`<rect x="${x-35}" y="175" width="250" height="165" rx="32" fill="none" stroke="${[C.purple,C.coral,C.blue,C.mint][j]}" stroke-width="9"/>`);
  tween('p'+j,{x:95,y:-155},'pair',.6+j*.7);draw('ring'+j,'pair',1+j*.7);
  s+=group('price'+j,box(x-5,404,190,86,C.yellow)+text(x+90,463,'3元',45,800,'middle'));
  show('price'+j,'divide',1+j*.45,{y:-100});
 }
 s+=label('divide',80,535,1570,90,['12 ÷ 4 ＝ 3元　→　每套的总价'],C.mint,44);show('divide','divide',1);
 s+=group('note',text(90,675,'一套＝1块橡皮＋1支铅笔；3元还不是单价。',36));show('note','meaning');return s;
}
function useBundleScene(){
 let s=label('condition',50,15,1630,95,['3块橡皮 ＋ 5支铅笔 ＝ 10.6元'],C.yellow,43);
 for(let j=0;j<3;j++){
  const x=175+j*360;s+=item('e'+j,'eraser',x,200,1.35);
  s+=group('ring'+j,`<rect x="${x-40}" y="165" width="265" height="165" rx="32" fill="none" stroke="${C.purple}" stroke-width="9"/>`);
  draw('ring'+j,'pair',.6+j*.6);
  s+=group('price'+j,text(x+95,380,'一套3元',35,800,'middle'));show('price'+j,'pair',2+j*.6);
 }
 for(let j=0;j<5;j++){
  const x=155+j*280;s+=item('p'+j,'pencil',x,400,1.35);
  if(j<3)tween('p'+j,{x:(270+j*360)-x,y:-200},'pair',j*.6);
  else tween('p'+j,{x:(1270+(j-3)*160)-x,y:-180},'left',.6+(j-3)*.6);
 }
 s+=group('leftbox',`<rect x="1220" y="165" width="420" height="235" rx="32" fill="none" stroke="${C.coral}" stroke-width="9"/>`+text(1430,366,'剩下2支',39,800,'middle'));show('leftbox','left',.8,{});
 s+=label('known',65,525,770,90,['3套：3 × 3 ＝ 9元'],C.purple,40);show('known','pair',3,{x:-80});
 s+=label('remaining',905,525,765,90,['剩下：10.6 − 9 ＝ 1.6元'],C.coral,36);show('remaining','subtract',2,{x:80});
 s+=group('why',text(90,672,'先扣除已知组合的费用，剩下的钱对应剩下的商品。',35));show('why','reason');return s;
}
function pricesScene(){
 let s=box(35,20,750,600,C.blue)+box(900,20,820,600,C.purple);
 s+=text(70,88,'先看剩下的2支铅笔',43,800);
 s+=item('p0','pencil',195,155,2)+item('p1','pencil',480,155,2);
 s+=label('penprice',75,365,660,106,['1.6 ÷ 2 ＝ 0.8元/支'],C.yellow,39);show('penprice','pencils',3);
 s+=group('each0',text(245,334,'0.8元',38,800,'middle'))+group('each1',text(534,334,'0.8元',38,800,'middle'));show('each0','pencils',2,{y:-65});show('each1','pencils',2.7,{y:-65});
 s+=group('kit',text(940,88,'再拆开一套：共3元',43,800)+item('eraser','eraser',1030,160,2)+item('pen','pencil',1420,160,2)+text(1320,255,'＋',55,800));show('kit','kit',.7,{});
 tween('pen',{y:42,opacity:.25},'eraser',1);
 s+=label('eraserprice',945,365,720,106,['3 − 0.8 ＝ 2.2元/块'],C.mint,40);show('eraserprice','eraser',2);
 s+=group('why',text(90,675,'先求什么，取决于整理后剩下什么。',40,800));show('why','why');return s;
}
function pairVerifyScene(){
 let s=label('prices',45,20,1640,90,['橡皮：2.2元/块　　铅笔：0.8元/支'],C.yellow,43);
 s+=label('first',45,173,1640,95,['第一次：3 × 2.2 ＋ 5 × 0.8 ＝ 10.6元  ✓'],C.mint,40);show('first','first',4,{x:-90});
 s+=label('second',45,315,1640,95,['第二次：4 × 2.2 ＋ 4 × 0.8 ＝ 12元  ✓'],C.blue,40);show('second','second',3,{x:90});
 s+=label('summary',45,460,1640,95,['配成一套 → 算已知部分 → 求剩余 → 检验'],C.purple,42);show('summary','summary');
 s+=group('limit',text(90,652,'先观察条件，能组成相同的一套时，再这样想。',36));show('limit','limit');return s;
}
function pairChallengeScene(){
 let s=box(25,15,1690,435)+multiline(70,88,[
 '美术小组购买绘画用品。4盒彩笔和4本绘画本共64元；',
 '2盒同样的彩笔和5本同样的绘画本共47元。',
 '同种商品的单价相同，购买时没有折扣。',
 '活动还需购买3盒彩笔和6本绘画本，一共应付多少元？',
 '请写出完整计算过程，并说明每一步的理由。'],40,76);
 s+=label('prepare',70,510,1600,125,['暂停视频，在草稿纸上画图、计算。','准备好后上台讲清思路，并检查原来的两组条件。'],C.mint,35);return s;
}

const renderers={read:()=>readScene(),pair:pairScene,share:shareScene,back:backScene,contest:()=>readScene(true),bundle:bundleScene,usebundle:useBundleScene,prices:pricesScene,verify:pairVerifyScene,challenge:pairChallengeScene};
const css=`@font-face{font-family:'Microsoft YaHei';src:local('Microsoft YaHei')}*{box-sizing:border-box}body{margin:0}.scene{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;background:${C.cream};color:${C.ink};font-family:'Microsoft YaHei',sans-serif;padding:36px 70px}.head{display:flex;justify-content:space-between;align-items:center;height:56px;font-size:27px;font-weight:700}.tag{padding:10px 22px;border:3px solid ${C.ink};border-radius:17px;background:${C.purple}}h1{font-size:58px;line-height:1.2;margin:25px 0 20px;letter-spacing:1px}.board{width:1780px;height:687px;display:block;overflow:visible}.subtitle{position:absolute;left:72px;right:72px;bottom:26px;min-height:103px;padding:16px 28px;background:${C.ink};color:white;border-radius:20px;display:flex;justify-content:center;align-items:center;text-align:center;font-size:35px;line-height:1.45}.source{position:absolute;left:80px;bottom:142px;font-size:23px;line-height:1;color:#45536C}.bar{position:absolute;bottom:0;left:0;width:1920px;height:8px;background:${C.coral};transform-origin:left}.chapter-dot{display:inline-block;width:13px;height:13px;border-radius:50%;margin:0 5px;border:2px solid ${C.ink};background:transparent}.chapter-dot.active{background:${C.ink}}`;
let duration=0,captions=[],motionMap=[];
fs.mkdirSync(path.join(root,'compositions'),{recursive:true});
for(scene of scenes){
 scene.start=duration;let cursor=.65;
 scene.lines=scene.lines.map((line,index)=>{
  const audio=voice.find(v=>v.scene===scene.id&&v.index===index);if(!audio)throw Error('缺配音');
  const row={...line,...audio,start:+cursor.toFixed(3)};
  const bounds=fs.readFileSync(path.join(root,audio.file.replace('.mp3','.jsonl')),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(b=>b.type==='SentenceBoundary');
  row.captions=bounds.map((b,j)=>{const start=b.offset/1e7;const end=Math.min(audio.duration+.12,start+b.duration/1e7+.1,bounds[j+1]?bounds[j+1].offset/1e7:Infinity);return {start:+(row.start+start).toFixed(3),duration:+(end-start).toFixed(3),text:b.text};});
  for(const cap of row.captions)captions.push({start:duration+cap.start,end:duration+cap.start+cap.duration,text:cap.text});
  cursor+=audio.duration+.5+(line.pause||0);return row;
 });
 scene.duration=Math.ceil((cursor+.7)*24)/24;duration+=scene.duration;
 code='';events=[];
 const art=renderers[scene.id]();
 code+=`tl.fromTo('#${id('heading')}',{x:-35,opacity:0},{x:0,opacity:1,duration:.6,ease:'power3.out'},0);tl.fromTo('#${id('progress')}',{scaleX:0},{scaleX:1,duration:${scene.duration},ease:'none'},0);`;
 const subs=scene.lines.flatMap(l=>l.captions).map((c,i)=>`<div class="clip subtitle" id="${id('sub'+i)}" data-start="${c.start}" data-duration="${c.duration}" data-track-index="5">${esc(c.text)}</div>`).join('');
 const source=['read','pair','share','back'].includes(scene.id)?'依据：《中科数学思维训练·五年级》第一讲例1':scene.id==='challenge'?'同类原创变式 · 独立讲解':'依据：第十四届小学“希望杯”五年级第2试第2题';
 const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><template><style>${css}</style><div id="${scene.id}" data-composition-id="${scene.id}" data-width="1920" data-height="1080" data-duration="${scene.duration}"><div class="scene"><div class="head"><span class="tag">${scene.tag}</span><span>思维实验室 · 把数学讲明白</span><span>${scenes.map((_,j)=>`<i class="chapter-dot ${j<=scenes.indexOf(scene)?'active':''}"></i>`).join('')}</span></div><h1 id="${id('heading')}">${scene.title}</h1><svg class="board" viewBox="0 0 1760 680" role="img" aria-label="${scene.title}">${art}</svg>${subs}<div class="bar" id="${id('progress')}"></div></div></div><script>{const tl=gsap.timeline({paused:true});${code}window.__timelines['${scene.id}']=tl;}</script></template></body></html>`;
 fs.writeFileSync(path.join(root,'compositions',scene.id+'.html'),html);
 motionMap.push({scene:scene.id,start:scene.start,duration:scene.duration,events});
}
duration=+duration.toFixed(3);
const slots=scenes.map(s=>`<div class="clip scene-slot" id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start.toFixed(3)}" data-duration="${s.duration}" data-track-index="0" data-width="1920" data-height="1080"></div>`).join('');
const audio=scenes.flatMap(s=>s.lines.map((l,i)=>`<audio id="audio-${s.id}-${i}" src="${l.file}" data-start="${(s.start+l.start).toFixed(3)}" data-duration="${l.duration}" data-track-index="10" data-volume="1"></audio>`)).join('');
fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>消去问题 · 配套讲解动画版</title><style>body{margin:0;background:${C.cream}}#main{position:relative;width:1920px;height:1080px;overflow:hidden}.scene-slot{position:absolute;inset:0;width:1920px;height:1080px}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-duration="${duration}">${slots}${audio}</div><script>window.__timelines['main']=gsap.timeline({paused:true});</script></body></html>`);

fs.mkdirSync(path.join(root,'segments'),{recursive:true});
let segments=[],part=[],partDuration=0;
for(const s of scenes){if(part.length&&partDuration+s.duration>235){segments.push(part);part=[];partDuration=0;}part.push(s);partDuration+=s.duration;}
if(part.length)segments.push(part);
const segmentMeta=[];
for(const [i,chunk] of segments.entries()){
 const base=chunk[0].start,len=chunk.reduce((v,s)=>v+s.duration,0);
 const hosts=chunk.map(s=>`<div class="clip scene-slot" id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${(s.start-base).toFixed(6)}" data-duration="${s.duration}" data-track-index="0" data-width="1920" data-height="1080"></div>`).join('');
 const audio=chunk.flatMap(s=>s.lines.map((l,j)=>`<audio id="part-${i}-${s.id}-${j}" src="${l.file}" data-start="${(s.start-base+l.start).toFixed(6)}" data-duration="${l.duration}" data-track-index="10" data-volume="1"></audio>`)).join('');
 const name=`part-${i+1}`;
 fs.writeFileSync(path.join(root,'segments',name+'.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>body{margin:0;background:${C.cream}}#${name}{position:relative;width:1920px;height:1080px;overflow:hidden}.scene-slot{position:absolute;inset:0;width:1920px;height:1080px}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div id="${name}" data-composition-id="${name}" data-width="1920" data-height="1080" data-duration="${len}">${hosts}${audio}</div><script>window.__timelines['${name}']=gsap.timeline({paused:true});</script></body></html>`);
 segmentMeta.push({name,duration:len,start:base});
}
fs.writeFileSync(path.join(root,'segments.json'),JSON.stringify(segmentMeta,null,2));
fs.writeFileSync(path.join(root,'timing.json'),JSON.stringify({duration,scenes,captions},null,2));
fs.writeFileSync(path.join(root,'motion-map.json'),JSON.stringify(motionMap,null,2));
const stamp=n=>{const ms=Math.round(n*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
fs.writeFileSync(path.join(root,'第一课-配套讲解-字幕.srt'),captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
fs.writeFileSync(path.join(root,'SCRIPT.md'),'# 第一课配套讲解\n\n'+scenes.map(s=>`## ${s.title}\n\n${s.lines.map(l=>l.text).join('\n\n')}`).join('\n\n'));
fs.writeFileSync(path.join(root,'STORYBOARD.md'),'---\nmode: autonomous\nstatus: animated\n---\n\n'+scenes.map((s,i)=>`## Frame ${i+1}\n\nstatus: animated\nsrc: compositions/${s.id}.html\nstart: ${s.start}\nduration: ${s.duration}\n\n${s.title}。使用dynamic-content-sequencing、svg-path-draw与位置变换，物品复制与配对由真实旁白时间驱动。\n`).join('\n'));
console.log(JSON.stringify({duration,minutes:duration/60,scenes:scenes.map(s=>({id:s.id,start:s.start,duration:s.duration})),motions:motionMap.reduce((sum,s)=>sum+s.events.length,0)}));
