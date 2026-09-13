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
