"""在 Blender 中重新导入交付 GLB，检查真实导出文件的蒙皮、循环与落地。"""
import bpy, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/world3d/assets/explorer-rigged-v1.glb'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
assert len(rig.data.bones) == 22
assert all(abs(sum(g.weight for g in v.groups) - 1) < .001 for v in mesh.data.vertices)
assert all(len(v.groups) <= 4 for v in mesh.data.vertices)
assert mesh.modifiers[0].type == 'ARMATURE'
assert max(mesh.dimensions) < 2.2
walk = next(a for a in bpy.data.actions if a.name == 'Walk')
idle = next(a for a in bpy.data.actions if a.name == 'Idle')
for track in rig.animation_data.nla_tracks: track.mute = True
rig.animation_data.action = walk
scene = bpy.context.scene
scene.render.fps = 60
start, end = walk.frame_range
floors, poses, hips, widths, ankles = [], [], [], [], []
foot_angles=[]
for frame in range(round(start), round(end) + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    points = [evaluated.matrix_world @ v.co for v in evaluated.data.vertices]
    floors.append(min(p.z for p in points))
    hips.append(rig.pose.bones['Hips'].head.copy())
    left, right = rig.pose.bones['Foot.L'].head.copy(), rig.pose.bones['Foot.R'].head.copy()
    widths.append(abs(left.x - right.x))
    ankles.append([left, right])
    foot=rig.pose.bones['Foot.L'];direction=foot.tail-foot.head
    foot_angles.append(math.atan2(direction.z,-direction.y))
    if frame in [round(start), round((start + end) / 2), round(end)]: poses.append(points)
assert min(floors) > -.01, f'鞋底穿地: {min(floors)}'
assert max(floors) < .015, f'角色悬空: {max(floors)}'
loop_error = max((a-b).length for a,b in zip(poses[0], poses[-1]))
movement = max((a-b).length for a,b in zip(poses[0], poses[1]))
print('CHECK',start,end,min(floors),max(floors),loop_error,movement,flush=True)
assert loop_error < .002, f'循环接缝跳动: {loop_error}'
assert movement > .1, '没有实际的蒙皮形变'
hip_acceleration = max((hips[i+1] - hips[i]*2 + hips[i-1]).length for i in range(1,len(hips)-1))
assert max(widths) < .25, f'行走脚距过宽: {max(widths)}'
assert max(widths) - min(widths) < .01, '双腿左右外摆'
assert hip_acceleration < .001, f'骨盆突跳: {hip_acceleration}'
foot_roll=max(foot_angles)-min(foot_angles)
assert foot_roll > math.radians(20), '脚掌始终平放，缺少脚跟落地与脚尖离地'
assert max(p.x for p in hips)-min(p.x for p in hips)>.008, '缺少支撑脚之间的重心转移'
report = {'bones':len(rig.data.bones), 'actions':[idle.name,walk.name],
    'walkFrameRange':[start,end], 'groundRange':[min(floors),max(floors)],
    'loopMaxVertexError':loop_error, 'halfCycleVertexMovement':movement,
    'textureSize':list(next(i for i in bpy.data.images if i.size[0]>0).size),
    'footSeparation':[min(widths),max(widths)], 'hipMaxFrameAcceleration':hip_acceleration,
    'footRollDegrees':math.degrees(foot_roll)}
(ROOT / 'artifacts/explorer-rigged-v1/verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('VERIFIED',json.dumps(report),flush=True)
