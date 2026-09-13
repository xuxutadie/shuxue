"""验证最终成片的编码、完整解码、音量和教学动画关键帧。"""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
video = root / '第一课-消去问题-原题精讲动画版.mp4'
timing = json.loads((root / 'timing.json').read_text(encoding='utf-8'))
probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
    'format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels',
    '-of', 'json', str(video)], check=True, capture_output=True, text=True)
info = json.loads(probe.stdout)
(root / 'video-info.json').write_text(json.dumps(info, indent=2), encoding='utf-8')
assert abs(float(info['format']['duration']) - timing['duration']) < .1
assert any(s.get('width') == 1920 and s.get('height') == 1080 for s in info['streams'])
assert any(s.get('codec_name') == 'aac' for s in info['streams'])
with (root / 'decode.log').open('w', encoding='utf-8') as log:
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True, stdout=log, stderr=log)
assert (root / 'decode.log').stat().st_size == 0
with (root / 'audio-check.log').open('w', encoding='utf-8') as log:
    subprocess.run(['ffmpeg', '-hide_banner', '-i', str(video), '-af', 'volumedetect', '-vn', '-sn', '-f', 'null', '-'], check=True, stdout=log, stderr=log)

def sheet(times, name):
    frames = sorted(set(round(t * 24) for t in times))
    select = '+'.join(f'eq(n,{frame})' for frame in frames)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-vf',
        f"select='{select}',scale=480:270,tile=3x4", '-frames:v', '1', str(root / name)], check=True)

sheet([s['start'] + s['duration'] * .8 for s in timing['scenes']], '成片-十二段画面检查.png')
scenes = {s['id']: s for s in timing['scenes']}

def cue(scene_id, name, offset):
    scene = scenes[scene_id]
    line = next(line for line in scene['lines'] if line['cue'] == name)
    return scene['start'] + line['start'] + offset

proofs = [cue('pair', 'books', 3), cue('pair', 'cups', 8), cue('pair', 'extra', 5),
          cue('copya', 'copies', .2), cue('copya', 'copies', 1.8), cue('copya', 'copies', 5),
          cue('copyb', 'copies', .2), cue('copyb', 'copies', 2.2), cue('copyb', 'copies', 5),
          cue('eliminate', 'pencils', .2), cue('eliminate', 'erasers', 4), cue('eliminate', 'unit', 4)]
sheet(proofs, '成片-动效过程检查.png')
(root / 'motion-proof-times.json').write_text(json.dumps(proofs, indent=2), encoding='utf-8')
print(json.dumps({'duration': info['format']['duration'], 'bytes': info['format']['size'],
                  'decode': '通过', 'contact_sheets': 2}, ensure_ascii=False))
