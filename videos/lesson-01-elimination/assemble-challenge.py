"""复用已验收的前五段，将新挑战段接入；按完整帧切割并重新编码。"""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
timing = json.loads((root / 'timing.json').read_text(encoding='utf-8'))
cut = next(scene['start'] for scene in timing['scenes'] if scene['id'] == 'teach')
frames = round(cut * 24)
assert abs(cut - frames / 24) < 0.0001
filters = (
    f'[0:v]trim=end_frame={frames},setpts=PTS-STARTPTS[v0];'
    f'[0:a]atrim=end={cut:.9f},asetpts=PTS-STARTPTS[a0];'
    '[1:v]setpts=PTS-STARTPTS[v1];[1:a]asetpts=PTS-STARTPTS[a1];'
    '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
)
subprocess.run([
    'ffmpeg', '-y', '-hide_banner',
    '-i', str(root / '第一课-消去问题-A版女声.mp4'),
    '-i', str(root / '讲出来-挑战段.mp4'),
    '-filter_complex', filters, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-r', '24',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', str(root / '第一课-消去问题-A版女声-进阶挑战.mp4')
], check=True)
