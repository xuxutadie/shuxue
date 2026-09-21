const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function harness(){
 const root={innerHTML:'',querySelector(){return {focus(){}};}};
 const calls=[];
 const context=vm.createContext({document:{addEventListener(){},getElementById(){return root;}},teacher:true,pupil:()=>({id:'test',games:{}}),api:async(...args)=>calls.push(args),toast(){}});
 vm.runInContext(fs.readFileSync('public/factor-game.js','utf8'),context);
 vm.runInContext('factorGameView()',context);
 return {run:code=>vm.runInContext(code,context),calls};
}
test('因数和分类：平方因数去重，1、2、奇合数及质数均正确',()=>{
 const {run}=harness();
 assert.equal(run('factorList(24).join(",")'),'1,2,3,4,6,8,12,24');
 assert.equal(run('factorList(16).join(",")'),'1,2,4,8,16');
 for(const [n,kind] of [[1,'neither'],[2,'prime'],[9,'composite'],[17,'prime'],[25,'composite']])assert.equal(run(`factorKind(${n})`),kind);
});
test('分袋图的能量豆总数守恒，余数单列，非因数不可收集',()=>{
 const {run}=harness();
 for(const n of [1,2,7,8,9,12,17,24])for(let group=1;group<=n;group++){
  const svg=run(`factorSvg(${n},${group},true)`);
  assert.equal((svg.match(/<circle /g)||[]).length,n);
  assert.equal(svg.includes('stroke-dasharray'),n%group!==0);
 }
 run('factorAction("pack",{})');
 assert.equal(run('factorState.found.length'),0);
 assert.match(run('factorState.message'),/剩 2 颗/);
 run('factorState.group=3;factorAction("pack",{})');
 assert.equal(run('factorState.found.join(",")'),'3,4');
 run('factorAction("pack",{})');
 assert.equal(run('factorState.found.length'),2);
});
test('随机闯关每题只有一个正确选项，覆盖容易混淆的概念',()=>{
 const {run}=harness();
 for(let i=0;i<100;i++){
  const questions=JSON.parse(run('JSON.stringify(factorQuiz())'));
  assert.equal(questions.length,6);
  for(const q of questions){assert.equal(q.options.filter(x=>x===q.answer).length,1);assert.equal(new Set(q.options).size,3);}
  const pack=questions.find(q=>q.text.startsWith('把 ')),n=Number(pack.text.match(/把 (\d+)/)[1]);
  assert.equal(pack.options.filter(x=>n%x===0).length,1);
 }
});
test('错答可重试，重复点击不累计正确数，教师演示不写入学生记录',()=>{
 const {run,calls}=harness();
 run('factorAction("stage",{dataset:{stage:"quiz"}})');
 run('factorAction("answer",{dataset:{choice:factorState.quiz[0].options.findIndex(x=>x!==factorState.quiz[0].answer)}})');
 assert.equal(run('factorState.passed'),false);
 assert.equal(run('factorState.question'),0);
 run('factorAction("answer",{dataset:{choice:factorState.quiz[0].options.indexOf(factorState.quiz[0].answer)}})');
 run('factorAction("answer",{dataset:{choice:factorState.quiz[0].options.indexOf(factorState.quiz[0].answer)}})');
 assert.equal(run('factorState.attempts'),2);
 assert.equal(run('factorState.first'),0);
 run('factorAction("next-question",{})');
 for(let i=1;i<6;i++)run('factorAction("answer",{dataset:{choice:factorState.quiz[factorState.question].options.indexOf(factorState.quiz[factorState.question].answer)}});factorAction("next-question",{})');
 assert.equal(run('factorState.first'),5);
 assert.equal(run('factorState.attempts'),7);
 assert.match(run('factorQuizView()'),/闯关完成/);
 assert.equal(calls.length,0);
});
test('新游戏只接入因数课和游乐场，第五课保留公倍数实验',()=>{
 const {run}=harness();
 run('function labView(index){return "旧实验"+index;}function labModel(){return {question:"问题"};}var labState={type:"multiples",values:{}};');
 run(fs.readFileSync('public/games.js','utf8'));
 assert.match(run('gameView("factor",3)'),/数字工厂/);
 assert.match(run('gameView("factor")'),/数字工厂/);
 assert.match(run('gameView("factor",4)'),/旧实验4/);
 assert.doesNotMatch(run('gameView("factor",4)'),/id="factor-game"/);
});
