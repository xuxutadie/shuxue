"""将新教师课堂助手接入现有页面，不调整题库、账号或数据库。"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(name,changes):
    path=root/name
    text=path.read_text(encoding='utf-8')
    for old,new in changes:
        if old not in text: raise ValueError(f'{name}: 未找到修改位置 {old[:65]}')
        text=text.replace(old,new,1)
    path.write_text(text,encoding='utf-8')

edit('public/index.html',[
 ('<script src="views.js?', '<script src="teacher-flow.js?v=teacher20260912"></script><script src="views.js?')])
path=root/'public/index.html'
path.write_text(path.read_text(encoding='utf-8').replace('curriculum20260912r2','teacher20260912'),encoding='utf-8')

path=root/'public/views.js'
text=path.read_text(encoding='utf-8')
start=text.index('function talkView(){')
end=text.index('function guideAction(',start)
text=text[:start]+'function talkView(){return alignedTalkView();}\n'+text[end:]
start=text.index(' <h3>五、小老师讲堂：')
end=text.index(' <h3>六、',start)
text=text[:start]+''' <h3>五、小老师讲堂：给支架，不代讲</h3><p><b>本次上台讲解题：</b>${esc(d.talkChallenge||d.mother.text)}</p><p><b>开场示范：</b>${esc(talkSupport(l).opening)}</p><ol>${talkSupport(l).talk.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${talkSupport(l).questions.map(q=>`<p>追问：${esc(q)}</p>`).join('')}${l.videoGuide?`<p><b>本题参考解法：</b>${esc(l.videoGuide.answer)}</p>`:''}<p>先听学生完整讲解，再选一个追问。卡住时只给一个关键词；仍有困难，先回母题练关键一步。评价不计入测评分数。</p>
'''+text[end:]
start=text.index('function practiceQuestion(')
end=text.index('\nfunction ',start+10)
old=text[start:end]
idx=old.index('return `<div class="question" id=')
student=old[idx:]
text=text[:start]+'''function practiceQuestion(q,i,j){const key=i+'-'+j,saved=pupil()?.practice[key];if(teacher)return `<div class="question"><p><b>${j+1}.</b> ${q.text}</p>${q.svg||''}<p class="tiny teacher-private">学生在自己的账号提交；教师查看不会产生学生作答记录。</p><details class="teacher-private"><summary>查看本题解析（教师）</summary><div class="answer"><b>参考答案：${esc(q.answer)}</b><br>${esc(q.explain)}</div></details></div>`;'''+student+text[end:]
text=text.replace(' const l=LESSONS[lessonId];\n return title(l.title,',' const l=LESSONS[lessonId];\n if(teacher&&lessonTab===\'teach\')return teachingView();\n return title(l.title,',1)
text=text.replace(' `<div class="notice lesson-path">',' `${teacher?`<section class="panel teacher-entry">${teachingLink()}<p>备课看详细资料，课堂按步骤推进。${pupil()?\'上方完成按钮只记录当前所选学生。\':\'当前是备课预览。\'}</p>${recordIdentity()}</section>`:\'\'}<div class="notice lesson-path">',1)
text=text.replace('<label for="lesson-note">课堂记录与下次调整</label>','${recordIdentity()}<label for="lesson-note">课堂记录与下次调整</label>',1)
text=text.replace('下面的开场和示范帮助你组织表达，具体条件以这道题为准。暂时有困难，可以先讲母题，再尝试变式。','下方提纲专门对应这道上台题。请按题中条件画图、列式；暂时有困难，可以展开下方母题回顾。',1)
path.write_text(text,encoding='utf-8')

edit('public/app.js',[
 ("else if(route==='home')main.innerHTML=teacher?dashboard():home();", "else if(route==='home')main.innerHTML=teacher?teacherStarter()+dashboard():home();"),
 ("['guide']:[])].includes(parts[2])", "['guide','teach']:[])].includes(parts[2])"),
 ("slide=0;main.innerHTML=lesson();", "slide=0;teachingStep=Math.max(0,Math.min(6,Number(parts[3])||0));if(lessonTab!=='teach'||teachingStep===6)projecting=false;main.innerHTML=lesson();"),
 ("main.focus({preventScroll:true});", "if(route!=='lesson'||lessonTab!=='teach')projecting=false;document.body.classList.toggle('classroom-projection',projecting);main.focus({preventScroll:true});"),
 ("if(action==='connect')await startSession();", "if(action==='finish-save'){await saveClassroomRecord();} if(action==='projection'){projecting=!projecting;document.body.classList.toggle('classroom-projection',projecting);b.textContent=projecting?'退出投屏展示':'投屏展示';}\n  if(action==='connect')await startSession();"),
 ("${courseButton(i)}${teacher?", "${teacher?teachingLink(i):courseButton(i)}${teacher?"),
 ("if(action==='talk-save'){const body=", "if(action==='talk-save'){const body="),
 ("toast(teacher?'讲课评价已保存。':'讲课准备已保存。');", "if(teacher){pupil().talk[lessonId]={...pupil().talk[lessonId],...body};}toast(teacher?`${pupil().name}的讲课评价已保存。`:'讲课准备已保存。');"),
 ("toast('课堂记录已保存。');", "toast(`${pupil().name}的课堂记录已保存。`);")])

# 学生评价入口不再提供不能提交的作答控件。未知单价仅在主动展开实验设置后显示。
edit('public/lesson-lab.js',[
 ("prompt:'大零件每个8克；上行2大3小，下行3大2小。选择对齐对象，观察两行的数量和总重量一起变化。'", "prompt:'上行2大3小，下行3大2小。先读图中总重量，选择对齐对象，观察两行数量和总重量一起变化。'"),
 ('<div class="lab-controls">${config.params.map', '''${['shop','balance','align'].includes(type)?'<details class="lab-parameter-disclosure"><summary>推理完成后，再展开单价或重量设置做变式</summary><p>先根据两组总量求未知量；这里的设置用于验证与拓展。</p>':''}<div class="lab-controls">${config.params.map'''),
 (".join('')}</div><div id=\"lab-picture\"", ".join('')}</div>${['shop','balance','align'].includes(type)?'</details>':''}<div id=\"lab-picture\"")])

# 现有浏览器沙箱测试与网页使用相同脚本加载顺序。
for name in ['tests/preparation.test.cjs','tests/course-videos.test.cjs']:
    path=root/name
    text=path.read_text(encoding='utf-8')
    text=text.replace("'views.js', 'app.js'", "'teacher-flow.js', 'views.js', 'app.js'")
    text=text.replace("'views.js','app.js'", "'teacher-flow.js','views.js','app.js'")
    text=text.replace('remove(){} },', 'remove(){}, toggle(){} },')
    path.write_text(text,encoding='utf-8')
