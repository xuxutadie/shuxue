/* 在线学习入口。身份、评分和权限以服务器为准；浏览器不保存整班档案。 */
let user=null,csrf='',teacher=false,LESSONS=[],FLOW=[],TEST_FLOW=[],overview={classes:[],students:[]};
let previewStudentId=null,previewExamKind=null,previewReturnHash='#home';
let state={students:[],current:null,dates:{},videos:{}},route='home',lessonId=0,lessonTab='learn',slide=0,playTimer=null;
let renderSerial=0,examSession=null,saveTimer=null,savePromise=null,examTimer=null,serverOffset=0,importSource=null,importPreview=null;
const main=document.getElementById('main'),dialog=document.getElementById('dialog');
const learningData=createLearningDataSource((url)=>api(url));
const pupil=()=>state.students.find(p=>p.id===state.current);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,cls='',attrs='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const title=(name,desc,action='')=>`<div class="page-head"><div><div class="eyebrow">MATH EXPLORERS / 五年级</div><h1>${name}</h1><p>${desc}</p></div>${action}</div>`;
const dateOf=i=>state.dates[i]||LESSONS[i].date;
const courseButton=i=>button('进入课堂 →','lesson','',`data-id="${i}"`);
function safeVideo(value){if(!value)return '';try{const u=new URL(value,location.origin||'http://localhost');if(['https:','http:'].includes(u.protocol)&&/\.(mp4|webm)$/i.test(u.pathname))return u.href;}catch{}return '';}
function isCorrect(a,b){return String(a).normalize('NFKC').trim()===String(b).trim();}
function toast(message){const box=document.getElementById('toast');box.textContent=message;box.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.style.display='none',5000);}
function status(text,error=false){const el=document.getElementById('sync-status');el.textContent=text;el.className=error?'save-error':'';}
async function api(url,options={}){
 const previewAtStart=previewStudentId;
 const method=(options.method||'GET').toUpperCase();
 const practiceCheck=method==='POST'&&/^\/api\/students\/[^/]+\/(?:practice|variants|warmups)\/\d+\/\d+$/.test(url);
 if(previewAtStart&&!['GET','HEAD'].includes(method)&&!practiceCheck&&url!=='/api/logout')throw new Error('当前为学生预览，不会保存学生记录。请返回教师模式进行管理。');
 const response=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...(previewAtStart&&url!=='/api/logout'?{'X-Student-Preview':previewAtStart}:{}),...options.headers},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
 const data=await response.json();if(previewAtStart!==previewStudentId)throw Object.assign(new Error('预览对象已切换，本次响应已取消。'),{obsolete:true});if(!response.ok){const err=new Error(data.error||'请求失败，请重试。');err.status=response.status;err.data=data;throw err;}
 if(!previewAtStart&&options.method&&!['GET','HEAD'].includes(options.method.toUpperCase()))learningData.invalidate();
 return data;
}
function modal(html){document.getElementById('dialog-body').innerHTML=html;if(!dialog.open)dialog.showModal();}
function download(name,value,type='application/json'){const u=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
const mascot=`<svg viewBox="0 0 400 260" aria-hidden="true"><ellipse cx="215" cy="224" rx="155" ry="17" fill="#d6b646" opacity=".3"/><g transform="rotate(-9 130 142)"><rect x="48" y="77" width="133" height="139" rx="30" fill="#9edcf5" stroke="#393248" stroke-width="3"/><circle cx="90" cy="127" r="6" fill="#393248"/><circle cx="140" cy="127" r="6" fill="#393248"/><path d="M98 151q18 20 36 0" fill="none" stroke="#393248" stroke-width="3" stroke-linecap="round"/><path d="M72 211l-9 18m89-18 10 18" stroke="#393248" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="148" r="10" fill="#ffaeaa"/><circle cx="154" cy="148" r="10" fill="#ffaeaa"/></g><g transform="rotate(8 274 145)"><path d="M266 45q10-10 20 5l74 143q10 21-13 21H206q-23 0-12-22Z" fill="#ff9274" stroke="#393248" stroke-width="3"/><circle cx="254" cy="141" r="6" fill="#393248"/><circle cx="300" cy="141" r="6" fill="#393248"/><path d="M262 167q13 14 26 0" fill="none" stroke="#393248" stroke-width="3" stroke-linecap="round"/><path d="M231 211l-5 18m89-18 6 18" stroke="#393248" stroke-width="5" stroke-linecap="round"/></g><path d="M205 30l5 15 16 1-12 10 4 16-13-9-13 9 4-16-12-10 16-1Z" fill="#ad94f2" stroke="#393248" stroke-width="2"/><text x="31" y="52" font-size="26" font-weight="bold" fill="#393248">1 + 1 = ?</text><path d="M360 73v22m-11-11h22" stroke="#393248" stroke-width="3"/><circle cx="28" cy="196" r="9" fill="#ad94f2" stroke="#393248" stroke-width="2"/></svg>`;
function loginView(){document.body.classList.add('auth-page');main.innerHTML=`<section class="login-layout"><div class="login-art"><span class="eyebrow">6 WEEKS · BIG IDEAS</span><h1>让好奇心带路，<br>和数学交个朋友。</h1><p>听懂一个方法，讲出一个道理，<br>再亲手解开一个小谜题。</p>${mascot}</div><form id="login-form" class="login-form"><span class="tag">你的数学探险，从这里开始</span><h2>欢迎来到思维实验室</h2><p class="muted">使用老师发给你的账号登录。教师也从这里进入。</p><div class="field"><label for="login-user">账号</label><input id="login-user" name="username" autocomplete="username" required placeholder="请输入你的账号"></div><div class="field"><label for="login-pass">密码</label><input id="login-pass" name="password" type="password" autocomplete="current-password" required placeholder="请输入密码"></div><p id="form-error" class="form-error" role="alert"></p><button type="submit">进入我的学习空间 →</button><p class="tiny">忘记密码？请联系老师重置。每个人都有自己的学习记录。</p></form></section>`;shell();}
function shell(){
 const logged=!!user,viewStudent=previewStudentId?pupil():null;
 document.getElementById('logout').hidden=!logged;document.getElementById('account-button').hidden=!logged;document.getElementById('refresh-data').hidden=!logged;
 document.getElementById('identity').textContent=logged?`${teacher?'教师':'学生'} · ${viewStudent?.name||user.name}`:'';
 document.getElementById('role-badge').textContent=teacher?'教师工作台 · 关注每个孩子':'学生学习空间 · 今天也来探索';
 const selector=document.getElementById('student');selector.hidden=!logged||user.role!=='teacher'||!!previewStudentId||!overview.students.length;
 selector.innerHTML=overview.students.map(p=>`<option value="${p.id}" ${p.id===state.current?'selected':''}>${esc(p.name)}${p.accountDisabled?'（已停用）':''} · ${esc(p.className)}</option>`).join('');
 const nav=teacher?[['home','⌂','班级工作台'],['courses','▤','课程与教案'],['exams','✎','学生测评'],['homework','▧','变式作业'],['ai-practice','✦','AI 引导练习'],['world3d','♧','3D 游戏世界'],['report','▥','学生成长档案'],['teacher','⚙','班级与资源']]:[['home','⌂','我的探索基地'],['courses','⚑','六周探险地图'],['games','◇','思维游乐场'],['world3d','♧','3D 游戏世界'],['practice','✓','练习与错题'],['report','▥','我的成长足迹']];
 document.getElementById('nav').innerHTML=nav.map(([id,icon,label])=>`<a href="#${id}" class="${route===id||route==='lesson'&&id==='courses'||route==='ai-settings'&&id==='ai-practice'||!teacher&&id==='practice'&&['exam','review','exams'].includes(route)?'active':''}"><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
 document.getElementById('breadcrumb').textContent=logged?(!teacher&&['exam','review'].includes(route)?'练习与错题 / 测评挑战':route==='lesson'?'课堂旅程 / '+(teacher?'教师授课':'学生学习'):route==='ai-settings'&&teacher?'AI 引导练习 / 教师设置':nav.find(x=>x[0]===route)?.[2]||'我的学习空间'):'思维实验室 · 数学探险计划';
 syncStudentPreviewShell();
}
async function loadData(options={}){
 const currentUser=user,previewAtStart=previewStudentId;
 const viewUser=previewAtStart?{id:previewAtStart,role:'student'}:currentUser;
 const {content,records}=await learningData.load(viewUser,options);
 if(user!==currentUser||previewAtStart!==previewStudentId)return;
 LESSONS=content.lessons;FLOW=content.flow;TEST_FLOW=content.testFlow;
 if(teacher){overview=records;state.students=overview.students;state.current=state.students.some(p=>p.id===state.current)?state.current:state.students[0]?.id;}
 else{state.students=[records];state.current=records.id;}
 const p=pupil();state.dates=p?.settings.dates||overview.classes[0]?.settings.dates||{};state.videos=p?.settings.videos||overview.classes[0]?.settings.videos||{};
}
function stats(items){return `<div class="stats">${items.map(([label,value,unit])=>`<div class="stat"><small>${label}</small><strong>${value}</strong><span>${unit}</span></div>`).join('')}</div>`;}
function home(){const p=pupil(),n=Math.max(0,LESSONS.findIndex((_,i)=>!p.completed.includes(i)));return title(`嗨，${esc(p.name)}！今天也有新发现。`,'每一次尝试，都让你更接近“我能讲明白”。',`<span class="tag">六周数学探险 · 2026</span>`)+`<section class="hero"><div class="hero-content"><span class="eyebrow">READY, SET, EXPLORE!</span><h2>${p.exams.A?'带着好奇心，开启下一站':'第一站，发现你的数学起点'}</h2><p>${p.exams.A?LESSONS[n].goal:'先试一试，再一起学。不会的题可以跳过，老师会陪你找到适合自己的方法。'}</p>${p.exams.A?courseButton(n):button('查看起点测评 →','exam-open','','data-kind="A"')}</div><div class="hero-art">${mascot}</div></section>`+stats([['完成课堂',p.completed.length,'/ 12 节'],['前测成绩',p.exams.A?.score??'—','/ 120 分'],['后测成绩',p.exams.B?.score??'—','/ 120 分'],['尝试练习',Object.keys(p.practice).length,'/ 36 道']])+`<section class="panel"><div class="section-head"><h2>我的六周探险地图</h2><a href="#courses">展开课程 →</a></div>${mapView()}</section><div class="grid-two"><section class="panel"><h2>思考值得被看见</h2>${badges(p)}<p class="tiny">徽章记录参与和坚持，不影响考试成绩。</p></section><section class="panel quote"><span class="eyebrow">今天，换你当老师</span><p>“这一步为什么成立？”<br>把你的发现讲给老师听。</p>${button('准备我的讲课 →','talk-open','secondary',`data-id="${n}"`)}</section></div>`;}
function mapView(){return `<div class="map-grid">${LESSONS.map((l,i)=>`<a class="map-stop ${pupil()?.completed.includes(i)?'done':''}" href="#lesson/${i}/learn"><span class="island">${pupil()?.completed.includes(i)?'✓':String(i+1).padStart(2,'0')}</span><strong>${esc(l.title.split(' · ')[0])}</strong><small>${dateOf(i).slice(5)} · 第${Math.floor(i/2)+1}周</small></a>`).join('')}</div>`;}
function badges(p){const list=[['✦ 起点探索家',!!p.exams.A],['▤ 勇敢小老师',Object.values(p.talk).some(t=>t.prep)],['◇ 游戏发现者',Object.keys(p.games).length>0],['⚑ 六周同行者',p.completed.length===12]];return `<div class="badges">${list.map(([name,done])=>`<span class="badge-item ${done?'':'locked'}">${name}${done?' · 已点亮':' · 待探索'}</span>`).join('')}</div>`;}
function courses(){return title(teacher?'课程与教案':'六周探险地图',teacher?'12节课程已备好，可直接查看讲解、教案、练习与游戏，无需先添加学生。':'每周二、周四见。每一站，都有属于你的讲台。')+`<section class="panel">${mapView()}</section><div class="course-grid">${LESSONS.map((l,i)=>`<article class="course"><div class="course-top"><span>第 ${String(i+1).padStart(2,'0')} 站</span><span>${dateOf(i)}</span></div><div class="course-body"><span class="tag">${pupil()?.completed.includes(i)?'✓ 已完成':[0,10].includes(i)?'含45分钟测评':'120分钟'}</span><h2>${l.title}</h2><p>${l.goal}</p>${teacher?teachingLink(i):courseButton(i)}${teacher?`<div class="controls">${button('查看教师教案','guide-open','secondary',`data-id="${i}"`)}</div>`:''}</div></article>`).join('')}</div>`;}
function reminders(p){const out=[];for(const k of ['A','B'])if(p.assignments[k]&&!p.exams[k])out.push(`${k}卷${p.drafts[k]?'作答中':'待完成'}`);const wrong=Object.values(p.practice).filter(x=>!x.correct).length;if(wrong)out.push(`${wrong}道待复习`);if(Object.values(p.talk).some(x=>x.level==='需要重新学习'))out.push('讲课需要再练');return out;}
function dashboard(){const ps=overview.students;return title('班级工作台','先看整体进度，再定位需要辅导的学生和题目。',button('创建学生账号','create-student'))+`<div class="controls dashboard-actions">${button('布置班级测评','assign-class','secondary')}<a href="#homework">变式作业与训练效果 →</a>${button('班级与资源','teacher-open','quiet')}</div>${examAnalysisPanel()}<details class="panel dashboard-fold"><summary>学生管理与课堂记录</summary><section class="panel"><div class="section-head"><h2>学生学习一览</h2>${button('导出学习记录','export','quiet')}</div><div class="toolbar"><label class="sr-only" for="student-search">搜索学生</label><input id="student-search" placeholder="搜索学生姓名或账号"><label class="sr-only" for="class-filter">筛选班级</label><select id="class-filter"><option value="">全部班级</option>${overview.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div id="student-table">${studentTable(ps)}</div></section></details><details class="panel dashboard-fold" ${ps.length?'':'open'}><summary>新教师上课指南</summary>${teacherStarter()}</details>`;}
function studentTable(ps){return ps.length?`<div class="table-wrap"><table><thead><tr><th>学生 / 班级</th><th>课程进度</th><th>前测 / 后测</th><th>独立练习</th><th>需要关注</th><th>操作</th></tr></thead><tbody>${ps.map(p=>`<tr><td><a class="student-link" href="#student/${p.id}">${esc(p.name)}</a><small>${esc(p.username)} · ${esc(p.className)}</small><span class="tag ${p.accountDisabled?'orange':''}">${p.accountDisabled?'已停用':'正常使用'}</span></td><td>${p.completed.length} / 12节</td><td>${p.exams.A?.score??'—'} / ${p.exams.B?.score??'—'}<small>每卷满分120分</small></td><td>${Object.keys(p.practice).length} / 36题</td><td>${reminders(p).map(x=>`<span class="tag orange">${x}</span>`).join(' ')||'<small>暂无待办</small>'}</td><td>${button('看成长档案','view-student','secondary',`data-student="${p.id}"`)}${studentAdminButtons(p)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><strong>还没有学生记录</strong>创建学生账号后，学习情况会显示在这里。</div>';}
function examsPage(embedded=false){const p=pupil();return (teacher?'<p class="notice">前测A卷已换为同难度新题。教师答案与打印学生卷对应当前新卷；已开始或已提交的测评保留原题，请从该生答题报告查看原卷解析。</p>':'')+(embedded?'<h2>测评挑战</h2>':title(teacher?`${esc(p.name)}的测评`:'测评挑战','两次独立作答，看看六周里发生了什么变化。'))+`<div class="notice">每卷20道填空题，每题6分，总分120分。45分钟。可以打草稿，不使用计算器、AI或老师提示。</div><div class="grid-two">${['A','B'].map(k=>{const e=p.exams[k],d=p.drafts[k];return `<section class="panel"><span class="tag">${k==='A'?'认识起点':'看见成长'}</span><h2>${k==='A'?'前测 A 卷':'后测 B 卷'}</h2><p>20题 · 120分 · 45分钟</p>${e?`<p class="game-number">${e.score} <small>/ 120分</small></p><p class="tiny">${new Date(e.date).toLocaleString('zh-CN')}</p>${teacher||e.released?button('查看答题与解析','exam-review','',`data-kind="${k}"`):'<p class="muted">已交卷。错题和解析将在老师开放讲评后显示。</p>'}`:teacher?`<p>${d?'学生正在作答':p.assignments[k]?'已布置，等待学生开始':'尚未布置'}</p>${!d?button(p.assignments[k]?'撤回未开始任务':'布置给这位学生','assign-student','secondary',`data-kind="${k}" data-enabled="${!p.assignments[k]}"`):''}`:p.assignments[k]||d?button(d?'继续作答 →':'查看考试说明 →','exam-open','',`data-kind="${k}"`):'<div class="empty">等老师布置后，就可以开始啦。</div>'}${teacher?`<div class="controls">${button('教师答案','exam-key','quiet',`data-kind="${k}"`)}${button('打印学生卷','print-exam','quiet',`data-kind="${k}"`)}</div>`:''}</section>`;}).join('')}</div>${historyPanel()}`;}
function historyPanel(){if(!teacher||!pupil().history.length)return '';return `<section class="panel"><h2>迁入的历史测评</h2><p class="tiny">保留原卷版本，不替代在线前后测，也不与在线成绩混算。</p>${pupil().history.map((h,i)=>`<div class="lesson-row"><div class="grow"><h3>${h.kind}卷 · ${h.record.version==='v1'?'第一版':'第二版'}</h3><small>${esc(h.record.date)} · ${h.record.score}/120分</small></div>${button('查看原卷','history','secondary',`data-index="${i}"`)}</div>`).join('')}</section>`;}
function examIntro(k){return title(`${k==='A'?'前测 A':'后测 B'} 卷`,'一次独立尝试，帮助老师更了解你。')+`<section class="panel account-panel"><span class="tag">20题 / 120分</span><h2>准备好再开始</h2><ol><li>准备白纸和笔，可以写草稿。</li><li>开始后连续计时45分钟，离开页面也会继续。</li><li>答案只填结果；不会的题可以暂时跳过。</li><li>以“已保存到服务器”提示为准，断网时请及时重连。</li><li>交卷后无法修改；老师开放讲评后可看解析。</li></ol>${button(previewStudentId?'预览答题页面（不计时）':'准备好了，开始计时','exam-start','',`data-kind="${k}"`)}</section>`;}
function examView(){const {record:r,questions:qs}=examSession;return title(`${r.kind}卷 · 独立测评`,'可以打草稿，按照自己的节奏思考。')+`<div class="exam-layout"><section class="panel">${qs.map((q,i)=>`<div class="question" id="q${i}"><label class="qtext" for="e${i}"><b>${i+1}.</b> ${q.text} <small>（6分）</small></label>${q.svg||''}<input id="e${i}" data-exam-answer="${i}" aria-label="第${i+1}题答案" value="${esc(r.answers[i])}" maxlength="100" autocomplete="off"></div>`).join('')}</section><aside class="panel exam-side"><small>剩余时间</small><div class="timer" id="exam-time">${previewStudentId?'预览':'45:00'}</div><small id="answered-count"></small><div class="numbers">${qs.map((_,i)=>`<a href="#q${i}" data-scroll="q${i}" id="num${i}" class="${r.answers[i]?'done':''}">${i+1}</a>`).join('')}</div>${button('提交试卷','exam-submit')}${button('重试保存','retry-save','quiet')}<p class="tiny">离开页面，计时仍继续。请留意页面顶部的保存提示。</p></aside></div>`;}
function reviewPage(data,label=''){const r=data.record,qs=data.questions;if(!r.correct)return title('试卷已提交','成绩已保存，讲评等待老师开放。')+`<section class="panel"><h2>${r.score} / 120分</h2></section>`;return title(`${label||r.kind+'卷答题报告'} · ${r.score}/120分`,`${r.correct.filter(Boolean).length}题正确。看看哪些方法已经掌握，哪些还需要再试。`)+`<section class="panel">${teacher&&!label?button(r.released?'收起学生端讲评':'向学生开放讲评','release','secondary',`data-kind="${r.kind}" data-released="${!r.released}"`):''}${qs.map((q,i)=>`<div class="question"><p><b>${i+1}.</b> ${q.text}</p>${q.svg||''}<p>学生答案：${esc(r.answers[i]||'未作答')} <span class="tag ${r.correct[i]?'':'orange'}">${r.correct[i]?'正确 · 6分':'未答对 · 0分'}</span></p><div class="answer"><b>正确答案：${esc(q.answer)}</b><br>${esc(q.explain)}</div></div>`).join('')}</section>`;}
function report(){const p=pupil(),a=p.exams.A,b=p.exams.B,practice=Object.values(p.practice);return title(`${teacher?esc(p.name)+'的':'我的'}成长足迹`,'分数是一部分，怎样思考、怎样表达，同样值得记录。',teacher?button('重置学生密码','reset-password','quiet'):'')+stats([['前测成绩',a?.score??'—','/120'],['后测成绩',b?.score??'—','/120'],['分数变化',a&&b?(b.score-a.score>0?'+':'')+(b.score-a.score):'—','分'],['课堂完成',p.completed.length,'/12']])+`<div class="grid-two"><section class="panel"><h2>前后测对照</h2>${a||b?`<div class="report-bars">${[['前测',a],['后测',b]].map(([label,e])=>`<div class="report-bar" style="height:${e?Math.max(2,e.score/120*150):2}px"><strong>${e?.score??'未测'}</strong><span>${label}</span></div>`).join('')}</div>`:'<div class="empty">完成起点测评后，第一份成长记录就会出现。</div>'}<p class="tiny">两卷是教学诊断卷，单次分数用于调整教学，不直接预测比赛成绩。</p><div class="controls">${button('查看测评记录','exams-open','secondary')}</div></section><section class="panel"><h2>练习与表达</h2><p>已尝试 <b>${practice.length}</b> 道练习；<b>${practice.filter(x=>!x.correct).length}</b> 道仍需复习。</p><p>有 <b>${Object.values(p.talk).filter(x=>x.prep).length}</b> 次讲课准备，<b>${Object.values(p.talk).filter(x=>x.level==='独立讲清').length}</b> 次被老师记录为“独立讲清”。</p>${badges(p)}</section></div><section class="panel"><h2>每一节课的小进步</h2><div class="table-wrap"><table><thead><tr><th>课程</th><th>独立练习</th><th>学生讲课</th>${teacher?'<th>教师记录</th>':''}<th>详情</th></tr></thead><tbody>${LESSONS.map((l,i)=>{const entries=[0,1,2].map(j=>p.practice[i+'-'+j]).filter(Boolean);return `<tr><td>${i+1}. ${l.title.split(' · ')[0]}</td><td>${entries.length}/3道已尝试<small>${entries.filter(x=>!x.correct).length}道待复习 · ${entries.reduce((sum,x)=>sum+x.attempts,0)}次作答</small></td><td>${esc(p.talk[i]?.level||'尚未评价')}</td>${teacher?`<td>${esc(p.notes[i]||'—')}</td>`:''}<td>${button('进入课堂','lesson','quiet',`data-id="${i}"`)}</td></tr>`;}).join('')}</tbody></table></div></section>${warmupRecordPanel(p)}${topicTable(p)}${practiceDetails(p)}${variantPracticeDetails(p)}${oldPracticePanel(p)}${historyPanel()}`;}
function teacherPage(){return title('班级与教学资源','管理账号、安排课程，把课堂准备集中在这里。')+`<div class="grid-two"><section class="panel"><h2>我的班级</h2>${overview.classes.map(c=>`<div class="lesson-row"><div class="grow"><h3>${esc(c.name)}</h3><small>${overview.students.filter(p=>p.classId===c.id).length}位学生</small></div>${button('课程设置','class-settings','secondary',`data-class="${c.id}"`)}</div>`).join('')}<div class="controls">${button('新建班级','create-class')}${button('创建学生账号','create-student','secondary')}</div></section><section class="panel"><h2>学习记录</h2><p>在线记录保存在数据库，可导出教学资料；完整恢复使用服务器数据库备份。</p><div class="controls">${button('导出学习记录','export','secondary')}${button('导入旧版档案','import-open','quiet')}</div><p class="tiny">旧版导入先预览、再选择对应学生。演示档案不进入正式统计。</p></section></div><section class="panel"><h2>教学资源已就位</h2><p>12节详细教案 · 36道练习 · 40道测评题 · 每课互动动画</p><p class="muted">每课均含讲解视频、分步图文、可操作动画和小老师讲课提纲。直接进入课堂即可观看；班级课程设置中可选填自定义视频地址来替换默认视频。</p><a href="#courses">查看课程与教案 →</a></section>`;}
function topicTable(p){const topics=[...new Set([...Object.keys(p.exams.A?.topics||{}),...Object.keys(p.exams.B?.topics||{})])];if(!topics.length)return '';return `<section class="panel"><h2>知识点表现</h2><p class="tiny">仅依据本次试卷中的题目，帮助选择接下来的复习内容。</p><div class="table-wrap"><table><thead><tr><th>知识点</th><th>前测答对 / 题数</th><th>后测答对 / 题数</th></tr></thead><tbody>${topics.map(t=>`<tr><td>${esc(t)}</td>${['A','B'].map(k=>{const s=p.exams[k]?.topics?.[t];return `<td>${s?`${s.correct} / ${s.total}`:'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;}
function practiceDetails(p){if(!teacher||!Object.keys(p.practice).length)return '';return `<section class="panel"><h2>练习作答明细</h2><div class="table-wrap"><table><thead><tr><th>题目</th><th>首次表现</th><th>最近作答</th><th>尝试次数</th></tr></thead><tbody>${Object.entries(p.practice).map(([key,r])=>{const [l,j]=key.split('-').map(Number);return `<tr><td>第${l+1}课 · 第${j+1}题<small>${LESSONS[l].practice[j].text}</small></td><td>${r.firstCorrect===undefined?'旧版未记录':r.firstCorrect?'正确':'未答对'}</td><td>${esc(r.answer)} · ${r.correct?'正确':'需复习'}</td><td>${r.attempts}<small>${(r.submissions||[]).map(x=>`${esc(x.answer)}（${x.correct?'对':'错'}）`).join(' → ')}</small></td></tr>`;}).join('')}</tbody></table></div></section>`;}
function passwordView(){const account=previewStudentId?pupil():user;return title(account.mustChange?'先给账号换一个新密码':'账号设置',account.mustChange?'首次登录需要修改初始密码，完成后即可开始。':'修改后，其他设备上的旧登录会失效。')+`<form id="password-form" class="panel account-panel"><p>当前账号：<b>${esc(account.username)}</b> · ${teacher?'教师':'学生'}</p><div class="field"><label for="current-password">当前密码</label><input type="password" id="current-password" autocomplete="current-password" required></div><div class="field"><label for="new-password">新密码（至少${teacher?10:6}位）</label><input type="password" id="new-password" autocomplete="new-password" minlength="${teacher?10:6}" maxlength="128" required></div><div class="field"><label for="confirm-password">再次输入新密码</label><input type="password" id="confirm-password" autocomplete="new-password" required></div><p id="form-error" class="form-error" role="alert"></p><button type="submit">保存新密码</button></form>`;}
function syncStudentPreviewShell(){
 const toggle=document.getElementById('student-preview-toggle'),banner=document.getElementById('student-preview-banner');
 if(!toggle||!banner)return;
 toggle.hidden=user?.role!=='teacher';toggle.disabled=!previewStudentId&&!overview.students.length;
 toggle.textContent=previewStudentId?'返回教师端':'预览学生模式';
 banner.hidden=true;banner.innerHTML='';
 if(previewStudentId){
  const p=pupil();
  document.getElementById('identity').textContent=`学生 · ${p?.name||'正在载入'}`;
 }
}
async function toggleStudentPreview(id){
 if(user?.role!=='teacher')return;
 const entering=!!id||!previewStudentId;
 const target=entering?(id||state.current):null;
 if(entering&&!overview.students.some(p=>p.id===target)){toast('请先选择一位学生。');return;}
 if(entering&&!previewStudentId)previewReturnHash=location.hash||'#home';
 previewStudentId=target;previewExamKind=null;teacher=!target;
 if(target)state.current=target;
 // 切换视角时清除试卷和缓存，防止上一名学生或教师解析残留。
 examSession=null;clearTimeout(saveTimer);clearInterval(examTimer);status('');
 learningData.reset();renderSerial++;dialog.close();projecting=false;
 document.body.classList.remove('classroom-projection');
 main.innerHTML='<p class="loading">正在切换视角…</p>';shell();
 const next=entering?'#home':previewReturnHash;
 if(location.hash!==next)location.hash=next;else await render({fresh:true});
}
async function render(options={}){
 const serial=++renderSerial;if(!user)return loginView();
 try{
  clearTimeout(saveTimer);if(examSession?.dirty)await saveAnswers();
  if(serial!==renderSerial)return;stopPlayer();stopLab();clearInterval(examTimer);
  document.body.classList.remove('auth-page');const parts=location.hash.slice(1).split('/');route=parts[0]||'home';
  if(user.mustChange){shell();main.innerHTML=passwordView();return;}
  if(!teacher&&['exams','ai-practice'].includes(route)){location.hash=route==='exams'?'practice/exams':'practice/ai';return;}
  if(!teacher&&route==='practice'&&['work','ai','wrong','exams','homework'].includes(parts[1]))practiceTab=parts[1];
  if(route==='student'&&teacher){state.current=parts[1];route='report';}
  await loadData({fresh:options.fresh===true});if(serial!==renderSerial)return;shell();
  if(route==='account')main.innerHTML=passwordView();
  else if(teacher&&!pupil()&&!['home','teacher','courses','lesson','games','game','world3d','ai-practice','ai-settings','homework'].includes(route)){main.innerHTML=title('先创建一位学生','创建账号后即可查看课程进度、布置测评并记录课堂表现。')+button('创建学生账号','create-student');}
  else if(route==='home')main.innerHTML=teacher?dashboard():home();
  else if(route==='homework'&&teacher){main.innerHTML=homeworkUI.page(parts[1]||'');void homeworkUI.load();}
  else if(route==='courses')main.innerHTML=courses();
  else if(route==='lesson'){lessonId=Math.max(0,Math.min(11,Number(parts[1])||0));if(!teacher&&practiceCourse!==lessonId)startPracticeLesson(lessonId);lessonTab=['learn','talk','game','work',...(teacher?['guide','teach']:[])].includes(parts[2])?parts[2]:'learn';slide=0;teachingStep=Math.max(0,Math.min(6,Number(parts[3])||0));if(lessonTab!=='teach'||teachingStep===6)projecting=false;main.innerHTML=lesson();if(lessonTab==='game')drawGame();}
  else if(route==='exams')main.innerHTML=examsPage();
  else if(route==='exam'&&['A','B'].includes(parts[1])){
   const k=parts[1];if(pupil().exams[k])main.innerHTML=reviewPage(await api(`/api/students/${pupil().id}/exams/${k}`));
   else if(teacher)main.innerHTML=examsPage();
   else if(pupil().drafts[k]||(previewStudentId&&previewExamKind===k)){const data=await api(`/api/students/${pupil().id}/exams/${k}${previewStudentId?'?previewPaper=1':''}`);serverOffset=data.serverTime-Date.now();if(data.record.date){examSession=null;main.innerHTML=reviewPage(data);}else{examSession={...data,studentId:pupil().id,dirty:false,edit:0};main.innerHTML=examView();if(previewStudentId)status('预览试卷 · 不计时、不交卷');else{status('已保存到服务器');examTick();examTimer=setInterval(examTick,1000);}}}
   else main.innerHTML=examIntro(k);
  }
  else if(route==='review'&&['A','B'].includes(parts[1]))main.innerHTML=reviewPage(await api(`/api/students/${pupil().id}/exams/${parts[1]}`));
  else if(route==='report')main.innerHTML=report();
  else if(route==='practice')main.innerHTML=practicePage();
  else if(route==='ai-practice'){main.innerHTML=aiPracticePage();void loadAiPractice();}
  else if(route==='ai-settings'&&teacher){main.innerHTML=aiSettingsPage();void loadAiSettings();}
  else if(route==='games')main.innerHTML=gamesPage();
  else if(route==='world3d')main.innerHTML=gameWorldPage(parts[1]);
  else if(route==='game'&&GAME_META[parts[1]]){main.innerHTML=title(GAME_META[parts[1]][0],GAME_META[parts[1]][1])+gameView(parts[1]);drawGame();}
  else if(route==='teacher'&&teacher)main.innerHTML=teacherPage()+`<section class="panel"><span class="tag">教师专属配置</span><h2>AI 引导练习</h2><p>保存接口密钥后，所属学生就能生成新题、获取逐步提示。只提供解题引导，不展示标准答案。</p><div class="controls"><a href="#ai-settings">配置 AI 接口 →</a><a href="#ai-practice">试用与查看学生记录 →</a></div></section>`;
  else main.innerHTML=teacher?dashboard():home();
  if(!teacher&&(route==='practice'||route==='lesson'&&lessonTab==='work')&&practiceTab==='ai'&&document.getElementById('ai-practice-page'))void loadAiPractice();
  if(!teacher&&(route==='practice'||route==='lesson'&&lessonTab==='work')&&practiceTab==='wrong')void loadExamWrongQuestions();
  if(!teacher&&['exam','review'].includes(route))main.innerHTML='<p><a href="#practice/exams">← 返回练习与错题 · 测评挑战</a></p>'+main.innerHTML;
  if(!teacher&&document.getElementById('homework-page'))void homeworkUI.load();
  if(route==='home'&&teacher)void loadExamAnalysis();
  if(route!=='lesson'||lessonTab!=='teach')projecting=false;document.body.classList.toggle('classroom-projection',projecting);main.focus({preventScroll:true});if(['lesson','home','courses'].includes(route))window.scrollTo?.(0,0);
 }catch(err){if(serial!==renderSerial||err.obsolete)return;if(err.status===401){learningData.reset();previewStudentId=null;previewExamKind=null;user=null;csrf='';teacher=false;overview={classes:[],students:[]};state.students=[];state.current=null;loginView();toast('登录已过期，请重新登录。');}else{toast(err.message);if(!main.innerHTML||main.querySelector('.loading'))main.innerHTML=`<section class="panel"><h2>暂时没能加载</h2><p>${esc(err.message)}</p>${button('重新加载','reload')}</section>`;}}
}
async function saveAnswers(){
 if(previewStudentId)return;
 if(savePromise){await savePromise;if(examSession?.dirty)return saveAnswers();return;}
 const session=examSession;if(!session?.dirty)return;if(session.conflict)throw new Error('请先处理另一页面的答案更新。');
 const edit=session.edit,answers=[...session.record.answers];status('保存中…');
 savePromise=(async()=>{try{const result=await api(`/api/students/${session.studentId}/exams/${session.record.kind}/answers`,{method:'PUT',body:{answers,revision:session.record.revision}});session.record.revision=result.record.revision;if(session.edit===edit)session.dirty=false;status(session.dirty?'保存中…':'已保存到服务器');}catch(err){status('保存失败，请重试',true);if(err.data?.conflict){session.conflict=true;modal(`<h2>另一页面更新了答案</h2><p>为避免覆盖，这一页已暂停保存。请先把当前草稿记在纸上，再载入服务器的最新记录继续。</p>${button('载入最新记录','exam-reload')}`);}if(err.data?.expired){session.dirty=false;session.record=err.data.record;toast('时间已到，按服务器已保存的答案交卷。');location.hash='exams';}throw err;}finally{savePromise=null;}})();
 await savePromise;
}
function examTick(){if(previewStudentId)return;const s=examSession;if(!s||s.record.date)return;const left=Math.max(0,Math.ceil((s.record.deadline-Date.now()-serverOffset)/1000));const timer=document.getElementById('exam-time');if(timer)timer.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;const count=document.getElementById('answered-count');if(count)count.textContent=`已填写 ${s.record.answers.filter(x=>x.trim()).length}/20题`;if(!left&&!s.expiring){s.expiring=true;api(`/api/students/${s.studentId}/exams/${s.record.kind}/submit`,{method:'POST',body:{}}).then(()=>{s.dirty=false;examSession=null;status('试卷已交卷');location.hash='exams';}).catch(err=>{s.expiring=false;status('连接中断，服务器仍按时截止',true);});}}
async function startSession(){try{const data=await api('/api/me');user=data.user;csrf=data.csrf;teacher=user.role==='teacher';await render();}catch(err){if(err.status===401){user=null;loginView();}else{main.innerHTML=`<section class="panel"><h1>学习空间暂时连接不上</h1><p>请确认在线服务已启动，再试一次。</p>${button('重新连接','connect')}</section>`;}}}
document.addEventListener('submit',async event=>{
 const form=event.target;if(!['login-form','password-form','student-form','class-form','reset-form','student-admin-form'].includes(form.id))return;event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
 try{
  if(form.id==='login-form'){const data=await api('/api/login',{method:'POST',body:{username:document.getElementById('login-user').value,password:document.getElementById('login-pass').value}});learningData.reset();user=data.user;csrf=data.csrf;teacher=user.role==='teacher';state.current=null;location.hash='home';await render();}
  if(form.id==='password-form'){const password=document.getElementById('new-password').value;if(password!==document.getElementById('confirm-password').value)throw new Error('两次新密码不一致。');await api('/api/password',{method:'POST',body:{current:document.getElementById('current-password').value,password}});user.mustChange=false;toast('密码已更新。');location.hash='home';await render();}
  if(form.id==='student-admin-form')await saveStudentAdmin(form);
  if(form.id==='student-form'){await api('/api/teacher/students',{method:'POST',body:{name:form.elements.name.value,username:form.elements.username.value,password:form.elements.password.value,classId:form.elements.classId.value}});dialog.close();toast('学生账号已创建。请把账号和初始密码交给学生。');await render();}
  if(form.id==='class-form'){await api('/api/teacher/classes',{method:'POST',body:{name:form.elements.name.value}});dialog.close();await render();}
  if(form.id==='reset-form'){await api('/api/teacher/students/'+pupil().id+'/reset-password',{method:'POST',body:{password:form.elements.password.value}});dialog.close();toast('密码已重置。学生下次登录需要修改初始密码。');}
 }catch(err){const box=form.querySelector('.form-error');if(box)box.textContent=err.message;else toast(err.message);}finally{submit.disabled=false;}
});
document.addEventListener('click',async event=>{
 const scroll=event.target.closest('[data-scroll]');if(scroll){event.preventDefault();document.getElementById(scroll.dataset.scroll)?.scrollIntoView({behavior:'smooth'});return;}
 const game=event.target.closest('[data-game]');if(game){gameAction(game.dataset.game,game);return;}
 const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,k=b.dataset.kind,i=Number(b.dataset.id);b.disabled=true;
 try{
  if(action==='student-preview'){await toggleStudentPreview(b.dataset.student);return;}
  if(previewStudentId&&['exam-submit','exam-confirm','retry-save','talk-save','complete','note-save','finish-save'].includes(action)){toast('预览不会保存或提交学生记录；可返回教师模式进行管理。');return;}
  if(action==='finish-save'){await saveClassroomRecord();} if(action==='projection'){projecting=!projecting;document.body.classList.toggle('classroom-projection',projecting);b.textContent=projecting?'退出投屏展示':'投屏展示';}
  if(action==='connect')await startSession();if(action==='reload')await render({fresh:true});
  if(action==='video-seek'){
   const video=document.getElementById('lesson-video'),time=Number(b.dataset.time);
   if(video&&Number.isFinite(time)&&time>=0){
    if(video.readyState<1)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clean();reject(new Error('视频还没有加载完成，请稍后再选章节。'));},10000);const clean=()=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',ready);video.removeEventListener('error',failed);};const ready=()=>{clean();resolve();};const failed=()=>{clean();reject(new Error('视频加载失败，请检查网络后重试。'));};video.addEventListener('loadedmetadata',ready,{once:true});video.addEventListener('error',failed,{once:true});video.load();});
    if(video.isConnected){video.currentTime=Math.min(time,Math.max(0,video.duration-.1));video.scrollIntoView({behavior:'smooth',block:'center'});await video.play().catch(()=>toast('已定位到章节，点击视频播放按钮即可观看。'));}
   }
  }
  if(action==='guide-open')location.hash=`lesson/${i}/guide`;if(action==='lesson')location.hash=`lesson/${i}/learn`;if(action==='talk-open')location.hash=`lesson/${i}/talk`;if(action==='work-open'){startPracticeLesson(i);location.hash=`lesson/${i}/work`;}if(action==='lesson-tab'){if(b.dataset.tab==='work')startPracticeLesson(lessonId);location.hash=`lesson/${lessonId}/${b.dataset.tab}`;}
  if(action==='teacher-open')location.hash='teacher';if(action==='exams-open')location.hash='exams';if(action==='view-student')location.hash='student/'+b.dataset.student;
  if(action==='slide-prev'||action==='slide-next'){stopPlayer();slide=Math.max(0,Math.min(LESSONS[lessonId].steps.length-1,slide+(action==='slide-next'?1:-1)));document.getElementById('stage').innerHTML=stageView();document.getElementById('slide-count').textContent=`${slide+1} / ${LESSONS[lessonId].steps.length}`;}
  if(action==='slide-play'){if(playTimer)stopPlayer();else{b.textContent='暂停播放';playTimer=setInterval(()=>{slide=(slide+1)%LESSONS[lessonId].steps.length;document.getElementById('stage').innerHTML=stageView();document.getElementById('slide-count').textContent=`${slide+1} / ${LESSONS[lessonId].steps.length}`;},12000);}}
  if(action==='warmup-check'){
   const q=Number(b.dataset.q),answer=document.getElementById('warmup-answer-'+q)?.value||'',reason=document.getElementById('warmup-reason-'+q)?.value||'',feedback=document.getElementById('warmup-feedback'),student=pupil(),warmup=LESSONS[lessonId].warmup;
   if(!answer.trim()){if(feedback)feedback.textContent='先写下你的判断或计算结果。';return;}
   if(warmup.questions[q].kind==='reason'&&reason.trim().length<4){if(feedback)feedback.textContent='再用一句话写出你的理由，然后检查。';return;}
   const result=await api(`/api/students/${student.id}/warmups/${lessonId}/${q}`,{method:'POST',body:{answer,reason,version:warmup.version}});
   if(!result.preview)student.warmups={...(student.warmups||{}),[lessonId]:result.warmup};
   if(!b.isConnected||pupil()?.id!==student.id)return;
   if(result.correct){
    if(result.preview){if(feedback){feedback.textContent='预览试做正确，不会记录学生成绩。';feedback.className='warmup-feedback';}return;}
    const panel=document.getElementById('lesson-warmup');if(panel)panel.outerHTML=lessonWarmupPanel();
    toast(result.completed?'三题热身完成，刷新后不会再次出现。':'答对了，继续下一题。');
   }else if(feedback){feedback.textContent=`${warmup.questions[q].hint}（已记录第${result.attempts}次尝试）`;feedback.className='warmup-feedback is-hint';}
  }
  if(action==='complete'){await api(`/api/students/${pupil().id}/lessons/${lessonId}`,{method:'PUT',body:{completed:!pupil().completed.includes(lessonId)}});await render();}
  if(action==='talk-save'){const body=teacher?{level:document.getElementById('talk-level').value}:{prep:document.getElementById('talk-notes').value};await api(`/api/students/${pupil().id}/lessons/${lessonId}`,{method:'PUT',body});if(teacher){pupil().talk[lessonId]={...pupil().talk[lessonId],...body};}toast(teacher?`${pupil().name}的讲课评价已保存。`:'讲课准备已保存。');}
  if(action==='note-save'){await api(`/api/students/${pupil().id}/lessons/${lessonId}`,{method:'PUT',body:{note:document.getElementById('lesson-note').value}});toast(`${pupil().name}的课堂记录已保存。`);}
  if(action==='practice-check'){
   if(teacher){toast('请在教师教案查看答案，学生登录后才能提交练习。');return;}
   const j=Number(b.dataset.q),key=i+'-'+j,student=pupil(),answer=document.getElementById('p-'+key).value;
   if(!answer.trim()){toast('先填写你的答案，再检查。');return;}
   const result=await api(`/api/students/${student.id}/practice/${i}/${j}`,{method:'POST',body:{answer,version:LESSONS[i].practice[j].version||'v1'}});
   if(!result.preview)student.practice[key]=result;
   // 切题或切换预览学生后，迟到的反馈不得写进新的题目。
   if(!b.isConnected||pupil()?.id!==student.id)return;
   document.querySelector('#practice-'+key+' .practice-feedback').innerHTML=`<div class="answer ${result.correct?'':'wrong'}">${result.correct?'✓ 答对啦！'+esc(result.explain):'还没有答对。试着画图或回看方法，再做一次。'}<br><small>${result.preview?'预览试做，不记录成绩':`已记录第${result.attempts}次尝试`}</small></div>`;refreshPracticeProgress();
  }
  if(action==='exam-open')location.hash='exam/'+k;if(action==='exam-review')location.hash='review/'+k;
  if(action==='exam-start'){if(previewStudentId){previewExamKind=k;await render();return;}await api(`/api/students/${pupil().id}/exams/${k}/start`,{method:'POST',body:{}});await render();}
  if(action==='exam-submit'){await saveAnswers();modal(`<h2>确认提交试卷</h2><p>已填写 ${examSession.record.answers.filter(x=>x.trim()).length}/20题。交卷后不能修改本次答案。</p>${button('确认交卷','exam-confirm')}`);}
  if(action==='exam-confirm'){await saveAnswers();await api(`/api/students/${examSession.studentId}/exams/${examSession.record.kind}/submit`,{method:'POST',body:{}});examSession=null;dialog.close();status('试卷已交卷');location.hash='exams';}
  if(action==='retry-save'){await saveAnswers();toast('答案已保存。');}
  if(action==='exam-reload'){examSession=null;dialog.close();await render();}
  if(action==='release'){await api(`/api/students/${pupil().id}/exams/${k}/release`,{method:'POST',body:{released:b.dataset.released==='true'}});await render();}
  if(action==='assign-student'){await api('/api/teacher/assign',{method:'POST',body:{studentId:pupil().id,kind:k,enabled:b.dataset.enabled==='true'}});await render();}
  if(action==='exam-key'||action==='print-exam'){const qs=await api('/api/teacher/keys/'+k);if(action==='exam-key')modal(`<h2>${k}卷教师答案</h2>${qs.map((q,j)=>`<p><b>${j+1}. ${esc(q.answer)}</b><br>${esc(q.explain)}</p>`).join('')}`);else{main.innerHTML=title(`${k}卷 · 学生试卷`,'姓名：____________　日期：____________　20题 / 120分 / 45分钟',button('打印试卷','print'))+qs.map((q,j)=>`<div class="question"><p>${j+1}. ${q.text}</p>${q.svg||''}<p>答案：________________</p></div>`).join('');}}
  if(action==='print')window.print();if(action==='print-practice'){main.innerHTML=title('课堂练习卷',LESSONS[lessonId].title,button('打印','print'))+motherProblem(LESSONS[lessonId])+variantsView(LESSONS[lessonId],{answers:false})+LESSONS[lessonId].practice.map((q,j)=>`<div class="question"><p>${j+1}. ${q.text}</p>${q.svg||''}<p>答案：____________</p></div>`).join('');}
  if(action==='history'){const data=await api(`/api/teacher/students/${pupil().id}/history/${b.dataset.index}`);data.record.kind=data.kind;main.innerHTML=reviewPage(data,`${data.kind}卷历史记录（${data.record.version}）`);}
  if(action==='game-open')location.hash='game/'+b.dataset.gameType;
  if(['student-edit','student-status','student-delete'].includes(action))openStudentAdmin(action,b.dataset.student);
  if(action==='create-student')modal(studentForm());
  if(action==='create-class')modal(`<h2>新建班级</h2><form id="class-form"><div class="field"><label for="class-name">班级名称</label><input id="class-name" name="name" maxlength="60" required></div><p class="form-error" role="alert"></p><button type="submit">创建班级</button></form>`);
  if(action==='reset-password')modal(`<h2>重置${esc(pupil().name)}的密码</h2><p>重置后，学生原有登录会失效，学习记录保留。</p><form id="reset-form"><div class="field"><label for="reset-pass">新的初始密码（至少6位）</label><input id="reset-pass" name="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required></div><p class="form-error" role="alert"></p><button type="submit">确认重置</button></form>`);
  if(action==='assign-class')modal(`<h2>布置班级测评</h2><p>学生点击“开始”时计时，已提交的成绩不会被覆盖。</p><div class="field"><label for="assign-class">选择班级</label><select id="assign-class">${overview.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="controls">${button('布置前测 A 卷','assign-confirm','','data-kind="A"')}${button('布置后测 B 卷','assign-confirm','secondary','data-kind="B"')}</div>`);
  if(action==='assign-confirm'){await api('/api/teacher/assign',{method:'POST',body:{classId:document.getElementById('assign-class').value,kind:k,enabled:true}});dialog.close();toast('测评已布置，学生登录后可开始。');await render();}
  if(action==='class-settings')showSettings(b.dataset.class);
  if(action==='settings-save'){const dates={},videos={};for(let j=0;j<12;j++){dates[j]=document.getElementById('date-'+j).value;videos[j]=document.getElementById('video-'+j).value.trim();}await api('/api/teacher/classes/'+b.dataset.class+'/settings',{method:'PUT',body:{dates,videos}});toast('课程设置已保存。');await loadData();}
  if(action==='export'){const data=await api('/api/teacher/export');download('思维实验室-在线学习记录.json',JSON.stringify(data,null,2));}
  if(action==='import-open')showImport();
  if(action==='import-preview'){const source=importSource.students[Number(document.getElementById('import-source').value)];importPreview=await api('/api/teacher/import/preview',{method:'POST',body:{student:source}});document.getElementById('import-result').innerHTML=`<p><b>来源学生：${esc(importPreview.name)}</b></p><p>完成${importPreview.completed}课，${importPreview.practice}道练习，${importPreview.exams.length}份历史测评。</p><p>${importPreview.exams.map(x=>`${x.kind}卷 ${x.version} · ${x.score}/120分`).join('；')}</p><label for="import-target">导入到在线学生</label><select id="import-target">${overview.students.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.username)}</option>`).join('')}</select><p class="tiny">已有在线记录优先保留；旧测评存入历史。旧版正在作答的草稿不迁移。</p>${button('确认对应关系并导入','import-confirm')}`;}
  if(action==='import-confirm'){await api('/api/teacher/students/'+document.getElementById('import-target').value+'/import',{method:'POST',body:{student:importSource.students[Number(document.getElementById('import-source').value)],fingerprint:importPreview.fingerprint}});dialog.close();toast('历史档案已导入。');await render();}
 }catch(err){toast(err.message);}finally{b.disabled=false;}
});
function studentForm(){return `<h2>创建学生账号</h2><p>账号用于登录，昵称用于课堂展示。学生首次登录会修改初始密码。</p><form id="student-form" class="mini-form"><div><label for="new-name">学生姓名或昵称</label><input id="new-name" name="name" maxlength="40" required></div><div><label for="new-user">登录账号</label><input id="new-user" name="username" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}" autocomplete="off" required placeholder="例如：xiaoyu01"></div><div><label for="new-pass">初始密码（至少6位）</label><input id="new-pass" name="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></div><div><label for="new-class">所属班级</label><select id="new-class" name="classId">${overview.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><p class="form-error wide" role="alert"></p><button type="submit" class="wide">创建学生账号</button></form>`;}
function showSettings(id){const c=overview.classes.find(x=>x.id===id);main.innerHTML=title(esc(c.name)+' · 课程资源','设置授课日期；视频地址留空时，自动使用本课动画视频。填写直链可替换为班级自选视频。')+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>课程</th><th>授课日期</th><th>替换默认视频（选填）</th></tr></thead><tbody>${LESSONS.map((l,i)=>`<tr><td>${i+1}. ${l.title}</td><td><input type="date" id="date-${i}" aria-label="第${i+1}课日期" value="${esc(c.settings.dates[i]||l.date)}"></td><td><input type="url" id="video-${i}" aria-label="第${i+1}课视频地址" value="${esc(c.settings.videos[i]||'')}" placeholder="留空使用本课动画视频"></td></tr>`).join('')}</tbody></table></div><div class="controls">${button('保存课程设置','settings-save','',`data-class="${id}"`)}</div></section>`;}
function showImport(){importSource=null;importPreview=null;modal(`<h2>导入旧版学生档案</h2><p>请先在原本地版的教师中心导出JSON备份，再选择文件。</p><label for="import-file">旧版备份文件</label><input type="file" id="import-file" accept=".json,application/json"><div id="import-select"></div><div id="import-result"></div>`);}
document.addEventListener('input',event=>{
 const el=event.target;if(el.hasAttribute('data-exam-answer')&&examSession){const i=Number(el.dataset.examAnswer);examSession.record.answers[i]=el.value.slice(0,100);examSession.edit++;if(previewStudentId){status('预览输入，不保存学生答案');return;}examSession.dirty=true;status('等待保存…');document.getElementById('num'+i)?.classList.toggle('done',!!el.value.trim());clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveAnswers().catch(err=>toast(err.message)),400);}
 if(el.id==='student-search')filterStudents();
 if(el.id==='cycle-n'){gameState.n=Number(el.value);gameState.reveal=false;document.getElementById('cycle-label').textContent=el.value;document.querySelectorAll('.game-item').forEach(x=>x.classList.remove('on'));document.getElementById('game-feedback').textContent='';}
});
function filterStudents(){const query=document.getElementById('student-search').value.trim().toLowerCase(),classId=document.getElementById('class-filter').value;document.getElementById('student-table').innerHTML=studentTable(overview.students.filter(p=>(!classId||p.classId===classId)&&(!query||(p.name+' '+p.username).toLowerCase().includes(query))));}
document.addEventListener('change',async event=>{
 if(event.target.id==='class-filter')filterStudents();
 if(event.target.id==='student'){if(previewStudentId){await toggleStudentPreview(event.target.value);return;}state.current=event.target.value;if(location.hash.startsWith('#student/'))location.hash='student/'+state.current;else await render();}
 if(event.target.id==='import-file'){try{const f=event.target.files[0];if(!f||f.size>5*1024*1024)throw new Error('请选择5MB以内的JSON备份。');const data=JSON.parse(await f.text());if(data.version!==1||!Array.isArray(data.students))throw new Error('这不是旧版学习备份。');importSource=data;document.getElementById('import-select').innerHTML=`<div class="field"><label for="import-source">选择来源学生</label><select id="import-source">${data.students.map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div>${button('预览所选档案','import-preview','secondary')}`;document.getElementById('import-result').innerHTML='';}catch(err){toast(err.message);}}
 if(event.target.id==='import-source'){importPreview=null;document.getElementById('import-result').innerHTML='';}
});
document.getElementById('logout').addEventListener('click',async()=>{try{await saveAnswers();await api('/api/logout',{method:'POST',body:{}});clearInterval(examTimer);stopPlayer();examSession=null;classroomDrafts.clear();projecting=false;document.body.classList.remove('classroom-projection');learningData.reset();renderSerial++;previewStudentId=null;previewExamKind=null;user=null;csrf='';teacher=false;LESSONS=[];overview={classes:[],students:[]};state.students=[];state.current=null;status('');loginView();}catch(err){toast(err.message);}});
document.getElementById('refresh-data').addEventListener('click',async event=>{const b=event.currentTarget;b.disabled=true;status('正在刷新…');try{await render({fresh:true});status('');}finally{b.disabled=false;}});
document.getElementById('account-button').addEventListener('click',()=>location.hash='account');
window.addEventListener('hashchange',render);
window.addEventListener('beforeunload',e=>{if(examSession?.dirty||classroomDrafts.size){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(examSession?.dirty)saveAnswers().catch(err=>toast(err.message));});
window.addEventListener('offline',()=>status('网络已断开，请重连后保存',true));

document.addEventListener('error',event=>{if(event.target?.id==='lesson-video'){const message=document.getElementById('video-error');if(message)message.hidden=false;}},true);
startSession();

// 历史题保留当时的题干与作答，不参加新版练习完成度。
function oldPracticePanel(p){
 if(!teacher||!p.practiceHistory?.length)return '';
 return `<section class="panel"><h2>旧版练习记录</h2><p class="muted">课程换题前的作答保留在这里，不计入新版练习的完成度。首次表现和尝试次数按原题查看。</p>${p.practiceHistory.map(r=>{const [l,j]=r.key.split('-').map(Number);return `<details><summary>第${l+1}课 · 原第${j+1}题 · ${r.correct?'最近答对':'仍需复习'}</summary><p>${esc(r.question?.text||'旧版练习')}</p><p>首次：${r.firstCorrect===undefined?'未单独记录':r.firstCorrect?'正确':'未答对'}；最近作答：${esc(r.answer)}；尝试${r.attempts}次。</p><p>${(r.submissions||[]).map(v=>`${esc(v.answer)}（${v.correct?'对':'错'}）`).join(' → ')}</p></details>`;}).join('')}</section>`;
}
