"""最后一组腾出一个位置后，导出第二课修订字幕，最多同时两课。"""
import hashlib,json,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parent
def ready(n):
    folder=root/f'lesson-{n:02}'
    report=folder/'video-verification.json'
    if not report.exists():return False
    digest=hashlib.sha256(b''.join(p.read_bytes() for p in [folder/'index.html',folder/'voice-meta.json',*sorted((folder/'compositions').glob('*.html'))])).hexdigest()
    return json.loads(report.read_text(encoding='utf-8'))['hash']==digest
print('第二课字幕修订已排队。',flush=True)
while not all(ready(n) for n in [4,5,6,7]):time.sleep(20)
subprocess.run([sys.executable,str(root/'render-all.py'),'lesson-02'],check=True)
