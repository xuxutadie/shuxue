"""只发布已验证成片、字幕和封面；源稿与教师答案留在非静态目录。"""
import json,shutil,subprocess,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
project=root.parent.parent
media=project/'public/media/lessons'
media.mkdir(parents=True,exist_ok=True)
lessons=json.loads((root/'lessons.json').read_text(encoding='utf-8'))
catalog=[];guides={}
# 整套资源核对通过后才能更新目录，避免把尚未完成的课从网站清单移除。
for number in range(2,13):
    folder=root/f'lesson-{number:02}'
    fingerprint=hashlib.sha256(b''.join(p.read_bytes() for p in [folder/'index.html',folder/'voice-meta.json',*sorted((folder/'compositions').glob('*.html'))])).hexdigest()
    if not (folder/'video-verification.json').exists() or json.loads((folder/'video-verification.json').read_text(encoding='utf8'))['hash']!=fingerprint:
        raise RuntimeError(f'第{number}课尚未完成成片验证，保留原网站目录。')
for number in range(1,13):
    folder=root.parent/'lesson-01-pairs' if number==1 else root/f'lesson-{number:02}'
    video=folder/'第一课-消去问题-多巴胺配套版.mp4' if number==1 else folder/'lesson.mp4'
    if not video.exists(): continue
    # 交付前必须有时长和完整解码的验证记录。
    report=folder/'video-verification.json'
    if not report.exists(): continue
    if number>1:
        fingerprint=hashlib.sha256(b''.join(p.read_bytes() for p in [folder/'index.html',folder/'voice-meta.json',*sorted((folder/'compositions').glob('*.html'))])).hexdigest()
        if json.loads(report.read_text(encoding='utf-8'))['hash']!=fingerprint:continue
    timing=json.loads((folder/'timing.json').read_text(encoding='utf-8'))
    version='v2' if number in [2,4,5,6,8,9,10,11,12] else 'v1'
    name=f'lesson-{number:02}-dopamine-{version}'
    target=media/(name+'.mp4')
    # 同样大小也可能是修订版，按内容核对后再替换。
    def file_hash(path):
        with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
    if not target.exists() or file_hash(target)!=file_hash(video):shutil.copy2(video,target)
    caps=folder/'captions.vtt'
    if number==1:
        src=next(folder.glob('*.srt')).read_text(encoding='utf-8')
        import re
        caps.write_text('WEBVTT\n\n'+re.sub(r'(\d{2}:\d{2}:\d{2}),(\d{3})',r'\1.\2',src),encoding='utf-8')
    shutil.copy2(caps,media/(name+'.vtt'))
    poster=media/(name+'.jpg')
    if not poster.exists():subprocess.run(['ffmpeg','-v','error','-y','-ss','3','-i',str(video),'-frames:v','1','-vf','scale=960:540',str(poster)],check=True)
    info={'lessonId':number-1,'title':'消去问题 · 配成一套' if number==1 else lessons[number-2]['title'],
          'src':'/media/lessons/'+name+'.mp4','captions':'/media/lessons/'+name+'.vtt','poster':'/media/lessons/'+name+'.jpg',
          'duration':round(timing['duration'],3),'chapters':[{'title':s['title'],'start':round(s['start'],3)} for s in timing['scenes']],
          'afterAssessment':number==11}
    catalog.append(info)
    if number==1:
        guides['0']={'question':'美术小组买4盒彩笔和4本绘画本共64元；2盒彩笔和5本绘画本共47元，同种商品单价相同，无折扣。3盒彩笔和6本绘画本共多少钱？','answer':'一套16元；3本绘画本47−2×16＝15元，每本5元，每盒彩笔11元。所求3×11＋6×5＝63元。'}
    else:
        l=lessons[number-2];guides[str(number-1)]={'question':l['scenes'][-1]['data']['stem'],'answer':l['challengeAnswer']}
(project/'public/course-videos.js').write_text('// 已完成的课程视频；仅含学生可见资源，不含教师答案。\nconst COURSE_VIDEOS='+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(project/'server/video-guides.json').write_text(json.dumps(guides,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'publication.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'已发布{len(catalog)}课视频与字幕。')
