"""轻量化女生主角并适配已有六种动作；保留用户原文件和男生资产。"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--prepare-only', action='store_true')
parser.add_argument('--use-prepared', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
OUT = ROOT / 'artifacts/girl-explorer-v1'
OUT.mkdir(parents=True, exist_ok=True)
prepared = ROOT / '.runtime/girl-prepared.blend'
prepared.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
if args.use_prepared:
    bpy.ops.wm.open_mainfile(filepath=str(prepared))
    mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.source)
    mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # 将脚底归零、身高统一到游戏的两米尺度，保留模型原有比例。
    low = min(v.co.z for v in mesh.data.vertices)
    height = max(v.co.z for v in mesh.data.vertices) - low
    print('SOURCE', len(mesh.data.vertices), len(mesh.data.polygons), low, height, flush=True)
    for v in mesh.data.vertices:
        v.co.z -= low
        v.co *= 2 / height
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.000004)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = mesh.modifiers.new('网页减面', 'DECIMATE')
    mod.ratio = min(1, 50000 / len(mesh.data.polygons))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in mesh.data.polygons:
        poly.use_smooth = True
    for index, mat in enumerate(mesh.data.materials):
        tree = mat.node_tree
        shader = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
        for name in ['Normal', 'Metallic', 'Roughness', 'Specular IOR Level', 'Specular Tint']:
            for link in list(shader.inputs[name].links):
                tree.links.remove(link)
        shader.inputs['Metallic'].default_value = 0
        shader.inputs['Roughness'].default_value = .72
        shader.inputs['Specular IOR Level'].default_value = .25
        base = shader.inputs['Base Color'].links[0].from_node
        for node in list(tree.nodes):
            if node.type == 'TEX_IMAGE' and node.image:
                if node != base:
                    tree.nodes.remove(node)
                    continue
                texture = OUT / f'base-color-{index}.jpg'
                node.image.scale(2048, 2048)
                node.image.filepath_raw = str(texture)
                node.image.file_format = 'JPEG'
                node.image.save()
                node.image = bpy.data.images.load(str(texture), check_existing=False)
                node.image.pack()
    used = {n.image for mat in mesh.data.materials for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
    for image in list(bpy.data.images):
        if image not in used:
            bpy.data.images.remove(image)
    mesh.name = 'GirlExplorer_SkinnedBody'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(prepared))
    print('PREPARED', len(mesh.data.vertices), len(mesh.data.polygons), flush=True)

def render_reference():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('WhiteStudio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
    scene.view_settings.view_transform = 'AgX'
    for location, power, size in [((3,-4,5),450,4),((-3,-2,3),200,3)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
        lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(0,-5,1))
    camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.3;scene.camera=camera
    for view,position in [('front',(0,-5,1)),('side',(5,0,1))]:
        camera.location=position;camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(ROOT/f'.runtime/girl-{view}.png')
        bpy.ops.render.render(write_still=True)

if args.prepare_only:
    render_reference()
else:
    # 读取已经验收的动作，以关节的世界方向适配女生，而不是拉伸女生网格。
    from mathutils import Matrix, Quaternion
    with bpy.data.libraries.load(str(ROOT/'artifacts/explorer-actions-v2/explorer-actions-v2.blend')) as (available, loaded):
        loaded.objects = available.objects
        loaded.actions = available.actions
    source_objects = [o for o in loaded.objects if o]
    for obj in source_objects:
        bpy.context.collection.objects.link(obj)
        obj.hide_render = True
    source_rig = next(o for o in source_objects if o.type == 'ARMATURE')
    source_mesh = next(o for o in source_objects if o.type == 'MESH')
    names = ['Idle','Walk','Run','Jump','SitDown','StandUp']
    reference = {name:bpy.data.actions[name] for name in names}
    for track in source_rig.animation_data.nla_tracks:
        track.mute = True
    rig = bpy.data.objects.new('GirlExplorerRig', source_rig.data.copy())
    bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    def set_bone(name, head, tail):
        bone=rig.data.edit_bones[name];bone.head=head;bone.tail=tail
    set_bone('Root',(0,0,0),(0,0,.2))
    set_bone('Hips',(0,.012,.91),(0,.012,1.035))
    set_bone('Spine',(0,.012,1.035),(0,.012,1.17))
    set_bone('Chest',(0,.012,1.17),(0,.012,1.39))
    set_bone('Neck',(0,.012,1.39),(0,.012,1.48))
    set_bone('Head',(0,.012,1.48),(0,.012,1.93))
    for side,sign in [('L',1),('R',-1)]:
        def p(x,y,z):return (x*sign,y,z)
        set_bone('Shoulder.'+side,p(.04,.005,1.36),p(.18,.005,1.345))
        set_bone('UpperArm.'+side,p(.18,.005,1.345),p(.295,-.01,1.06))
        set_bone('Forearm.'+side,p(.295,-.01,1.06),p(.392,-.018,.865))
        set_bone('Hand.'+side,p(.392,-.018,.865),p(.423,-.025,.765))
        set_bone('Thigh.'+side,p(.137,.012,.91),p(.151,-.022,.53))
        set_bone('Shin.'+side,p(.151,-.022,.53),p(.157,.009,.155))
        set_bone('Foot.'+side,p(.157,.009,.155),p(.157,-.145,.066))
        set_bone('Toe.'+side,p(.157,-.145,.066),p(.157,-.215,.05))
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh.select_set(True)
    print('BINDING GIRL',flush=True)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    if not mesh.vertex_groups:raise RuntimeError('女生自动绑定未生成权重')
    groups={g.name:g for g in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        x,y,z=vertex.co
        name='Head' if z>1.47 else 'Chest' if y>.12 and .98<z<1.42 and abs(x)<.26 else None
        # 鞋子保持完整，避免脚趾弯曲将鞋面折成尖角。
        if z<.22:name='Foot.L' if x>0 else 'Foot.R'
        if name:
            for group in list(vertex.groups):mesh.vertex_groups[group.group].remove([vertex.index])
            groups[name].add([vertex.index],1,'REPLACE')
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
    missing=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups)<.99]
    if missing:raise RuntimeError(f'{len(missing)} 个女生顶点未绑定')
    scene=bpy.context.scene;scene.render.fps=60
    actions={}
    leg_ratio=(rig.data.bones['Thigh.L'].length+rig.data.bones['Shin.L'].length)/(source_rig.data.bones['Thigh.L'].length+source_rig.data.bones['Shin.L'].length)
    sole={};source_sole={}
    for side,sign in [('L',1),('R',-1)]:
        sole[side]=[v.co-rig.data.bones['Foot.'+side].head_local for v in mesh.data.vertices if v.co.z<.13 and v.co.x*sign>0]
        source_sole[side]=[v.co-source_rig.data.bones['Foot.'+side].head_local for v in source_mesh.data.vertices if v.co.z<.13 and v.co.x*sign>0]

    def put(name,head,rotation,poses):
        rest=rig.data.bones[name]
        desired=Matrix.Translation(head)@rotation.to_matrix().to_4x4()
        base=poses[rest.parent.name]@rest.parent.matrix_local.inverted()@rest.matrix_local
        basis=base.inverted()@desired;pose=rig.pose.bones[name]
        pose.rotation_quaternion=basis.to_quaternion()
        if name=='Hips':pose.location=basis.to_translation()
        poses[name]=desired

    def head_at(name,poses):
        rest=rig.data.bones[name]
        return poses[rest.parent.name]@rest.parent.matrix_local.inverted()@rest.head_local

    def mapped_rotation(name):
        return source_rig.pose.bones[name].matrix.to_quaternion()@source_rig.data.bones[name].matrix_local.to_quaternion().inverted()@rig.data.bones[name].matrix_local.to_quaternion()

    for name in names:
        source_rig.animation_data.action=reference[name]
        act=bpy.data.actions.new('Girl_'+name);act.use_fake_user=True
        rig.animation_data_create();rig.animation_data.action=act
        start,end=map(round,reference[name].frame_range)
        for frame in range(start,end+1):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=(0,0,0);bone.scale=(1,1,1)
            poses={'Root':rig.data.bones['Root'].matrix_local.copy()}
            offset=source_rig.pose.bones['Hips'].head-source_rig.data.bones['Hips'].head_local
            center=rig.data.bones['Hips'].head_local+offset*leg_ratio
            if name in ['SitDown','StandUp']:center.y=rig.data.bones['Hips'].head_local.y+offset.y
            put('Hips',center,mapped_rotation('Hips'),poses)
            for target in ['Spine','Chest','Neck','Head']+[part+'.'+side for side in ['L','R'] for part in ['Shoulder','UpperArm','Forearm','Hand']]:
                put(target,head_at(target,poses),mapped_rotation(target),poses)
            for side,sign in [('L',1),('R',-1)]:
                foot='Foot.'+side;upper='Thigh.'+side;lower='Shin.'+side
                source_bone=source_rig.pose.bones[foot]
                delta=source_bone.head-source_rig.data.bones[foot].head_local
                target=rig.data.bones[foot].head_local+delta*leg_ratio
                if name in ['SitDown','StandUp']:
                    progress=(frame-start)/(end-start)
                    if name=='StandUp':progress=1-progress
                    ease=progress**3*(10+progress*(-15+6*progress))
                    target.y+=.09*ease
                rotation=mapped_rotation(foot)
                source_turn=source_bone.matrix.to_quaternion()@source_rig.data.bones[foot].matrix_local.to_quaternion().inverted()
                turn=rotation@rig.data.bones[foot].matrix_local.to_quaternion().inverted()
                floor=min((source_turn@v).z+source_bone.head.z for v in source_sole[side])
                target.z=floor*leg_ratio-min((turn@v).z for v in sole[side])
                hip=head_at(upper,poses);direction=target-hip;length=direction.length
                a,b=rig.data.bones[upper].length,rig.data.bones[lower].length
                if length>=a+b:raise RuntimeError(f'{name} 第{frame}帧 {side}脚步超出腿长: {length} >= {a+b}')
                direction.normalize();along=(a*a-b*b+length*length)/(2*length)
                pole=Vector((0,-1,0));bend=(pole-direction*pole.dot(direction)).normalized()
                knee=hip+along*direction+math.sqrt(max(0,a*a-along*along))*bend
                for bone,origin,tip in [(upper,hip,knee),(lower,knee,target)]:
                    rest=rig.data.bones[bone]
                    q=(rest.tail_local-rest.head_local).rotation_difference(tip-origin)@rest.matrix_local.to_quaternion()
                    put(bone,origin,q,poses)
                put(foot,target,rotation,poses)
                toe='Toe.'+side;rest=rig.data.bones[toe]
                poses[toe]=poses[foot]@rig.data.bones[foot].matrix_local.inverted()@rest.matrix_local
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
            rig.pose.bones['Hips'].keyframe_insert('location',frame=frame,group='Hips')
        for curve in act.fcurves:
            for point in curve.keyframe_points:point.interpolation='LINEAR'
        actions[name]=(act,end)
        print('RETARGETED',name,start,end,flush=True)
    for obj in source_objects:bpy.data.objects.remove(obj,do_unlink=True)
    for old in reference.values():bpy.data.actions.remove(old)
    rig.animation_data.action=None
    for name,(act,end) in actions.items():
        act.name=name
        track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True
        strip=track.strips.new(name,1,act);strip.action_frame_start=1;strip.action_frame_end=end
    rig.animation_data.action=actions['Idle'][0];scene.frame_set(1)
    # 编辑工程只打包实际使用的女生贴图。
    used={n.image for mat in mesh.data.materials for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
    for image in list(bpy.data.images):
        if image not in used:bpy.data.images.remove(image)
    for image in used:image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'girl-explorer-v1.blend'))
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    asset=ROOT/'public/world3d/assets/girl-explorer-v1.glb'
    bpy.ops.export_scene.gltf(filepath=str(asset),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=88,export_yup=True,export_skins=True,export_all_influences=False)
    report={'sourceBytes':Path(args.source).stat().st_size,'assetBytes':asset.stat().st_size,'triangles':len(mesh.data.polygons),'vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'unweightedVertices':len(missing),'animations':names,'legRatio':leg_ratio}
    (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('RESULT',json.dumps(report),flush=True)
