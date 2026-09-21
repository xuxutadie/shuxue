// 章节配置与进度分开保存，后续地图可复用任务、奖励和背包结构。
const {townCourses}=require('./content.cjs');
const {fail}=require('../db');
const chapter={id:'bakery',courseId:'story-bakery',title:'救援口粮 · 米米的委托',npc:0,nextNpc:1,bonus:30,
 steps:[
  {id:'orders',title:'整理被风吹乱的订单',line:'米米：营地失去了联系！先把四张订单两两放进篮子，让两篮数量相同，再算出口粮总数。',reward:10},
  {id:'boxes',title:'给运输车分批装箱',line:'米米：总数核对好了！接下来把小盒分成几批，算清这一车的面包数量。',reward:20},
  {id:'route',title:'安排沿途补给',line:'米米：沿途的队员也需要口粮。把首尾配送站配成数量相同的一对，再核对这趟配送的总数。',reward:30},
  {id:'stock',title:'核对最后一批库存',line:'米米：出发前还差最后一次清点。整理整盒和散装面包，数量核对正确，救援车就能出发！',reward:30}
 ],items:[{id:'rescue-food',name:'救援口粮箱',icon:'📦',description:'米米托付的口粮，准备送往星光营地。'},
 {id:'signal-note',name:'神秘信号纸条',icon:'✉',description:'配送员捡到的营地纸条。下一步交给音乐屋的多多，寻找信号的规律。'}]};
