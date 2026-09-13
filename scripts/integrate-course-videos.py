"""将独立播放器放在讲解前、教师教案内；保留原有教学材料和班级覆盖配置。"""
from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'public/views.js'
s=p.read_text(encoding='utf-8')
s=s.replace(" const video=safeVideo(state.videos[lessonId]||'');\n",'')
s=s.replace(" return motherProblem(l)+`<section class=\"panel lesson-intro\">"," return motherProblem(l)+courseVideoPanel()+`<section class=\"panel lesson-intro\">")
s=s.replace('${video?`<video controls preload="metadata" src="${esc(video)}"></video>`:\'\'}','')
s=s.replace("${video?'可结合教师视频学习。':'本课使用图文和互动动画；正式视频尚未接入。'} ",'图文步骤便于暂停复盘。 ')
s=s.replace('+motherProblem(l)+`<section class="panel guide-page">','+motherProblem(l)+courseVideoPanel()+`<section class="panel guide-page">')
p.write_text(s,encoding='utf-8')
p=root/'public/index.html';s=p.read_text(encoding='utf-8')
if 'course-videos.js' not in s:s=s.replace('<script src="figures.js','<script src="course-videos.js?v=videos1"></script><script src="figures.js')
s=s.replace('v=online6','v=videos1');p.write_text(s,encoding='utf-8')
p=root/'public/app.js';s=p.read_text(encoding='utf-8')
s=s.replace('每课均含分步讲解、可操作动画和小老师讲课提纲。正式视频可在各班级的课程设置中接入MP4或WebM直链；视频制作需要单独完成。','每课均含讲解视频、分步图文、可操作动画和小老师讲课提纲。直接进入课堂即可观看；班级课程设置中可选填自定义视频地址来替换默认视频。')
s=s.replace('设置授课日期与视频直链，学生会看到自己班级的安排。','设置授课日期；视频地址留空时，自动使用本课动画视频。填写直链可替换为班级自选视频。')
s=s.replace('视频地址（选填）','替换默认视频（选填）').replace('placeholder="https://…/lesson.mp4"','placeholder="留空使用本课动画视频"')
hook="\ndocument.addEventListener('error',event=>{if(event.target?.id==='lesson-video'){const message=document.getElementById('video-error');if(message)message.hidden=false;}},true);\n"
if "event.target?.id==='lesson-video'" not in s:s=s.replace('startSession();\n',hook+'startSession();\n')
p.write_text(s,encoding='utf-8')
