/* 课堂按观察、验证、表达、独立应用递进；备课内容不依赖学生档案。 */
// 默认课程视频与班级自定义视频共用播放器；自定义视频不套用默认片的章节时间。
function courseVideoMeta(i){return typeof COURSE_VIDEOS==='undefined'?null:COURSE_VIDEOS.find(v=>v.lessonId===i);}
function videoTime(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function courseVideoPanel(){
 const meta=courseVideoMeta(lessonId),custom=safeVideo(state.videos[lessonId]||''),src=custom||meta?.src;
 if(!src)return '';
 if(!teacher&&meta?.afterAssessment&&!pupil()?.exams?.B)return `<section class="panel course-video"><span class="tag">后测之后再复盘</span><h2>本课讲解视频</h2><p>先独立完成并提交B卷，再观看这段视频，用新例题整理思路。</p><a href="#exams">前往测评中心 →</a></section>`;
 const builtIn=!custom,guide=teacher&&builtIn?LESSONS[lessonId].videoGuide:null;
 if(builtIn&&meta.examples?.length)return exampleVideoPanel(meta,guide);
 return `<section class="panel course-video" aria-label="本课讲解视频"><div class="section-head"><div><span class="tag">${builtIn?'多巴胺动画课堂':'班级教学视频'}</span><h2>${builtIn?esc(meta.title):'跟着视频学一遍'}</h2></div>${builtIn?`<span class="video-length">${videoTime(Math.round(meta.duration))} · 中文讲解</span>`:''}</div><p>先看完整例题，再跟随图形变化理解每一步。可以随时暂停，在草稿纸上尝试。</p>${meta?.afterAssessment?'<p class="notice">测后复盘：请安排在学生提交B卷以后播放。</p>':''}<video id="lesson-video" controls playsinline preload="metadata" ${builtIn?`poster="${esc(meta.poster)}"`:''} src="${esc(src)}" aria-label="第${lessonId+1}课讲解视频">${builtIn?`<track kind="subtitles" srclang="zh" label="中文字幕" src="${esc(meta.captions)}">`:''}当前浏览器不支持视频播放。</video><p id="video-error" class="notice" role="status" hidden>视频暂时未能加载，请检查网络后刷新页面，或使用下方链接打开。</p><div class="video-help"><p class="tiny">画面已配字幕；可使用播放器调整音量、倍速或全屏观看。</p><a href="${esc(src)}" target="_blank" rel="noopener">单独打开视频 ↗</a></div>${builtIn?`<details class="video-chapters" open><summary>选择讲解章节</summary><div class="chapter-buttons">${meta.chapters.map(c=>button(`<span>${videoTime(c.start)}</span> ${esc(c.title)}`,'video-seek','secondary',`data-time="${c.start}"`)).join('')}</div></details>`:''}${guide?`<details class="video-teacher-guide"><summary>教师用：视频末尾讲解题与参考答案</summary><p>${esc(guide.question)}</p><p><b>参考思路：</b>${esc(guide.answer)}</p><p class="tiny">学生准备上台时请收起此处，先听学生完整讲解。</p></details>`:''}</section>`;
}
// 例题各有自己的视频与章节，学生可直接选择当前正在学习的题。
function exampleVideoPanel(meta,guide){
 return `<section class="panel course-video" aria-label="本课讲解视频"><span class="tag">多巴胺动画课堂</span><h2>一道例题，一段讲解</h2><p>先选对应的例题，跟着动画理解，再回到题目自己讲一遍。</p>${meta.examples.map((part,i)=>{
  const id=i?'lesson-video-'+i:'lesson-video';
  return `<details class="example-video" ${i===0?'open':''}><summary>${esc(part.title)} · ${videoTime(Math.round(part.duration))}</summary><p>${esc(part.description)}</p><video id="${id}" controls playsinline preload="none" poster="${esc(part.poster)}" src="${esc(part.src)}" aria-label="${esc(part.title)}"><track kind="subtitles" srclang="zh" label="中文字幕" src="${esc(part.captions)}">当前浏览器不支持视频播放。</video><p id="${id}-error" class="notice" role="status" hidden>视频暂时未能加载，请刷新重试，或单独打开视频。</p><div class="chapter-buttons">${part.chapters.map(c=>button(`<span>${videoTime(c.start)}</span> ${esc(c.title)}`,'video-seek','secondary',`data-video="${id}" data-time="${c.start}"`)).join('')}</div><div class="video-help"><a href="${esc(part.src)}" target="_blank" rel="noopener">单独打开这道例题的视频 ↗</a></div></details>`;
 }).join('')}${guide?`<details class="video-teacher-guide"><summary>教师用：独立讲解题与参考答案</summary><p>两段例题看完后，可使用这道彩旗题安排学生独立讲解。</p><p>${esc(guide.question)}</p><p><b>参考思路：</b>${esc(guide.answer)}</p></details>`:''}</section>`;
}
function lessonRow(i){const l=LESSONS[i];return `<div class="lesson-row"><span class="lesson-num">${String(i+1).padStart(2,'0')}</span><div class="grow"><h3>${l.title}</h3><small>${dateOf(i)} · 120分钟 ${pupil()?.completed.includes(i)?'· 已完成':''}</small></div>${courseButton(i)}</div>`;}
// 所有课堂入口共用完整题干；题目与解题提示分开，先读题再看分析。
function motherCards(l){return l.detail.mother.cards||[l.detail.mother];}
function variantCards(l){return l.detail.variants.flatMap(v=>v.cards||[v]);}
function questionSolution(q,{open=false,mother=false}={}){
 return `<details class="${mother?'mother-solution':'variant-solution'} practice-card-solution" ${open?'open':''}><summary>尝试后展开本题答案与步骤</summary><p><b>参考答案：</b>${esc(q.answer)}</p><p><b>解题步骤：</b>${esc(q.explain)}</p></details>`;
}
function motherProblem(l,{answers=true}={}){
 return `<section class="panel mother-problem"><span class="tag">本课母题 · 先完整读题</span><h2>与视频逐题对照</h2><p class="tiny">每题先圈出已知与所求，在草稿纸上尝试，再展开这一题的答案。</p>${motherCards(l).map(m=>`<article class="practice-card mother-card"><h3>${esc(m.title)}</h3><p class="problem-stem">${esc(m.text)}</p><ol class="problem-asks">${m.asks.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>${answers?questionSolution(m,{mother:true}):''}</article>`).join('')}</section>`;
}
function motherSolution(l,open=false){
 return motherCards(l).map(m=>`<article class="practice-card"><h3>${esc(m.title)}</h3>${questionSolution(m,{open,mother:true})}</article>`).join('');
}
// 先匹配原文字串，再逐段转义；标红内容绝不作为 HTML 解释。
function changedStem(text,changed=[]){
 const parts=[...new Set(changed.filter(x=>typeof x==='string'&&x&&text.includes(x)))].sort((a,b)=>b.length-a.length);
 let html='',cursor=0;
 while(cursor<text.length){
  let next=text.length,match='';
  for(const part of parts){const at=text.indexOf(part,cursor);if(at>=0&&(at<next||(at===next&&part.length>match.length))){next=at;match=part;}}
  html+=esc(text.slice(cursor,next));
  if(!match)break;
  html+=`<mark class="changed-condition">${esc(match)}</mark>`;cursor=next+match.length;
 }
 return html;
}
function variantsView(l,{answers=true}={}){
 return `<section class="panel lesson-variants"><span class="tag">从母题到变式 · 看条件怎样变化</span><h2>完整变式题 · 逐题练习</h2><p class="tiny">红字标出变化的条件或所求。先独立尝试，再展开本题答案与步骤。</p>${variantCards(l).map(v=>`<article class="practice-card variant-problem"><h3>${esc(v.title)}</h3><p class="problem-stem">${changedStem(v.text,v.changed)}</p><p class="condition-change"><b>变化说明：</b>${esc(v.change)}</p>${answers?questionSolution(v):''}</article>`).join('')}</section>`;
}
function lesson(){
 const l=LESSONS[lessonId];
 if(!teacher&&lessonTab==='work')return title('独立练习',`第${lessonId+1}课 · ${l.title}`,`<a href="#lesson/${lessonId}/learn">返回本课 →</a>`)+studentPracticePanel(lessonId);
 if(teacher&&lessonTab==='teach')return teachingView();
 return title(l.title,`第${lessonId+1}次课 · ${dateOf(lessonId)} · ${l.goal}`,teacher&&pupil()?button(pupil().completed.includes(lessonId)?'取消完成标记':'标记课堂完成','complete','secondary'):'')+
 `${teacher?`<section class="panel teacher-entry">${teachingLink()}<p>备课看详细资料，课堂按步骤推进。${pupil()?'上方完成按钮只记录当前所选学生。':'当前是备课预览。'}</p>${recordIdentity()}</section>`:''}<div class="notice lesson-path">课堂路线：老师讲解并操作动画 → 学生动手验证 → 小老师上台讲 → 收起提示独立练习${[0,10].includes(lessonId)?'<br><b>本课先完成45分钟独立测评并交卷，再开始下面的教学环节。</b>':''}</div>
 <div class="tabs" role="group" aria-label="课堂环节">${[['learn','① 知识讲解'],['game','② 互动验证'],['talk','③ 小老师讲堂'],['work','④ 独立练习'],...(teacher?[['guide','教师教案']]:[])].map(([id,label])=>button(label,'lesson-tab',lessonTab===id?'active':'',`data-tab="${id}"`)).join('')}</div><div id="lesson-body">${lessonBody()}</div>`;
}

// 第二课先复习第一课。题目来自登录后的课程接口，学生端不会收到标准答案。
function lessonWarmupPanel(){
 if(lessonId!==1)return '';
 if(teacher)return warmupRecordPanel();
 const warmup=LESSONS[1]?.warmup,record=pupil()?.warmups?.[1];
 if(!warmup||record?.version===warmup.version&&record.completed)return '';
 const step=warmup.questions.findIndex((_,index)=>!record?.questions?.[index]?.correct);
 if(step<0)return '';
 const item=warmup.questions[step],finished=Object.values(record?.questions||{}).filter(q=>q.correct).length;
 const field=item.kind==='reason'?`<label for="warmup-answer-${step}">先判断</label><select id="warmup-answer-${step}"><option value="">请选择</option><option value="yes">正确</option><option value="no">不正确</option></select><label for="warmup-reason-${step}">再用一句话说明理由</label><textarea id="warmup-reason-${step}" rows="3" placeholder="我这样判断是因为……"></textarea>`:`<label for="warmup-answer-${step}">写下结果</label><input id="warmup-answer-${step}" inputmode="decimal" autocomplete="off" placeholder="可以填写单位">`;
 return `<section class="panel lesson-warmup" id="lesson-warmup"><div class="section-head"><div><span class="tag">上节课回顾 · 3题热身</span><h2>先唤醒第一课的方法</h2></div><span class="warmup-progress">已完成 ${finished} / ${warmup.questions.length}</span></div><article class="warmup-card"><h3>第 ${step+1} / ${warmup.questions.length} 题 · ${esc(item.level)}</h3><p class="problem-stem">${esc(item.question)}</p><div class="warmup-fields">${field}</div><div class="controls">${button('检查并继续','warmup-check','',`data-q="${step}"`)}</div><p class="warmup-feedback" id="warmup-feedback" role="status">先在草稿纸上完成，再检查。</p></article><p class="tiny">答错时只会获得思路提示，不会直接显示标准答案；作答次数会帮助老师调整教学。</p></section>`;
}
function warmupRecordPanel(student=pupil()){
 if(!teacher||!student)return '';
 const warmup=LESSONS[1]?.warmup,record=student.warmups?.[1];
 if(!warmup)return '';
 if(!record||record.version!==warmup.version)return `<section class="panel warmup-record teacher-private"><h2>${esc(student.name)}的回顾记录</h2><div class="empty">尚未开始第二课的上节课回顾。</div></section>`;
 const rows=warmup.questions.map((question,index)=>{
  const saved=record.questions?.[index],submissions=saved?.submissions||[];
  const history=submissions.length?submissions.map(item=>`${esc(item.answer)}（${item.correct?'正确':'未答对'}）${item.reason?`<small>理由：${esc(item.reason)}</small>`:''}`).join(' → '):'尚未作答';
  return `<tr><td>${index+1}. ${esc(question.level)}<small>${esc(question.question)}</small></td><td>共${saved?.attempts||0}次</td><td>${history}</td></tr>`;
 }).join('');
 return `<section class="panel warmup-record teacher-private"><div class="section-head"><div><span class="tag">第二课课前回顾</span><h2>${esc(student.name)}的回顾记录</h2></div><b>${record.completed?'已完成':'进行中'}</b></div><div class="table-wrap"><table><thead><tr><th>题目</th><th>作答次数</th><th>每次作答</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function lessonWarmupGuide(){
 if(lessonId!==1)return '';
 const warmup=LESSONS[1]?.warmup;
 if(!warmup)return '';
 const answerText=['每把尺子4元','这一步正确','1张成人票和1张儿童票共40元'];
 const answers=warmup.questions.map((question,index)=>`<article class="guide-step"><h3>第${index+1}题 · ${esc(question.level)}</h3><p>${esc(question.question)}</p><p><b>答案：</b>${answerText[index]}</p><p>${esc(question.explain)}</p></article>`).join('');
 return `<section class="panel warmup-guide teacher-private"><span class="tag">第二课专用 · 教师可见</span><h2>课前回顾参考答案</h2><p>学生端逐题作答，只给方向提示。建议每题先留出独立思考时间，再根据学生表达追问。</p>${answers}</section>${warmupRecordPanel()}`;
}
function lessonBody(){
 const l=LESSONS[lessonId],d=l.detail;
 if(!teacher&&lessonTab==='work')return studentPracticePanel(lessonId);
 if(lessonTab==='game')return motherProblem(l)+`<section class="panel"><h2>先动手，再准备当老师</h2><p>${d.labTask}</p><ol><li>操作前，把预测写在草稿纸上。</li><li>只改变一个条件，用图形和数值验证。</li><li>写下“我改变了什么、发现什么、为什么”。</li></ol></section>`+gameView(l.game,lessonId)+`<section class="panel">${button('带着发现，准备上台 →','lesson-tab','','data-tab="talk"')}</section>`;
 if(lessonTab==='work')return motherProblem(l)+variantsView(l)+`<section class="panel"><h2>需要更多同类练习？</h2><p>AI 练习只提供解题引导，不直接给答案。先尝试，再按需要请求下一步提示。</p><a href="#ai-practice">AI 引导练习 →</a></section>`+`<section class="panel"><h2>独立练习 · 先尝试，再检查</h2><p class="muted">母题与变式用于示范和再练；下方3题用于独立检查，保存到个人练习记录。请收起动画、答案和示范稿，在草稿纸上完成后再提交。</p>${l.practice.map((q,j)=>practiceQuestion(q,lessonId,j)).join('')}</section><section class="panel"><h2>练习结束，再回顾母题与变式</h2><p>先保留自己的解法，再返回知识讲解核对理由。</p>${button('回看本课讲解','lesson-tab','secondary','data-tab="learn"')}</section>`;
 if(lessonTab==='talk')return talkView();
 if(lessonTab==='guide')return guideView();
 return lessonWarmupPanel()+courseSequencePanel(l)+personalReviewPanel()+motherProblem(l)+courseVideoPanel()+`<section class="panel lesson-intro"><span class="tag">读完母题，再开始分析</span><h2>从题目中找出突破口</h2><p class="lead">${d.hook}</p><h3>对照题干，想一想</h3><ul>${d.check.map(x=>`<li>${x.split('｜')[0]}</li>`).join('')}</ul><p class="muted">先自己说或在草稿纸上写，老师听过以后再进入动画。</p></section>`+
 labView(lessonId)+
 `<div class="grid-two"><section class="panel"><div class="section-head"><h2>跟着例题，一步一步讲明白</h2><span class="tag">可手动翻页</span></div><div class="lesson-stage" id="stage">${stageView()}</div><div class="controls">${button('← 上一步','slide-prev','secondary')}${button('自动播放','slide-play','','id="slide-play"')}${button('下一步 →','slide-next','secondary')}<span id="slide-count" class="muted">${slide+1} / ${l.steps.length}</span></div><p class="tiny">图文步骤便于暂停复盘。 自动翻页每12秒一次，讲解时建议手动翻页。</p></section><section class="panel"><h2>把操作变成一个道理</h2><p>${d.concept}</p><h3>在草稿纸上留下这条路线</h3><p class="board-note">${d.board}</p><h3>特别留意</h3><p>${l.pitfall}</p></section></div>
 <section class="panel"><h2>回到完整母题，逐问检查</h2><p>返回上方母题卡，逐题展开答案，核对每一步对应的条件。</p></section>`+(teacher?variantsView(l):'')+`<section class="panel"><div class="controls">${button('我来操作验证 →','lesson-tab','','data-tab="game"')}${button('准备小老师讲堂','lesson-tab','secondary','data-tab="talk"')}</div></section>`;
}
function stageView(){const s=LESSONS[lessonId].steps[slide];return `<span class="eyebrow">STEP ${String(slide+1).padStart(2,'0')}</span><h2>${s[0]}</h2><p>${s[1]}</p><div class="formula">${s[2]}</div><p class="tiny">停下来问自己：我能指出图中的对应部分，并解释这一步的理由吗？</p>`;}
function talkView(){return alignedTalkView()+(lessonTab==='teach'?'':`<section class="panel">${button('收起提示，开始独立练习 →','lesson-tab','','data-tab="work"')}</section>`);}
function guideAction(name,l){
 const d=l.detail;
 if(name.includes('独立测评'))return ['前测用A卷，后测用B卷；连续45分钟，20道填空，共120分。可以写草稿。先交卷再进入教学。','独立作答；教师只解释操作规则，不提示解法。','记录是否按相同条件完成，保留原始成绩。'];
 if(name.includes('规则'))return ['说明计时、草稿、提交规则；确认设备可用。','复述不会的题可暂时跳过。','确认学生理解规则后开始。'];
 if(name.includes('知识'))return [`先完整展示并朗读母题“${d.mother.title}”，让学生复述条件与所求，再逐步讲解；动画每次只变一个条件。`,'先预测，再观察；每一步让学生指出图中对应部分。',`追问：${d.questions[0][0]}`];
 if(name.includes('互动'))return [d.labTask,'普通课建议8分钟操作、7分钟写提纲、5分钟试讲；测评课压缩为4＋3＋3分钟。','请学生说出改变的条件、观察到的结果与理由。'];
 if(name.includes('上台'))return ['先让学生连续讲2～3分钟，再提本课追问；不要中途代讲。多人班分组轮讲，轮换上台代表。','照四步提纲讲解，接受一个追问，修正后重讲关键一步。','用下方检查清单观察；选择学生后记录评价。'];
 if(name.includes('独立练习'))return ['收起动画与提纲。按基础、应用、变式完成3题，先独立再检查。测评课优先第1题，其余按速度安排。','写草稿，给每题标题号；出错后保留原过程。','区分读题、方法与计算问题，不只记录对错。'];
 if(name.includes('变式'))return [d.transfer[0],'关闭参考思路，独立重做；完成快的学生说明另一种解法。',`${d.transfer[1]}；${d.transfer[2]}`];
 if(name.includes('休息'))return ['离开屏幕，起身喝水和活动。','休息，不继续讲新题。','保证休息时间。'];
 if(name.includes('热身'))return [d.check.map(x=>x.split('｜')[0]).join('；'),'口头回答或写出一步计算。','答不出时先用实物或简单数值补前置知识。'];
 return ['请学生用一句话回顾方法；布置一道未完成练习或口头复述。',d.exit,'教师写下今天掌握的一点与下次要补的一点。'];
}
function guideView(){
 const l=LESSONS[lessonId],d=l.detail,flow=[0,10].includes(lessonId)?TEST_FLOW:FLOW;
 let elapsed=0;
 return `<section class="panel guide-title"><div class="section-head"><h2>第${lessonId+1}课 · 教师教案</h2>${button('打印教案','print','secondary')}</div><p>先完成上节课回顾，再呈现完整母题，让学生读题与尝试。</p></section>`+lessonWarmupGuide()+personalReviewPanel()+motherProblem(l)+courseVideoPanel()+`<section class="panel guide-page"><p><b>教学目标：</b>${l.goal}</p><p><b>本课递进：</b>${esc(d.sequenceNote||'')}</p><p><b>达成表现：</b>${d.exit}</p><p><b>前置知识：</b>${l.prereq}</p><p><b>材料：</b>白纸、彩笔、投屏或电脑；可用纸片代替动画中的物品。</p><p><b>核心概念：</b>${d.concept}</p><p><b>授课顺序：</b>先讲解与观察动画，再动手验证、准备讲课，最后学生上台与独立练习。共${flow.reduce((s,x)=>s+x[1],0)}分钟。</p>
 <h3>一、开场与前置检查</h3><blockquote>${d.hook}</blockquote>${d.check.map(x=>{const [q,a]=x.split('｜');return `<p><b>问：</b>${q}<br><b>期望回应：</b>${a}</p>`;}).join('')}
 <h3>二、120分钟课堂安排</h3><div class="table-wrap"><table><thead><tr><th>时间 / 环节</th><th>教师怎样做</th><th>学生怎样参与</th><th>观察与检查</th></tr></thead><tbody>${flow.map(([name,minutes])=>{const start=elapsed;elapsed+=minutes;const parts=guideAction(name,l);return `<tr><td><b>${start}～${elapsed}分</b><br>${name}</td>${parts.map(x=>`<td>${x}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div>
 <h3>三、例题逐步讲解（可直接按此授课）</h3>${l.steps.map((s,i)=>`<article class="guide-step"><span class="tag">第${i+1}步</span><h4>${s[0]}</h4><p><b>教师讲述：</b>${s[1]}</p><p class="formula">${s[2]}</p><p><b>停下来让学生做：</b>${['复述条件，并在图上指出已知与所求。','指着变化的部分，解释为什么可以这样处理。','说出算式中每个数对应的量与单位。','用自己的话重讲理由，再核对原条件。'][i%4]}</p></article>`).join('')}

 <h3>四、动画怎么用，观察什么</h3><p>${d.labTask}</p><p>建议三轮：第一轮教师示范，先停在初始状态听预测；第二轮让学生只改变一个参数；第三轮让学生一边操作一边说理由。上台讲课可再次展开同一动画。</p>
 <h3>五、小老师讲堂：给支架，不代讲</h3><p><b>本次上台讲解题：</b>${esc(d.talkChallenge||d.mother.text)}</p><p><b>开场示范：</b>${esc(talkSupport(l).opening)}</p><ol>${talkSupport(l).talk.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${talkSupport(l).questions.map(q=>`<p>追问：${esc(q)}</p>`).join('')}${l.videoGuide?`<p><b>本题参考解法：</b>${esc(l.videoGuide.answer)}</p>`:''}<p>先听学生完整讲解，再选一个追问。卡住时只给一个关键词；仍有困难，先回母题练关键一步。评价不计入测评分数。</p>
 <h3>六、易错点与现场补救</h3><p><b>常见误区：</b>${l.pitfall}</p><p><b>具体处理：</b>${d.repair}</p><p><b>需要支持：</b>先用动画和纸片，只讲清一个关键步骤；教师给一个关键词后让学生续讲。</p><p><b>学有余力：</b>${d.transfer[0]}要求先预测再证明；有时间再尝试另一种解释。</p>
 ${variantsView(l,{guide:true})}
 <h3>七、板书路线</h3><p class="board-note">${d.board}</p>
 <h3>八、练习答案与讲解</h3>${l.practice.map((q,i)=>`<article class="guide-step"><h4>第${i+1}题 · ${['基础应用','继续应用','综合或变式'][i]}</h4><p>${q.text}</p>${q.svg||''}<p><b>答案：${esc(q.answer)}</b></p><p>${q.explain}</p></article>`).join('')}
 <h3>九、出口检查与下次调整</h3><p>${d.exit}</p><p><b>变式参考：</b>${d.transfer[1]}。${d.transfer[2]}</p>${pupil()?`${recordIdentity()}<label for="lesson-note">课堂记录与下次调整</label><textarea id="lesson-note" placeholder="学生在哪一步需要提示？用什么方式补救？下次用哪道新题确认？">${esc(pupil().notes[lessonId]||'')}</textarea><div class="controls">${button('保存课堂记录','note-save')}</div>`:'<p class="muted">当前为备课预览。选择学生后，可以填写课堂记录。</p>'}<div class="controls">${button('打印学生练习卷','print-practice','secondary')}</div></section>`;
}
function practiceQuestion(q,i,j){const key=i+'-'+j,saved=pupil()?.practice[key];if(teacher)return `<div class="question"><p><b>${j+1}.</b> ${q.text}</p>${q.svg||''}<p class="tiny teacher-private">学生在自己的账号提交；教师查看不会产生学生作答记录。</p><details class="teacher-private"><summary>查看本题解析（教师）</summary><div class="answer"><b>参考答案：${esc(q.answer)}</b><br>${esc(q.explain)}</div></details></div>`;return `<div class="question" id="practice-${key}"><label class="qtext" for="p-${key}"><b>${j+1}.</b> ${q.text}</label>${q.svg||''}<input id="p-${key}" aria-label="第${j+1}题答案" value="${esc(saved?.answer||'')}" autocomplete="off"><button class="secondary" data-action="practice-check" data-id="${i}" data-q="${j}">检查答案</button><div class="practice-feedback" role="status">${saved?`<div class="answer ${saved.correct?'':'wrong'}">${saved.correct?'✓ 回答正确':'还需要再想一想'}${saved.correct&&q.explain?'。'+q.explain:''}</div>`:''}</div></div>`}
function practicePage(){if(teacher)return title('学生练习记录','查看当前所选学生的作答情况。')+practiceDetails(pupil())+variantPracticeDetails(pupil());return title('练习与错题','独立练习、AI 拔高、测评与错题，都在这里。')+(['work','ai'].includes(practiceTab)?`<section class="panel practice-course-picker"><label for="practice-course">选择练习课程</label><select id="practice-course">${LESSONS.map((l,i)=>`<option value="${i}" ${i===practiceCourse?'selected':''}>第${i+1}课 · ${esc(l.title)}</option>`).join('')}</select></section>`:'')+studentPracticePanel(practiceCourse);}
function gamesPage(){return title('思维游乐场','先预测，亲手试，再讲出背后的数学。')+gameWorldEntry()+`<div class="course-grid">${Object.entries(GAME_META).map(([id,[name,desc]],i)=>`<article class="course"><div class="course-top"><span>探索 ${String(i+1).padStart(2,'0')}</span><span>◇</span></div><div class="course-body"><span class="tag">${pupil()?.games[id]?'已探索':'待探索'}</span><h2 style="margin-top:14px">${name}</h2><p>${desc}</p>${button('进入探索 →','game-open','',`data-game-type="${id}"`)}</div></article>`).join('')}</div>`}
function stopPlayer(){clearInterval(playTimer);playTimer=null;const b=document.getElementById('slide-play');if(b)b.textContent='自动播放';}

function courseSequencePanel(l){return l.detail.sequenceNote?`<section class="panel"><span class="tag">这节课往前走一步</span><p>${esc(l.detail.sequenceNote)}</p><p class="tiny">示范与再练帮助理解；独立新题检验迁移。可以打草稿，不要求全程心算。</p></section>`:'';}
function talkTransferPanel(l){return l.detail.talkChallenge?`<section class="panel"><span class="tag">上台讲解题 · 先准备再开讲</span><h2>母题会讲了，用这道变式试一试</h2><p class="problem-stem">${esc(l.detail.talkChallenge)}</p><ol><li>先读完整题，用自己的话说出改变了什么。</li><li>画图或列式，选出最关键的一步，准备解释“为什么”。</li><li>讲完用原条件检查；老师先听完整，再给提示。</li></ol><p class="tiny">下方提纲专门对应这道上台题。请按题中条件画图、列式；暂时有困难，可以展开下方母题回顾。</p></section>`:'';}
function personalReviewPanel(){
 if(lessonId!==10)return '';
 const p=pupil(), topics=p?.exams?.B?.topics;
 const map={'消去方程':[0,1],'周期余数':[2],'因数质数':[3,4],'面积':[5],'空间观察':[6],'行程':[7],'牛吃草':[8],'平均数':[9],'最值':[9,11]};
 const weak=Object.entries(topics||{}).filter(([,v])=>v.correct<v.total).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
 const rows=weak.map(([topic,v])=>`<div class="lesson-row"><div class="grow"><h3>${esc(topic)}</h3><p>后测答对${v.correct}/${v.total}题。${map[topic]?'先核对具体错因，再决定是否回学。':'教师结合原题补充讲解，再用新题确认。'}</p>${(map[topic]||[]).map(i=>`<a href="#lesson/${i}/learn">回看第${i+1}课</a> · <a href="#lesson/${i}/work">第${i+1}课独立练习</a>`).join('　')}</div></div>`).join('');
 return `<section class="panel"><span class="tag">先看个人后测，再选补学内容</span><h2>${teacher&&p?esc(p.name)+'的复盘起点':'本课怎样复盘'}</h2><p>先完成B卷并交卷。下面视频示范纠错方法；实际优先补哪1～2个知识点，要看该生后测和讲解表现。</p>${topics?(weak.length?rows:'<p>这次后测未显示答错的知识点。请再抽题听学生讲理由，用新题确认，不能只凭全对判定完全掌握。</p>'):'<p class="muted">目前没有可用的个人后测知识点结果。教师选择已完成后测的学生后，这里会列出需要核查的知识点；备课时仍可先看示范。</p>'}<ol><li>遮住解析，指出最先出错或卡住的位置。</li><li>区分读题、关系理解、计算和最终所求。</li><li>回到对应知识点，操作动画并自己讲一遍。</li><li>收起提示做新题，教师在课堂记录中写明是否独立完成。</li></ol>${teacher&&p?'<a href="#report">查看该生完整成长档案 →</a>':''}</section>`;
}
