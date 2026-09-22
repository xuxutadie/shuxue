"""仅在两段成片都完成后更新课程清单；旧片保留。"""
import json, shutil, subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
project=root.parent.parent
media=project/'public/media/lessons'
def duration(file):
    return float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(file)]))['format']['duration'])
def stamp(n):
    ms=round(n*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

original=json.loads((root.parent/'course-series/lesson-03/timing.json').read_text(encoding='utf8'))
timing=json.loads((root/'timing.json').read_text(encoding='utf8'))
assert json.loads((root/'video-verification.json').read_text(encoding='utf8'))['decode']=='通过'
movie=media/'lesson-03-example-2-v2.mp4'
shutil.copyfile(root/'lesson.mp4',movie)
shutil.copyfile(root/'captions.vtt',media/'lesson-03-example-2-v2.vtt')
subprocess.run(['ffmpeg','-y','-v','error','-ss','4','-i',str(movie),'-frames:v','1','-update','1',str(media/'lesson-03-example-2-v2.jpg')],check=True)
end=original['scenes'][4]['start']
captions=[c for c in original['captions'] if c['start']<end]
(media/'lesson-03-example-1-v2.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(min(c["end"],end))}\n{c["text"]}' for i,c in enumerate(captions))+'\n',encoding='utf8')
parts=[]
for number,title,desc,scenes in [
    (1,'例题1 · 彩色列车的循环','找出四节一组，理解有余数和刚好整除时的位置。',original['scenes'][:4]),
    (2,'例题2 · 加4减1，跟着棋子找规律','先走格子，圈出完整组，再处理第7次；最后解释算式中每个数的含义。',timing['scenes'])]:
    prefix=f'/media/lessons/lesson-03-example-{number}-v2'
    seconds=duration(media/Path(prefix+'.mp4').name)
    parts.append(dict(title=title,description=desc,src=prefix+'.mp4',poster=prefix+'.jpg',captions=prefix+'.vtt',duration=seconds,chapters=[dict(title=s['title'],start=round(s['start'],3)) for s in scenes]))
catalog=project/'public/course-videos.js'
text=catalog.read_text(encoding='utf8')
data=json.loads(text[text.index('['):text.rindex(']')+1])
next(v for v in data if v['lessonId']==2)['examples']=parts
catalog.write_text('// 已完成的课程视频；仅含学生可见资源，不含教师答案。\nconst COURSE_VIDEOS='+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
(root/'publication.json').write_text(json.dumps(parts,ensure_ascii=False,indent=2),encoding='utf8')
print('已发布第三课两段独立例题视频', [p['duration'] for p in parts])
