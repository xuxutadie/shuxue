const { bank, currentExamVersions } = require('./content');
const { fail } = require('./db');

function summarizeExams(rows, kind) {
 const groups = new Map();
 for (const row of rows) {
  // 按原卷版本统计，只使用已提交的正式测评，不重新评分或混入历史导入成绩。
  if (!row.submitted_at) continue;
  const paper = bank.exams[row.version]?.[kind];
  if (!paper) fail(500, '测评题库版本不存在。');
  if (!groups.has(row.version)) groups.set(row.version, {
   version: row.version, submittedCount: 0, students: [],
   questions: paper.map((q,i) => ({ number: i+1, text:q.text, svg:q.svg||'', topic:q.topic,
    answer:q.answer, explain:q.explain, wrongCount:0, blankCount:0, wrongStudents:[] }))
  });
  const group=groups.get(row.version);group.submittedCount++;
  const student={id:row.user_id,name:row.name,username:row.username,className:row.class_name,
   accountDisabled:row.account_disabled===true,score:row.score,wrongNumbers:[],blankNumbers:[]};
  group.questions.forEach((q,i)=>{
   if(row.correct[i]===true)return;
   const answer=String(row.answers[i]??''),blank=!answer.trim();
   q.wrongCount++;if(blank)q.blankCount++;
   q.wrongStudents.push({id:student.id,name:student.name,username:student.username,answer,blank});
   student.wrongNumbers.push(i+1);if(blank)student.blankNumbers.push(i+1);
  });
  group.students.push(student);
 }
 for(const group of groups.values()){
  for(const q of group.questions)q.wrongRate=Math.round(q.wrongCount/group.submittedCount*100);
  group.questions.sort((a,b)=>b.wrongCount-a.wrongCount||a.number-b.number);
 }
 const submittedCount=rows.filter(r=>r.submitted_at).length;
 return {kind,totalStudents:rows.length,submittedCount,pendingCount:rows.length-submittedCount,
  // 面板需要全班名册，不能只列已交卷学生；仅返回展示用的成绩与状态。
  students:rows.map(row=>{
   const scores={A:null,B:null},scoreVersions={A:null,B:null};
   if(row.submitted_at){scores[kind]=row.score;scoreVersions[kind]=row.version;}
   const other=kind==='A'?'B':'A';
   if(row.other_submitted_at){scores[other]=row.other_score;scoreVersions[other]=row.other_version;}
   return {id:row.user_id,name:row.name,username:row.username,className:row.class_name,accountDisabled:row.account_disabled===true,
    version:row.version||null,scores,scoreVersions,
    status:row.submitted_at?'submitted':row.attempt_id?(new Date(row.deadline)<=new Date()?'overdue':'in_progress'):row.assigned?'assigned':'unassigned'};
  }),
  groups:[...groups.values()].sort((a,b)=>Number(b.version===currentExamVersions[kind])-Number(a.version===currentExamVersions[kind])||b.version.localeCompare(a.version))};
}

async function examAnalysis(pool,user,query){
 const kind=query.kind||'A',classId=query.classId||'';
 if(!['A','B'].includes(kind)||typeof classId!=='string')fail(400,'请选择前测或后测及有效班级。');
 if(classId){
  if(!/^[0-9a-f-]{36}$/i.test(classId))fail(404,'班级不存在。');
  if(!(await pool.query('SELECT 1 FROM classes WHERE id=$1 AND teacher_id=$2',[classId,user.id])).rowCount)fail(404,'班级不存在。');
 }
 // 一次联表读取整班，不逐个请求学生档案，避免拖慢工作台。
 const rows=(await pool.query(`SELECT s.user_id,(s.data->>'accountDisabled'='true') AS account_disabled,u.name,u.username,c.name AS class_name,
  a.id AS attempt_id,a.deadline,a.version,a.submitted_at,a.score,a.correct,a.answers,assignment.enabled AS assigned,
  other.score AS other_score,other.version AS other_version,other.submitted_at AS other_submitted_at
  FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
  LEFT JOIN attempts a ON a.student_id=s.user_id AND a.kind=$2
  LEFT JOIN attempts other ON other.student_id=s.user_id AND other.kind<>$2
  LEFT JOIN assignments assignment ON assignment.student_id=s.user_id AND assignment.kind=$2
  WHERE c.teacher_id=$1 ${classId?'AND c.id=$3':''} ORDER BY u.name,u.username`,classId?[user.id,kind,classId]:[user.id,kind])).rows;
 return summarizeExams(rows,kind);
}
module.exports={examAnalysis,summarizeExams};
