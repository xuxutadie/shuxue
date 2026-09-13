"""可续做的批次渲染，成片逐条验证，未成功的文件不发布。"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parent
cli='C:/Users/6/AppData/Local/npm-cache/_npx/110f701c48e68d66/node_modules/hyperframes/dist/cli.js'
node='C:/Program Files/nodejs/node.exe'
env=dict(os.environ,HYPERFRAMES_BROWSER_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe')
def run(command,log,**kw):
    with log.open('w',encoding='utf-8') as handle:
        return subprocess.run(command,stdout=handle,stderr=handle,**kw)
def probe(file):
    return json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',str(file)],capture_output=True,text=True,check=True).stdout)
def render(folder):
    report=(folder/'check.json').read_text(encoding='utf-8');check=json.loads(report[report.index('{'):]);assert check['ok'],folder.name+'检查未通过'
    segments=json.loads((folder/'segments.json').read_text(encoding='utf-8'))
    digest=hashlib.sha256(b''.join(p.read_bytes() for p in [folder/'index.html',folder/'voice-meta.json',*sorted((folder/'compositions').glob('*.html'))])).hexdigest()
    for part in segments:
        name=part['name'];out=folder/'segments'/(name+'.mp4');receipt=out.with_suffix('.receipt.json')
        if out.exists() and receipt.exists() and json.loads(receipt.read_text())['hash']==digest:continue
        print(folder.name+' 开始渲染 '+name,flush=True)
        result=run([node,cli,'render',str(folder),'--composition','segments/'+name+'.html','--output',str(out),'--fps','24','--quality','high','--workers','1','--no-low-memory-mode','--experimental-fast-capture','--browser-gpu'],folder/(name+'-render.log'),env=env,cwd=root)
        if result.returncode and 'artifact validated' not in (folder/(name+'-render.log')).read_text(encoding='utf-8'):raise RuntimeError(folder.name+' '+name+'未完成')
        info=probe(out);assert abs(float(info['format']['duration'])-part['duration'])<.16
        receipt.write_text(json.dumps({'hash':digest,'seconds':part['duration']}),encoding='utf-8')
    movie=folder/'lesson.mp4';verified=folder/'video-verification.json'
    if movie.exists() and verified.exists() and json.loads(verified.read_text())['hash']==digest:
        print(folder.name+' 复用已验证成片',flush=True);return
    command=['ffmpeg','-y','-hide_banner'];filters=[];inputs=''
    for i,p in enumerate(segments):
        command+=['-i',str(folder/'segments'/(p['name']+'.mp4'))]
        filters+=[f'[{i}:v]trim=end_frame={round(p["duration"]*24)},setpts=PTS-STARTPTS[v{i}]',f'[{i}:a]atrim=end={p["duration"]:.9f},asetpts=PTS-STARTPTS[a{i}]'];inputs+=f'[v{i}][a{i}]'
    filters+=[inputs+f'concat=n={len(segments)}:v=1:a=1[v][a]']
    command+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-threads','3','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(movie)]
    run(command,folder/'assemble.log').check_returncode()
    timing=json.loads((folder/'timing.json').read_text(encoding='utf-8'));info=probe(movie)
    assert abs(float(info['format']['duration'])-timing['duration'])<.1
    assert any(s.get('width')==1920 and s.get('height')==1080 for s in info['streams'])
    assert any(s['codec_name']=='aac' for s in info['streams'])
    run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'],folder/'decode.log').check_returncode()
    assert (folder/'decode.log').stat().st_size==0
    run(['ffmpeg','-hide_banner','-i',str(movie),'-af','volumedetect','-vn','-f','null','-'],folder/'audio-check.log').check_returncode()
    frames=sorted(set(round((s['start']+s['duration']*.92)*24) for s in timing['scenes']))
    expr='+'.join(f'eq(n,{n})' for n in frames)
    run(['ffmpeg','-y','-v','error','-i',str(movie),'-vf',f"select='{expr}',scale=640:360,tile=2x4",'-frames:v','1',str(folder/'成片检查.jpg')],folder/'sheet.log').check_returncode()
    verified.write_text(json.dumps({'hash':digest,'seconds':float(info['format']['duration']),'bytes':int(info['format']['size']),'decode':'通过','video':'1920×1080 H264 24fps','audio':'AAC'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(folder.name+' 成片已验证 '+str(round(timing['duration']))+'秒',flush=True)
folders=[p for p in sorted(root.glob('lesson-*')) if (p/'index.html').exists() and (len(sys.argv)<2 or p.name in sys.argv[1:])]
with ThreadPoolExecutor(max_workers=int(os.environ.get('MATH_VIDEO_RENDER_JOBS','2'))) as executor:list(executor.map(render,folders))
print('本批次全部导出完成',flush=True)
