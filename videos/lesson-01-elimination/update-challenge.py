"""保存原稿后更新讲解末段与第一课练习，不改动其余题库。"""
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
project = root.parent.parent
backup = root / 'versions' / 'a-before-challenge'
backup.mkdir(parents=True, exist_ok=True)
for name in ['script.json', 'voice-meta.json', 'timing.json', 'SCRIPT.md', '第一课-字幕.srt', 'build.cjs', 'index.html']:
    if not (backup / name).exists():
        shutil.copy2(root / name, backup / name)
if not (backup / 'data.js').exists():
    shutil.copy2(project / 'data.js', backup / 'data.js')
if not (backup / 'voice-xiaoxiao').exists():
    shutil.copytree(root / 'assets' / 'voice-xiaoxiao', backup / 'voice-xiaoxiao')

scenes = json.loads((root / 'script.json').read_text(encoding='utf-8-sig'))
scenes[-1] = {
 'id': 'teach', 'title': '挑战升级：这一次，由你来讲', 'tag': '06 / 讲出来',
 'lines': [
  {'text': '现在，请你当小老师，独立挑战这道新题。', 'cue': 'intro'},
  {'text': '文具店同一种本子的单价相同，同一种笔的单价也相同，购买时没有折扣。', 'cue': 'condition'},
  {'text': '甲买三本本子和两支笔，共二十四元。乙买六本同样的本子和七支同样的笔，共五十七元。', 'cue': 'orders'},
  {'text': '每支笔多少元？每本本子多少元？请写出计算过程，并检验两张订单。', 'cue': 'ask'},
  {'text': '可以在草稿纸上画图、计算。请暂停视频，准备好以后，上台用自己的话讲清楚你的做法和理由。', 'cue': 'prepare', 'pause': 12}
 ]
}
(root / 'script.json').write_text(json.dumps(scenes, ensure_ascii=False, indent=2), encoding='utf-8')
build = (root / 'build.cjs').read_text(encoding='utf-8')
start = build.index('function teach(){')
end = build.index('\nconst content=', start)
build = build[:start] + '''function teach(){return `<p class="condition">文具店同一种本子的单价相同，同一种笔的单价也相同，购买时没有折扣。</p><div class="challenge-order"><span class="badge">甲的订单</span><b>3 本本子 ＋ 2 支笔</b><strong>共 24 元</strong></div><div class="challenge-order second"><span class="badge">乙的订单</span><b>6 本同样的本子 ＋ 7 支同样的笔</b><strong>共 57 元</strong></div><div class="ask">每支笔、每本本子各多少元？<span>写出计算过程，并用两张订单检验答案。</span></div><div class="tip">暂停视频 → 草稿纸上准备 → 上台讲清做法和理由</div>`;}
''' + build[end:]
build = build.replace("if(scene.id==='teach')for(const cue of ['line1','line2','line3','questions','bridge','end'])motion+=reveal(`teach-${cue}`,cue);", "// 挑战题完整呈现，学生自主讲解；不显示解法或教师追问。")
build = build.replace('.header{display:flex;', '.challenge-order{display:flex;align-items:center;gap:24px;padding:28px 24px;background:white;border:4px solid #243047;border-radius:24px;min-height:145px;box-shadow:6px 6px 0 #243047}.challenge-order b{font-size:42px}.challenge-order strong{margin-left:auto;font-size:52px;background:#FFDB58;padding:12px 24px;border-radius:18px;white-space:nowrap}.challenge-order.second strong{background:#75C9FF}.challenge-order .badge{font-size:30px;white-space:nowrap}.header{display:flex;')
build = build.replace('scene.duration=+(t+0.7).toFixed(3);total+=scene.duration;', '''scene.duration=+(t+0.7).toFixed(3);
 // 末段从完整视频帧开始，方便复用已验收的前五段画面与声音。
 if(scene.id==='variant')scene.duration=Math.ceil((total+scene.duration)*24)/24-total;
 total+=scene.duration;''')
