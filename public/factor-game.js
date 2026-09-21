/* 因数与质数小游戏：先用分组找依据，再分类，最后独立判断。 */
let factorState;
const FACTOR_KINDS={prime:'质数',composite:'合数',neither:'两者都不是'};
function factorList(n){
 const result=[];
 for(let i=1;i<=n;i++)if(n%i===0)result.push(i);
 return result;
}
function factorKind(n){return n===1?'neither':factorList(n).length===2?'prime':'composite';}
function factorShuffle(items){return items.map(value=>({value,order:Math.random()})).sort((a,b)=>a.order-b.order).map(item=>item.value);}
function factorQuiz(){
 const n=[12,18,20,24][Math.floor(Math.random()*4)];
 return factorShuffle([
  {text:`把 ${n} 颗能量豆装袋，每袋一样多，必须全部装完，不能有剩余。下面哪一个数可以作为每袋的颗数？`,options:[5,7,6,4].filter(x=>n%x!==0).slice(0,2).concat(factorList(n)[2]),answer:factorList(n)[2],hint:'试着用总颗数除以每袋的颗数，检查是否有余数。'},
  {text:'1 只有一个正因数，就是 1。应该把 1 放进哪个数字家族？',options:['质数','合数','两者都不是'],answer:'两者都不是',hint:'质数恰好有两个正因数；合数有两个以上。'},
  {text:'2 可以分成 1 × 2，没有其他的正因数。2 是偶数，它属于哪个数字家族？',options:['质数','合数','两者都不是'],answer:'质数',hint:'判断质数要数正因数，不能只看它是奇数还是偶数。'},
  {text:'小宇说：“9 是奇数，所以 9 是质数。”哪一句能说明他的判断不正确？',options:['9 比 2 大','9 还能被 3 整除','9 的个位是 9'],answer:'9 还能被 3 整除',hint:'找找除了 1 和它本身，是否还有别的正因数。'},
  {text:'24 = 4 × 6。下面哪一种说法正确？',options:['4 和 6 都是 24 的因数','4 和 6 都是质数','24 是 4 的因数'],answer:'4 和 6 都是 24 的因数',hint:'因数要说明“是谁的因数”；观察哪两个数相乘得到 24。'},
  {text:'小米找到 16 的因数对：1 × 16、2 × 8、4 × 4。16 一共有几个不同的正因数？',options:[5,6,4],answer:5,hint:'同一个因数只能算一次，注意最后一对中的两个 4。'}
 ]).map(q=>({...q,options:factorShuffle(q.options)}));
}
function factorGameView(){
 factorState={stage:'explore',n:12,group:5,packed:false,found:[],message:'先猜一猜：每袋 5 颗，12 颗能量豆能恰好装完吗？',round:0,targets:[7,8,1,2,9,17],passed:false,quiz:factorQuiz(),question:0,attempts:0,first:0,questionAttempts:0,saved:false};
 return `<section id="factor-game" class="panel factor-game" aria-label="因数与质数数字工厂">${factorGameContent()}</section>`;
}
function factorButton(text,action,extra='',style='secondary'){
 return `<button class="${style}" data-factor="${action}" ${extra}>${text}</button>`;
}
function factorRules(){
 return '<details class="factor-rules"><summary>想不起来？翻开概念卡</summary><p><b>因数：</b>在正整数范围内，如果一个数能整除另一个数，没有余数，前者就是后者的因数。例如 12 = 3 × 4，3 和 4 都是 12 的因数。</p><p><b>质数：</b>大于 1，恰好只有 1 和它本身这两个正因数。</p><p><b>合数：</b>大于 1，有两个以上的正因数。<b>1 既不是质数，也不是合数。</b></p><p>因数说的是两个数之间的关系；质数说的是一个数的分类。</p></details>';
}
function factorGameContent(){
 const s=factorState;
 const nav=[['explore','① 分一分'],['classify','② 分家族'],['quiz','③ 闯一关']].map(([key,label])=>factorButton(label,'stage',`data-stage="${key}" aria-pressed="${s.stage===key}"`,s.stage===key?'':'secondary')).join('');
 return `<div class="factor-heading"><div><span class="tag">数字工厂 · 因数与质数</span><h2>给能量豆找个家</h2><p>分得刚刚好，数学有门道。</p></div><span class="factor-mascot" aria-hidden="true">✦</span></div><div class="factor-nav" role="group" aria-label="游戏关卡">${nav}</div>${s.stage==='quiz'?factorQuizView():factorLabView()}<p id="factor-feedback" class="factor-feedback" role="status">${s.message}</p>${factorRules()}<p class="tiny">探索不计入测评分数。闯关结束后，只记录本次参与；刷新页面可以重新玩。</p>`;
}
function factorLabView(){
 const s=factorState,classification=s.stage==='classify',all=factorList(s.n),complete=all.length===s.found.length;
 const choices=classification?'':`<label for="factor-total">换一批能量豆<select id="factor-total" data-factor-total>${[12,24,7,8,1,2,9,17].map(n=>`<option value="${n}" ${s.n===n?'selected':''}>${n} 颗</option>`).join('')}</select></label>`;
 const task=classification?`第 ${s.round+1} / ${s.targets.length} 站：${s.n} 属于哪个家族？先试着分袋，再判断。`:`有 ${s.n} 颗能量豆，每袋要装同样多，全部装完且没有剩余。每袋可以装几颗？请找齐 ${s.n} 的正因数。`;
 return `<h3 class="factor-task" tabindex="-1">${task}</h3><div class="factor-layout"><div class="factor-scene">${factorSvg(s.n,s.group,s.packed)}</div><div class="factor-console">${choices}<label for="factor-group">每袋装几颗？<select id="factor-group" data-factor-group ${s.passed?'disabled':''}>${Array.from({length:s.n},(_,i)=>i+1).map(n=>`<option value="${n}" ${s.group===n?'selected':''}>${n} 颗</option>`).join('')}</select></label>${factorButton('动手装袋 →','pack',s.passed?'disabled':'','')}<p class="tiny">先选颗数，再点装袋。整袋用实线框表示，剩余用虚线框表示。</p><h3>我发现的因数</h3><div class="factor-chips">${s.found.length?s.found.map(n=>`<span>${n}</span>`).join(''):'还没收集到，试着装一袋吧。'}</div><p>${complete?'✓ 已找齐！相同因数只收集一次。':`已发现 ${s.found.length} 个不同因数。`}</p></div></div>${classification?`<div class="factor-choices" role="group" aria-label="判断数字家族">${Object.entries(FACTOR_KINDS).map(([key,label])=>factorButton(label,'classify',`data-kind="${key}" ${s.passed?'disabled':''}`)).join('')}</div>${s.passed?factorButton(s.round===s.targets.length-1?'进入独立闯关 →':'下一个数字 →','next-kind','',''):''}`:complete?factorButton('我找齐了，去分家族 →','stage','data-stage="classify"',''):''}`;
}
function factorSvg(n,group,packed){
 // 每袋按实际颗数画点；余数永远单列，避免把未装满的一袋当成因数依据。
 const bags=packed?Array(Math.floor(n/group)).fill(group):[n],remainder=packed?n%group:0;
 if(remainder)bags.push(remainder);
 const columns=2,cellWidth=150,cellHeight=130,height=Math.ceil(bags.length/columns)*cellHeight+16;
 const label=packed?`${n} 颗，每袋 ${group} 颗，装满 ${Math.floor(n/group)} 袋，剩 ${remainder} 颗`:`${n} 颗能量豆等待装袋`;
 return `<p class="factor-scene-caption">${label}</p><svg viewBox="0 0 310 ${height}" role="img" aria-label="${label}">${bags.map((count,i)=>{
  const x=10+(i%columns)*cellWidth,y=10+Math.floor(i/columns)*cellHeight,rest=remainder&&i===bags.length-1;
  return `<g class="factor-bag"><rect x="${x}" y="${y}" width="138" height="116" rx="16" fill="${rest?'#ffe2da':packed?'#e0f5ed':'#fff0ac'}" stroke="#393248" stroke-width="2" ${rest?'stroke-dasharray="6 4"':''}/><text x="${x+10}" y="${y+21}" font-size="13" fill="#393248">${rest?'剩余':packed?`第 ${i+1} 袋`:'待装袋'} · ${count} 颗</text>${Array.from({length:count},(_,j)=>`<circle class="factor-bean" cx="${x+16+j%6*21}" cy="${y+39+Math.floor(j/6)*19}" r="7" fill="${rest?'#ff8d73':['#ffce46','#a996ee','#70cee8'][i%3]}" stroke="#393248" stroke-width="1.5"/>`).join('')}</g>`;
 }).join('')}</svg>`;
}
function factorQuizView(){
 const s=factorState,q=s.quiz[s.question];
 if(!q)return `<div class="factor-finish"><span aria-hidden="true">★</span><h3 class="factor-task" tabindex="-1">数字工厂，闯关完成！</h3><p>完成 ${s.quiz.length} 题 · 首次答对 ${s.first} 题 · 共作答 ${s.attempts} 次</p><p>当一分钟小老师：什么是 12 的因数？什么是质数？为什么 1 不属于质数或合数？</p>${factorButton('换个顺序，再挑战一次','retry','','')}</div>`;
 return `<p class="tag">独立闯关 ${s.question+1} / ${s.quiz.length}</p><h3 class="factor-task" tabindex="-1">${q.text}</h3><div class="factor-choices">${q.options.map((option,index)=>factorButton(option,'answer',`data-choice="${index}" ${s.passed?'disabled':''}`)).join('')}</div>${s.passed?factorButton(s.question===s.quiz.length-1?'看看我的收获 →':'下一题 →','next-question','',''):''}`;
}
function factorResetNumber(n){Object.assign(factorState,{n,group:Math.min(2,n),packed:false,found:[],passed:false,message:'先预测，再试着装袋；判断要说出依据。'});}
function factorRedraw(focusTask=false){
 const root=document.getElementById('factor-game'),active=document.activeElement;
 const id=active?.id,action=active?.dataset.factor;
 root.innerHTML=factorGameContent();
 const focus=focusTask?root.querySelector('.factor-task'):id?document.getElementById(id):action?root.querySelector(`[data-factor="${action}"]:not(:disabled)`):null;
 (focus||root.querySelector('.factor-task'))?.focus({preventScroll:true});
}
function factorAction(action,el){
 const s=factorState;
 if(!s)return;
 if(action==='stage'){
  if(s.stage===el.dataset.stage)return;
  s.stage=el.dataset.stage;
  if(s.stage==='classify'){s.round=0;factorResetNumber(s.targets[0]);}
  else if(s.stage==='explore')factorResetNumber(12);
  else factorStartQuiz();
 }else if(action==='pack'&&!s.passed){
  s.packed=true;const full=Math.floor(s.n/s.group),rem=s.n%s.group;
  if(!rem){s.found=[...new Set([...s.found,s.group,full])].sort((a,b)=>a-b);s.message=`${s.n} = ${s.group} × ${full}，没有剩余！${s.group===full?`${s.group} 是 ${s.n} 的因数，重复的只记一次。`:`${s.group} 和 ${full} 都是 ${s.n} 的因数。`}`;}
  else s.message=`${s.n} ÷ ${s.group} = ${full} …… ${rem}，还剩 ${rem} 颗。所以 ${s.group} 不是 ${s.n} 的因数，换一种装法试试。`;
 }else if(action==='classify'&&s.stage==='classify'&&!s.passed){
  if(el.dataset.kind!==factorKind(s.n))s.message='再想想：质数恰有两个正因数，合数有两个以上。试一试其他装法，别只看奇偶。';
  else {s.passed=true;s.found=factorList(s.n);s.message=`判断正确！${s.n} 的正因数是 ${s.found.join('、')}，共 ${s.found.length} 个。${s.n===1?'1 只有一个正因数，所以两者都不是。':`${s.n} 是${FACTOR_KINDS[factorKind(s.n)]}。`}${s.n===2?'2 是唯一的偶质数。':s.n===9?'奇数不一定是质数。':''}`;}
 }else if(action==='next-kind'&&s.passed){
  if(++s.round===s.targets.length){s.stage='quiz';factorStartQuiz();}else factorResetNumber(s.targets[s.round]);
 }else if(action==='answer'&&s.stage==='quiz'&&!s.passed&&s.quiz[s.question]){
  const q=s.quiz[s.question];s.attempts++;s.questionAttempts++;
  s.passed=q.options[Number(el.dataset.choice)]===q.answer;
  if(s.passed&&s.questionAttempts===1)s.first++;
  s.message=s.passed?'答对了！请先用自己的话说出理由，再继续。':`还需要想一想。${q.hint}`;
 }else if(action==='next-question'&&s.passed){
  s.question++;s.questionAttempts=0;s.passed=false;s.message='先独立判断，需要时可以翻开概念卡。';
  if(s.question===s.quiz.length){s.message='记住：找因数看整除，认质数数因数。';factorRecord();}
 }else if(action==='retry')factorStartQuiz();
 factorRedraw(['stage','next-kind','next-question','retry'].includes(action));
}
function factorStartQuiz(){Object.assign(factorState,{quiz:factorQuiz(),question:0,attempts:0,first:0,questionAttempts:0,passed:false,message:'先独立判断，需要时可以翻开概念卡。'});}
function factorRecord(){
 // 沿用平台的参与记录，不把练习动画算作测评成绩；教师演示不写学生数据。
 if(factorState.saved||teacher||!pupil()||(typeof previewStudentId!=='undefined'&&previewStudentId))return;
 const session=factorState,student=pupil();session.saved=true;
 api(`/api/students/${student.id}/games/factor`,{method:'POST',body:{}}).then(()=>{student.games.factor={date:new Date().toISOString()};}).catch(()=>{session.saved=false;toast('本次参与记录未保存，可稍后重新闯关。');});
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-factor]');if(el)factorAction(el.dataset.factor,el);});
document.addEventListener('change',event=>{
 const el=event.target;if(!factorState)return;
 if(el.matches('[data-factor-total]')){factorResetNumber(Number(el.value));factorRedraw();}
 if(el.matches('[data-factor-group]')){factorState.group=Number(el.value);factorState.packed=false;factorState.message='装袋前先预测：会不会剩下能量豆？';factorRedraw();}
});
