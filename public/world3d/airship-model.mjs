import * as T from './vendor/three.module.js';

// 飞艇朝局部 +Z 前进，甲板下缘接近 y=0；人物始终站在开放的中央区域。
export function createAirship(){
 const group=new T.Group();group.name='云海旅行飞艇';
 const deck=.55,rider=new T.Vector3(0,deck,0),rotors=[];
 const colors={cream:0xfff3d6,yellow:0xffcd55,coral:0xff8c9b,mint:0x69d5c7,blue:0x6bbbe6,purple:0xa08bd3,dark:0x655478,wood:0xc28b68};
 function part(parent,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.65,metalness:.08}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(parent,w,h,d,color,x=0,y=0,z=0){return part(parent,new T.BoxGeometry(w,h,d),color,x,y,z);}
 function ball(parent,r,color,x=0,y=0,z=0){return part(parent,new T.SphereGeometry(r,24,16),color,x,y,z);}
 function rod(parent,a,b,r,color){const from=new T.Vector3(...a),to=new T.Vector3(...b),direction=to.clone().sub(from);const m=part(parent,new T.CylinderGeometry(r,r,direction.length(),10),color);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return m;}

 // 下半椭球船身没有尖角，甲板完整覆盖船舱；总占地约 2.6 × 4.5。
 const hull=part(group,new T.SphereGeometry(1,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),colors.coral,0,.45,0);hull.scale.set(1.3,.45,2.25);
 const platform=part(group,new T.CylinderGeometry(1,1,.1,48),colors.cream,0,.5,0);platform.scale.set(1.3,1,2.25);
 const rim=part(group,new T.TorusGeometry(1,.045,8,64),colors.yellow,0,.54,0);rim.rotation.x=Math.PI/2;rim.scale.set(1.25,2.2,1);
 // 横向木板线让乘客脚下的站立区域易于辨认。
 for(let i=-3;i<=3;i++){const z=i*.48,halfWidth=1.22*Math.sqrt(1-(z/2.2)**2);box(group,halfWidth*2,.012,.025,colors.wood,0,deck+.007,z);}
 for(const side of [-1,1]){
  for(const z of [-1.45,-.5,.5,1.45])rod(group,[side*1.03,deck,z],[side*1.03,1.17,z],.035,colors.purple);
  rod(group,[side*1.03,1.17,-1.45],[side*1.03,1.17,1.45],.045,colors.purple);
  rod(group,[side*1.03,.86,-1.45],[side*1.03,.86,1.45],.022,colors.cream);
  // 船头护栏两侧留出登艇开口，中央不设置横梁。
  rod(group,[side*1.03,1.17,1.45],[side*.6,1.17,2.0],.045,colors.purple);
  rod(group,[side*.6,deck,2.0],[side*.6,1.17,2.0],.035,colors.purple);
  rod(group,[side*1.03,1.17,-1.45],[side*.55,1.17,-1.95],.045,colors.purple);
 }
 rod(group,[-.55,1.17,-1.95],[.55,1.17,-1.95],.045,colors.purple);
 // 侧面舷窗与前方星形徽章强化船体的方向感。
 for(const side of [-1,1])for(const z of [-.8,.65]){
  const window=part(group,new T.CircleGeometry(.13,24),colors.blue,side*1.18,.32,z);window.rotation.y=side*Math.PI/2;
  const frame=part(group,new T.TorusGeometry(.14,.028,8,24),colors.cream,side*1.19,.32,z);frame.rotation.y=side*Math.PI/2;
 }
 const badge=part(group,new T.CircleGeometry(.24,32),colors.mint,0,.31,2.18);
 const star=new T.Shape();for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,r=i%2?.07:.16,x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(i===0)star.moveTo(x,y);else star.lineTo(x,y);}star.closePath();part(group,new T.ShapeGeometry(star),colors.yellow,0,.31,2.19);

 // 气囊底部 y=3.0，距甲板 2.45，能容纳当前约 1.65 高的男女主角。
 const balloon=part(group,new T.SphereGeometry(1,40,24),colors.yellow,0,4.1,0);balloon.scale.set(1.75,1.1,3.25);
 const nose=ball(group,.27,colors.coral,0,4.1,3.15);nose.scale.set(1.3,1,.7);
 for(const z of [-2.15,-.95,.95,2.15]){
  const crossSection=Math.sqrt(1-(z/3.25)**2),band=part(group,new T.TorusGeometry(1,.025,8,48),Math.abs(z)>2?colors.mint:colors.cream,0,4.1,z);band.scale.set(1.75*crossSection,1.1*crossSection,1);
 }
 // 吊索位于甲板外围，避免穿过人物；四根硬支架承担船体悬吊的视觉结构。
 for(const x of [-1.03,1.03])for(const z of [-1.45,1.45]){
  rod(group,[x,.62,z],[x*1.2,3.28,z],.025,colors.dark);
  ball(group,.065,colors.cream,x*1.2,3.28,z);
 }
 function fin(parent,points,color){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return part(parent,new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035}),color);}
 const topFin=fin(group,[[0,0],[0,1.05],[1.1,.35],[1.35,0]],colors.mint);topFin.rotation.y=Math.PI/2;topFin.position.set(0,4.8,-2.05);
 for(const side of [-1,1]){const wing=fin(group,[[0,0],[1.1,.2],[1.35,-.65],[.25,-.85]],side<0?colors.blue:colors.mint);wing.rotation.x=Math.PI/2;wing.scale.x=side;wing.position.set(side*.95,4.1,-2.1);}

 // 双后置推进器朝后排气，叶片绕 Z 轴旋转；外圈保护框保持静止。
 for(const side of [-1,1]){
  rod(group,[side*1.1,1.25,-1.45],[side*1.75,1.45,-1.45],.07,colors.purple);
  const motor=part(group,new T.CylinderGeometry(.19,.22,.55,20),colors.blue,side*1.75,1.45,-1.45);motor.rotation.x=Math.PI/2;
  part(group,new T.TorusGeometry(.47,.04,8,32),colors.cream,side*1.75,1.45,-1.78);
  const rotor=new T.Group();rotor.position.set(side*1.75,1.45,-1.79);group.add(rotor);
  box(rotor,.12,.82,.06,colors.purple);box(rotor,.82,.12,.06,colors.purple);ball(rotor,.12,colors.yellow,0,0,.04);rotors.push({object:rotor,direction:side});
 }
 let elapsed=0;
 return {group,deck,rider,animate(dt){elapsed+=Math.max(0,Number(dt)||0);for(const rotor of rotors)rotor.object.rotation.z=elapsed*22*rotor.direction;}};
}
