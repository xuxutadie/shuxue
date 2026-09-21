// 原项目题目保持不变；答案和解析只放在服务端，不随静态页面下发。
const crypto=require('node:crypto');
const seed=require('./seed.json'),camp=require('./expedition.json');
function prepare(course){return {...course,questions:course.questions.map(q=>({...q,id:'q'+crypto.createHash('sha256').update(q.text.trim()+'\n'+q.answer.trim()).digest('hex').slice(0,24)}))};}
const townCourses=seed.map(prepare),campCourses=camp.map(prepare),courses=[...townCourses,...campCourses];
const questions=new Map(courses.flatMap(c=>c.questions).map(q=>[q.id,q]));
const firstQuestions=[...new Map(townCourses.flatMap(c=>c.questions).map(q=>[q.id,q])).values()];
const normalize=value=>String(value).normalize('NFKC').trim().replace(/[\s,，]/g,'');
function isAnswer(value,expected){const a=normalize(value),b=normalize(expected);return a===b||(/^\d+(\.\d+)?$/.test(a)&&/^\d+$/.test(b)&&Number(a)===Number(b));}
module.exports={townCourses,campCourses,courses,questions,firstQuestions,isAnswer};
