/* 新教师课堂助手：只组织已有课程，成绩与权限仍由原服务端负责。 */
let teachingStep=0,projecting=false;
const classroomDrafts=new Map();
const TEACHING_STEPS=['课前准备','读题与尝试','视频与方法','动画验证','小老师讲堂','独立练习','课末记录'];
// 每课提纲围绕实际上台题，避免把母题中的物品和数字带入新题。
const TALK_SUPPORT=[
 ['彩笔和绘画本的购物问题',['4盒彩笔和4本绘画本可以分成____套，每套包含____。','我在第二次购买中圈出____套，剩下____。','我先求____的单价，再求____的单价。','新购物清单需要____元；代回两次购买检查____。'],'为什么第二次购买可以先圈出两套？','一套的价格与一盒彩笔的价格有什么不同？'],
 ['长块与短块的重量问题',['两组相加得到____长块和____短块，共____克。','每套一长一短重____；我从原条件中拆出____。','所求5长4短可以看作____，还需要____。','我把单个重量代回36克和34克检查____。'],'5长4短能直接当成五套吗？','知道一套重量后，怎样求一个长块？'],
 ['50面彩旗的排列问题',['重复的一组是____，每组____面。','50里面有____个完整组，还剩____面。','第50面看余下的位置；蓝旗总数要统计____。','我用靠近50的整组末尾位置检查____。'],'求某一面颜色和求蓝旗总数有什么不同？','余下的旗里有没有蓝旗？'],
 ['48个零件装袋的问题',['全部装完要求每袋件数是48的____。','我从____开始成对寻找，并在____时停止。','至少5个、至多13个，所以保留____。','我用乘积和质因数分解检查____。'],'为什么不能选每袋5个？','如何保证没有漏掉或重复一组因数？'],
 ['材料包与闪灯的两个问题',['分材料包要找24和36的____，再检查至少5包。','最多分____包，每包蓝卡____张、黄卡____张。','两灯再次同闪要找5与6的____。','我列出到90秒的同闪时刻，并说明是否计入0秒。'],'分包数与每包卡片数一样吗？','题目中的0秒和90秒分别算不算？'],
 ['缺口深度与三角形面积的问题',['长方形原面积是____，减去剩余面积得到____。','缺口面积除以已知的宽，得到____。','三角形移动过程中，底____，高____。','我用补回缺口或重新算面积检查____。'],'为什么不能用面积差直接当深度？','顶点移动后，哪条长度仍是三角形的高？'],
 ['半格面积与镜像位置的问题',['6个半格能拼成____整格，加上原来的____格。','每格边长3厘米，每格面积是____。','镜像与原点到镜面的距离____，高度____。','我分别用拼格和数左右距离检查____。'],'格数可以直接当平方厘米吗？','镜像应该在镜面的哪一边？'],
 ['中途停留的追赶问题',['小乐出发时，小安已领先____米。','先追5分钟后差距____；停3分钟时差距____。','最后还要追____分钟，总经过时间要加上____。','我分别用两人的速度与实际走路时间计算相遇位置。'],'小乐停下时，小安有没有停？','经过时间与小乐走路时间为什么不同？'],
 ['草地生长与牛吃草的问题',['两种情况下总共吃掉____份和____份草。','原有草相同，相差的草来自____天的生长。','每天长____份，所以原有____份。','18头牛每天净消耗____份；用原草加新草检查。'],'吃掉的总草量为什么不等于原有草量？','放18头牛时，每天应该扣除多少新增草？'],
 ['分书与移去一个数的问题',['我固定甲的本数，再列乙丙，逐一检查2到4本限制。','三家书店有名字，同样的数量交换书店后____。','原来总和是____，移去18后总和____、个数____。','我用新平均数乘剩余个数，再加18检查____。'],'为什么交换甲乙的书数可能是另一种分法？','移去一个数后，除数为什么也要改变？'],
 ['彩灯与平均数的错因复盘',['我更容易出错的是____，以前容易把____弄错。','彩灯每组____盏，第44盏落在____位置。','原总和____，去掉26后应除以____。','我用组末位置和还原总和分别检查两问。'],'一组里有两个蓝色，会改变每组的盏数吗？','这次用什么检查办法避免原来的错误？'],
 ['三道题的选法与检查',['分材料包先找____，再筛选至少6包的限制。','数圆形要把完整组和剩下的图案____。','计算星号要先算____，再把结果代入____。','我分别用分包结果、分组计数和运算规则检查。'],'每道题的条件为什么适合你选的方法？','星号两次运算中的a分别是什么？']
];
function talkSupport(l){const row=TALK_SUPPORT[lessonId];return {opening:`大家好，今天我讲${row[0]}。我先读出已知条件，再说明题目要我求什么。`,talk:row[1],questions:row.slice(2),answer:l.videoGuide?.answer};}
function teacherPrivate(html){return teacher?`<div class="teacher-private">${html}</div>`:'';}
function teacherStarter(){if(!teacher)return '';return `<section class="panel teacher-starter"><span class="tag">新老师从这里开始</span><h2>第一次上课，按这四步准备</h2><div class="starter-grid"><div><b>① 准备学生账号</b><p>把各自账号交给学生，提前试登录；学生首次登录需改为至少6位的密码。</p>${button('创建学生账号','create-student','secondary')}</div><div><b>② 备好第一节课</b><p>先看完整题目、讲解路线和易错点，准备草稿纸、彩笔及投屏设备。</p>${button('查看第一课教案','guide-open','secondary','data-id="0"')}</div><div><b>③ 先做起点测评</b><p>第一课先做A卷：20题、120分、45分钟。学生点开始才计时。</p>${overview.classes.length?button('布置班级前测','assign-class','secondary'):'<a href="#teacher">先创建班级 →</a>'}</div><div><b>④ 跟着步骤授课</b><p>依次读题、看视频、操作动画、上台讲解和做题；最后为所选学生保存记录。</p><a class="start-teaching" href="#lesson/0/teach/0">开始第一课 →</a></div></div><p class="tiny">授课时用教师账号；学生用自己的账号做测评与练习。投屏展示会隐藏教师解析与个人记录，退出展示后可继续评价。</p></section>`;}
function teachingLink(i=lessonId){return `<a class="start-teaching" href="#lesson/${i}/teach/0">跟着步骤上课 →</a>`;}
function recordIdentity(){return `<p class="record-identity">${pupil()?`当前记录对象：<b>${esc(pupil().name)}</b> · 第${lessonId+1}课。切换学生请使用顶部“查看学生档案”。`:'当前为教师备课预览，选择学生后才能记录表现。'}</p>`;}
function draftKey(){return `${user?.id}/${pupil()?.id}/${lessonId}`;}
function classroomValues(){return {...{level:pupil()?.talk?.[lessonId]?.level||'',note:pupil()?.notes?.[lessonId]||'',completed:pupil()?.completed?.includes(lessonId)||false},...classroomDrafts.get(draftKey())};}
function lessonRecordPanel(){
 const p=pupil(),v=classroomValues();
 return teacherPrivate(`<section class="panel"><span class="tag">课末收尾 · 逐位记录</span><h2>今天学会了什么，下次补什么？</h2>${recordIdentity()}<p>${esc(LESSONS[lessonId].detail.exit)}</p>${p?`<label for="finish-level">讲解表现</label><select id="finish-level"><option value="">尚未评价</option>${['独立讲清','追问后讲清','需要重新学习'].map(x=>`<option ${v.level===x?'selected':''}>${x}</option>`).join('')}</select><label for="finish-note">课堂记录与下次任务</label><textarea id="finish-note" maxlength="5000" placeholder="例如：能解释价差；求总价时漏了一项。下次先让学生圈出所求，再做一道新题。">${esc(v.note)}</textarea><label class="completion-check"><input type="checkbox" id="finish-completed" ${v.completed?'checked':''}>确认该学生已完成本课（可保留未完成状态）</label><p id="finish-status" role="status">${classroomDrafts.has(draftKey())?'有未保存的修改，请保存后结束。':'已载入该学生的已保存记录。'}</p>${button('保存本课评价与记录','finish-save')}`:'<a href="#home">返回工作台选择或创建学生 →</a>'}<p class="tiny">这里保存讲解评价、课堂记录与完成状态；练习和测评分数由学生独立作答产生。班级授课结束后，请逐位选择学生记录。</p><a href="#report">查看成长档案 →</a></section>`);
}
function teachingPreparation(){const l=LESSONS[lessonId],k=lessonId===0?'A':lessonId===10?'B':null,p=pupil();return `<section class="panel"><span class="tag">第${lessonId+1}课 · 120分钟</span><h2>上课前，先确认这几件事</h2><p><b>本课目标：</b>${esc(l.goal)}</p><p><b>学生要先会：</b>${esc(l.prereq)}</p><ul><li>准备白纸、彩笔；学生用自己的账号登录。</li><li>试播视频，确认声音；动画可手动推进。</li><li>先听学生讲完整，再追问理由；先独立做题，再看解析。</li></ul>${k?`<div class="notice"><h3>本课先完成${k==='A'?'前测A':'后测B'}卷</h3><p>0～5分钟讲规则，5～50分钟独立测评，50～60分钟休息。交卷以后再进入知识讲解。</p><p>可以打草稿；不使用计算器、AI或解题提示。布置任务不会开始计时。</p>${teacherPrivate(`<p>${p?`${esc(p.name)}：${p.exams?.[k]?'已交卷，可进入教学':p.drafts?.[k]?'正在作答，请等交卷':p.assignments?.[k]?'已布置，等待学生开始':'尚未布置'}`:'当前没有选择学生，可先备课。'}</p><div class="controls"><a href="#exams">查看学生测评状态 →</a>${overview.classes.length?button('布置班级测评','assign-class','secondary'):''}${button('刷新完成情况','reload','quiet')}</div>`)}</div>`:'<p class="notice">普通课按教案时间安排推进；中途留出休息，动画和变式可根据理解速度调整。</p>'}${teacherPrivate(`<details><summary>老师备课：开场检查与补救</summary>${l.detail.check.map(x=>`<p>${esc(x.replace('｜',' → 期望回应：'))}</p>`).join('')}<p>${esc(l.detail.repair)}</p></details><a href="#lesson/${lessonId}/guide">查看完整120分钟教案 →</a>`)}</section>`;}
function teachingMethod(){const l=LESSONS[lessonId];return courseVideoPanel()+teacherPrivate(`<section class="panel"><h2>视频与母题怎样衔接</h2><p>${lessonId===0?'本页母题是本子与笔；视频用杯子等购物例题示范同样的消去思路，再拓展到“配成一套”。看完请回到本课母题，指出相同的方法，不混用两道题的数字。':'先看视频中的完整例题，再回到本课母题整理方法；遇到条件不同，先让学生说出变化。'}</p><p>在讲解章节切换前暂停，让学生说“接下来想求什么，为什么”；最后的“换你来讲”安排在小老师环节。学生已能说明理由时，可以跳过重复示范。</p><details><summary>回看母题与分步讲法</summary>${motherProblem(l)}${l.steps.map(s=>`<h3>${esc(s[0])}</h3><p>${esc(s[1])}</p><p>${esc(s[2])}</p>`).join('')}</details></section>`);}
function teachingView(){
 const l=LESSONS[lessonId],s=teachingStep,minutes=[0,10].includes(lessonId)?['60分钟（含测评与休息）','5分钟','15分钟','10分钟','10分钟','15分钟','5分钟']:['10分钟','10分钟','30分钟','25分钟','15分钟','25分钟','5分钟'];
 const content=()=>s===0?teachingPreparation()+teacherPrivate(personalReviewPanel()):s===1?motherProblem(l)+`<section class="panel"><h2>先尝试，不急着听答案</h2><p>圈出已知条件和所求，在草稿纸上画图或列式。</p><p>说一说：我知道了什么？还缺什么？我打算从哪里开始？</p></section>`:s===2?teachingMethod():s===3?`<section class="panel"><h2>先预测，再验证</h2>${teacherPrivate(`<p>${esc(l.detail.labTask)}</p>`)}<p>先按原题观察；说清关键一步以后再调整参数做变式。普通课在本环节前休息5分钟（计入本环节25分钟）。</p></section>`+labView(lessonId):s===4?talkView():s===5?`<section class="panel"><h2>独立完成这3道题</h2><p>学生在自己的账号中进入第${lessonId+1}课“独立练习”，用草稿纸作答后提交。测评课先做第1题，其余按速度安排。</p>${l.practice.map((q,j)=>practiceQuestion(q,lessonId,j)).join('')}</section>`:lessonRecordPanel();
 return `<div class="teaching-room"><div class="teaching-toolbar"><div><span class="tag">第${lessonId+1}课 · ${s+1}/7</span><b>${esc(TEACHING_STEPS[s])}</b><small>建议${minutes[s]}，可按学情调整</small></div><div class="controls">${s<6?button(projecting?'退出投屏展示':'投屏展示','projection','secondary'):''}<a class="teacher-private" href="#lesson/${lessonId}/guide">完整教案</a></div></div><nav class="teaching-steps" aria-label="逐步授课">${TEACHING_STEPS.map((name,i)=>`<a href="#lesson/${lessonId}/teach/${i}" ${i===s?'aria-current="step"':''} ${i===6?'class="teacher-private"':''}>${i+1}. ${name}</a>`).join('')}</nav>${teacherPrivate(recordIdentity())}<h1>${esc(l.title)}</h1>${content()}<div class="teaching-next">${s?`<a href="#lesson/${lessonId}/teach/${s-1}">← 上一步</a>`:'<a href="#courses">返回课程</a>'}${s<6?`${s===5?'<span class="projection-only">请先退出投屏，再进入课末记录。</span>':''}<a class="start-teaching ${s===5?'teacher-private':''}" href="#lesson/${lessonId}/teach/${s+1}">${s===0&&[0,10].includes(lessonId)?'交卷并休息后，进入读题':'下一步：'+TEACHING_STEPS[s+1]} →</a>`:'<a href="#home">返回班级工作台 →</a>'}</div></div>`;
}
function alignedTalkView(){
 const l=LESSONS[lessonId],d=talkSupport(l),p=pupil(),saved=p?.talk[lessonId]||{};
 return talkTransferPanel(l)+`<section class="panel"><h2>从这句话开始</h2><blockquote>${esc(d.opening)}</blockquote><p>先在纸上画这道上台题的图。准备3分钟，试讲2～3分钟；听完一个追问，再补讲关键一步。</p><h3>四步讲课提纲 · 对照上方题目填写</h3><ol>${d.talk.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>不要求背稿。卡住时先读出一个已知条件，再指着自己的图说明下一步。</p>${teacher?'':`<label for="talk-notes">我的讲课提纲（保存后，下次可继续）</label><textarea id="talk-notes" rows="6" placeholder="${esc(d.talk.join('\n'))}">${esc(saved.prep||'')}</textarea>${p?button('保存讲课准备','talk-save'):''}`}</section>`+teacherPrivate(`<section class="panel"><h2>老师怎样听、怎样追问</h2>${recordIdentity()}<p>先完整听2～3分钟，不中途代讲。检查：条件与所求、关键理由、图式与单位、原条件检验。</p>${d.questions.map(q=>`<p>追问：${esc(q)}</p>`).join('')}${d.answer?`<details><summary>教师参考：本次上台题的解法</summary><p>${esc(d.answer)}</p></details>`:''}<p>说不下去时，只给一个关键词；仍有困难，返回母题练习关键一步，下次再独立讲变式。</p>${teacher&&p?`<p>学生已保存的准备：</p><p class="saved-prep">${esc(saved.prep||'尚未保存提纲，可先用纸笔准备。')}</p><label for="talk-level">本次讲解观察</label><select id="talk-level"><option value="">尚未评价</option>${['独立讲清','追问后讲清','需要重新学习'].map(x=>`<option ${saved.level===x?'selected':''}>${x}</option>`).join('')}</select>${button('保存讲课评价','talk-save')}<p class="tiny">讲课评价不计入120分测评；停顿后能说清理由也算理解。</p>`:''}</section>`)+`<details class="panel"><summary>需要降低难度？回看完整母题</summary>${motherProblem(l)}</details>`;
}

