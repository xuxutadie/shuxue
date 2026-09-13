"""为已确认的配套讲法创建独立视频版本，保留旧版文件。"""
import json
import shutil
from pathlib import Path

base = Path(__file__).resolve().parent
old = base / 'lesson-01-original'
new = base / 'lesson-01-pairs'
new.mkdir(exist_ok=True)
for name in ['build.cjs', 'make-voice-a.py']:
    if not (new / name).exists():
        shutil.copy2(old / name, new / name)
if not (new / 'assets').exists():
    shutil.copytree(old / 'assets', new / 'assets')
original = json.loads((old / 'script.json').read_text(encoding='utf-8'))
scenes = original[:5]
scenes[0]['tag'] = '01 / 读懂问题'
scenes[4]['title'] = '两种数量都变了，怎样想？'
scenes[4]['tag'] = '05 / 换个角度'
scenes[4]['lines'][0]['text'] = '再看一道题，这次两种商品的数量都变了。先完整读题，再找容易入手的条件。'
scenes[4]['lines'][-1]['text'] = '这一次，橡皮和铅笔的数量都变了。不过，第二种买法里的橡皮和铅笔恰好一样多。我们可以从这里入手。'
scenes += [
 {'id':'bundle','title':'4套共12元，每套多少钱？','tag':'06 / 配成一套','lines':[
  {'cue':'read','text':'先看第二种买法：四块橡皮和四支铅笔，共十二元。把一块橡皮和一支铅笔配成一套。'},
  {'cue':'pair','text':'看，每一块橡皮都和一支铅笔配对，正好组成四套。每套的东西完全一样，所以每套的价钱也一样。'},
  {'cue':'divide','text':'四套共十二元，平均分成四份，十二除以四，每套三元。'},
  {'cue':'meaning','text':'注意，三元是一块橡皮加一支铅笔的总价，还不是任何一种商品的单价。我们先求出一套的价钱，再去看另一种买法。'}
 ]},
 {'id':'usebundle','title':'圈出3套，还剩下什么？','tag':'07 / 找到剩余','lines':[
  {'cue':'read','text':'第一种买法，是三块橡皮和五支铅笔，共十点六元。我们就在这些商品里配一配，不增加，也不拿走商品。'},
  {'cue':'pair','text':'三块橡皮，分别配上三支铅笔，正好圈出三套。每套三元，三套一共九元。'},
  {'cue':'left','text':'五支铅笔里，用了三支来配套，还剩两支。这两支铅笔，不属于刚才圈出的三套。'},
  {'cue':'subtract','text':'十点六元里面，九元付给了三套商品。剩下的十点六减九，等于一点六元，就是这两支铅笔的总价。'},
  {'cue':'reason','text':'这样，我们先算出相同组合的费用，再从总价里扣除。剩下的钱，只对应剩下的两支铅笔，问题就简单了。'}
 ]},
 {'id':'prices','title':'先求铅笔，再拆开一套','tag':'08 / 求出单价','lines':[
  {'cue':'pencils','text':'两支同品种的铅笔共一点六元，平均分成两份，每支铅笔零点八元。'},
  {'cue':'kit','text':'再看我们刚才配好的一套。一块橡皮加一支铅笔，一共三元。'},
  {'cue':'eraser','text':'从三元里扣掉铅笔的零点八元，剩下二点二元，就是一块橡皮的价格。'},
  {'cue':'why','text':'我们先算铅笔，是因为配好三套后，恰好剩下两支铅笔。选择先算什么，要看题目里的条件怎样整理更方便。'}
 ]},
 {'id':'verify','title':'放回原来的两次购买，检验','tag':'09 / 检验方法','lines':[
  {'cue':'first','text':'把橡皮二点二元、铅笔零点八元，放回第一种买法。三块橡皮六点六元，五支铅笔四元，共十点六元，符合。'},
  {'cue':'second','text':'第二种买法：四块橡皮八点八元，四支铅笔三点二元，共十二元，也符合。'},
  {'cue':'summary','text':'这道题的路线是：配成相同的一套，先求一套的价钱；再圈出已知费用的部分，算剩下的商品，最后代回检验。'},
  {'cue':'limit','text':'配套方便，是因为这道题恰好有四块橡皮和四支铅笔，可以分成四个相同组合。以后遇到新题，也要先观察条件，不能看到两种商品就照搬。'}
 ]},
 {'id':'challenge','title':'换你来讲：算出新的购物总价','tag':'10 / 小老师讲堂','lines':[
  {'cue':'intro','text':'现在，换你当小老师。先完整读题，再独立想办法。'},
  {'cue':'first','text':'美术小组购买绘画用品。四盒彩笔和四本绘画本共六十四元；两盒同样的彩笔和五本同样的绘画本共四十七元。'},
  {'cue':'second','text':'同种商品的单价相同，购买时没有折扣。活动还需要购买三盒彩笔和六本绘画本，一共应付多少元？'},
  {'cue':'ask','text':'请写出完整的计算过程，并说明每一步的理由。'},
  {'cue':'pause','text':'暂停视频，可以在草稿纸上画图和计算。准备好以后，上台讲清你的思路，并检查原来的两组条件。','pause':10}
 ]}
]
(new / 'script.json').write_text(json.dumps(scenes, ensure_ascii=False, indent=2), encoding='utf-8')
print('已创建配套讲解版，复用现有女声素材与工具。')
