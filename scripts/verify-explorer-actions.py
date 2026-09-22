"""检查交付模型的动作循环、接缝和实际蒙皮顶点高度。"""
import bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/world3d/assets/explorer-actions-v2.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
for track in rig.animation_data.nla_tracks:track.mute=True
scene=bpy.context.scene
scene.render.fps=60
report={}
endpoints={}
for name in ['Idle','Walk','Run','Jump','SitDown','StandUp']:
    act=bpy.data.actions[name]
    rig.animation_data.action=act
    start,end=map(round,act.frame_range)
    floors=[]
    tops=[]
    feet=[]
    samples=[]
    for frame in sorted(set([start,end]+list(range(start,end+1,3)))):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        obj=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        points=[obj.matrix_world @ v.co for v in obj.data.vertices]
        floors.append(min(p.z for p in points));tops.append(max(p.z for p in points))
        feet.append(abs(rig.pose.bones['Foot.L'].head.x-rig.pose.bones['Foot.R'].head.x))
        if frame in [start,end]:samples.append(points)
    endpoints[name]=samples
    loop=max((a-b).length for a,b in zip(*samples))
    report[name]={'duration':(end-start)/60,'floor':[min(floors),max(floors)],'height':[min(tops),max(tops)],'footWidth':max(feet),'loopError':loop}
    assert min(floors)>-.04, f'{name} 穿地：{min(floors)}'
    if name in ['Idle','Walk','Run']:assert loop<.003, f'{name} 循环有跳变'
    assert max(feet)<.35, f'{name} 两脚过度外张'
    if name=='Run':
        scene.frame_set(start)
        bpy.context.view_layer.update()
        arms=rig.pose.bones['Hand.L'].head.y-rig.pose.bones['Hand.R'].head.y
        legs=rig.pose.bones['Foot.L'].head.y-rig.pose.bones['Foot.R'].head.y
        assert arms*legs<0, '跑步出现同手同脚，摆臂应与同侧腿反向'
    if name=='Jump':
        scene.frame_set(round((start+end)/2));bpy.context.view_layer.update()
        span=abs(rig.pose.bones['Hand.L'].head.x-rig.pose.bones['Hand.R'].head.x)
        report[name]['armSpan']=span
        assert span>1.1, '腾空时双臂没有向两侧展开'
    if name=='SitDown':
        scene.frame_set(end);bpy.context.view_layer.update()
        for side in ['L','R']:
            hip,knee,ankle=(rig.pose.bones[p+'.'+side].head.copy() for p in ['Thigh','Shin','Foot'])
            angle=math.degrees((hip-knee).angle(ankle-knee))
            shin=(ankle-knee).normalized()
            assert 80<angle<125, f'坐姿膝盖弯曲异常：{side} {angle}'
            assert abs(shin.z)>.94, f'坐姿小腿没有自然下垂：{side}'
            report[name]['kneeAngle'+side]=angle
    print(name,json.dumps(report[name]),flush=True)
for first,last in [('SitDown','StandUp'),('StandUp','SitDown')]:
    error=max((a-b).length for a,b in zip(endpoints[first][-1],endpoints[last][0]))
    assert error<.003, f'{first} 到 {last} 接缝不匹配'
assert report['Jump']['floor'][1]>.5, '跳跃未实际离地'
assert 1.6<report['SitDown']['height'][0]<1.85, '坐姿应落在长凳高度，不是地面坐姿'
(ROOT/'artifacts/explorer-actions-v2/verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('VERIFIED',flush=True)
