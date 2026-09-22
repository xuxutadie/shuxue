const {transaction,fail}=require('../db');
const {ownedStudent}=require('../auth');
const engine=require('./engine.cjs');
function setupWorld3d(app,pool){
 // 教师试玩按账号隔离，最多保留一小时；真实学生进度存在原有 PostgreSQL 档案中。
 const demos=new Map();
 async function access(req,write,action){
  if(req.params.id==='demo'){
   if(req.user.role!=='teacher'||req.studentPreview)fail(403,'此入口仅供教师试玩。');
   for(const [key,value] of demos)if(value.until<Date.now())demos.delete(key);
   let entry=demos.get(req.user.id);
   if(!entry){if(demos.size>=100)demos.delete(demos.keys().next().value);entry={state:engine.initial()};demos.set(req.user.id,entry);}
   const copy=structuredClone(entry.state),out=action(copy,{demo:true,name:'教师试玩'});
   entry.state=copy;entry.until=Date.now()+3600000;return out;
  }
  return transaction(pool,async db=>{
   const student=await ownedStudent(db,req.user,req.params.id,write);
   if(write&&(req.user.role!=='student'||req.studentPreview))fail(403,'查看学生记录时不能代替学生作答，请使用教师试玩。');
   // 游戏不能在独立测评进行期间提供额外解题帮助。
   if(req.user.role==='student'&&(await db.query('SELECT 1 FROM attempts WHERE student_id=$1 AND submitted_at IS NULL',[req.params.id])).rowCount)fail(403,'请先完成当前测评，再进入游戏世界。');
   const state=student.data.world3d||engine.initial(),out=action(state,{readonly:req.user.role==='teacher'||!!req.studentPreview,name:student.name});
   if(write){student.data.world3d=state;await db.query('UPDATE students SET data=$2 WHERE user_id=$1',[student.user_id,JSON.stringify(student.data)]);}
   return out;
  });
 }
 app.get('/api/world3d/:id',async(req,res)=>res.json(await access(req,false,(s,opts)=>engine.view(s,opts))));
 app.post('/api/world3d/:id/character',async(req,res)=>res.json(await access(req,true,s=>engine.selectCharacter(s,req.body.character))));
 app.post('/api/world3d/:id/home',async(req,res)=>res.json(await access(req,true,s=>require('./home.cjs').decorate(s,req.body))));
 app.post('/api/world3d/:id/playground',async(req,res)=>res.json(await access(req,true,(s,opts)=>require('./playground.cjs').purchase(s,req.body,opts))));
 app.post('/api/world3d/:id/start',async(req,res)=>res.json(await access(req,true,(s,opts)=>{engine.start(s,req.body.courseId,opts.demo);return engine.view(s,opts);})));
 app.post('/api/world3d/:id/run',async(req,res)=>res.json(await access(req,true,(s,opts)=>({...engine.runAction(s,req.body),...engine.view(s,opts)}))));
 app.post('/api/world3d/:id/camp',async(req,res)=>res.json(await access(req,true,(s,opts)=>({...engine.submitGame(s,req.body,opts.demo),state:engine.view(s,opts)}))));
}
module.exports={setupWorld3d};
