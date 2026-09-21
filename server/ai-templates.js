/* 模型只选择参数，程序负责生成可解题目；提示不包含计算结果或标准答案。 */
function randomSource(seed) {
 let value = seed >>> 0;
 return (min, max) => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return min + value % (max - min + 1); };
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
function buildProblem(lesson, difficulty, seed) {
 if (!Number.isInteger(lesson) || lesson < 0 || lesson > 11 || ![1,2,3].includes(difficulty) || !Number.isInteger(seed) || seed < 1 || seed > 1000000000) throw new Error('出题参数不正确。');
 const pick = randomSource(seed), out = { lesson, difficulty, seed, unit: '', hints: [] };
 const set = (topic, text, answer, unit, hints) => Object.assign(out, { topic, text, answer: String(answer), unit, hints });
 switch (lesson) {
 case 0: {
  if(difficulty===3){
   const eraser=pick(15,29)*10,pencil=pick(4,12)*10;
   const first=(3*eraser+5*pencil)/100,second=(4*eraser+4*pencil)/100,target=(5*eraser+2*pencil)/100;
   set('消去后的综合求值',`文具店里，同一种橡皮的单价相同，同一种铅笔的单价也相同，均没有折扣。买3块橡皮和5支铅笔共花${first.toFixed(2)}元；买4块橡皮和4支铅笔共花${second.toFixed(2)}元。现在要买5块橡皮和2支铅笔，一共需要多少元？`,target,'元',['先把两次购买都看成完整的等量关系，想办法造出数量相同的一种文具。','消去一种文具后，先求出另一种单价，再代回任意一组原条件。','题目最后求的是新组合的总价。列出新组合算式，并用另一组原条件检查单价。']);break;
  }
  const bottles = pick(2,5), cups = pick(6,12), extra = pick(2,5), bottlePrice = pick(12,24), cupPrice = pick(3,8);
  const multiple=difficulty===1?1:2,first = bottles*bottlePrice+(cups+extra)*cupPrice, second = multiple*(bottles*bottlePrice+cups*cupPrice);
  set(difficulty===1?'直接消去':'数量对齐再消去', `学校购买水瓶和茶杯。同一种商品的单价相同，均没有折扣。第一次买${bottles}个水瓶和${cups+extra}个茶杯，共${first}元；第二次买${multiple*bottles}个同样的水瓶和${multiple*cups}个同样的茶杯，共${second}元。一个茶杯多少元？`, cupPrice, '元', [difficulty===1?'分别圈出两次购买中数量相同和数量不同的商品。':'先观察水瓶数量的倍数关系，怎样把其中一次购买的全部数量与费用一起调整？','如果先不比较相同商品的费用，两次总价的差对应哪种商品？','价差对应的是一个商品还是多个？先在纸上求数量差，再想怎样得到单价。']); break;
 }
 case 1: {
  const big=pick(6,12), small=pick(2,5), a=2*big+3*small, b=3*big+2*small;
  const question=difficulty===1?'一个大零件重多少克？':difficulty===2?'4个大零件和4个小零件一共重多少克？':'5个大零件和4个小零件一共重多少克？';
  const answer=difficulty===1?big:difficulty===2?4*(big+small):5*big+4*small;
  set(difficulty===3?'等量关系与整体求值':'等量关系求值',`机器人活动室里，同型大零件等重，同型小零件也等重。2个大零件和3个小零件共重${a}克；3个大零件和2个小零件共重${b}克。${question}`,answer,'克',['先写出两行数量关系，看看有没有可以直接抵消的部分。','观察两行合并后能否配成相同的“大＋小”组合，也可以把两行同时调整后再比较。','对照最后所求：需要单个重量、完整的套数，还是套数之外还剩一种零件？选择一条路线在纸上试。']);break;
 }
 case 2: case 10: {
  if(difficulty===3){
   const colors=lesson===2?['红色','黄色','蓝色','黄色','绿色']:['紫色','橙色','蓝色','橙色','绿色','蓝色'];
   const start=pick(8,25),end=start+pick(36,72),target=lesson===2?'黄色':'蓝色';
   let count=0;for(let index=start;index<=end;index++)if(colors[(index-1)%colors.length]===target)count++;
   const correction=lesson===10?'小宇认为“只用区间长度除以一组的长度，取整数部分就够了”。这个方法可能漏掉区间两端的不完整组。请先判断并修正他的想法。':'';
   set(lesson===2?'周期区间计数':'周期纠错与区间计数',`彩旗从第1面开始，按${colors.join('、')}的顺序不断重复排列。${correction}从第${start}面到第${end}面（两端都计入），一共有多少面${target}彩旗？`,count,'面',['先在第一组中标出目标颜色出现的所有位置，不要只看它出现了几次。','分别求“从第1面到终点”和“从第1面到起点前一面”的目标颜色数量。','用两个累计数量相减，再单独检查区间的起点和终点有没有漏计。']);break;
  }
  const patterns=[['红色','黄色','蓝色','绿色'],['黄色','蓝色','蓝色','红色'],['红色','红色','蓝色']];
  const colors=patterns[difficulty-1], target=pick(5,18)*colors.length+(lesson===10?0:pick(0,colors.length-1));
  set('周期定位',`彩旗从第1面开始，按${colors.join('、')}的顺序不断重复排列。${lesson===10?'小宇说：“只要能整除，目标就一定是第一种颜色。”请在草稿纸上判断他的说法，再独立作答。':''}第${target}面彩旗是什么颜色？`,colors[(target-1)%colors.length],'',['先完整圈出一组重复单元，注意相同颜色也可能占据不同位置。','把目标序号分成若干完整组和剩下的位置。商和余数各表示什么？','用第一组末尾和第二组开头检查自己的定位；余数为零时，不要跳到下一组。']);break;
 }
 case 3: {
  if(difficulty===3){
   const totals=[48,60,72,84,96],total=totals[pick(0,totals.length-1)];
   const all=[];for(let n=2;n<=total;n++)if(total%n===0)all.push(n);
   const anchor=all[pick(1,Math.max(1,all.length-2))],low=Math.max(2,anchor-2),high=Math.min(total,anchor+4);
   const bags=total/anchor,bagLow=Math.max(2,bags-3),bagHigh=bags+3;
   const choices=all.filter(n=>n>=low&&n<=high&&total/n>=bagLow&&total/n<=bagHigh);
   set('因数双重范围筛选',`工厂有${total}个相同零件，要全部装袋且没有剩余。每袋零件数必须是整数，且每袋至少${low}个、至多${high}个；装成的袋数还必须至少${bagLow}袋、至多${bagHigh}袋。每袋件数一共有多少种不同选择？`,choices.length,'种',['先列出总数的因数对：一边表示每袋件数，另一边表示袋数。','先用每袋件数的范围筛选一次，再检查对应的袋数是否也在规定范围内。','最后数的是符合两项限制的“每袋件数”，同一对因数交换位置时含义不同，不要重复或漏记。']);break;
  }
  const total=[24,36,48,60,72][pick(0,4)], low=difficulty===1?1:pick(3,5), high=difficulty===1?total:pick(12,18);
  const factors=[];for(let n=low;n<=high;n++)if(total%n===0)factors.push(n);
  set('因数与范围筛选',`工厂有${total}个相同零件，要全部装袋且没有剩余。每袋零件数相同，且必须是整数。每袋至少${low}个、至多${high}个。每袋件数一共有多少种不同的选择？请在草稿纸上有序列出，再填写选择的种数。`,factors.length,'种',['“全部装完且没有剩余”对每袋数量有什么要求？','从小到大寻找成对的因数，遇到相同的一对不要重复记录。','逐个检查每袋至少、至多的限制，最后数的是符合要求的不同数量，而不是袋数。']);break;
 }
 case 4: {
  const a=pick(3,7), b=a+pick(1,4), period=a*b/gcd(a,b), times=pick(2,5), end=period*times;
  if(difficulty===1) set('公倍数与同步',`甲灯每隔${a}秒闪一次，乙灯每隔${b}秒闪一次。两灯在0秒同时闪过，以后一直按各自间隔闪烁。0秒之后，第一次再次同时闪是在第几秒？`,period,'秒',['分别写出两盏灯在零秒之后的闪烁时刻。','在两行时刻中寻找共同出现的时刻，想想“第一次”该选哪个。','题目问的是再次同时闪，起点零秒可以作为答案吗？']);
  else if(difficulty===2)set('同步次数与端点',`甲灯每隔${a}秒闪一次，乙灯每隔${b}秒闪一次。两灯在0秒同时闪过。观察0秒之后直到第${end}秒结束，不计0秒、包含第${end}秒。两灯一共同时闪了几次？`,times,'次',['先找两盏灯再次同时闪烁的间隔。','按这个共同间隔在纸上列出观察范围内的时刻。','检查起点是否计入、终点是否计入，然后数时刻的个数。']);
  else {const c=b+pick(1,3),three=a*b/gcd(a,b),joint=three*c/gcd(three,c),count=pick(2,4),start=joint+1,finish=joint*(count+1);set('三项同步与区间计数',`甲、乙、丙三盏灯分别每隔${a}秒、${b}秒、${c}秒闪一次，0秒时三灯同时闪过。从第${start}秒开始观察，到第${finish}秒结束（两端都计入）。这段时间内三盏灯一共同时闪了几次？`,count,'次',['先只考虑甲、乙两灯，找它们共同闪烁的间隔，再把丙灯的间隔加入比较。','得到三灯共同间隔后，在数轴上标出观察区间内的所有倍数。','起点不是0秒。分别检查第一个共同倍数是否早于起点，以及终点是否恰好计入。']);}break;
 }
 case 5: {
  const width=pick(9,13), length=width+pick(3,6);
  if(difficulty===1){const corner=pick(2,4);set('补形与面积',`一张长方形纸长${length}厘米、宽${width}厘米。从右上角剪去一个边长${corner}厘米的正方形，正方形的两条边分别贴着纸片的上边和右边。剩余纸片的面积是多少平方厘米？`,length*width-corner*corner,'平方厘米',['先画出完整长方形，再标出右上角剪掉的小正方形。','剩余部分能否看作完整图形扣去缺角？两个图形分别怎样求面积？','核对缺角的边长与面积是否混淆，并在结果后写面积单位。']);break;}
  if(difficulty===2){const cutLength=pick(3,6),cutWidth=pick(2,5);set('长方形缺角面积',`一张长方形纸长${length}厘米、宽${width}厘米。从右上角剪去一个长${cutLength}厘米、宽${cutWidth}厘米的小长方形，小长方形的两条边分别贴着原纸的上边和右边。剩余纸片的面积是多少平方厘米？`,length*width-cutLength*cutWidth,'平方厘米',['先求完整长方形面积，再把缺角的长和宽单独标清。','缺角是长方形，不能只减一条边长；写出它的面积算式。','用完整面积减缺角面积，检查单位是长度还是面积。']);break;}
  const square=pick(2,4),cutLength=pick(3,5),cutWidth=pick(2,3);
  set('复合缺角面积',`一张长方形纸长${length}厘米、宽${width}厘米。先从右上角剪去一个边长${square}厘米的正方形，再从左下角剪去一个长${cutLength}厘米、宽${cutWidth}厘米的小长方形；两个缺角互不重叠。剩余纸片的面积是多少平方厘米？`,length*width-square*square-cutLength*cutWidth,'平方厘米',['先画完整长方形，并把两个位于不同角的缺口分别标出来。','分别计算完整图形、正方形缺口和长方形缺口的面积。','两个缺口互不重叠，应从完整面积中分别扣除；最后检查面积单位。']);break;
 }
 case 6: {
  if(difficulty===2){const distance=pick(4,9),move=pick(1,3),height=pick(2,5);set('镜像与对称轴距离',`在正方形网格纸上，一条竖直直线是对称轴。点A位于对称轴左侧${distance}格、某条水平基准线上方${height}格。现在把点A水平向右移动${move}格，得到点B，再作点B关于这条竖直对称轴的镜像点C。点C位于对称轴右侧多少格？`,distance-move,'格',['先在草稿纸上画出对称轴、原来的点和移动后的点。','向右移动后，点到竖直对称轴的距离怎样变化？上下位置影响这个距离吗？','镜像点和原来的点分别在对称轴两侧，它们到对称轴的距离有什么关系？']);break;}
  if(difficulty===3){const rows=Array.from({length:3},()=>Array.from({length:4},()=>pick(1,5))),side=pick(2,3),visible=[0,1,2,3].reduce((sum,col)=>sum+Math.max(...rows.map(row=>row[col])),0);set('三排遮挡与实际面积',`桌面上用棱长${side}厘米的相同小正方体搭积木，摆成前、中、后三排，每排从左到右有4列，同列前后对齐且中间没有空洞。前排各列高${rows[0].join('、')}层，中排各列高${rows[1].join('、')}层，后排各列高${rows[2].join('、')}层。从正前方平视，只计算能看到的正面轮廓，不计算顶面和侧面。轮廓面积是多少平方厘米？`,visible*side*side,'平方厘米',['先按从左到右的4列整理数据，每一列都有前、中、后三个高度。','从正面看，同一列最终轮廓高度由三排中的最高值决定，不能把三排层数直接相加。','先合计轮廓包含多少个小正方形，再根据小正方体棱长求每个正面的实际面积。']);break;}
  const whole=pick(4,9), half=2*pick(1,4), side=pick(2,4);
  set('半格与面积单位',`一个图形由${whole}个完整正方形方格和${half}个半格组成，各部分没有重叠。每个半格都是同样的正方形方格沿对角线切出的一半。每个完整方格的边长是${side}厘米。整个图形的面积是多少平方厘米？`,(whole+half/2)*side*side,'平方厘米',['试着把半格两两配对，先数出图形相当于多少个整格。','每格的边长和每格的面积一样吗？先确定一个整格的面积。','最后检查：自己填的是格数还是实际面积？']);break;
 }
 case 7: {
  const delta=pick(10,20), slow=2*delta, fast=3*delta, lead=pick(4,8), rest=difficulty===1?0:pick(1,3), chaseBefore=2;
  if(difficulty===3){
   const evenLead=2*pick(2,4),secondFast=4*delta,advancedRest=pick(1,3);
   const remaining=slow*evenLead-(fast-slow)*chaseBefore+slow*advancedRest;
   const time=chaseBefore+advancedRest+remaining/(secondFast-slow);
   set('分段变速追赶',`小明从学校沿一条直路出发，每分钟走${slow}米；${evenLead}分钟后，小华从学校沿同一方向出发，开始时每分钟走${fast}米。小明一直不停。小华先追赶${chaseBefore}分钟，随后原地停留${advancedRest}分钟，接着把速度提高到每分钟${secondFast}米并保持不变。从小华首次出发算起，经过多少分钟能追上小明？`,time,'分钟',['把小华首次出发作为0时刻，先算这时两人的路程差。','分成“第一次追赶、停留、加速后追赶”三段：前后差距在每段怎样变化？','算出加速开始时的剩余差距，再用新的速度差求最后一段时间，最后别漏加前两段。']);break;
  }
  const time=slow*lead/delta+rest*fast/delta;
  set('同向追赶',`小明从学校沿一条直路出发，每分钟走${slow}米；${lead}分钟后，小华从学校沿同一方向出发，每分钟走${fast}米。小明一直不停。${rest?`小华追赶${chaseBefore}分钟后原地停留${rest}分钟，再以原速继续追赶。`:'小华全程保持速度，中途不停留。'}从小华首次出发算起，经过多少分钟能追上小明？`,time,'分钟',['把小华刚出发的时刻作为计时起点，先找两人原来的差距。',rest?'分别画出追赶、停留、继续追赶三个阶段，标出差距在哪段缩小、在哪段扩大。':'两人都在前进，每分钟真正缩小的差距应怎样计算？','题目要求的是从首次出发到追上的总经过时间；检查有没有漏算停留时间。']);break;
 }
 case 8: {
  const growth=pick(1,4), stock=12*pick(difficulty===3?3:2,difficulty===3?6:5), first=growth+6, second=growth+12;
  if(difficulty===3){const target=growth+5,before=4,newGrowth=growth+1,remaining=stock-(target-growth)*before,answer=before+remaining/(target-newGrowth);set('牛吃草与生长变化',`同一片草地在相同初始草量下作比较：若草每天匀速生长，放${first}头牛可吃${stock/6}天，放${second}头牛可吃${stock/12}天。每头牛每天食量相同。现在仍从相同初始草量开始放${target}头牛；吃了${before}天后，因为降雨，草每天新长的量比原来增加了相当于1头牛一天的食量，牛的数量不变。从开始放牛算起，这片草一共可以吃多少天？`,answer,'天',['先利用前两种情况求出原来每天新长的草量，以及开始时已有的草量。','前4天按原生长速度计算，求这段时间实际消耗了多少原有草。','降雨后每天生长量增加，但牛每天吃草总量不变。用新的每日净消耗处理剩余原草，再加上前4天。']);break;}
  const target=growth+(difficulty===1?4:3);
  set('生长与消耗',`同一片草地在相同初始草量下进行两种假设比较：放${first}头牛，${stock/6}天恰好吃完；放${second}头牛，${stock/12}天恰好吃完。草每天匀速生长，每头牛每天食量相同，两种情况不是先后连续放牧。若仍从相同初始草量开始放${target}头牛，可以吃多少天？`,stock/(target-growth),'天',['把一头牛一天吃的草记为一份，分别表示两种情况的总吃草量。','两种情况原草量相同，总吃草量为什么不同？把差量与多生长的天数对应起来。','区分原有草、每天新长的草、每天吃掉的草；应该用每天的哪一种变化去消耗原草？']);break;
 }
 case 9: {
  if(difficulty===1){const avg=pick(9,18), a=avg-2,b=avg+1,c=avg+3;set('平均数与总量',`四次练习得分的平均数为${avg}分，前三次分别得${a}分、${b}分、${c}分。第四次得多少分？`,4*avg-a-b-c,'分',['平均数、次数和总分有什么关系？','先在纸上还原全部次数的总分，再整理已知部分的总分。','把自己求出的数放回题目，检查平均数是否符合原条件。']);}
  else if(difficulty===2){const low=pick(1,3),high=low+2,total=3*low+pick(2,4);let count=0;for(let a=low;a<=high;a++)for(let b=low;b<=high;b++){const c=total-a-b;if(c>=low&&c<=high)count++;}set('有序枚举',`${total}本相同的书全部分给甲、乙、丙三家不同的书店，每家至少${low}本、至多${high}本，数量必须为整数。三家书店有区别，交换两家分到的数量算不同方案。一共有多少种分配方案？`,count,'种',['先把总数、每家的下限和上限写在草稿纸上。','固定甲店的数量，再让乙店从小到大变化，丙店补足总数。','检查每种方案是否满足全部限制，再按分类计数，避免遗漏或重复。']);}
  else {const low=pick(1,3),high=low+3,total=3*(low+1);let count=0;for(let a=low;a<=high;a++)for(let b=low;b<=high;b++){const c=total-a-b;if(c>=low&&c<=high&&(a===b||a===c||b===c))count++;}set('有序限制枚举',`${total}本相同的书全部分给甲、乙、丙三家不同的书店，每家至少${low}本、至多${high}本，数量必须为整数，并且至少有两家书店分到的数量相同。三家书店有区别，交换两家分到的数量算不同方案。一共有多少种分配方案？`,count,'种',['先忽略“至少两家相同”，按甲店数量分类，列出满足总数和范围的有序方案。','对每个方案比较三个数，只保留至少有一对相等的情况；三家都相等也符合要求。','交换书店后若三家的数量记录不同，就属于另一种方案。按分类复查，避免把相同数值排列漏掉。']);}break;
 }
 case 11: {
  const selected=[2,4,9][seed%3], nested=buildProblem(selected,difficulty,seed);
  Object.assign(out,nested,{lesson:11,topic:'混合选法 · '+nested.topic});break;
 }
 }
 return out;
}
function matchesAnswer(input, question) {
 let value=String(input).normalize('NFKC').trim().replace(/\s/g,'');
 if(question.unit&&value.endsWith(question.unit))value=value.slice(0,-question.unit.length);
 if(question.answer.endsWith('色')&&!value.endsWith('色'))value+='色';
 const expected=question.answer;
 return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expected)?Number(value)===Number(expected):value===expected;
}
module.exports={buildProblem,matchesAnswer};
