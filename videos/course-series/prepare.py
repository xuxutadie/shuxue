"""为每课准备可独立重做的工作目录，配音缓存只在内容吻合时复用。"""
import json, shutil
from pathlib import Path
from content import lessons, ROOT
for lesson in lessons:
    folder=ROOT/f"lesson-{lesson['number']:02}"
    folder.mkdir(exist_ok=True,parents=True)
    (folder/'script.json').write_text(json.dumps(lesson['scenes'],ensure_ascii=False,indent=2),encoding='utf-8')
    (folder/'lesson.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2),encoding='utf-8')
    shutil.copy2(ROOT.parent/'lesson-01-pairs/make-voice-a.py',folder/'make-voice-a.py')
    shutil.copy2(ROOT/'BRIEF.md',folder/'BRIEF.md')
(ROOT/'lessons.json').write_text(json.dumps(lessons,ensure_ascii=False,indent=2),encoding='utf-8')
print('11课工作目录和脚本已就绪')
