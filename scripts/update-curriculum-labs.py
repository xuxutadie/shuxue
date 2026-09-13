"""给需要多种观察任务的课增加实验切换，复盘课按个人薄弱点选实验。"""
from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'public/lesson-lab.js';s=p.read_text(encoding='utf8')
needle='<p>${config.prompt}</p><p class="tiny">'
addition='''<p>${config.prompt}</p>${!standaloneType&&LAB_OPTIONS[lessonIndex]?`<label>选择本次要验证的知识点<select data-lab-select>${LAB_OPTIONS[lessonIndex].map(k=>`<option value="${k}" ${k===type?'selected':''}>${LAB_CONFIG[k].name}</option>`).join('')}</select></label>`:''}<p class="tiny">'''
if 'select data-lab-select' not in s:s=s.replace(needle,addition)
needle="  const el=event.target;if(!labState)return;"
addition="""  const el=event.target;if(!labState)return;
  if(el.hasAttribute('data-lab-select')){
    const lesson=labState.lessonIndex,type=el.value;
    if(!LAB_OPTIONS[lesson]?.includes(type))return;
    stopLab();chosenLab[lesson]=type;
    el.closest('.lesson-lab').outerHTML=labView(lesson);
    labPaint(0,true);return;
  }"""
if "el.hasAttribute('data-lab-select')" not in s:s=s.replace(needle,addition)
s=s.replace('只有计算出错', '只有计算出错')
p.write_text(s,encoding='utf8')
p=root/'public/games.js';s=p.read_text(encoding='utf8')
s=s.replace("'/games/'+gameState.type", "'/games/'+({align:'shop',reflection:'area',stacks:'area',stopped:'chase',grid:'area',multiples:'factor',balance:'shop'}[labState.type]||labState.type)")
p.write_text(s,encoding='utf8')
p=root/'public/index.html';s=p.read_text(encoding='utf8').replace('?v=videos2','?v=curriculum20260912');p.write_text(s,encoding='utf8')
print('课堂实验切换已接入，复盘不再固定使用面积或购物动画。')
