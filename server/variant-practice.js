const crypto=require('node:crypto');
const {correct}=require('./content');
// 每个输入对应题目中的一个明确结果；解释、画图与列举过程在草稿纸完成。
const number=(label,answer)=>({label,answer:String(answer)});
const set=(label,answer)=>({label,answer,type:'set'});
const choice=(label,answer,options)=>({label,answer,options});
const color=label=>choice(label,'',['红','黄','蓝','绿']);
const colors=(labels,answers)=>labels.map((label,i)=>({...color(label),answer:answers[i]}));
const fields=[
 [[number('水瓶单价（元）',18),number('茶杯单价（元）',4)],[number('橡皮单价（元）',2.2)]],
 [[number('总重量（克）',60)],[number('总重量（克）',64)]],
 [colors(['第40节颜色','第41节颜色'],['绿','红']),colors(['第20盏颜色','第21盏颜色'],['红','蓝'])],
 [[set('每袋件数（用逗号分隔）','1,2,3,4,6,9,12,18,36'),number('种数',9)],[set('每袋件数（用逗号分隔）','6,8,12'),number('种数',3)]],
 [[number('同时闪的次数',3),set('同时闪的时刻（秒，用逗号分隔）','24,48,72')],[set('可能的包数（用逗号分隔）','6,12'),number('最多分几包',12),number('最多分法每包蓝卡（张）',2),number('最多分法每包黄卡（张）',3)]],
 [[number('面积（平方厘米）',42)],[number('缺口深度（厘米）',5)]],
 [[number('面积（平方厘米）',72)],[number('正面看到的高度（层）',3),choice('后摞会被完全挡住吗','不会',['会','不会']),choice('仅凭正面视图能确定全部数量吗','不能',['能','不能'])]],
 [[number('总经过时间（分钟）',16)],[number('总经过时间（分钟）',18),number('相遇处距起点（米）',1200)]],
 [[number('每分钟排水量（升）',7)],[choice('2头牛会把草吃完吗','不会',['会','不会']),number('1头牛放牧10天后的草量（份）',40)]],
 [[number('方案数（请在草稿纸列出）',6)],[number('平均每家（本）',4)]],
 [colors(['第40面颜色','第41面颜色'],['绿','红']),[number('正确平均数',17)]],
 [[number('运算结果',18),choice('可以先算3★4代替括号内运算吗','不可以',['可以','不可以'])],[number('包数',15)],[number('圆的数量（个）',25)],[number('运算结果',21)]]
];
function variants(lesson,index,teacher=false){
 return lesson.detail.variants.flatMap(v=>v.cards||[v]).map((q,j)=>{
  const inputs=fields[index][j];
  const version=crypto.createHash('sha256').update(JSON.stringify({text:q.text,inputs})).digest('hex').slice(0,16);
  return {title:q.title,text:q.text,changed:q.changed||[],version,
   inputs:inputs.map(({answer,...field})=>teacher?{...field,answer}:field),...(teacher?{answer:q.answer,explain:q.explain}:{})};
 });
}
function matches(value,field){
 if(field.type!=='set')return correct(value,field.answer);
 const tokens=String(value).normalize('NFKC').trim().split(/[、,，;；\s]+/).filter(Boolean);
 if(!tokens.every(t=>/^\d+$/.test(t)))return false;
 const nums=tokens.map(Number);if(new Set(nums).size!==nums.length)return false;
 return nums.sort((a,b)=>a-b).join(',')===field.answer;
}
module.exports={variants,matches};