const base=townCourses.find(c=>c.id==='seed-0-0').questions;
const variants=townCourses.find(c=>c.id==='seed-1-0').questions;
function progress(s){return s.adventure?.chapters?.[chapter.id];}
function ensure(s){s.adventure??={chapters:{}};return s.adventure.chapters[chapter.id]??={rewards:{},done:false};}
function view(s){const p=progress(s);return {chapter,started:!!p,done:!!p?.done,points:Object.values(p?.rewards||{}).reduce((a,b)=>a+b,0),items:p?.done?chapter.items:[],completedSteps:Object.keys(p?.rewards||{}).filter(k=>k!=='completion'),activeNpc:p?.done?1:0};}
function cleanBoard(b){
 if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>3000)fail(400,'操作台数据不正确，请重新摆放。');
 const places={};for(const [key,value] of Object.entries(b.places||{})){if(!/^\d{1,2}$/.test(key)||Number(key)>19||!Number.isInteger(value)||value<0||value>9)fail(400,'配送篮数据不正确。');places[key]=value;}
 const work={};for(const key of ['first','second','extra']){const value=b.work?.[key];if(value!==undefined){if(!['string','number'].includes(typeof value)||String(value).length>12)fail(400,'请用数字填写观察结果。');work[key]=String(value).trim();}}
 return {places,selected:Number.isInteger(b.selected)&&b.selected>=0&&b.selected<20?b.selected:null,size:[2,3,4,6,8].includes(b.size)?b.size:0,arranged:b.arranged===true,work};
}
// 只把目标和问题发给前端，观察题答案与判定保留在服务器。
function lesson(r){
 const variant=r.qids[r.index]===variants[r.index].id;
 const topics=['凑整配对','分组巧算','首尾配对','合并与拆分'];
 const labels=[['每篮多少个','一共几篮'],['每批多少个','一共几批'],['每对站点共送多少个','配成几对'],variant?['整批有几盒','剩余几盒']:['散装相当于几盒','合并后一共几盒']];
 const goals=['把能凑成整百的订单配在一起。','改变分组，让乘法更好算，总数量不变。','比较首尾两站，找出每对相同的数量。','每盒数量相同，盒数可以合并或拆分。'];
 return {topic:topics[r.index],goal:goals[r.index],labels:labels[r.index],isVariant:variant,extra:r.index===2&&variant?'单独一站送多少个':null};
}
function checkLearning(r){
 const i=r.index,variant=r.qids[i]===variants[i].id,b=r.bakery||{};
 if(!boardCorrect(r))return ['把订单两两配对，让每篮总数相同。','先选择每批几盒，再观察分组。','把首尾站点配对，让每对总数相同。','先点击整理货物，比较整理前后的盒数。'][i];
 const expected=i===0?[variant?100:500,2]:i===1?[(variant?125:25)*b.size,(variant?24:16)/b.size]:i===2?[variant?32:21,variant?7:10]:variant?[100,1]:[1,100];
 const work=b.work||{},prompts=lesson(r);
 for(const [index,key]of ['first','second'].entries()){
  if(!/^\d+$/.test(work[key]||'')||Number(work[key])!==expected[index])return `${prompts.labels[index]}还需核对。`+[
   ['把同一个篮子里的两张订单相加。','数一数完整的配送篮。'],
   ['用每盒数量乘每批盒数。','用总盒数除以每批盒数。'],
   ['把配在一起的两个站点数量相加。','数配对的组数，不是站点总数。'],
   variant?['先找接近的整百盒数。','拆分后的两部分应合起来等于101盒。']:['散装数量除以每盒数量。','原来的盒数加上新装的盒数。']
  ][i][index];
 }
 if(prompts.extra&&(!/^\d+$/.test(work.extra||'')||Number(work.extra)!==16))return '别漏掉单独一站，请核对它的配送数量。';
 return '';
}
function explanation(r){
 const variant=r.qids[r.index]===variants[r.index].id,b=r.bakery||{};
 if(r.index===0)return variant?'48与52、97与3分别凑成100。两篮各100个，总数为100×2＝200个。':'199与301、298与202分别凑成500。两篮各500个，总数为500×2＝1000个。';
 if(r.index===1){const unit=variant?125:25,count=variant?24:16,size=(variant?[3,4,6,8]:[2,4,8]).includes(b.size)?b.size:variant?8:4;return `按每批${size}盒：一批有${unit}×${size}＝${unit*size}个，共${count}÷${size}＝${count/size}批。因此${unit}×${count}＝（${unit}×${size}）×${count/size}＝${unit*count}。盒子只重新分组，总数不变，这就是乘法结合律。${size===(variant?8:4)?'这样每批恰好凑成整百或整千。':`你的分组也成立。再比较每批${variant?8:4}盒，能否凑成更好算的整百或整千？`}`;}
 if(r.index===2)return variant?'2与30、4与28……配成7对，每对32个；中间的16单独留下。总数为32×7＋16＝240个，不能漏掉单独一站。':'1与20、2与19……配成10对，每对21个。总数为21×10＝210个。20个站点两两配对，所以是10对。';
 return variant?'101盒拆成100盒与1盒，每盒都是24个。总数为24×100＋24×1＝2424个，这是把乘法拆开计算。':'37个散装正好装1盒，与99盒合起来是100盒。每盒37个，总数为37×（99＋1）＝3700个，这是把相同的每盒数量提出来计算。';
}
function boardCorrect(r){
 const b=r.bakery||{},i=r.index,variant=r.qids[i]===variants[i].id;
 if(i===1)return (variant?[3,4,6,8]:[2,4,8]).includes(b.size);
 if(i===3)return b.arranged===true;
 const values=i===0?(variant?[48,97,52,3]:[199,298,301,202]):Array.from({length:variant?15:20},(_,j)=>(j+1)*(variant?2:1));
 const bins=Math.ceil(values.length/2),groups=Array.from({length:bins},()=>[]);
 for(let j=0;j<values.length;j++){const n=b.places?.[j];if(!Number.isInteger(n)||n<0||n>=bins)return false;groups[n].push(values[j]);}
 const target=values[0]+values.at(-1);
 // 四张不按大小排列的订单，按全部数量的一半检查。
 const sum=i===0?values.reduce((a,b)=>a+b,0)/2:target;
 return groups.every(g=>g.length===2&&g[0]+g[1]===sum||values.length%2===1&&g.length===1&&g[0]*2===sum);
}
function award(s,r){const p=ensure(s),step=chapter.steps[r.index];if(p.rewards[step.id])return 0;p.rewards[step.id]=step.reward;return step.reward;}
function complete(s){const p=ensure(s);if(!chapter.steps.every(step=>p.rewards[step.id]))fail(400,'请先完成四项口粮准备。');p.done=true;p.rewards.completion??=chapter.bonus;}
module.exports={chapter,base,variants,view,ensure,cleanBoard,boardCorrect,lesson,checkLearning,explanation,award,complete};
