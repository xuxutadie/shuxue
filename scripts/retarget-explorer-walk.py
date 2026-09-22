"""将行走参考的节奏适配到现有少年骨架，保留角色、贴图和站立动画。"""
import bpy, json, math, sys, argparse
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--reference',required=True,help='经过采样的行走关节位置 JSON')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
out=ROOT/'artifacts/explorer-rigged-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'explorer-rigged-v1.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
scene=bpy.context.scene;scene.render.fps=60;scene.frame_start=1;scene.frame_end=73
SCALE=2/1.1267300844192505
reference=json.loads(Path(args.reference).read_text(encoding='utf-8'))
names=list(reference['frames'][0])
samples=np.array([[f[n] for n in names] for f in reference['frames'][:-1]])
# 参考朝 +Y，本模型朝 -Y；以周期低通滤波消除参考接缝的小噪点。
samples[:,:,:2]*=-1
freq=np.fft.rfft(samples,axis=0);freq[11:]=0
samples=np.fft.irfft(freq,n=len(samples),axis=0)
mean_hips=samples[:,names.index('Hips'),:].mean(axis=0)
# 成年参考的重心冲击较大；保留主节奏，减小高频颠簸以适合少年身材。
pelvis_samples=np.stack([samples[:,names.index('Hips'),0],samples[:,names.index('Hips'),1],
 (samples[:,names.index('LeftUpLeg'),2]+samples[:,names.index('RightUpLeg'),2])/2],axis=1)
pelvis_freq=np.fft.rfft(pelvis_samples,axis=0);pelvis_freq[4:]=0
pelvis_samples=np.fft.irfft(pelvis_freq,n=len(samples),axis=0)
pelvis_samples[:,2]=pelvis_samples[:,2].mean()+.68*(pelvis_samples[:,2]-pelvis_samples[:,2].mean())
for track in list(rig.animation_data.nla_tracks):
    if track.name=='Walk':rig.animation_data.nla_tracks.remove(track)
rig.animation_data.action=None
for act in list(bpy.data.actions):
    if act.name=='Walk':bpy.data.actions.remove(act)
walk=bpy.data.actions.new('Walk');walk.use_fake_user=True;rig.animation_data.action=walk

def put(name,head,rotation,poses):
    rest=rig.data.bones[name];parent=rest.parent
    desired=Matrix.Translation(head)@rotation.to_matrix().to_4x4()
    base=poses[parent.name]@parent.matrix_local.inverted()@rest.matrix_local if parent else rest.matrix_local
    basis=base.inverted()@desired
    pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION'
    pb.rotation_quaternion=basis.to_quaternion()
    if name=='Hips':pb.location=basis.to_translation()
    poses[name]=desired

def head_at(name,poses):
    b=rig.data.bones[name]
    return poses[b.parent.name]@b.parent.matrix_local.inverted()@b.head_local

def point_bone(name,direction,poses):
    b=rig.data.bones[name]
    q=(b.tail_local-b.head_local).rotation_difference(direction)@b.matrix_local.to_quaternion()
    put(name,head_at(name,poses),q,poses)

sole_points={}
for side,sign in [('L',1),('R',-1)]:
    ankle=rig.data.bones['Foot.'+side].head_local/SCALE
    sole_points[side]=[v.co/SCALE-ankle for v in mesh.data.vertices if v.co.z/SCALE<.08 and v.co.x*sign>0]

