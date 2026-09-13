"""批次检查：只使用现有HyperFrames，不改变依赖版本。"""
import subprocess,os,json,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parent
cli='C:/Users/6/AppData/Local/npm-cache/_npx/110f701c48e68d66/node_modules/hyperframes/dist/cli.js'
node='C:/Program Files/nodejs/node.exe'
env=dict(os.environ,HYPERFRAMES_BROWSER_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe')
folders=[p for p in sorted(root.glob('lesson-*')) if (p/'index.html').exists() and (len(sys.argv)<2 or p.name in sys.argv[1:])]
def check(folder):
    timing=json.loads((folder/'timing.json').read_text(encoding='utf-8'))
    ats=','.join(str(round(s['start']+s['duration']*.72,3)) for s in timing['scenes'])
    with (folder/'check.json').open('w',encoding='utf-8') as log:
        result=subprocess.run([node,cli,'check',str(folder),'--json','--snapshots','--at',ats],cwd=root,env=env,stdout=log,stderr=log)
    print(folder.name+' 检查 '+str(result.returncode),flush=True)
    # 独立快照覆盖每个章节，便于完整视觉检查。
    if result.returncode==0:
        with (folder/'snapshot.log').open('w',encoding='utf-8') as log:
            subprocess.run([node,cli,'snapshot',str(folder),'--at',ats],cwd=root,env=env,stdout=log,stderr=log,check=True)
    return result.returncode
with ThreadPoolExecutor(max_workers=2) as executor:
    results=list(executor.map(check,folders))
sys.exit(1 if any(results) else 0)
