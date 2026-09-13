"""独立检查导出成片与配套动画的前中后画面。"""
import json
import subprocess
from pathlib import Path

root=Path(__file__).resolve().parent
video=root/'第一课-消去问题-多巴胺配套版.mp4'
timing=json.loads((root/'timing.json').read_text(encoding='utf-8'))
result=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels','-of','json',str(video)],check=True,capture_output=True,text=True)
info=json.loads(result.stdout)
(root/'video-info.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
assert abs(float(info['format']['duration'])-timing['duration'])<.1
assert any(s.get('width')==1920 and s.get('height')==1080 for s in info['streams'])
assert any(s.get('codec_name')=='aac' for s in info['streams'])
with (root/'decode.log').open('w',encoding='utf-8') as log:
    subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True,stdout=log,stderr=log)
assert (root/'decode.log').stat().st_size==0
with (root/'audio-check.log').open('w',encoding='utf-8') as log:
    subprocess.run(['ffmpeg','-hide_banner','-i',str(video),'-af','volumedetect','-vn','-sn','-f','null','-'],check=True,stdout=log,stderr=log)

def sheet(times,name,layout):
    frames=sorted(set(round(t*24) for t in times))
    selected='+'.join(f'eq(n,{n})' for n in frames)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f"select='{selected}',scale=480:270,tile={layout}",'-frames:v','1',str(root/name)],check=True)

sheet([s['start']+s['duration']*.8 for s in timing['scenes']],'成片-十段检查.png','2x5')
scenes={s['id']:s for s in timing['scenes']}
def cue(name,key,offset):
    s=scenes[name];return s['start']+next(l['start'] for l in s['lines'] if l['cue']==key)+offset

times=[cue('bundle','pair',.1),cue('bundle','pair',2),cue('bundle','divide',4),
       cue('usebundle','pair',.1),cue('usebundle','pair',4),cue('usebundle','left',4),
       cue('prices','pencils',5),cue('prices','kit',2),cue('prices','eraser',4)]
sheet(times,'成片-配套动效检查.png','3x3')
print(json.dumps({'duration':info['format']['duration'],'bytes':info['format']['size'],'decode':'通过','sheets':2},ensure_ascii=False))