def leg(side,target,pitch,poses):
    upper=rig.data.bones['Thigh.'+side];lower=rig.data.bones['Shin.'+side]
    hip=head_at(upper.name,poses);ankle=Vector(target)*SCALE
    delta=ankle-hip;distance=delta.length
    if distance>=upper.length+lower.length-.00001:
        raise RuntimeError(f'参考迈步超出少年腿长 {side}: {distance}')
    direction=delta.normalized()
    along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    pole=Vector((0,-1,0));bend=(pole-direction*pole.dot(direction)).normalized()
    knee=hip+along*direction+math.sqrt(max(0,upper.length**2-along**2))*bend
    point_bone(upper.name,knee-hip,poses)
    point_bone(lower.name,ankle-knee,poses)
    foot=rig.data.bones['Foot.'+side]
    put(foot.name,ankle,Quaternion((1,0,0),-pitch)@foot.matrix_local.to_quaternion(),poses)
    # 脚趾跟随脚掌，鞋底保持完整；不在鞋面上制造不自然的折痕。
    toe=rig.data.bones['Toe.'+side]
    poses[toe.name]=poses[foot.name]@foot.matrix_local.inverted()@toe.matrix_local

foot_means={side:samples[:,names.index(ref+'Foot'),0].mean() for side,ref in [('L','Left'),('R','Right')]}
ground_limits=[]
for frame in range(1,74):
    f={n:Vector(samples[(frame-1)%72,i]) for i,n in enumerate(names)}
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion()
    poses={'Root':rig.data.bones['Root'].matrix_local.copy()}
    center=pelvis_samples[(frame-1)%72]
    h=Vector(((center[0]-mean_hips[0])*.40,(center[1]-mean_hips[1])*.38,center[2]*.525+.018))*SCALE
    across=f['LeftUpLeg']-f['RightUpLeg']
    yaw=math.atan2(across.y,across.x)*.75
    roll=math.atan2(across.z,across.x)*.65
    pelvis_rotation=Quaternion((0,0,1),yaw)@Quaternion((0,1,0),-roll)@rig.data.bones['Hips'].matrix_local.to_quaternion()
    put('Hips',h,pelvis_rotation,poses)
    for target,a,b in [('Spine','Hips','Spine1'),('Chest','Spine1','Neck'),('Neck','Neck','Head'),('Head','Spine2','Head')]:
        direction=f[b]-f[a]
        direction.x*=.55;direction.y*=.55
        point_bone(target,direction,poses)
    for side,ref,sign in [('L','Left',1),('R','Right',-1)]:
        for target,a,b in [('Shoulder','Shoulder','Arm'),('UpperArm','Arm','ForeArm'),('Forearm','ForeArm','Hand')]:
            direction=f[ref+b]-f[ref+a]
            point_bone(target+'.'+side,direction,poses)
        hand=rig.data.bones['Hand.'+side]
        hand_parent=rig.data.bones['Forearm.'+side]
        # 手腕在小幅摆臂中自然跟随，保留原有掌心方向。
        poses[hand.name]=poses[hand_parent.name]@hand_parent.matrix_local.inverted()@hand.matrix_local
        foot,toe=f[ref+'Foot'],f[ref+'ToeBase']
        pitch=math.atan2((toe-foot).z,-(toe-foot).y)+math.radians(36.5)
        pitch=max(math.radians(-52),min(math.radians(27),pitch))
        rotation=Quaternion((1,0,0),-pitch)
        ground=-min((rotation@v).z for v in sole_points[side])
        # 参考的脚跟/脚尖滚动保留；鞋型不同，用本模型鞋底计算安全落点。
        z=max(foot.z*.525+.018,ground+.001)
        target=(sign*.060+(foot.x-foot_means[side])*.10,(foot.y-mean_hips[1])*.45,z)
        leg(side,target,pitch,poses)
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
        if pb.name=='Hips':pb.keyframe_insert('location',frame=frame,group=pb.name)

track=rig.animation_data.nla_tracks.new();track.name='Walk';track.mute=True
strip=track.strips.new('Walk',1,walk)
strip.action_frame_start=1;strip.action_frame_end=73
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'explorer-rigged-v1.blend'))
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
asset=ROOT/'public/world3d/assets/explorer-rigged-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(asset),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,
 export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=88,export_yup=True,
 export_skins=True,export_all_influences=False)
print('RETARGETED',asset.stat().st_size,flush=True)
