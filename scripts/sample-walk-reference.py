"""从本地行走参考提取关节轨迹，不将参考人物网格或贴图带入成品。"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=args.source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
walk=next(a for a in bpy.data.actions if a.name=='Walk')
rig.animation_data.action=walk
names=['Hips','Spine','Spine1','Spine2','Neck','Head',
       'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
       'RightShoulder','RightArm','RightForeArm','RightHand',
       'LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase',
       'RightUpLeg','RightLeg','RightFoot','RightToeBase']
bone_names={name:next(b.name for b in rig.data.bones if b.name.endswith(':'+name) or b.name==name) for name in names}
start,end=walk.frame_range
out={'source':'https://threejs.org/examples/models/gltf/Soldier.glb',
     'sha256':hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),
     'range':[start,end],'fps':60,'frames':[]}
for i in range(73):
    frame=start+(end-start)*i/72
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
    bpy.context.view_layer.update()
    out['frames'].append({n:list(rig.matrix_world@rig.pose.bones[bone_names[n]].head) for n in names})
Path(args.output).write_text(json.dumps(out,ensure_ascii=False),encoding='utf-8')
print('SAMPLED',len(out['frames']),'frames',flush=True)
