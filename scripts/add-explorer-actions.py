"""在已验收的骨架上补充动作，保留原来的站立、行走和模型文件。"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/explorer-actions-v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'artifacts/explorer-rigged-v1/explorer-rigged-v1.blend'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
scene = bpy.context.scene
scene.render.fps = 60
SCALE = 2 / 1.1267300844192505

def smooth(t):
    t = max(0, min(1, t))
    return t*t*t*(10 + t*(-15 + 6*t))

def reset():
    for p in rig.pose.bones:
        p.location = (0, 0, 0)
        p.rotation_mode = 'QUATERNION'
        p.rotation_quaternion = Quaternion()
        p.scale = (1, 1, 1)

def put(name, head, rotation, poses):
    rest = rig.data.bones[name]
    desired = Matrix.Translation(head) @ rotation.to_matrix().to_4x4()
    base = poses[rest.parent.name] @ rest.parent.matrix_local.inverted() @ rest.matrix_local
    basis = base.inverted() @ desired
    p = rig.pose.bones[name]
    p.rotation_quaternion = basis.to_quaternion()
    if name == 'Hips': p.location = basis.to_translation()
    poses[name] = desired

def head_at(name, poses):
    b = rig.data.bones[name]
    return poses[b.parent.name] @ b.parent.matrix_local.inverted() @ b.head_local

def point(name, direction, poses):
    b = rig.data.bones[name]
    rotation = (b.tail_local-b.head_local).rotation_difference(Vector(direction)) @ b.matrix_local.to_quaternion()
    put(name, head_at(name, poses), rotation, poses)

def follow(name, poses):
    b = rig.data.bones[name]
    poses[name] = poses[b.parent.name] @ b.parent.matrix_local.inverted() @ b.matrix_local

soles = {}
for side, sign in [('L', 1), ('R', -1)]:
    ankle = rig.data.bones['Foot.'+side].head_local / SCALE
    soles[side] = [v.co/SCALE-ankle for v in mesh.data.vertices if v.co.z/SCALE < .08 and v.co.x*sign > 0]

def leg(side, target, pitch, poses):
    upper, lower = (rig.data.bones[p+'.'+side] for p in ['Thigh', 'Shin'])
    hip = head_at(upper.name, poses)
    ankle = Vector(target)*SCALE
    delta = ankle-hip
    length = delta.length
    if not abs(upper.length-lower.length)+.00001 < length < upper.length+lower.length-.00001:
        raise RuntimeError(f'{side} 腿部落点不可达：{length}')
    direction = delta.normalized()
    along = (upper.length**2-lower.length**2+length**2)/(2*length)
    pole = Vector((0, -1, 0))
    bend = (pole-direction*pole.dot(direction)).normalized()
    knee = hip+along*direction+math.sqrt(max(0, upper.length**2-along**2))*bend
    point(upper.name, knee-hip, poses)
    point(lower.name, ankle-knee, poses)
    foot = rig.data.bones['Foot.'+side]
    put(foot.name, ankle, Quaternion((1, 0, 0), -pitch) @ foot.matrix_local.to_quaternion(), poses)
    follow('Toe.'+side, poses)

def sole_height(side, pitch):
    rotation = Quaternion((1, 0, 0), -pitch)
    return -min((rotation @ p).z for p in soles[side])+.002

def body(height, forward=0, lean=0, twist=0, roll=0, sway=0):
    reset()
    poses = {'Root': rig.data.bones['Root'].matrix_local.copy()}
    rest = rig.data.bones['Hips']
    put('Hips', Vector((sway, forward, height))*SCALE,
        Quaternion((0, 0, 1), twist) @ Quaternion((0, 1, 0), roll) @ rest.matrix_local.to_quaternion(), poses)
    point('Spine', (0, -lean, 1), poses)
    point('Chest', (0, -lean*.6, 1), poses)
    point('Neck', (0, 0, 1), poses)
    point('Head', (0, 0, 1), poses)
    if twist or roll:
        # 胸肩与骨盆反向转动，头部稳定；避免整块躯干像木板一样摆动。
        for name, turn, tilt, incline in [('Spine', -.45, -.4, lean), ('Chest', -1.15, -.7, lean*.7), ('Neck', -.18, -.1, 0), ('Head', -.08, 0, 0)]:
            rotation = Quaternion((0,0,1), twist*turn) @ Quaternion((0,1,0), roll*tilt) @ Quaternion((1,0,0), math.atan(incline))
            put(name, head_at(name, poses), rotation @ rig.data.bones[name].matrix_local.to_quaternion(), poses)
    for side in ['L', 'R']: follow('Shoulder.'+side, poses)
    return poses

def arm(side, swing, bend, poses):
    sign = 1 if side == 'L' else -1
    point('UpperArm.'+side, (sign*.12, math.sin(swing), -math.cos(swing)), poses)
    point('Forearm.'+side, (sign*.03, math.sin(swing-bend), -math.cos(swing-bend)), poses)
    follow('Hand.'+side, poses)

def run(t):
    phase = t*math.tau
    # 支撑中段略下沉、蹬地后升起，重心随左右脚交替转移。
    poses = body(.462-.017*math.cos(2*phase-1.9), -.024, .18+.025*math.sin(2*phase),
                 .07*math.sin(phase+.2), .035*math.cos(phase-.3), .009*math.cos(phase-.3))
    for side, sign, offset in [('L', 1, 0), ('R', -1, .5)]:
        step = (t+offset) % 1
        stance = .36
        if step < stance:
            u = step/stance
            y = -.20+.40*u
            pitch = .12-.70*smooth(u)
            lift = 0
        else:
            u = (step-stance)/(1-stance)
            # 支撑和摆动在交界处保持相同速度，不在落地时突然折返。
            tangent = .40/stance*(1-stance)
            y = .20+tangent*u+(-.40-tangent)*smooth(u)
            pitch = -.58+.70*smooth(u)
            # 后摆先收小腿，再伸腿落地，摆动最高点略早于中点。
            lift = .16*math.sin(math.pi*u)**2*(1+.3*math.cos(math.pi*u))
        z = sole_height(side, pitch)+lift
        leg(side, (sign*.067, y, z), pitch, poses)
        # 与同侧腿反向摆臂：左腿向前时右臂向前。
        cycle=step*math.tau
        swing=.62*math.cos(cycle-.16)
        bend=1.05+.22*math.sin(cycle-.4)
        arm(side, swing, bend, poses)
        # 手腕稍晚于前臂到位，手肘不再全程锁死成同一个角度。
        point('Hand.'+side, (sign*.04, math.sin(swing-bend-.09*math.sin(cycle-.65)), -math.cos(swing-bend-.09*math.sin(cycle-.65))), poses)

def jump(t):
    # 整个起跳、腾空、落地都烘焙到骨盆；游戏不会额外叠加高度。
    if t < .2:
        crouch = .075*smooth(t/.2)
        lift, tuck = 0, 0
    elif t < .8:
        u = (t-.2)/.6
        crouch = .075*(1-smooth(min(1, u*4)))
        lift, tuck = .45*4*u*(1-u), .055*math.sin(math.pi*u)**2
    else:
        u = (t-.8)/.2
        crouch, lift, tuck = .055*math.sin(math.pi*u)**2, 0, 0
    poses = body(.533-crouch+lift, 0, .14*(crouch/.075))
    spread=math.sin(math.pi*t)**2
    for side, sign in [('L', 1), ('R', -1)]:
        # 腾空时双脚自然分开，略微前后错开；落地缓冲后恢复站姿。
        leg(side, ((.067+.026*spread)*sign, .009+tuck*.3+sign*.022*spread, sole_height(side, 0)+lift+tuck), 0, poses)
        # 起跳时向两侧展开手臂，落地后自然收回；肘部保留轻微弯曲。
        angle=.12+1.18*spread
        point('UpperArm.'+side, (sign*math.sin(angle), -.12*spread, -math.cos(angle)), poses)
        point('Forearm.'+side, (sign*math.sin(angle*.9), -.22*spread, -math.cos(angle*.9)), poses)
        follow('Hand.'+side, poses)

def sitting(t):
    u = smooth(t)
    # 根位置在凳前 0.85 米；骨盆向后落在座面，保持左右膝盖间距。
    # 椅面高 0.67 米，角色脚底基准高 0.09 米；双脚只向后收，不向前伸直。
    poses = body(.533-.150*u, .005+.406*u, .20*math.sin(math.pi*u))
    for side, sign in [('L', 1), ('R', -1)]:
        # 前半程依次收脚，避免两只脚同时在地上滑动。
        foot_t=max(0,min(1,(t-(0 if side=='L' else .12))/.48))
        step=smooth(foot_t)
        lift=.023*math.sin(math.pi*foot_t)**2
        leg(side, (sign*.067, .009+.164*step, sole_height(side, 0)+lift), 0, poses)
        arm(side, -.15*u, .18+.95*u, poses)

# 只新增命名动作，原 Walk 和 Idle 完整保留。
for track in rig.animation_data.nla_tracks: track.mute = True
rig.animation_data.action = None
for name, frames, pose in [('Run', 40, run), ('Jump', 73, jump),
                           ('SitDown', 61, sitting), ('StandUp', 61, lambda t: sitting(1-t))]:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for frame in range(1, frames+1):
        pose((frame-1)/(frames-1))
        for p in rig.pose.bones:
            p.keyframe_insert('rotation_quaternion', frame=frame, group=p.name)
            if p.name == 'Hips': p.keyframe_insert('location', frame=frame, group=p.name)
    print('ACTION', name, frames, flush=True)

rig.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'explorer-actions-v2.blend'))
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
asset = ROOT/'public/world3d/assets/explorer-actions-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_frame_range=False,
    export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88,
    export_yup=True, export_skins=True, export_all_influences=False)
(OUT/'report.json').write_text(json.dumps({'assetBytes': asset.stat().st_size,
    'animations': [a.name for a in bpy.data.actions]}, indent=2), encoding='utf-8')
print('EXPORTED', asset.stat().st_size, flush=True)
