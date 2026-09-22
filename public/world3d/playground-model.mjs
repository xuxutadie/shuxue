import * as T from './vendor/three.module.js';
import {rides,parkBounds} from './playground-rules.mjs';
const colors=[0xffc75c,0xe7a3cf,0x8cccd4,0xaaa1e4,0xa9cd83,0xf6ab86];
function mesh(g,geo,c,x,y,z){const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:c,roughness:.75}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function box(g,w,h,d,c,x,y,z){return mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);}
function cyl(g,r,h,c,x,y,z){return mesh(g,new T.CylinderGeometry(r,r,h,24),c,x,y,z);}
function ball(g,r,c,x,y,z,scale=[1,1,1]){const m=mesh(g,new T.SphereGeometry(r,14,10),c,x,y,z);m.scale.set(...scale);return m;}
function beam(g,a,b,r,c){const va=new T.Vector3(...a),vb=new T.Vector3(...b),m=cyl(g,r,va.distanceTo(vb),c,...va.clone().add(vb).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return m;}
function sign(g,text,x,y,z,width=3){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#fff8e6';c.fillRect(0,0,512,128);c.fillStyle='#4b425f';c.font='bold 43px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,66);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshBasicMaterial({map,side:T.DoubleSide}));m.position.set(x,y,z);g.add(m);return m;}
function star(g,c,x,y,z){const s=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.17:.37;i?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r);}s.closePath();return mesh(g,new T.ExtrudeGeometry(s,{depth:.1,bevelEnabled:false}),c,x,y,z);}
export function buildPlayground(){
 const group=new T.Group(),wheelGroup=new T.Group(),carouselGroup=new T.Group(),cabins=[],horses=[],waves=[],surfObjects=new Map();
 const ground=parkBounds;box(group,ground.maxX-ground.minX,.85,28,0xa9c8a0,37.5,-.48,0);box(group,44.7,.06,27.7,0xc5ddac,37.5,-.025,0);
 box(group,44,.07,3,0xf7dfb9,37,.025,0);box(group,3,.07,25,0xf7dfb9,46,.025,0);box(group,3,.07,25,0xf7dfb9,28,.025,0);
 for(let x=17;x<60;x+=2)box(group,1.85,.02,2.65,0xffecc8,x,.07,0);
 // 入口拱门和小卖亭，主通道保持无障碍。
 const gate=new T.Group();gate.name='park-entrance-arch';gate.position.x=18;gate.rotation.y=-Math.PI/2;group.add(gate);
 for(const x of [-2.8,2.8]){
  box(gate,.85,.28,.85,0xffedc8,x,.18,0);box(gate,.55,2.95,.55,0xc9b1e9,x,1.76,0);
  for(const y of [.6,1.3,2,2.7])box(gate,.59,.13,.59,0xffd97d,x,y,0);
  ball(gate,.37,0xffd36e,x,3.23,0);
 }
 // 真正的半圆拱顶，中央保留充足的通行高度。
 const arch=new T.Shape();arch.absarc(0,3.15,3.05,0,Math.PI,false);arch.lineTo(-2.45,3.15);arch.absarc(0,3.15,2.45,Math.PI,0,true);arch.closePath();
 mesh(gate,new T.ExtrudeGeometry(arch,{depth:.36,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,steps:1,curveSegments:40}),0xb49bdd,0,0,-.18);
 for(let i=0;i<=16;i++){const a=i*Math.PI/16;ball(gate,.08,i%2?0xfff0bc:0xffcaa9,Math.cos(a)*2.75,3.15+Math.sin(a)*2.75,.23);}
 box(gate,4.8,1.12,.4,0xffd477,0,4.54,0);box(gate,4.95,.12,.48,0xfff0ce,0,3.97,0);
 // 字牌在横梁外侧，双面分别朝外，避免文字被梁遮住或从背面读成镜像。
 for(const side of [-1,1]){const title=sign(gate,'星光游乐场',0,4.54,side*.23,4.35);title.rotation.y=side<0?Math.PI:0;title.name=side>0?'park-title-front':'park-title-back';title.material.side=T.FrontSide;}
 star(gate,0xffd156,0,6.38,0);
 box(group,4,2.5,4,0xffedc8,24,1.25,-7);box(group,4.4,.22,4.4,0xe7a3cf,24,2.65,-7);sign(group,'欢乐补给站',24,2.15,-4.95,3);box(group,2.4,.85,.15,0x9ed9df,24,1.3,-4.94);
 for(const z of [-13.9,13.9]){box(group,44,.1,.1,0xfff4d9,37.5,.7,z);for(let x=16;x<60;x+=2)cyl(group,.06,1,0xfff4d9,x,.5,z);}
 for(const z of [-12,-6,0,6,12]){cyl(group,.07,2.5,0xaf87b9,59.7,1.25,z);ball(group,.22,0xffe18c,59.7,2.6,z);}
 // 摩天轮的吊舱保持竖直；只有轮盘转动，人物随自己的座舱移动。
 const wheel=rides.wheel;wheelGroup.position.set(wheel.x,8.3,wheel.z);wheelGroup.userData.rideId='wheel';group.add(wheelGroup);
 const rotor=new T.Group();rotor.name='wheel-rotor';rotor.position.z=-.45;wheelGroup.add(rotor);
 for(const z of [-.35,.35]){const rim=mesh(rotor,new T.TorusGeometry(4.8,.14,8,64),0x967ac8,0,0,z);for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(rotor,[0,0,z],[Math.sin(a)*4.8,-Math.cos(a)*4.8,z],.055,0xf4d875);}}
 cyl(wheelGroup,.4,2.5,0xffd36b,0,0,-1.3).rotation.x=Math.PI/2;
 const supports=new T.Group();supports.name='wheel-supports';supports.userData.rideId='wheel';group.add(supports);
 for(const z of [-2.8,-2.2])for(const x of [-3.3,3.3])beam(supports,[wheel.x+x,.2,wheel.z+z],[wheel.x,8.3,wheel.z+z],.18,0x78bcc8);
 box(group,11.2,.22,7.6,0xf1d9e9,wheel.x,.11,wheel.z+.6);
 for(let i=0;i<8;i++){
  const cabin=new T.Group();cabin.name=`wheel-cabin-${i}`;wheelGroup.add(cabin);cabins.push(cabin);
  box(cabin,1.65,.14,1.9,colors[i%6],0,-.8,.2);box(cabin,1.65,.55,.12,colors[i%6],0,-.5,-.7);
  for(const x of [-.79,.79]){box(cabin,.1,.55,1.8,colors[i%6],x,-.5,.2);beam(cabin,[x,-.8,-.65],[x,1.35,-.65],.045,0xfff5dd);beam(cabin,[x,-.8,1.05],[x,1.35,1.05],.045,0xfff5dd);}
  box(cabin,1.9,.15,2.15,colors[i%6],0,1.4,.2);box(cabin,1.3,.15,.48,0xffe7a5,0,-.06,-.36);
 }
 const hangers=[];for(let i=0;i<8;i++){const h=new T.Group();beam(h,[0,0,-.45],[0,0,2.5],.07,0xffd36b);beam(h,[0,0,2.5],[0,-.2,2.5],.07,0xffd36b);wheelGroup.add(h);hangers.push(h);}
 // 木马做成真正的坐骑，马身随转盘公转并轻轻上下起伏。
 const carousel=rides.carousel;carouselGroup.position.set(carousel.x,0,carousel.z);carouselGroup.userData.rideId='carousel';group.add(carouselGroup);
 cyl(carouselGroup,3.75,.3,0xdca0bb,0,.16,0);cyl(carouselGroup,3.55,.12,0xffe8ad,0,.37,0);
 cyl(carouselGroup,.7,3.35,0xf7e6c8,0,2.05,0);cyl(carouselGroup,.79,.16,0xe8b658,0,.5,0);cyl(carouselGroup,.79,.16,0xe8b658,0,3.62,0);
 const turntable=new T.Group();carouselGroup.add(turntable);
 // 条纹帐篷顶、垂幔与暖色灯珠，代替原来单色的大圆锥。
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,b=(i+1)*Math.PI/12,geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([0,5.35,0,Math.sin(b)*4.05,4,Math.cos(b)*4.05,Math.sin(a)*4.05,4,Math.cos(a)*4.05],3));geometry.computeVertexNormals();
  const panel=mesh(carouselGroup,geometry,[0xbca1df,0xffe9be,0xf3bdcf][i%3],0,0,0);panel.material.side=T.DoubleSide;
  ball(carouselGroup,.27,i%2?0xffe9be:0xf3bdcf,Math.sin(a)*3.95,3.86,Math.cos(a)*3.95,[1,.85,1]);
  ball(carouselGroup,.075,0xffe092,Math.sin(a)*3.95,3.55,Math.cos(a)*3.95);
 }
 cyl(carouselGroup,4.05,.1,0xeac271,0,4,0);cyl(carouselGroup,.065,.75,0xeac271,0,5.6,0);star(carouselGroup,0xffd666,0,6,0);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,horse=new T.Group(),coat=i%2?0xfff2de:0xfffaf1,mane=[0xb894d1,0xf2acb8,0x9bcbbd][i%3];turntable.add(horse);horses.push(horse);horse.name=`carousel-horse-${i}`;horse.userData.angle=a;
  // 立杆放到鞍座侧面，人物坐骑时不会被杆子贯穿。
  cyl(horse,.038,3.45,0xe5bd65,.52,2.02,0);
  ball(horse,.6,coat,0,1.15,0,[.55,.67,1.25]);
  beam(horse,[0,1.35,.42],[0,1.94,.73],.19,coat);ball(horse,.31,coat,0,2.05,.8,[.65,.8,1.1]);ball(horse,.24,coat,0,1.98,1.08,[.83,.63,1]);
  for(const x of [-.12,.12]){ball(horse,.095,coat,x,2.32,.66,[.55,1.8,.65]);ball(horse,.042,0x4e4055,x*1.65,2.12,.93);ball(horse,.012,0xffffff,x*1.77,2.135,.95);}
  for(let j=0;j<5;j++)ball(horse,.12,mane,0,1.55+j*.15,.36+j*.055,[1,1.2,1]);
  for(const x of [-.22,.22])for(const z of [-.43,.43]){const knee=z>0?z+.22:z-.15,foot=z>0?z+.09:z-.23;beam(horse,[x,1,z],[x,.69,knee],.075,coat);beam(horse,[x,.69,knee],[x,.43,foot],.065,coat);const hoof=box(horse,.17,.12,.23,0xae8898,x,.4,foot);hoof.name='horse-hoof';}
  const tail=new T.CatmullRomCurve3([new T.Vector3(0,1.3,-.66),new T.Vector3(0,1.17,-.95),new T.Vector3(.12,.74,-1.08)]);mesh(horse,new T.TubeGeometry(tail,12,.11,7,false),mane,0,0,0);
  ball(horse,.45,0xd996b1,0,1.48,-.14,[.75,.18,.95]);box(horse,.53,.12,.51,0xa97895,0,1.55,-.14);
  for(const side of [-1,1]){const rein=new T.CatmullRomCurve3([new T.Vector3(side*.2,2.02,1.02),new T.Vector3(side*.31,1.68,.55),new T.Vector3(side*.29,1.69,-.12)]);mesh(horse,new T.TubeGeometry(rein,10,.015,5,false),0xba9460,0,0,0);}
 }
 // 冲浪池里的浪花、星星和浮标随实际游戏状态推进。
 const surf=rides.surf,waterGroup=new T.Group();waterGroup.userData.rideId='surf';group.add(waterGroup);
 box(waterGroup,9.3,.3,11.3,0xfff0cb,surf.x,.13,surf.z);box(waterGroup,8.8,.08,10.8,0x62cbdc,surf.x,.31,surf.z);
 for(let i=0;i<8;i++){const wave=box(waterGroup,8.4,.025,.1,0xc4f6f3,surf.x,.37,2+i*1.3);waves.push(wave);}
 const board=new T.Group();waterGroup.add(board);ball(board,1,0xffd35d,0,0,0,[.45,.12,1.25]);box(board,.2,.025,1.8,0xf58da6,0,.125,0);board.visible=false;
 // 秋千吊绳和座椅一起绕横梁摆动，角色使用相同的旋转坐标。
 const swing=rides.swing,swingGroup=new T.Group();swingGroup.position.set(swing.x,0,swing.z);swingGroup.userData.rideId='swing';group.add(swingGroup);
 box(swingGroup,5.4,.12,7.4,0xf3dfbc,0,.06,0);
 for(const x of [-2.3,2.3])for(const z of [-2,2])beam(swingGroup,[x,.12,z],[x,4.5,0],.12,0x8fc6c8);
 beam(swingGroup,[-2.6,4.5,0],[2.6,4.5,0],.16,0xf1bf69);
 const swingPivot=new T.Group();swingPivot.position.y=4.4;swingGroup.add(swingPivot);
 for(const x of [-.66,.66])beam(swingPivot,[x,0,0],[x,-3.45,0],.03,0xa7a2b2);
 box(swingPivot,1.5,.17,.7,0xc995bf,0,-3.45,0);box(swingPivot,1.5,.55,.12,0xdab5d4,0,-3.18,-.32);
 // 蹦床保留弹性垫、软包边和防护网，留出面向步道的入口。
 const trampoline=rides.trampoline,trampolineGroup=new T.Group();trampolineGroup.position.set(trampoline.x,0,trampoline.z);trampolineGroup.userData.rideId='trampoline';group.add(trampolineGroup);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(trampolineGroup,.08,.7,0xa19ab6,Math.sin(a)*3.1,.35,Math.cos(a)*3.1);if(i!==6){cyl(trampolineGroup,.065,3.4,0xac93cf,Math.sin(a)*3.35,2.3,Math.cos(a)*3.35);ball(trampolineGroup,.12,0xffd576,Math.sin(a)*3.35,4.02,Math.cos(a)*3.35);}}
 const mat=cyl(trampolineGroup,3,.09,0x677db7,0,.82,0),rim=mesh(trampolineGroup,new T.TorusGeometry(3.18,.23,10,48),0xb2a1e3,0,.85,0);rim.rotation.x=Math.PI/2;
 for(let i=0;i<8;i++){if(i===5||i===6)continue;const a=i*Math.PI/4,b=(i+1)*Math.PI/4;for(let j=0;j<=5;j++){const t=a+(b-a)*j/5;beam(trampolineGroup,[Math.sin(t)*3.35,1,Math.cos(t)*3.35],[Math.sin(t)*3.35,3.95,Math.cos(t)*3.35],.008,0xc1cde2);}for(const y of [1.5,2,2.5,3,3.5])beam(trampolineGroup,[Math.sin(a)*3.35,y,Math.cos(a)*3.35],[Math.sin(b)*3.35,y,Math.cos(b)*3.35],.01,0xc1cde2);}
 star(trampolineGroup,0xffdf77,0,.88,0).rotation.x=-Math.PI/2;
 let currentAngle=0,swingAngle=0;

 function motion(id,angle,time){
  if(id==='swing'){swingAngle=angle;swingPivot.rotation.x=angle;}
  if(id==='wheel'){rotor.rotation.z=angle;for(let i=0;i<8;i++){const a=angle+i*Math.PI/4;cabins[i].position.set(Math.sin(a)*4.8,-Math.cos(a)*4.8-1.6,2.5);hangers[i].position.set(Math.sin(a)*4.8,-Math.cos(a)*4.8,0);}}
  if(id==='carousel'){currentAngle=angle;for(const horse of horses){const a=horse.userData.angle+angle;horse.position.set(Math.sin(a)*2.25,.28+.12*Math.sin(time*2+a),Math.cos(a)*2.25);horse.rotation.y=a+Math.PI/2;}}
 }
 function riderPose(id){group.updateMatrixWorld(true);const anchor=id==='wheel'?cabins[0]:id==='swing'?swingPivot:horses[0],p=id==='swing'?new T.Vector3(0,-3.93,.75):new T.Vector3(0,id==='wheel'?-.52:1.1,id==='wheel'?.5:.65);anchor.localToWorld(p);return {position:p,yaw:id==='carousel'?currentAngle+Math.PI/2:0,pitch:id==='swing'?swingAngle:0};}
 function bounceFrame(round){mat.position.y=.82-(round.height<.2?.08:0);return {position:new T.Vector3(trampoline.x,.92+round.height,trampoline.z),yaw:0};}
 function surfFrame(round,time){
  board.visible=!!round;for(let i=0;i<waves.length;i++)waves[i].position.z=1.8+(i*1.3+time*1.4)%10.5;
  const active=new Set(round?.items.map(i=>i.id)||[]);for(const [id,m] of surfObjects)if(!active.has(id)){m.visible=false;waterGroup.remove(m);m.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});surfObjects.delete(id);}
  if(!round)return null;
  for(const item of round.items){let object=surfObjects.get(item.id);if(!object){object=new T.Group();if(item.kind==='star')star(object,0xffd449,0,.55,0);else{cyl(object,.35,.6,0xf78f79,0,.32,0);cyl(object,.36,.12,0xfff7de,0,.36,0);}waterGroup.add(object);surfObjects.set(item.id,object);}object.position.set(surf.x+item.lane*2.4,.38,10.8-item.distance);object.visible=!item.passed;object.rotation.y=item.kind==='star'?time:0;}
  board.position.set(surf.x+round.lane*2.4,.48+round.height,10.8);board.rotation.z=(round.target-round.lane)*-.16;
  return {position:new T.Vector3(board.position.x,board.position.y+.12,10.8),yaw:Math.PI,roll:board.rotation.z};
 }
 motion('wheel',0,0);motion('carousel',0,0);
 return {group,motion,riderPose,surfFrame,bounceFrame};
}