// 草稿按教师、学生、课程分别暂存；失败保留，成功后才清理。
function rememberClassroomDraft(){
 if(!teacher||!pupil()||!document.getElementById('finish-note'))return;
 classroomDrafts.set(draftKey(),{level:document.getElementById('finish-level').value,note:document.getElementById('finish-note').value,completed:document.getElementById('finish-completed').checked});
 document.getElementById('finish-status').textContent='有未保存的修改；切换环节或学生后可回来继续，刷新或关闭前请保存。';
}
async function saveClassroomRecord(){
 if(!teacher||!pupil())throw new Error('请先选择要记录的学生。');
 rememberClassroomDraft();
 const key=draftKey(),student=pupil(),id=lessonId,body={...classroomDrafts.get(key)};
 try{
  await api(`/api/students/${student.id}/lessons/${id}`,{method:'PUT',body});
  student.talk[id]={...student.talk[id],level:body.level};student.notes[id]=body.note;
  student.completed=student.completed.filter(x=>x!==id);if(body.completed)student.completed.push(id);
  // 请求期间即使切换学生，也不会把返回结果写进另一个学生。
  if(JSON.stringify(classroomDrafts.get(key))===JSON.stringify(body))classroomDrafts.delete(key);
  if(key===draftKey()&&document.getElementById('finish-status'))document.getElementById('finish-status').textContent=classroomDrafts.has(key)?'上一份记录已保存；还有新的修改，请再次保存。':`${student.name}的第${id+1}课评价、记录与完成状态已保存。`;
  toast(`${student.name}的第${id+1}课记录已保存。`);
 }catch(err){if(key===draftKey()&&document.getElementById('finish-status'))document.getElementById('finish-status').textContent='保存失败，草稿已保留。请检查连接后再次保存。';throw err;}
}
document.addEventListener('input',event=>{if(['finish-level','finish-note','finish-completed'].includes(event.target.id))rememberClassroomDraft();});
