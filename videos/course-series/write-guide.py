"""将最终时长、章节与教师解法整理成可复用备课说明。"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent
project=root.parent.parent
items=json.loads((root/'lessons.json').read_text(encoding='utf-8'))
rows=[];sections=[];total=466.75
def clock(t):
    t=int(t+.5);return f'{t//60}分{t%60:02}秒'
rows.append('| 1 | 消去问题：抵消与配成一套 | 7分47秒 | 先抵消相同部分，再配套求剩余 |')
first=json.loads((root.parent/'lesson-01-pairs/timing.json').read_text(encoding='utf-8'))
first_guide=json.loads((project/'server/video-guides.json').read_text(encoding='utf-8'))['0']
sections.append('## 第1课：消去问题 · 配成一套\n\n时长：7分47秒。\n\n'+'\n'.join(f"- {clock(s['start'])}：{s['title']}" for s in first['scenes'])+f"\n\n**视频最后的独立讲解题**\n\n{first_guide['question']}\n\n**教师参考答案**\n\n{first_guide['answer']}\n")
for l in items:
    p=root/f"lesson-{l['number']:02}";timing=json.loads((p/'timing.json').read_text(encoding='utf-8'));total+=timing['duration']
    rows.append(f"| {l['number']} | {l['title']} | {clock(timing['duration'])} | {l['scenes'][1]['title']} |")
    sections.append(f"## 第{l['number']}课：{l['title']}\n\n时长：{clock(timing['duration'])}。\n\n"+'\n'.join(f"- {clock(s['start'])}：{s['title']}" for s in timing['scenes'])+f"\n\n**视频最后的独立讲解题**\n\n{l['scenes'][-1]['data']['stem']}\n\n**教师参考答案**\n\n{l['challengeAnswer']}\n")
text='''# 多巴胺数学动画课堂 · 教师使用手册

本套视频配合现有12节课使用，保留A版晓晓女声和第一课已确认的多巴胺配色。视频用于完整例题讲解，不能替代学生独立思考、互动验证和上台表达。

## 怎样在网站里使用

进入「课程与教案 / 六周探险地图」选择课程，在「知识讲解」里直接播放。教师进入「教师教案」也能查看同一视频。播放器下方可点击章节，直接跳到相应讲解或最后的小老师任务；支持暂停、倍速和全屏。视频画面已带字幕，另附中文字幕轨道。

班级课程设置里的视频地址留空，就使用系统默认片；填写可播放的MP4/WebM直链可覆盖。自定义视频不显示默认片章节，避免跳错位置。清空后恢复默认片。

第1课先完成前测，再教学。第11课先完成后测，再看复盘；学生未提交B卷时，第11课显示完成测评的提示，教师可提前备课。复盘使用新例题，没有A/B卷答案。视频末题的参考解法仅在教师界面展开，学生视频中不显示。

## 建议课堂用法

1. 先让学生读完整题目，圈出条件和所求；允许用纸笔打草稿。
2. 按章节看视频，关键动作处暂停，让学生指出图形中的数量对应关系。
3. 看完变式后，操作网站互动动画，只改变一个条件，验证自己的预测。空间观察课可切换方格、镜像与遮挡；行程课可切换连续追及与中途停留。
4. 跳到视频最后的完整题，暂停并收起教师答案，让学生准备后上台讲解。
5. 再进入「独立练习」，完成与视频示范不同的三道题，保存个人答题记录。第2至12课使用新版练习；旧版答题记录保留在教师成长报告中。观看视频本身不会自动标记课堂完成或改变分数。

小老师讲解时重点听：是否说清题意、关键一步的理由、数与单位的对应、以及是否检查。学生可以停顿、看关键词、修正后再讲，无需背诵视频旁白。

## 视频总览

| 课次 | 内容 | 时长 | 图解重点 |
|---|---|---|---|
'''+ '\n'.join(rows)+f'\n\n总时长：{clock(total)}。\n\n'+ '\n'.join(sections)
(project/'课程视频使用手册.md').write_text(text,encoding='utf-8')
(root/'delivery-plan.json').write_text(json.dumps({'count':12,'totalSeconds':total,'totalDuration':clock(total)},ensure_ascii=False,indent=2),encoding='utf-8')
print(clock(total))
