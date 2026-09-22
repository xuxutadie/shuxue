"""用本机 Blender 制作轻量主角、变形骨骼和循环行走动画，不覆盖原始模型。

blender --background --python scripts/build-explorer-rig.py -- --source 原模型.glb
可用 --prepared 指向已减面的临时 blend，便于只调整绑定与动画。
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--prepared')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = Path(args.source)
out = ROOT / 'artifacts' / 'explorer-rigged-v1'
out.mkdir(parents=True, exist_ok=True)
asset = ROOT / 'public' / 'world3d' / 'assets' / 'explorer-rigged-v1.glb'

if args.prepared:
    bpy.ops.wm.open_mainfile(filepath=args.prepared)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if not args.prepared:
    # 先焊接几何重合点，UV 仍保留在面角上，避免直接减面撕开接缝。
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.000002)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = mesh.modifiers.new('网页减面', 'DECIMATE')
    mod.ratio = min(1, 60000 / len(mesh.data.polygons))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for mat in mesh.data.materials:
        tree = mat.node_tree
        shader = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
        for name in ['Normal', 'Metallic', 'Roughness', 'Specular IOR Level', 'Specular Tint']:
            for link in list(shader.inputs[name].links): tree.links.remove(link)
        shader.inputs['Metallic'].default_value = 0
        shader.inputs['Roughness'].default_value = .72
        shader.inputs['Specular IOR Level'].default_value = .25
        shader.inputs['Specular Tint'].default_value = (1, 1, 1, 1)
        base = shader.inputs['Base Color'].links[0].from_node
        for node in list(tree.nodes):
            if node.type == 'TEX_IMAGE' and node.image:
                if node == base: node.image.scale(2048, 2048)
                else: tree.nodes.remove(node)

mesh.name = 'Explorer_SkinnedBody'
for poly in mesh.data.polygons: poly.use_smooth = True
# 将缩小后的像素真正另存再载入，避免 GLB 导出器复用原来打包的 4K 数据。
for mat in mesh.data.materials:
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            image = node.image
            image.scale(2048, 2048)
            texture_path = out / 'base-color.jpg'
            image.filepath_raw = str(texture_path)
            image.file_format = 'JPEG'
            image.save()
            node.image = bpy.data.images.load(str(texture_path), check_existing=False)
SCALE = 2.0 / 1.1267300844192505
for v in mesh.data.vertices: v.co *= SCALE

# 关节根据此模型的正面、侧面实际位置标定，不能直接套用其它身材。
arm_data = bpy.data.armatures.new('ExplorerSkeleton')
rig = bpy.data.objects.new('ExplorerRig', arm_data)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None, deform=True):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = Vector(head) * SCALE, Vector(tail) * SCALE
    b.use_deform = deform
    if parent: b.parent = arm_data.edit_bones[parent]
    return b

bone('Root', (0, 0, 0), (0, 0, .12), deform=False)
bone('Hips', (0, .005, .545), (0, .005, .61), 'Root')
bone('Spine', (0, .005, .61), (0, .005, .705), 'Hips')
bone('Chest', (0, .005, .705), (0, .005, .81), 'Spine')
bone('Neck', (0, .005, .81), (0, .005, .867), 'Chest')
bone('Head', (0, .005, .867), (0, .005, 1.085), 'Neck')
for side, sign in [('L', 1), ('R', -1)]:
    def p(x, y, z): return (x * sign, y, z)
    bone('Shoulder.' + side, p(.025, .0, .797), p(.117, .005, .774), 'Chest')
    bone('UpperArm.' + side, p(.117, .005, .774), p(.184, .0, .612), 'Shoulder.' + side)
    bone('Forearm.' + side, p(.184, .0, .612), p(.235, -.006, .504), 'UpperArm.' + side)
    bone('Hand.' + side, p(.235, -.006, .504), p(.246, -.01, .435), 'Forearm.' + side)
    bone('Thigh.' + side, p(.078, .005, .545), p(.096, -.022, .302), 'Hips')
    bone('Shin.' + side, p(.096, -.022, .302), p(.104, .009, .087), 'Thigh.' + side)
    bone('Foot.' + side, p(.104, .009, .087), p(.105, -.08, .042), 'Shin.' + side)
    bone('Toe.' + side, p(.105, -.08, .042), p(.105, -.122, .035), 'Foot.' + side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True
arm_data.display_type = 'OCTAHEDRAL'

bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
print('BINDING automatic weights', flush=True)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
if not mesh.vertex_groups:
    raise RuntimeError('自动绑定失败：未生成顶点权重，不导出假绑定文件。')

# 脸和背包应保持完整，不能被附近的肩膀和手臂拉扯。
groups = {g.name: g for g in mesh.vertex_groups}
for v in mesh.data.vertices:
    x, y, z = v.co / SCALE
    name = 'Head' if z > .875 else 'Chest' if (y > .08 and .59 < z < .835 and abs(x) < .155) else None
    if name:
        for g in list(v.groups): mesh.vertex_groups[g.group].remove([v.index])
        groups[name].add([v.index], 1, 'REPLACE')
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
missing = [v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups) < .99]
if missing:
    raise RuntimeError(f'发现 {len(missing)} 个未正确绑定的顶点，请修复权重后导出。')
print('BOUND', len(mesh.data.vertices), 'vertices;', len(arm_data.bones), 'bones', flush=True)

scene = bpy.context.scene
scene.render.fps = 60
scene.frame_start = 1
scene.frame_end = 73

def local_world_rotation(name, angle, axis=(1, 0, 0)):
    local_axis = arm_data.bones[name].matrix_local.to_quaternion().inverted() @ Vector(axis)
    return Quaternion(local_axis, angle)

def set_rotation(name, rotations, frame):
    pb = rig.pose.bones[name]
    pb.rotation_mode = 'QUATERNION'
    q = Quaternion()
    for angle, axis in rotations: q @= local_world_rotation(name, angle, axis)
    pb.rotation_quaternion = q
    pb.keyframe_insert('rotation_quaternion', frame=frame, group=name)

def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)

def action(name):
    rig.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    return act

def orient_bone(name, head, direction, parent_pose, rotation=None):
    """由目标方向求局部旋转，保持真实骨长和连续骨骼层级。"""
    rest = arm_data.bones[name]
    world_rotation = rotation or (rest.tail_local - rest.head_local).rotation_difference(direction) @ rest.matrix_local.to_quaternion()
    desired = Matrix.Translation(head) @ world_rotation.to_matrix().to_4x4()
    base = parent_pose @ rest.parent.matrix_local.inverted() @ rest.matrix_local
    rig.pose.bones[name].rotation_quaternion = (base.inverted() @ desired).to_quaternion()
    return desired

def solve_leg(side, target):
    """两段式腿部 IK：脚步落点固定，膝盖向身体前方自然弯曲。"""
    thigh = arm_data.bones['Thigh.' + side]
    shin = arm_data.bones['Shin.' + side]
    pelvis = rig.pose.bones['Hips'].matrix.copy()
    hip = pelvis @ arm_data.bones['Hips'].matrix_local.inverted() @ thigh.head_local
    ankle = Vector(target) * SCALE
    distance = (ankle - hip).length
    a, b = thigh.length, shin.length
    if distance >= a + b - .00001:
        raise RuntimeError(f'脚步超出腿长: {side}, {distance:.5f} >= {a+b:.5f}')
    direction = (ankle - hip).normalized()
    along = (a*a - b*b + distance*distance) / (2*distance)
    height = math.sqrt(max(0, a*a - along*along))
    pole = Vector((0, -1, 0))
    bend = (pole - direction * pole.dot(direction)).normalized()
    knee = hip + direction * along + bend * height
    upper_pose = orient_bone('Thigh.' + side, hip, knee - hip, pelvis)
    lower_pose = orient_bone('Shin.' + side, knee, ankle - knee, upper_pose)
    foot_rest = arm_data.bones['Foot.' + side]
    orient_bone('Foot.' + side, ankle, foot_rest.tail_local - foot_rest.head_local,
                lower_pose, foot_rest.matrix_local.to_quaternion())

def key_legs(frame):
    for side in ['L', 'R']:
        for part in ['Thigh', 'Shin', 'Foot', 'Toe']:
            pb = rig.pose.bones[part + '.' + side]
            pb.keyframe_insert('rotation_quaternion', frame=frame, group=pb.name)

idle = action('Idle')
for frame in range(1, 122, 2):
    reset_pose()
    phase = (frame - 1) / 120 * math.tau
    set_rotation('Chest', [(.008 * math.sin(phase), (1, 0, 0))], frame)
    set_rotation('Head', [(.012 * math.sin(phase), (0, 0, 1))], frame)
    for side, sign in [('L', 1), ('R', -1)]:
        set_rotation('UpperArm.' + side, [(.18 * sign, (0, 1, 0))], frame)
        for part in ['Forearm', 'Hand']:
            set_rotation(part + '.' + side, [], frame)
    rig.pose.bones['Hips'].location.y = -.002 * SCALE
    bpy.context.view_layer.update()
    for side, sign in [('L', 1), ('R', -1)]: solve_leg(side, (.079 * sign, .009, .087))
    key_legs(frame)
    rig.pose.bones['Hips'].keyframe_insert('location', frame=frame, group='Hips')

walk = action('Walk')
for frame in range(1, 74):
    reset_pose()
    cycle = (frame - 1) / 72
    phase = cycle * math.tau
    # 骨盆采用连续曲线，不再根据每帧最低顶点突然抬升全身。
    rig.pose.bones['Hips'].location.y = (-.010 - .004 * math.cos(2 * phase)) * SCALE
    rig.pose.bones['Hips'].keyframe_insert('location', frame=frame, group='Hips')
    set_rotation('Hips', [(.012 * math.sin(phase), (0, 0, 1))], frame)
    set_rotation('Chest', [(-.02 * math.sin(phase), (0, 0, 1))], frame)
    set_rotation('Head', [(.008 * math.sin(phase), (0, 0, 1))], frame)
    bpy.context.view_layer.update()
    for side, sign in [('L', 1), ('R', -1)]:
        step = (cycle + (0 if side == 'L' else .5)) % 1
        stance = .62
        if step < stance:
            # 支撑脚匀速向后，配合游戏角色前进时可保持脚底不滑动。
            foot_y = -.10 + .20 * step / stance
            foot_z = .087
        else:
            u = (step - stance) / (1 - stance)
            smooth = u*u*u*(10 + u*(-15 + 6*u))
            tangent = .20 / stance * (1 - stance)
            foot_y = .10 + tangent*u + (-.20-tangent)*smooth
            # 抬脚曲线首尾速度、加速度均为零，避免落脚时突然顿一下。
            foot_z = .087 + .053 * 64*u*u*u*(1-u)**3
        solve_leg(side, (.062 * sign, foot_y, foot_z))
        arm_swing = math.cos((step / stance if step < stance else 1 + (step-stance)/(1-stance)) * math.pi)
        set_rotation('UpperArm.' + side, [(.18 * arm_swing, (1, 0, 0)), (.18 * sign, (0, 1, 0))], frame)
        set_rotation('Forearm.' + side, [(-.12 + .035 * arm_swing, (1, 0, 0))], frame)
        set_rotation('Hand.' + side, [], frame)
    key_legs(frame)

# 用 NLA 名称明确输出两个动作，网页可按名字切换，不依赖动画数组顺序。
rig.animation_data.action = None
for act, end in [(idle, 121), (walk, 73)]:
    track = rig.animation_data.nla_tracks.new()
    track.name = act.name
    track.mute = True
    strip = track.strips.new(act.name, 1, act)
    strip.action_frame_start = 1
    strip.action_frame_end = end
rig.animation_data.action = walk
reset_pose()
scene.frame_set(1)

# 删除已不再使用的 4K 法线、金属贴图，编辑文件只保留必需素材。
used_images = {n.image for m in mesh.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
for image in list(bpy.data.images):
    if image not in used_images: bpy.data.images.remove(image)
for image in used_images: image.pack()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'explorer-rigged-v1.blend'))
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_frame_range=False,
    export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88,
    export_yup=True, export_skins=True, export_all_influences=False)
report = {'source': str(source), 'sourceBytes': source.stat().st_size,
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'triangles': sum(len(p.vertices) - 2 for p in mesh.data.polygons),
    'vertices': len(mesh.data.vertices), 'bones': len(arm_data.bones),
    'unweightedVertices': len(missing), 'height': 2.0,
    'assetBytes': asset.stat().st_size, 'animations': ['Idle', 'Walk']}
(out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
print('RESULT', json.dumps(report), flush=True)
