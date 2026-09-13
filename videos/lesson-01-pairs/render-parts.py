"""分段渲染并按精确时长拼接，复用已安装工具，避免长片大量临时图片。"""
import hashlib
import json
import os
import subprocess
from pathlib import Path

root=Path(__file__).resolve().parent
cli=Path('C:/Users/6/AppData/Local/npm-cache/_npx/110f701c48e68d66/node_modules/hyperframes/dist/cli.js')
parts=json.loads((root/'segments.json').read_text(encoding='utf-8'))
fingerprint=hashlib.sha256(b''.join((root/n).read_bytes() for n in ['index.html','build.cjs','script.json','voice-meta.json'])).hexdigest()
env=dict(os.environ,HYPERFRAMES_BROWSER_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe')

def probe(file):
    result=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(file)],check=True,capture_output=True,text=True)
    return float(json.loads(result.stdout)['format']['duration'])

for part in parts:
    name=part['name']; output=root/'segments'/(name+'.mp4'); receipt=output.with_suffix('.receipt.json')
    cached=output.exists() and receipt.exists() and json.loads(receipt.read_text())['hash']==fingerprint
    if not cached:
        print('开始渲染 '+name,flush=True)
        with (root/(name+'-render.log')).open('w',encoding='utf-8') as log:
            result=subprocess.run(['C:/Program Files/nodejs/node.exe',str(cli),'render',str(root),
                '--composition','segments/'+name+'.html','--output',str(output),'--fps','24',
                '--quality','high','--workers','1','--no-low-memory-mode','--experimental-fast-capture','--browser-gpu'],
                env=env,cwd=root.parent.parent,stdout=log,stderr=log)
        # 该版本CLI有已知的完成后非零退出问题；要求产物验证日志和实际文件同时成立。
        if result.returncode and 'artifact validated' not in (root/(name+'-render.log')).read_text(encoding='utf-8'):
            raise RuntimeError(name+'未完成，请检查渲染日志')
        assert abs(probe(output)-part['duration'])<.15
        receipt.write_text(json.dumps({'hash':fingerprint,'duration':probe(output),'cli_exit':result.returncode}),encoding='utf-8')
    print(name+'已验证',flush=True)

command=['ffmpeg','-y','-hide_banner']
filters=[];inputs=''
for i,part in enumerate(parts):
    command+=['-i',str(root/'segments'/(part['name']+'.mp4'))]
    filters += [f'[{i}:v]trim=end_frame={round(part["duration"]*24)},setpts=PTS-STARTPTS[v{i}]',
                f'[{i}:a]atrim=end={part["duration"]:.9f},asetpts=PTS-STARTPTS[a{i}]']
    inputs+=f'[v{i}][a{i}]'
filters += [inputs+f'concat=n={len(parts)}:v=1:a=1[v][a]']
command += ['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18',
            '-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',
            str(root/'第一课-消去问题-多巴胺配套版.mp4')]
print('分段完成，开始合成完整视频',flush=True)
with (root/'assemble.log').open('w',encoding='utf-8') as log:
    subprocess.run(command,check=True,stdout=log,stderr=log)
print('完整视频已导出',flush=True)
