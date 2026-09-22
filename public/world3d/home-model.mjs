import * as T from './vendor/three.module.js';
import {townHome,homeDistrict} from './home-layout.mjs';
const palettes={boy:{accent:0x65bcb6,soft:0xffdb72,dark:0x397b94,cloth:0x8fcbd8},girl:{accent:0xd19acb,soft:0xffb8b7,dark:0x8e70ad,cloth:0xb4dcca}};
const walls={sky:0xd9eff7,lavender:0xeee2f6,mint:0xdcefe3,cream:0xffedcc};
function material(color){return new T.MeshStandardMaterial({color,roughness:.82});}
function mesh(g,geometry,color,x,y,z){const m=new T.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function box(g,w,h,d,c,x,y,z){return mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);}
function ball(g,r,c,x,y,z,s=[1,1,1]){const m=mesh(g,new T.SphereGeometry(r,16,10),c,x,y,z);m.scale.set(...s);return m;}
function cylinder(g,r,h,c,x,y,z){return mesh(g,new T.CylinderGeometry(r,r,h,24),c,x,y,z);}
function pillow(g,w,h,d,c,x,y,z){return ball(g,1,c,x,y,z,[w/2,h/2,d/2]);}
function label(g,text,x,y,z,color='#496070',width=2){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff9ea';ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 46px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}));m.position.set(x,y,z);g.add(m);return m;
}
function plant(g,x,z,color=0x79b79a){cylinder(g,.23,.43,0xe4b48b,x,.25,z);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ball(g,.3,color,x+Math.cos(a)*.18,.75+i%2*.18,z+Math.sin(a)*.18,[.8,1.3,.8]);}}
function star(g,x,y,z,color=0xffd26d,size=.22){
 const s=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?size*.45:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?s.lineTo(px,py):s.moveTo(px,py);}s.closePath();const m=mesh(g,new T.ExtrudeGeometry(s,{depth:.05,bevelEnabled:false}),color,x,y,z);return m;
}
export function disposeGroup(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}o.skeleton?.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}
// 住宅区独立铺地，原小镇任务区不缩放；相连步道可直接走到新家门口。
export function createHomeDistrict(){
 const g=new T.Group(),d=homeDistrict,w=d.maxX-d.minX,cx=(d.minX+d.maxX)/2;
 box(g,w,.85,20,0xa9c8a0,cx,-.48,0);
 box(g,w-.25,.06,19.75,0xc7dda8,cx,-.025,0);
 // 广场向西的步道直达朝东的正门，庭院铺在住宅与广场之间。
 box(g,10,.07,3.2,0xf2dfb2,-18,.025,0);
 box(g,7,.07,11.8,0xf2dfb2,-20.3,.025,0);
 for(const x of [-22.7,-20.7,-18.7])for(let z=-5;z<=5;z+=1.1)box(g,1.75,.025,.96,0xf7e9c8,x,.075,z);
 // 围栏位于可行走边界之外，中央庭院留出足够的活动空间。
 for(const z of [-9.9,9.9]){
  box(g,18,.12,.12,0xfff4d9,-25,.65,z);
  for(let x=-33;x<=-17;x+=2)box(g,.15,1,.15,0xfff4d9,x,.5,z);
 }
 box(g,.12,.12,19.8,0xfff4d9,-33.9,.65,0);
 for(let z=-9;z<=9;z+=2)box(g,.15,1,.15,0xfff4d9,-33.9,.5,z);
 for(const [x,z] of [[-32.5,-8],[-18,-8],[-32.5,8],[-18,8]]){
  cylinder(g,.18,1.4,0xb78c62,x,.7,z);
  ball(g,1.05,0x92c698,x,2.1,z,[1,1.25,1]);
  ball(g,.6,0xb4d5a3,x+.5,2.45,z);
 }
 // 花圃与树木共用碰撞范围，避免人物直接穿过装饰。
 for(const x of [-30.8,-19.2]){
  box(g,1.4,.25,1.1,0xc89574,x,.12,6.8);
  for(let i=0;i<5;i++){const dx=(i%3-1)*.35,dz=Math.floor(i/3)*.35;ball(g,.2,i%2?0xffc365:0xe9a7c6,x+dx,.48,6.6+dz);}
 }
 label(g,'花园住宅区',-17.2,1.8,4.8,'#496070',2.6);
 cylinder(g,.07,1.65,0xb78c62,-17.2,.8,4.8);
 return g;
}
export function createHomeEntrance(character){
 const girl=character==='girl',p=girl?palettes.girl:{...palettes.boy,accent:0x508d75,dark:0x325e56,cloth:0x8cbaa0},g=new T.Group();g.position.set(townHome.x,0,townHome.z);g.rotation.y=townHome.yaw;g.userData.homeDoor=true;
 const w=townHome.width,d=townHome.depth,front=d/2;
 box(g,w,3.9,d,0xfff3d9,0,1.98,0);
 // 双坡屋顶：山墙填满正立面，两片坡面在屋脊相接，避免锥形屋顶像悬空大帽子。
 const half=w/2+.35,rise=1.96,eave=3.84,roofDepth=d+.65,slope=Math.atan2(rise,half),slopeWidth=Math.hypot(half,rise);
 const gable=new T.Shape();gable.moveTo(-w/2,4);gable.lineTo(w/2,4);gable.lineTo(0,eave+rise);gable.closePath();
 mesh(g,new T.ExtrudeGeometry(gable,{depth:d,bevelEnabled:false}),0xfff3d9,0,0,-d/2);
 for(const side of [-1,1]){
  const roof=box(g,slopeWidth,.16,roofDepth,p.accent,side*half/2,eave+rise/2,0);roof.rotation.z=-side*slope;
  // 白色檐边与细瓦缝让斜面轮廓清楚，保持轻量的卡通造型。
  for(const z of [-roofDepth/2,roofDepth/2]){const trim=box(g,slopeWidth+.12,.2,.14,0xfff7e7,side*half/2,eave+rise/2,z);trim.rotation.z=-side*slope;}
  for(let z=-roofDepth/2+.55;z<roofDepth/2-.2;z+=.65){const seam=box(g,slopeWidth,.028,.035,p.cloth,side*half/2,eave+rise/2+.095,z);seam.rotation.z=-side*slope;}
  box(g,.15,.2,roofDepth,0xfff7e7,side*half,eave,0);
 }
 const ridge=cylinder(g,.11,roofDepth+.18,p.dark,0,eave+rise+.04,0);ridge.rotation.x=Math.PI/2;
 box(g,1.35,2.3,.13,p.dark,0,1.2,front+.06);ball(g,.085,0xffd466,.43,1.2,front+.17);
 for(const x of [-2.55,2.55]){
  box(g,1.7,1.85,.14,0xffffff,x,2.15,front+.06);
  box(g,1.5,1.65,.15,0xa3d9e4,x,2.15,front+.14);
  box(g,.08,1.7,.17,0xffffff,x,2.15,front+.24);
  box(g,1.55,.08,.17,0xffffff,x,2.15,front+.24);
  box(g,1.85,.24,.45,p.soft,x,1.15,front+.22);
 }
 label(g,girl?'星光花园之家':'森林探索之家',0,3.42,front+.16,'#496070',3.5);
 box(g,2.4,.06,.8,p.soft,0,.07,front+.4);
 if(girl){for(const x of [-2.55,2.55])for(const dx of [-.5,0,.5])ball(g,.18,0xf2a8c5,x+dx,1.43,front+.28);star(g,0,4.65,front+.08,0xffd26d,.34);}
 else {forestExterior(g,w,d,front,p);}
 return g;
}
// 森林小屋用石基、木框、百叶窗和门廊建立层次，所有落地装饰都留在原房屋碰撞范围内。
function forestExterior(g,w,d,front,p){
 const timber=0xa47952,lightWood=0xd6ad75;
 box(g,w+.08,.45,d+.08,0xc2b69f,0,.26,0);
 for(let x=-3.8;x<4;x+=.76)box(g,.015,.38,.035,0x958d7d,x,.26,front+.065);
 for(const x of [-3.87,3.87])box(g,.24,3.5,.18,timber,x,2.05,front+.12);
 for(const y of [.63,3.78])box(g,w,.16,.17,timber,0,y,front+.11);
 // 山墙交叉木梁和圆形阁楼窗。
 for(const side of [-1,1]){const beam=box(g,3.3,.13,.17,timber,side*1.45,4.52,front+.12);beam.rotation.z=-side*.46;}
 const attic=mesh(g,new T.CylinderGeometry(.45,.45,.12,32),0xffe2a0,0,4.69,front+.14);attic.rotation.x=Math.PI/2;
 mesh(g,new T.TorusGeometry(.46,.065,8,32),timber,0,4.69,front+.23);
 box(g,.06,.84,.08,lightWood,0,4.69,front+.24);box(g,.84,.06,.08,lightWood,0,4.69,front+.24);
 // 暖色木门、门框及门廊顶，柱子紧贴墙面，不挡进入家园的落点。
 box(g,1.26,2.18,.13,lightWood,0,1.19,front+.15);
 for(const x of [-.79,.79])box(g,.16,2.53,.27,timber,x,1.3,front+.15);
 for(const x of [-.38,0,.38])box(g,.024,1.95,.025,timber,x,1.2,front+.23);
 ball(g,.07,0xf5cf65,.43,1.18,front+.27);
 for(const x of [-1.08,1.08]){box(g,.16,2.65,.16,timber,x,1.4,front+.23);box(g,.3,.18,.28,lightWood,x,.25,front+.23);}
 const canopy=box(g,2.7,.16,1.05,p.accent,0,2.88,front+.46);canopy.rotation.x=.16;
 box(g,2.78,.2,.13,lightWood,0,2.8,front+.96);
 // 窗边百叶与花箱。
 for(const x of [-2.55,2.55]){
  for(const side of [-1,1]){box(g,.34,1.85,.12,p.dark,x+side*1.03,2.15,front+.17);for(let y=1.42;y<2.94;y+=.22)box(g,.29,.055,.08,p.cloth,x+side*1.03,y,front+.25);}
  box(g,1.88,.28,.45,timber,x,1.11,front+.25);
  for(let i=0;i<5;i++){ball(g,.16,0x79a775,x-.65+i*.32,1.35,front+.26,[1,1.25,1]);ball(g,.1,i%2?0xffd36d:0xffefe0,x-.65+i*.32,1.53,front+.3);}
 }
 // 侧墙也有窗和木框，从广场斜看时不再是一整块空白墙。
 for(const side of [-1,1]){
  const wall=new T.Group();wall.position.x=side*(w/2+.02);wall.rotation.y=side*Math.PI/2;g.add(wall);
  for(const y of [.68,3.75])box(wall,d,.13,.1,timber,0,y,0);
  for(const x of [-1.25,1.25]){box(wall,1.55,1.55,.13,lightWood,x,2.2,0);box(wall,1.28,1.28,.14,0xa8d6ce,x,2.2,.04);box(wall,.065,1.3,.08,0xffefcf,x,2.2,.14);box(wall,1.3,.065,.08,0xffefcf,x,2.2,.14);}
 }
 box(g,.68,1.5,.74,0xb98970,-2.5,5,-.9);box(g,.86,.16,.91,0xe2c4a0,-2.5,5.81,-.9);
 for(const y of [4.55,4.85,5.15,5.45])box(g,.69,.025,.76,0xe2c4a0,-2.5,y,-.9);
 for(const x of [-1.48,1.48]){box(g,.12,.12,.35,p.dark,x,2.5,front+.2);const lamp=box(g,.23,.35,.23,0xffd77c,x,2.29,front+.25);lamp.material.emissive.setHex(0xffb83f);lamp.material.emissiveIntensity=.4;box(g,.32,.09,.32,p.dark,x,2.49,front+.25);}
}
export function buildInterior(character,settings){
 const girl=character==='girl',p=palettes[character]||palettes.boy,g=new T.Group(),wallMeshes=[];
 box(g,14.4,.25,9.4,0xe4ccb0,0,-.13,0);box(g,14,.05,9,0xf3dfc1,0,.01,0);
 for(let x=-6.8;x<7;x+=.7)box(g,.016,.01,8.9,0xe4cfae,x,.043,0);
 function wall(w,h,d,x,y,z){const m=box(g,w,h,d,walls[settings.wall],x,y,z);wallMeshes.push(m);}
 wall(14,3.4,.18,0,1.7,-4.5);wall(.18,1.1,9,-7,.55,0);wall(.18,1.1,9,7,.55,0);
 // 切面视角保留后墙与矮侧墙，前墙留空，让房间和人物都看得清。
 wall(.22,2.75,5.2,0,1.375,-1.8);box(g,.3,.12,5.3,p.accent,0,2.77,-1.8);
 for(const x of [-3.5,3.5]){box(g,6.9,.16,.12,0xffffff,x,.13,-4.37);box(g,6.9,.14,.24,p.accent,x,3.38,-4.47);}
 // 两间房各有窗户、窗帘与主题挂画。
 for(const x of [-4.7,4.6]){
  box(g,2.4,1.8,.12,0xffffff,x,2.18,-4.34);box(g,2.15,1.55,.13,0xa9dce5,x,2.18,-4.25);
  box(g,.08,1.6,.14,0xffffff,x,2.18,-4.16);box(g,2.2,.08,.14,0xffffff,x,2.18,-4.16);
  for(const dx of [-1.28,1.28]){const curtain=cylinder(g,.19,1.95,p.cloth,x+dx,2.15,-4.02);curtain.scale.z=.55;}
  box(g,2.8,.1,.24,p.dark,x,3.18,-4.04);
 }
 label(g,girl?'花园客厅':'探索客厅',-2,3.02,-4.28,'#59657b',1.8);
 label(g,girl?'星光卧室':'星际卧室',1.55,3.02,-4.28,'#59657b',1.8);
 // 沙发的座面高与共用坐姿匹配，站位在沙发前方 0.85 米。
 box(g,3.5,.38,1.1,p.dark,-4.6,.36,-2.25);pillow(g,3.35,.22,1.06,p.accent,-4.6,.59,-2.25);
 box(g,3.5,.85,.23,p.accent,-4.6,1,-2.75);
 for(const x of [-6.23,-2.97])pillow(g,.32,.62,1.18,p.accent,x,.78,-2.25);
 for(const [i,x] of [-5.55,-4.6,-3.65].entries())pillow(g,.65,.6,.22,i%2?p.soft:p.cloth,x,1.05,-2.55);
 if(girl){const top=cylinder(g,.8,.13,0xfff2da,-3.8,.61,.15);top.scale.z=.57;top.scale.x=1.18;}else box(g,1.8,.13,.95,0xf3c574,-3.8,.61,.15);
 for(const x of [-4.4,-3.2])for(const z of [-.1,.4])cylinder(g,.045,.54,p.dark,x,.3,z);
 box(g,.45,.08,.34,p.soft,-4,.73,.1);cylinder(g,.09,.16,0xffffff,-3.5,.76,.1);
 // 书架、书籍和绿植是固定装饰。
 box(g,.6,2.15,2.1,p.dark,-6.45,1.12,-.5);
 for(let h=.4;h<2;h+=.52){box(g,.65,.06,2.15,0xffe6b6,-6.42,h,-.5);for(let j=0;j<5;j++)box(g,.46,.35,.16,[p.soft,p.accent,0xefac98,0xb9d8b4][j%4],-6.36,h+.2,-1.3+j*.34);}
 plant(g,-6,3.5);plant(g,6.1,.8);
 // 男生采用飞船床头和望远镜；女生采用花瓣床头和小兔玩偶。
 box(g,2.5,.42,3.4,p.dark,4.4,.3,-2);pillow(g,2.42,.38,3.3,0xfffaf1,4.4,.62,-2);
 box(g,2.4,.16,2,p.cloth,4.4,.86,-1.5);box(g,2.5,1,.18,p.accent,4.4,1.05,-3.65);
 for(const x of [3.8,5])pillow(g,.93,.22,.58,0xfff4db,x,.92,-3.15);
 if(girl){for(let i=0;i<5;i++)ball(g,.29,i%2?p.soft:p.accent,3.45+i*.48,1.55+Math.sin(i*Math.PI/4)*.3,-3.67,[1,1,.36]);ball(g,.23,0xffeddc,5.05,1.11,-2.85);ball(g,.19,0xffeddc,5.05,1.43,-2.85);for(const x of [4.96,5.14])ball(g,.095,0xffeddc,x,1.68,-2.85,[.7,1.7,.7]);}
 else {for(const x of [3.65,4.4,5.15])star(g,x,1.45,-3.52,p.soft,.23);const scope=cylinder(g,.13,.75,p.soft,6,1.5,-3.1);scope.rotation.z=.9;for(let i=0;i<3;i++){const leg=box(g,.045,1.1,.045,p.dark,6+Math.cos(i*2.1)*.2,.58,-3.1+Math.sin(i*2.1)*.2);leg.rotation.z=Math.cos(i*2.1)*.3;}}
 box(g,1.7,2.4,.9,0xffedcf,1.25,1.25,-3.7);for(const x of [.85,1.65]){box(g,.77,2.2,.07,p.cloth,x,1.25,-3.21);ball(g,.055,p.dark,x+(x<1.25?.23:-.23),1.2,-3.13);}
 // 书桌、台灯、笔记本和椅子。
 box(g,3,.13,1,p.soft,4.6,1.12,3);for(const x of [3.35,5.85])for(const z of [2.65,3.35])box(g,.09,1.05,.09,p.dark,x,.57,z);
 box(g,.7,.045,.5,0xfffaf2,4.6,1.21,2.9);box(g,.32,.05,.48,p.accent,5.35,1.21,2.9);
 cylinder(g,.16,.08,p.dark,3.65,1.25,3);cylinder(g,.035,.5,p.dark,3.65,1.51,3);mesh(g,new T.ConeGeometry(.3,.35,24),p.cloth,3.65,1.86,3);
 box(g,.75,.14,.65,p.accent,4.6,.61,2.15);box(g,.75,.65,.12,p.accent,4.6,.94,1.84);for(const x of [4.32,4.88])for(const z of [1.93,2.38])box(g,.055,.52,.055,p.dark,x,.3,z);
 // 墙上小画与星星灯。
 box(g,1.1,1.1,.1,p.dark,-1.35,1.85,-4.28);box(g,.94,.94,.11,p.soft,-1.35,1.85,-4.2);star(g,-1.35,1.85,-4.1,girl?0xbe87ba:0x70afbd,.35);
 for(let i=0;i<6;i++)star(g,1+i*.82,2.8+Math.sin(i)*.1,-4.13,p.soft,.12);
 label(g,'返回小镇',-1.6,.07,3.8,'#4c6774',1.6).rotation.x=-Math.PI/2;
 let decor=new T.Group();g.add(decor);
 function applyDecor(next){
  wallMeshes.forEach(m=>m.material.color.setHex(walls[next.wall]||walls.cream));
  g.remove(decor);disposeGroup(decor);decor=new T.Group();g.add(decor);
  const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');const colors={wave:['#9edada','#fff1b4'],flower:['#edb7cb','#fff3c7'],stars:['#bfb1e9','#fff0a5'],sun:['#ffd475','#fff4d1']};const cs=colors[next.rug]||colors.wave;
  ctx.fillStyle=cs[0];ctx.fillRect(0,0,512,512);ctx.strokeStyle=cs[1];ctx.lineWidth=14;ctx.strokeRect(18,18,476,476);ctx.fillStyle=cs[1];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const x=110+i*146,y=110+j*146;ctx.beginPath();if(next.rug==='wave'){ctx.lineWidth=16;ctx.arc(x,y,42,0,Math.PI);ctx.stroke();}else if(next.rug==='flower'){for(let k=0;k<5;k++){ctx.moveTo(x,y);ctx.arc(x+Math.cos(k*1.257)*22,y+Math.sin(k*1.257)*22,18,0,Math.PI*2);}ctx.fill();}else if(next.rug==='stars'){for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,r=k%2?17:40;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.fill();}else{ctx.arc(x,y,33,0,Math.PI*2);ctx.fill();}}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  for(const [x,z,w,d] of [[-3.8,.7,4,3.3],[3.2,.3,2,1.6]]){const rug=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({map:tex,roughness:1}));rug.rotation.x=-Math.PI/2;rug.position.set(x,.06,z);rug.receiveShadow=true;decor.add(rug);}
  const x=-2.4,z=-3.5;cylinder(decor,.45,.75,0xffedce,x,.42,z);
  if(next.ornament==='planet'){ball(decor,.32,p.accent,x,1.12,z);const ring=mesh(decor,new T.TorusGeometry(.43,.045,8,32),p.soft,x,1.12,z);ring.rotation.x=1.1;}
  else if(next.ornament==='flowers'){cylinder(decor,.16,.28,p.soft,x,.95,z);for(let i=0;i<5;i++){const a=i*1.257;ball(decor,.12,i%2?0xffbd92:0xd8a4cd,x+Math.cos(a)*.22,1.3+Math.sin(a)*.1,z+Math.sin(a)*.22);}}
  else if(next.ornament==='crystal'){mesh(decor,new T.OctahedronGeometry(.4),0xb49be0,x,1.21,z);star(decor,x+.4,1.5,z,p.soft,.12);}
  else for(let i=0;i<3;i++){const b=box(decor,.6,.11,.4,[p.accent,p.soft,p.cloth][i],x,.85+i*.11,z);b.rotation.y=i*.2;}
 }
 applyDecor(settings);
 return {group:g,applyDecor};
}
