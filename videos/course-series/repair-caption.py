"""重建第二课字幕，只复用经逐文件比对完全相同的前半段。"""
import hashlib,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
folder=root/'lesson-02'
part=folder/'segments/part-1.html'
dependencies=[part,folder/'voice-meta.json',*[folder/p for p in re.findall(r'data-composition-src="([^"]+)"',part.read_text(encoding='utf-8'))]]
before={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in dependencies}
old=json.loads((folder/'video-verification.json').read_text(encoding='utf-8'))['hash']
subprocess.run(['C:/Program Files/nodejs/node.exe',str(root/'build.cjs'),'lesson-02'],check=True)
after={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in dependencies}
assert before==after,'前半段内容发生变化，不能复用'
digest=hashlib.sha256(b''.join(p.read_bytes() for p in [folder/'index.html',folder/'voice-meta.json',*sorted((folder/'compositions').glob('*.html'))])).hexdigest()
receipt=folder/'segments/part-1.receipt.json'
data=json.loads(receipt.read_text(encoding='utf-8'))
assert data['hash']==old
data.update(hash=digest,reuseEvidence={'previousHash':old,'unchangedDependencies':before})
receipt.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('第二课已修正；前半段依赖逐文件一致，可直接复用。')
