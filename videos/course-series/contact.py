"""将每课各章唯一快照排成检查表，不改变源图。"""
import json,re
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parent
for folder in sorted(root.glob('lesson-*')):
    if not (folder/'snapshots').exists():continue
    timing=json.loads((folder/'timing.json').read_text(encoding='utf-8'))
    files=list((folder/'snapshots').glob('frame-*-at-*.png'))
    if not files:continue
    sheet=Image.new('RGB',(1280,4*385),'#FFF9E9');d=ImageDraw.Draw(sheet)
    for i,s in enumerate(timing['scenes']):
        at=s['start']+s['duration']*.72
        # 同一时间点可能留下不同批次的快照；优先取最近一次生成的图。
        file=min(files,key=lambda p:(round(abs(float(re.search(r'at-([\d.]+)s',p.name)[1])-at),3),-p.stat().st_mtime))
        image=Image.open(file).convert('RGB').resize((640,360))
        x=(i%2)*640;y=(i//2)*385
        sheet.paste(image,(x,y+25));d.text((x+8,y+5),f'{folder.name} chapter {i+1} | {at:.1f}s',fill='#243047')
    sheet.save(folder/'review.jpg')
print('逐课检查表已生成')
