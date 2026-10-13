import * as T from './vendor/three.module.js';
import {stations} from './navigation3d.mjs';

// 原生几何体搭建独立天文城；设施占地与既有营地寻路网格保持一致。
export function createObservatory(getProgress){
 const scene=new T.Group(),rotors=[],lamps=[],beams=[],mirrors=[];
 const palette=[0xffc85c,0xf3a2c9,0xa998e9,0x75d5ce,0x79bde7,0xffa877];
 function mesh(parent,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.65,metalness:.12}));m.position.set(x,y,z);parent.add(m);return m;}
 const box=(p,w,h,d,c,x=0,y=0,z=0)=>mesh(p,new T.BoxGeometry(w,h,d),c,x,y,z);
 const ball=(p,r,c,x=0,y=0,z=0)=>mesh(p,new T.SphereGeometry(r,20,12),c,x,y,z);
 const cyl=(p,r,h,c,x=0,y=0,z=0,top=r)=>mesh(p,new T.CylinderGeometry(top,r,h,32),c,x,y,z);
 function ring(p,r,t,c,x=0,y=0,z=0){const m=mesh(p,new T.TorusGeometry(r,t,8,48),c,x,y,z);return m;}
 function sign(p,label,y=3.5){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=100;const c=canvas.getContext('2d');c.fillStyle='#fff8e3';c.fillRect(0,0,640,100);c.fillStyle='#443650';c.font='bold 40px Microsoft Yahei';c.textAlign='center';c.textBaseline='middle';c.fillText(label,320,50);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:tex}));s.scale.set(4.6,.72,1);s.position.set(0,y,0);p.add(s);}
 box(scene,32,.7,28,0xb1a6d6,0,-.45,0);box(scene,31.7,.12,27.7,0xeff4e8,0,-.04,0);
 for(let i=0;i<13;i++){const angle=i*Math.PI*2/13,height=4+(i%3),m=mesh(scene,new T.ConeGeometry(2+Math.sin(i)*.4,height,5),0xc2b4d9,Math.cos(angle)*13,-.85-height/2,Math.sin(angle)*11);m.rotation.z=Math.PI;}
 // 环形主路、各站支路和飞艇下客点，无装饰阻挡行走道路。
 for(const z of [-4,4])box(scene,29,.035,2.4,0xdacef4,0,.045,z);
 for(const x of [-14,14])box(scene,2,.035,22,0xdacef4,x,.045,0);
 for(const x of [-10,0,10])box(scene,1.8,.04,24,0xe6ddf9,x,.045,0);
 for(let i=0;i<6;i++){
  const g=new T.Group();g.position.set(...[stations[i][0],0,stations[i][1]]);g.userData.stationIndex=i;scene.add(g);
  box(g,6.3,.25,5.4,palette[i],0,.16,0);box(g,5.9,.1,5,0xfff5dc,0,.34,0);
  const front=i<3?1:-1;
  // 每站一个小型机器人管家，只有当前站上方显示任务感叹号。
  cyl(g,.28,.7,0xf3e8ca,0,.76,front*3.8);ball(g,.36,palette[i],0,1.3,front*3.8);box(g,.5,.15,.12,0x394d68,0,1.32,front*4.12);
  const lamp=ball(g,.15,0x9c92b3,.55,1.45,front*3.8);lamps.push(lamp);
  sign(g,['飞艇码头','星灯长廊','齿轮工坊','镜光花园','气象观测台','星图控制台'][i],i===0?5.8:4.5);
  if(i===0){
   const ship=new T.Group();g.add(ship);const balloon=ball(ship,1,0xffc95f,0,3.3,0);balloon.scale.set(2.6,1.25,1.05);box(ship,2.8,.65,1.3,0xae7a60,0,1.3,0);box(ship,2.1,.18,1.4,0xfff4d4,0,1.73,0);
   for(const x of [-1,1])for(const z of [-.5,.5])cyl(ship,.025,1.8,0x716079,x,2.35,z);
   const fin=box(ship,.15,1,1.4,0xf492a8,2.35,3.2,0);fin.rotation.z=-.2;
   const prop=new T.Group();prop.position.set(-2.8,3.1,0);ship.add(prop);box(prop,.12,.12,1.4,0x8d83b5);box(prop,.12,1.4,.12,0x8d83b5);rotors.push({object:prop,axis:'x',station:i});
  }
  if(i===1){
   for(let j=0;j<5;j++){const x=-2+j;cyl(g,.07,2.3,0x9984bb,x,1.6,0);ball(g,.36,[0xffd365,0x70cde4,0xee94ba][j%3],x,2.9,0);const arch=ring(g,.55,.08,0xffe2a4,x,2.9,0);rotors.push({object:arch,axis:'y',station:i});}
  }
  if(i===2){
   box(g,5,2.8,.35,0x8998c1,0,1.8,-.7);
   for(let j=0;j<3;j++){const gear=new T.Group();gear.position.set((j-1)*1.5,2,.2);g.add(gear);cyl(gear,.65,.18,palette[i]).rotation.x=Math.PI/2;for(let k=0;k<10;k++){const a=k*Math.PI/5,tooth=box(gear,.24,.28,.24,0xffdc85,Math.sin(a)*.68,Math.cos(a)*.68,0);tooth.rotation.z=-a;}ball(gear,.14,0xfff7e6,0,0,.18);rotors.push({object:gear,axis:'z',station:i,direction:j%2?1:-1});}
  }
  if(i===3){
   for(let j=0;j<3;j++){const m=box(g,.16,1.5,1.1,0x9adeec,(j-1)*1.8,1.6,0);m.rotation.y=.6;mirrors.push(m);cyl(g,.1,1.3,0xb699c5,(j-1)*1.8,.9,0);const flower=ball(g,.3,0xf1abc4,(j-1)*1.8,.65,1.6);flower.scale.y=.5;}
  }
  if(i===4){
   cyl(g,1.3,1.7,0xe2edf2,0,1.3,0);const dome=ball(g,1.3,0x84bddf,0,2.2,0);dome.scale.y=.7;
   const dish=mesh(g,new T.ConeGeometry(1,.4,32,1,true),0xffe4ad,0,3.2,0);dish.rotation.z=.55;
   const vane=new T.Group();vane.position.set(1.9,2.2,.8);g.add(vane);cyl(g,.08,2.2,0xa68ac0,1.9,1.4,.8);box(vane,1.5,.15,.15,0xf6a0b4);rotors.push({object:vane,axis:'y',station:i});
  }
  if(i===5){
   const scope=new T.Group();scope.position.y=2;g.add(scope);cyl(g,.18,1.8,0xa293bd,0,1.3,0);const tube=cyl(scope,.5,2.8,0xffc16b);tube.rotation.z=-.65;ball(scope,.52,0x8adce9,.83,1.08,0);box(g,2,.5,1.1,0xa99bde,0,.75,1.5);for(let j=0;j<3;j++)ball(g,.12,0xffe786,(j-1)*.55,1.06,1.5);
  }
 }
 // 中央天文塔位于已有不可行走圆心，顶部星环在修复后逐层点亮。
 cyl(scene,1.7,.4,0x9b87c7,0,.25,0);cyl(scene,1.2,5.8,0xd0c3ed,0,3.3,0,1);ball(scene,1.35,0x82d7e4,0,6.4,0);
 for(let i=0;i<3;i++){const r=ring(scene,1.8+i*.24,.09,0xffd578,0,6.4,0);r.rotation.x=Math.PI/2+i*.5;rotors.push({object:r,axis:'y',station:5});}
 const star=mesh(scene,new T.OctahedronGeometry(.7),0xffe48d,0,8.4,0);
 for(let i=0;i<6;i++){const light=new T.Mesh(new T.CylinderGeometry(.03,.16,3.2,8),new T.MeshBasicMaterial({color:palette[i],transparent:true,opacity:.5,depthWrite:false}));light.position.set(Math.sin(i*Math.PI/3)*1.3,4.3,Math.cos(i*Math.PI/3)*1.3);scene.add(light);beams.push(light);}
 // 休息凳与已有营地坐席一一对应。
 for(const x of [-6,6])for(const z of [-2.4,2.4]){box(scene,2.4,.18,.85,0xd3b389,x,.58,z);for(const a of [-.9,.9])for(const b of [-.25,.25])box(scene,.12,.5,.12,0x9a849f,x+a,.25,z+b);}
 const dock=new T.Group();dock.position.set(0,0,12);scene.add(dock);box(dock,5,.15,2.7,0xe2b883,0,.12,0);// 码头路牌与可乘坐飞艇由交通模块统一提供，避免重复遮挡人物。
 let elapsed=0;
 return {scene,animate(dt){elapsed+=dt;const progress=getProgress();for(const r of rotors)r.object.rotation[r.axis]+=dt*(progress.stations[r.station].repaired?1.3:.15)*(r.direction||1);lamps.forEach((m,i)=>{const done=progress.stations[i].repaired;m.material.color.setHex(done?0x7aebbc:0xb4a4c9);m.material.emissive.setHex(done?0x236c50:0);});beams.forEach((b,i)=>{b.visible=progress.stations[i].repaired;});mirrors.forEach(m=>{m.rotation.y=progress.stations[3].repaired?Math.PI/4:.6;});star.rotation.y=elapsed*.6;star.position.y=8.4+Math.sin(elapsed*1.5)*.12;star.material.emissive.setHex(progress.complete?0xc59b12:0);}};
}
