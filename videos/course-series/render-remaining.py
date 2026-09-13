"""等待首批释放渲染资源后，继续其余课及已校正的第七课。"""
import json,subprocess,time,sys
from pathlib import Path
root=Path(__file__).resolve().parent
waiting=[3,9,10,11,12]
print('剩余课已排入队列，等待首批释放渲染资源。',flush=True)
while not all((root/f'lesson-{i:02}'/'video-verification.json').exists() for i in waiting):
    time.sleep(20)
print('开始后续批次。',flush=True)
subprocess.run([sys.executable,str(root/'render-all.py'),'lesson-02','lesson-04','lesson-05','lesson-06','lesson-07','lesson-08'],check=True)
print('全部课程渲染完成。',flush=True)
