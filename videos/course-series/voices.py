"""串行处理各课，课内三路配音；避免大量请求同时占用服务。"""
import subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent
for folder in sorted(root.glob('lesson-*')):
    if not (folder/'script.json').exists(): continue
    print('开始配音 '+folder.name,flush=True)
    with (folder/'voice.log').open('w',encoding='utf-8') as log:
        subprocess.run([sys.executable,str(folder/'make-voice-a.py')],check=True,stdout=log,stderr=log)
    print('配音完成 '+folder.name,flush=True)
