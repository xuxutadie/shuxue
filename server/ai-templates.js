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
   set('配成相同组合再消去',`文具店里，同一种橡皮的单价相同，同一种铅笔的单价也相同，均没有折扣。买3块橡皮和5支铅笔共花${((3*eraser+5*pencil)/100).toFixed(2)}元；买4块橡皮和4支铅笔共花${((4*eraser+4*pencil)/100).toFixed(2)}元。一块橡皮多少元？`,eraser/100,'元',['观察第二次购买，能不能分成几份完全一样的“橡皮加铅笔”组合？','把第一次购买中的相同组合圈出来，剩下的是哪种文具？','先借助组合费用找剩余文具的单价，再回到一组中求题目要的单价。']);break;
  }
  const bottles = pick(2,5), cups = pick(6,12), extra = pick(2,5), bottlePrice = pick(12,24), cupPrice = pick(3,8);
  const multiple=difficulty===1?1:2,first = bottles*bottlePrice+(cups+extra)*cupPrice, second = multiple*(bottles*bottlePrice+cups*cupPrice);
  set(difficulty===1?'直接消去':'数量对齐再消去', `学校购买水瓶和茶杯。同一种商品的单价相同，均没有折扣。第一次买${bottles}个水瓶和${cups+extra}个茶杯，共${first}元；第二次买${multiple*bottles}个同样的水瓶和${multiple*cups}个同样的茶杯，共${second}元。一个茶杯多少元？`, cupPrice, '元', [difficulty===1?'分别圈出两次购买中数量相同和数量不同的商品。':'先观察水瓶数量的倍数关系，怎样把其中一次购买的全部数量与费用一起调整？','如果先不比较相同商品的费用，两次总价的差对应哪种商品？','价差对应的是一个商品还是多个？先在纸上求数量差，再想怎样得到单价。']); break;
 }
 case 1: {
  const big=pick(6,12), small=pick(2,5), a=2*big+3*small, b=3*big+2*small;
  const question=difficulty===1?'一个大零件重多少克？':difficulty===2?'4个大零件和4个小零件一共重多少克？':'5个大零件和4个小零件一共重多少克？';
  const answer=difficulty===1?big:difficulty===2?4*(big+small):5*big+4*small;
  set('等量关系与整体求值',`机器人活动室里，同型大零件等重，同型小零件也等重。2个大零件和3个小零件共重${a}克；3个大零件和2个小零件共重${b}克。${question}`,answer,'克',['先写出两行数量关系，看看有没有可以直接抵消的部分。','观察两行合并后能否配成相同的“大＋小”组合，也可以把两行同时调整后再比较。','对照最后所求：需要单个重量、完整的套数，还是套数之外还剩一种零件？选择一条路线在纸上试。']);break;
 }
 case 2: case 10: {
  const patterns=[['红色','黄色','蓝色','绿色'],['黄色','蓝色','蓝色','红色'],['红色','红色','蓝色']];
  const colors=patterns[difficulty-1], target=pick(5,18)*colors.length+(lesson===10?0:pick(0,colors.length-1));
  set('周期定位',`彩旗从第1面开始，按${colors.join('、')}的顺序不断重复排列。${lesson===10?'小宇说：“只要能整除，目标就一定是第一种颜色。”请在草稿纸上判断他的说法，再独立作答。':''}第${target}面彩旗是什么颜色？`,colors[(target-1)%colors.length],'',['先完整圈出一组重复单元，注意相同颜色也可能占据不同位置。','把目标序号分成若干完整组和剩下的位置。商和余数各表示什么？','用第一组末尾和第二组开头检查自己的定位；余数为零时，不要跳到下一组。']);break;
 }
 case 3: {
  const total=[24,36,48,60,72][pick(0,4)], low=difficulty===1?1:pick(3,5), high=difficulty===1?total:pick(12,18);
  const factors=[];for(let n=low;n<=high;n++)if(total%n===0)factors.push(n);
  set('因数与范围筛选',`工厂有${total}个相同零件，要全部装袋且没有剩余。每袋零件数相同，且必须是整数。每袋至少${low}个、至多${high}个。每袋件数一共有多少种不同的选择？请在草稿纸上有序列出，再填写选择的种数。`,factors.length,'种',['“全部装完且没有剩余”对每袋数量有什么要求？','从小到大寻找成对的因数，遇到相同的一对不要重复记录。','逐个检查每袋至少、至多的限制，最后数的是符合要求的不同数量，而不是袋数。']);break;
 }
 case 4: {
  const a=pick(3,7), b=a+pick(1,4), period=a*b/gcd(a,b), times=pick(2,5), end=period*times;
  if(difficulty===1) set('公倍数与同步',`甲灯每隔${a}秒闪一次，乙灯每隔${b}秒闪一次。两灯在0秒同时闪过，以后一直按各自间隔闪烁。0秒之后，第一次再次同时闪是在第几秒？`,period,'秒',['分别写出两盏灯在零秒之后的闪烁时刻。','在两行时刻中寻找共同出现的时刻，想想“第一次”该选哪个。','题目问的是再次同时闪，起点零秒可以作为答案吗？']);
  else set('同步次数与端点',`甲灯每隔${a}秒闪一次，乙灯每隔${b}秒闪一次。两灯在0秒同时闪过。观察0秒之后直到第${end}秒结束，不计0秒、包含第${end}秒。两灯一共同时闪了几次？`,times,'次',['先找两盏灯再次同时闪烁的间隔。','按这个共同间隔在纸上列出观察范围内的时刻。','检查起点是否计入、终点是否计入，然后数时刻的个数。']);break;
 }
 case 5: {
  const width=pick(6,9), length=width+pick(2,5), corner=pick(2,4);
  set('补形与面积',`一张长方形纸长${length}厘米、宽${width}厘米。从右上角剪去一个边长${corner}厘米的正方形，正方形的两条边分别贴着纸片的上边和右边。剩余纸片的面积是多少平方厘米？`,length*width-corner*corner,'平方厘米',['先画出完整长方形，再标出右上角剪掉的小正方形。','剩余部分能否看作完整图形扣去缺角？两个图形分别怎样求面积？','核对缺角的边长与面积是否混淆，并在结果后写面积单位。']);break;
 }
 case 6: {
  if(difficulty===2){const distance=pick(4,9),move=pick(1,3),height=pick(2,5);set('镜像与对称轴距离',`在正方形网格纸上，一条竖直直线是对称轴。点A位于对称轴左侧${distance}格、某条水平基准线上方${height}格。现在把点A水平向右移动${move}格，得到点B，再作点B关于这条竖直对称轴的镜像点C。点C位于对称轴右侧多少格？`,distance-move,'格',['先在草稿纸上画出对称轴、原来的点和移动后的点。','向右移动后，点到竖直对称轴的距离怎样变化？上下位置影响这个距离吗？','镜像点和原来的点分别在对称轴两侧，它们到对称轴的距离有什么关系？']);break;}
  if(difficulty===3){const front=[pick(1,3),pick(1,3),pick(1,3)],back=[pick(2,4),pick(2,4),pick(2,4)];set('遮挡与正面轮廓',`桌面上用相同小正方体搭积木，摆成前后两排，每排从左到右有3列。前排各列分别堆${front.join('、')}层，后排对应各列分别堆${back.join('、')}层，同列前后对齐且中间没有空洞。从正前方平视，只看积木的正面轮廓，不透视、不计算顶面和侧面。看到的轮廓一共占多少个小正方形？`,front.reduce((sum,n,i)=>sum+Math.max(n,back[i]),0),'个',['先按左、中、右三列分别整理前后高度。','同一列中，后排低处可能被遮挡，轮廓的最高位置由哪一排决定？','分别画出各列最后看到的高度，再合起来数轮廓的小正方形，不要把前后两排全部相加。']);break;}
  const whole=pick(4,9), half=2*pick(1,4), side=pick(2,4);
  set('半格与面积单位',`一个图形由${whole}个完整正方形方格和${half}个半格组成，各部分没有重叠。每个半格都是同样的正方形方格沿对角线切出的一半。每个完整方格的边长是${side}厘米。整个图形的面积是多少平方厘米？`,(whole+half/2)*side*side,'平方厘米',['试着把半格两两配对，先数出图形相当于多少个整格。','每格的边长和每格的面积一样吗？先确定一个整格的面积。','最后检查：自己填的是格数还是实际面积？']);break;
 }
 case 7: {
  const delta=pick(10,20), slow=2*delta, fast=3*delta, lead=pick(4,8), rest=difficulty===1?0:pick(1,3), chaseBefore=2;
  const time=slow*lead/delta+rest*fast/delta;
  set('同向追赶',`小明从学校沿一条直路出发，每分钟走${slow}米；${lead}分钟后，小华从学校沿同一方向出发，每分钟走${fast}米。小明一直不停。${rest?`小华追赶${chaseBefore}分钟后原地停留${rest}分钟，再以原速继续追赶。`:'小华全程保持速度，中途不停留。'}从小华首次出发算起，经过多少分钟能追上小明？`,time,'分钟',['把小华刚出发的时刻作为计时起点，先找两人原来的差距。',rest?'分别画出追赶、停留、继续追赶三个阶段，标出差距在哪段缩小、在哪段扩大。':'两人都在前进，每分钟真正缩小的差距应怎样计算？','题目要求的是从首次出发到追上的总经过时间；检查有没有漏算停留时间。']);break;
 }
 case 8: {
  const growth=pick(1,4), stock=12*pick(2,5), first=growth+6, second=growth+12, target=growth+(difficulty===1?4:difficulty===2?3:2);
  set('生长与消耗',`同一片草地在相同初始草量下进行两种假设比较：放${first}头牛，${stock/6}天恰好吃完；放${second}头牛，${stock/12}天恰好吃完。草每天匀速生长，每头牛每天食量相同，两种情况不是先后连续放牧。若仍从相同初始草量开始放${target}头牛，可以吃多少天？`,stock/(target-growth),'天',['把一头牛一天吃的草记为一份，分别表示两种情况的总吃草量。','两种情况原草量相同，总吃草量为什么不同？把差量与多生长的天数对应起来。','区分原有草、每天新长的草、每天吃掉的草；应该用每天的哪一种变化去消耗原草？']);break;
 }
 case 9: {
  if(difficulty===1){const avg=pick(9,18), a=avg-2,b=avg+1,c=avg+3;set('平均数与总量',`四次练习得分的平均数为${avg}分，前三次分别得${a}分、${b}分、${c}分。第四次得多少分？`,4*avg-a-b-c,'分',['平均数、次数和总分有什么关系？','先在纸上还原全部次数的总分，再整理已知部分的总分。','把自己求出的数放回题目，检查平均数是否符合原条件。']);}
  else {const low=pick(1,3),high=low+2,total=3*low+pick(2,4);let count=0;for(let a=low;a<=high;a++)for(let b=low;b<=high;b++){const c=total-a-b;if(c>=low&&c<=high)count++;}set('有序枚举',`${total}本相同的书全部分给甲、乙、丙三家不同的书店，每家至少${low}本、至多${high}本，数量必须为整数。三家书店有区别，交换两家分到的数量算不同方案。一共有多少种分配方案？`,count,'种',['先把总数、每家的下限和上限写在草稿纸上。','固定甲店的数量，再让乙店从小到大变化，丙店补足总数。','检查每种方案是否满足全部限制，再按分类计数，避免遗漏或重复。']);}break;
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