# 同时导出独立末段入口，只重新渲染改动部分。
anchor = "fs.writeFileSync(path.join(root,'timing.json')"
pos = build.index(anchor)
build = build[:pos] + '''const tail=scenes.find(s=>s.id==='teach');
const tailAudio=tail.lines.map((l,i)=>`<audio id="tail-audio-${i}" src="${l.file}" data-start="${l.start}" data-duration="${l.duration}" data-track-index="10" data-volume="1"></audio>`).join('');
fs.writeFileSync(path.join(root,'tail.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>body{margin:0}#tail-main{position:relative;width:1920px;height:1080px;overflow:hidden}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div id="tail-main" data-composition-id="tail-main" data-width="1920" data-height="1080" data-duration="${tail.duration}"><div class="clip" id="teach" data-composition-id="teach" data-composition-src="compositions/teach.html" data-start="0" data-duration="${tail.duration}" data-track-index="0" data-width="1920" data-height="1080"></div>${tailAudio}</div><script>window.__timelines['tail-main']=gsap.timeline({paused:true});</script></body></html>`);
''' + build[pos:]
(root / 'build.cjs').write_text(build, encoding='utf-8')

data = (project / 'data.js').read_text(encoding='utf-8')
start = data.index('practice:[Q(')
end = data.index(']},', start)
replacement = """practice:[Q('文具店同种商品单价固定，没有折扣。甲买3本本子和4支笔共37元，乙买3本同样的本子和7支同样的笔共49元。买2本这样的本子和5支这样的笔，共需多少元？',34,'① 本子数量相同，价差只对应多出的笔：(49－37)÷(7－4)＝4（元/支）。② 每本本子：(37－4×4)÷3＝7（元）。③ 所求总价：2×7＋5×4＝34（元）。检验原订单：3×7＋4×4＝37，3×7＋7×4＝49。注意：求出笔价后还没有回答最后的问题。','消去方程'),Q('文具店同种商品单价固定，没有折扣。甲买2本练习本和3支笔共29元，乙买4本同样的练习本和7支同样的笔共61元。每本练习本多少元？',10,'① 把甲的整张订单乘2：4本练习本和6支笔共58元。所有商品数量和总价都要一起乘2。② 与乙比较：多1支笔，多付61－58＝3元，所以每支笔3元。③ 每本练习本：(29－3×3)÷2＝10（元）。检验：2×10＋3×3＝29，4×10＋7×3＝61。','消去方程'),Q('玩具店每盒同款拼图价格相同，每盒同款彩笔价格相同，没有折扣。甲买3盒拼图和2盒彩笔共54元，乙买2盒同样的拼图和3盒同样的彩笔共51元。买1盒拼图和1盒彩笔共需多少元？',21,'方法一：两张订单合起来，5盒拼图和5盒彩笔共54＋51＝105元，正好能分成5份“1盒拼图＋1盒彩笔”，每份105÷5＝21（元）。方法二：甲整体乘2得6盒拼图＋4盒彩笔＝108元；乙整体乘3得6盒拼图＋9盒彩笔＝153元。相减得5盒彩笔45元，每盒彩笔9元；每盒拼图(54－2×9)÷3＝12元。所求12＋9＝21元。检验：3×12＋2×9＝54，2×12＋3×9＝51。','消去方程')"""
data = data[:start] + replacement + data[end:]
(project / 'data.js').write_text(data, encoding='utf-8')
test = project / 'tests' / 'online.test.cjs'
test.write_text(test.read_text(encoding='utf-8').replace("{answer:'2'});assert.equal(r.data.correct,true)", "{answer:bank.lessons[0].practice[0].answer});assert.equal(r.data.correct,true)"), encoding='utf-8')
print('已备份并更新：视频末段、第一课3题、测试中的正确答案引用。')
