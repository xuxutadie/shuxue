"""把递进说明、个人复盘入口和历史练习显示接入现有页面。"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'public/app.js';s=p.read_text(encoding='utf8')
s=s.replace("body:{answer:document.getElementById('p-'+key).value}","body:{answer:document.getElementById('p-'+key).value,version:LESSONS[i].practice[j].version||'v1'}")
s=s.replace('${practiceDetails(p)}${historyPanel()}','${practiceDetails(p)}${oldPracticePanel(p)}${historyPanel()}')
if 'function oldPracticePanel(' not in s:
    s+='''
// 历史题保留当时的题干与作答，不参加新版练习完成度。
function oldPracticePanel(p){
 if(!teacher||!p.practiceHistory?.length)return '';
 return `<section class="panel"><h2>旧版练习记录</h2><p class="muted">课程换题前的作答保留在这里，不计入新版练习的完成度。首次表现和尝试次数按原题查看。</p>${p.practiceHistory.map(r=>{const [l,j]=r.key.split('-').map(Number);return `<details><summary>第${l+1}课 · 原第${j+1}题 · ${r.correct?'最近答对':'仍需复习'}</summary><p>${esc(r.question?.text||'旧版练习')}</p><p>首次：${r.firstCorrect===undefined?'未单独记录':r.firstCorrect?'正确':'未答对'}；最近作答：${esc(r.answer)}；尝试${r.attempts}次。</p><p>${(r.submissions||[]).map(v=>`${esc(v.answer)}（${v.correct?'对':'错'}）`).join(' → ')}</p></details>`;}).join('')}</section>`;
}
'''
p.write_text(s,encoding='utf8')
p=ROOT/'public/views.js';s=p.read_text(encoding='utf8')
s=s.replace(" const l=LESSONS[lessonId],d=l.detail;\n if(lessonTab", " const l=LESSONS[lessonId],d=l.detail;\n if(lessonTab")
s=s.replace('return motherProblem(l)+courseVideoPanel()+`<section class="panel lesson-intro">','return courseSequencePanel(l)+personalReviewPanel()+motherProblem(l)+courseVideoPanel()+`<section class="panel lesson-intro">')
s=s.replace("<b>教学目标：</b>${l.goal}","<b>教学目标：</b>${l.goal}</p><p><b>本课递进：</b>${esc(d.sequenceNote||'')}")
s=s.replace("</section>`+motherProblem(l)+courseVideoPanel()+`<section class=\"panel guide-page\">","</section>`+personalReviewPanel()+motherProblem(l)+courseVideoPanel()+`<section class=\"panel guide-page\">")
s=s.replace("return motherProblem(l)+`<section class=\"panel talk-start\">","return motherProblem(l)+talkTransferPanel(l)+`<section class=\"panel talk-start\">")
s=s.replace('上方母题与变式供纸上练习；下方3题保存到个人练习记录。收起动画与讲解，可以在纸上打草稿，每次检查会记录结果。','母题与变式用于示范和再练；下方3题用于独立检查，保存到个人练习记录。请收起动画、答案和示范稿，在草稿纸上完成后再提交。')
s=s.replace('朗读上方完整母题，在纸上画图并写出已知、所求。','先用母题练习开场，再读上方“上台讲解题”，在纸上写出它的已知与所求。')
s=s.replace('读懂后收起示范，用自己的表达重新讲；无需逐字背诵。','这是母题的开场示范。读懂后收起，用自己的话讲上台题；数字和条件以所选题为准，无需背稿。')
if 'function courseSequencePanel(' not in s:
    s+='''
function courseSequencePanel(l){return l.detail.sequenceNote?`<section class="panel"><span class="tag">这节课往前走一步</span><p>${esc(l.detail.sequenceNote)}</p><p class="tiny">示范与再练帮助理解；独立新题检验迁移。可以打草稿，不要求全程心算。</p></section>`:'';}
function talkTransferPanel(l){return l.detail.talkChallenge?`<section class="panel"><span class="tag">上台讲解题 · 先准备再开讲</span><h2>母题会讲了，用这道变式试一试</h2><p class="problem-stem">${esc(l.detail.talkChallenge)}</p><ol><li>先读完整题，用自己的话说出改变了什么。</li><li>画图或列式，选出最关键的一步，准备解释“为什么”。</li><li>讲完用原条件检查；老师先听完整，再给提示。</li></ol><p class="tiny">下面的开场和示范帮助你组织表达，具体条件以这道题为准。暂时有困难，可以先讲母题，再尝试变式。</p></section>`:'';}
function personalReviewPanel(){
 if(lessonId!==10)return '';
 const p=pupil(), topics=p?.exams?.B?.topics;
 const map={'消去方程':[0,1],'周期余数':[2],'因数质数':[3,4],'面积':[5],'空间观察':[6],'行程':[7],'牛吃草':[8],'平均数':[9],'最值':[9,11]};
 const weak=Object.entries(topics||{}).filter(([,v])=>v.correct<v.total).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
 const rows=weak.map(([topic,v])=>`<div class="lesson-row"><div class="grow"><h3>${esc(topic)}</h3><p>后测答对${v.correct}/${v.total}题。${map[topic]?'先核对具体错因，再决定是否回学。':'教师结合原题补充讲解，再用新题确认。'}</p>${(map[topic]||[]).map(i=>`<a href="#lesson/${i}/learn">回看第${i+1}课</a> · <a href="#lesson/${i}/work">第${i+1}课独立练习</a>`).join('　')}</div></div>`).join('');
 return `<section class="panel"><span class="tag">先看个人后测，再选补学内容</span><h2>${teacher&&p?esc(p.name)+'的复盘起点':'本课怎样复盘'}</h2><p>先完成B卷并交卷。下面视频示范纠错方法；实际优先补哪1～2个知识点，要看该生后测和讲解表现。</p>${topics?(weak.length?rows:'<p>这次后测未显示答错的知识点。请再抽题听学生讲理由，用新题确认，不能只凭全对判定完全掌握。</p>'):'<p class="muted">目前没有可用的个人后测知识点结果。教师选择已完成后测的学生后，这里会列出需要核查的知识点；备课时仍可先看示范。</p>'}<ol><li>遮住解析，指出最先出错或卡住的位置。</li><li>区分读题、关系理解、计算和最终所求。</li><li>回到对应知识点，操作动画并自己讲一遍。</li><li>收起提示做新题，教师在课堂记录中写明是否独立完成。</li></ol>${teacher&&p?'<a href="#report">查看该生完整成长档案 →</a>':''}</section>`;
}
'''
p.write_text(s,encoding='utf8')
print('网页已接入递进、上台变式、个人复盘与旧题记录。')
