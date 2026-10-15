import * as T from './vendor/three.module.js';
import {stations} from './navigation3d.mjs';

// 六处设施沿用营地的碰撞范围，低矮水渠和步道只负责视觉连接。
export function createEcoport(getProgress){
 const scene=new T.Group(),geometries=new Map(),materials=new Map();
 const colors={cream:0xfff5d7,ink:0x38445c,water:0x50d8e8,purple:0xad8bea,pink:0xff90be,yellow:0xffd75c,green:0x82d88d,wood:0xc98b62,white:0xfffcf2};
 const labels=['星图桥','镜影货仓','疾风驿站','山路补给站','云端牧场','生态控制塔'];
 const kinds=['bridge','warehouse','railway','supply','pasture','water-tower'];
 const accents=[colors.water,colors.purple,colors.yellow,0xffa45f,colors.green,colors.pink];
 const groups=[],lamps=[],animations=[];
 const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
 function material(color,transparent=false){const key=`${color}:${transparent}`;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.72,metalness:.04,transparent,opacity:transparent ? .54 : 1,depthWrite:!transparent}));return materials.get(key);}
 function mesh(parent,geo,color,x=0,y=0,z=0,transparent=false){const object=new T.Mesh(geo,material(color,transparent));object.position.set(x,y,z);parent.add(object);return object;}
 function box(parent,w,h,d,color,x=0,y=0,z=0){const object=mesh(parent,geometry(`box:${w}:${h}:${d}`,()=>new T.BoxGeometry(w,h,d)),color,x,y,z);return object;}
 function ball(parent,r,color,x=0,y=0,z=0){return mesh(parent,geometry(`ball:${r}`,()=>new T.SphereGeometry(r,16,10)),color,x,y,z);}
 function cylinder(parent,r,h,color,x=0,y=0,z=0,top=r){return mesh(parent,geometry(`cyl:${r}:${h}:${top}`,()=>new T.CylinderGeometry(top,r,h,20)),color,x,y,z);}
 function ring(parent,r,t,color,x=0,y=0,z=0){return mesh(parent,geometry(`ring:${r}:${t}`,()=>new T.TorusGeometry(r,t,6,32)),color,x,y,z);}
 function rod(parent,from,to,r,color){const a=new T.Vector3(...from),b=new T.Vector3(...to);const object=cylinder(parent,r,a.distanceTo(b),color);object.position.copy(a).add(b).multiplyScalar(.5);object.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());return object;}
 function label(parent,text,y){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=120;
  const context=canvas.getContext('2d');context.fillStyle='#fff9e9';context.fillRect(0,0,640,120);context.fillStyle='#35435c';context.font='bold 46px Microsoft Yahei';context.textAlign='center';context.textBaseline='middle';context.fillText(text,320,60);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));sprite.position.set(0,y,0);sprite.scale.set(4.4,.82,1);parent.add(sprite);
 }
 function wheel(parent,x,y,z){const w=cylinder(parent,.18,.15,colors.ink,x,y,z);w.rotation.x=Math.PI/2;return w;}
 function robot(parent,color,x,y,z){
  const bot=new T.Group();bot.position.set(x,y,z);parent.add(bot);
  box(bot,.62,.66,.48,color,0,.55,0);box(bot,.76,.12,.58,colors.cream,0,.93,0);
  const head=ball(bot,.34,colors.white,0,1.18,0);head.scale.set(1,.82,.9);
  box(bot,.48,.13,.09,colors.ink,0,1.2,.29);ball(bot,.035,colors.water,-.13,1.21,.345);ball(bot,.035,colors.water,.13,1.21,.345);
  rod(bot,[0,1.45,0],[0,1.68,0],.035,colors.ink);ball(bot,.09,color,0,1.69,0);
  wheel(bot,-.27,.18,.05);wheel(bot,.27,.18,.05);return bot;
 }
 // 岛的侧壁在地面以下收束，云朵分布两侧而非盖住可行走地面。
 box(scene,32,.7,28,0xc7b4e7,0,-.45,0);box(scene,31.8,.12,27.8,0xf0f6dd,0,-.04,0);
 for(let i=0;i<10;i++){
  const angle=i*Math.PI/5,height=2.8+i%3;
  const rock=mesh(scene,geometry(`rock:${height}`,()=>new T.ConeGeometry(2.25,height,5)),0xbba4d5,Math.cos(angle)*13,-.85-height/2,Math.sin(angle)*11);rock.rotation.z=Math.PI;
 }
 for(let i=0;i<8;i++){
  const cloud=new T.Group();cloud.position.set((i%2?1:-1)*(17.8+(i%3)),i%3===0?.5:-1.4,-12+Math.floor(i/2)*8);scene.add(cloud);
  for(let k=0;k<3;k++){const puff=ball(cloud,1,0xffffff,(k-1)*1.3,Math.sin(k)*.3,0);puff.scale.set(1.4,.55,1.05);}
 }
 for(const z of [-4,4])box(scene,29,.035,2.4,0xffe7ad,0,.045,z);
 for(const x of [-14,14])box(scene,2,.035,22,0xffe7ad,x,.045,0);
 for(const x of [-10,0,10])box(scene,1.8,.04,24,0xffefc8,x,.045,0);
 // 横贯港口的水渠只在桥面下通过；桥面平齐，保留原有寻路高度。
 box(scene,30,.025,1.7,colors.water,0,.06,0);
 for(const z of [-1.02,1.02])box(scene,30,.09,.18,0xc4edf0,0,.08,z);
 for(const x of [-14,-10,10,14]){
  box(scene,2,.055,2.4,colors.wood,x,.12,0);
  for(let k=0;k<5;k++)box(scene,1.9,.025,.08,0xe8bd8d,x,.16,-.9+k*.45);
 }
 // 四处坐凳与共用坐席定义一致，不能额外占用开放道路。
 for(const x of [-6,6])for(const z of [-2.4,2.4]){
  box(scene,2.4,.18,.85,colors.wood,x,.58,z);
  for(const a of [-.9,.9])for(const b of [-.25,.25])box(scene,.12,.5,.12,colors.ink,x+a,.25,z+b);
 }
 for(let i=0;i<6;i++){
  const group=new T.Group();group.position.set(stations[i][0],0,stations[i][1]);group.userData.stationIndex=i;group.userData.facilityKind=kinds[i];groups.push(group);scene.add(group);
  box(group,6.3,.18,5.4,accents[i],0,.12,0);box(group,6.08,.08,5.16,colors.cream,0,.25,0);
  const front=i<3?1:-1,npc=robot(group,accents[i],0,0,front*3.8);if(front<0)npc.rotation.y=Math.PI;
  const lamp=new T.Group();lamp.position.set(.62,1.45,front*3.8);group.add(lamp);ball(lamp,.13,0xb4b4be);const lit=ball(lamp,.13,0x6ce8ab);lit.visible=false;lamps.push(lit);
 }
 // 星图桥：缺失桥板与雾团在修复时退去，孩子可以直接看见通行图恢复。
 {
  const g=groups[0];label(g,labels[0],4);
  box(g,5.9,.04,3.7,colors.water,0,.32,0);
  for(const x of [-2.6,2.6])for(const z of [-1.25,1.25])cylinder(g,.18,1.4,0xa8c9d6,x,.95,z);
  const repaired=new T.Group();repaired.name='ecoport-bridge-repaired';repaired.visible=false;g.add(repaired);
  for(let i=0;i<11;i++){const plank=box(i===4||i===5||i===7?repaired:g,.46,.17,2.1,i%2?0xffdf83:0xf2bd6a,-2.4+i*.48,1.22,0);plank.rotation.z=Math.sin(i*.6)*.015;}
  for(const z of [-1.25,1.25]){rod(g,[-2.6,1.6,z],[2.6,1.6,z],.055,colors.cream);rod(g,[-2.6,1.95,z],[2.6,1.95,z],.055,colors.cream);}
  const beacons=[];
  for(const x of [-2.65,2.65]){cylinder(g,.12,2.2,colors.purple,x,1.4,0);const beacon=ball(g,.23,colors.yellow,x,2.65,0);beacon.visible=false;beacons.push(beacon);}
  const fog=new T.Group();g.add(fog);for(let i=0;i<4;i++){const puff=ball(fog,.7,0xe7e5f1,-1.8+i*1.1,1.8,.45);puff.scale.set(1.2,.65,.8);}
  let retreat=0;
  animations.push((time,done)=>{repaired.visible=done(0);beacons.forEach(b=>b.visible=done(0));retreat=T.MathUtils.lerp(retreat,done(0)?1:0,.08);fog.position.y=retreat*3;fog.scale.setScalar(1-retreat*.95);fog.visible=retreat<.99;});
 }
 // 镜影货仓：仓库与镜面各有轮廓，顶部吊机在恢复后搬运货箱。
 {
  const g=groups[1];label(g,labels[1],4.9);
  box(g,4.2,2.4,2.8,colors.purple,-.65,1.52,-.35);
  box(g,4.5,.22,3.2,0x8063c8,-.65,2.85,-.35);
  box(g,1.5,1.9,.05,colors.ink,-.65,1.22,1.08);
  const shutter=box(g,1.4,1.8,.09,0xc6b0f0,-.65,1.25,1.14);
  for(const x of [-1.4,-.7,0])box(g,.035,1.7,.03,0xe5dafb,x,1.28,1.21);
  for(const x of [-2.35,1.05])box(g,.35,.65,.06,colors.water,x,2,1.09);
  const mirror=box(g,.12,1.65,1.25,0x87dce9,2.3,1.2,-1.45);mirror.rotation.y=-.2;
  for(let i=0;i<3;i++)box(g,.66,.64,.66,[colors.yellow,colors.pink,colors.green][i],-1.8+i*.74,.66,1.7);
  const crane=new T.Group();crane.position.set(2.05,.35,.75);g.add(crane);
  cylinder(crane,.3,.2,0x7d66a9,0,.1,0);cylinder(crane,.09,2.7,colors.yellow,0,1.5,0);
  const arm=new T.Group();arm.position.y=2.8;crane.add(arm);box(arm,2.4,.16,.17,colors.yellow,-.9,0,0);
  const cable=rod(arm,[-1.9,0,0],[-1.9,-1.35,0],.025,colors.ink),cargo=box(arm,.68,.65,.68,colors.pink,-1.9,-1.55,0);
  for(const x of [-.24,.24])box(cargo,.06,.7,.72,0xffd6e6,x,0,0);
  animations.push((time,done)=>{if(done(1)){arm.rotation.y=Math.sin(time*.7)*.38;const lift=Math.sin(time*1.2)*.3;cargo.position.y=-1.5+lift;cable.scale.y=1-lift*.65;cable.position.y=-.68+lift*.5;}shutter.scale.y=done(1)?.12:1;shutter.position.y=done(1)?2.05:1.25;});
 }
 // 疾风驿站的环形运输轨道从仓库方向接入，列车在设施恢复后连续运行。
 {
  const g=groups[2];label(g,labels[2],4.3);
  box(g,3.3,.2,1.35,colors.yellow,0,2.8,-1.5);
  for(const x of [-1.35,1.35])cylinder(g,.09,2.4,0xe4a741,x,1.55,-1.5);
  box(g,1.2,.6,.12,colors.ink,0,2.27,-1.5);
  for(const x of [-.35,0,.35])ball(g,.07,colors.water,x,2.28,-1.41);
  const trackPoints=Array.from({length:49},(_,i)=>new T.Vector3(Math.cos(i*Math.PI/24)*2.35,.4,Math.sin(i*Math.PI/24)*1.3));
  for(const radius of [.94,1.06]){
   const curve=new T.CatmullRomCurve3(trackPoints.map(p=>new T.Vector3(p.x*radius,p.y,p.z*radius)),true);
   mesh(g,geometry(`track:${radius}`,()=>new T.TubeGeometry(curve,48,.04,5,true)),colors.ink);
  }
  for(let i=0;i<20;i++){const a=i*Math.PI/10,sleeper=box(g,.52,.065,.11,0xb9976d,Math.cos(a)*2.35,.37,Math.sin(a)*1.3);sleeper.rotation.y=-Math.atan2(Math.sin(a)*2.35,Math.cos(a)*1.3);}
  const train=new T.Group();g.add(train);box(train,.9,.55,.62,colors.yellow,0,.82,0);box(train,.52,.4,.58,colors.pink,-.14,1.25,0);box(train,.025,.23,.42,colors.water,.13,1.27,0);
  for(const x of [-.3,.3])for(const z of [-.35,.35])wheel(train,x,.52,z);
  const lamp=ball(train,.08,colors.cream,.47,.92,0);lamp.scale.set(.4,1,1);
  animations.push((time,done)=>{const a=done(2)?time*.65:.4;train.position.set(Math.cos(a)*2.35,0,Math.sin(a)*1.3);train.rotation.y=-Math.atan2(Math.cos(a)*1.3,-Math.sin(a)*2.35);});
 }
 // 山路补给站保留高低两段补给道，修复后小机器人将货物送往牧场。
 {
  const g=groups[3];label(g,labels[3],4.6);
  for(let i=0;i<3;i++){
   const mountain=mesh(g,geometry(`hill:${i}`,()=>new T.ConeGeometry(1.3,1.7+i*.5,6)),[0x9acb9a,0x78bb93,0xb0d59d][i],-1.75+i*1.55,1.2+i*.2,.85);
   mountain.rotation.y=i*.4;
  }
  box(g,3.9,.42,1.45,0xe7c29b,-.3,.52,-.9);box(g,2.8,.42,1.1,0xf2d6ab,.4,.94,-.65);
  box(g,2.5,.15,1.55,0xffa85d,-.4,2.7,-1.25);
  for(const x of [-1.4,.6])cylinder(g,.07,2.2,colors.wood,x,1.5,-1.25);
  box(g,.8,.8,.7,colors.purple,1.95,.75,-.9);
  const lit=ball(g,.14,colors.yellow,1.95,1.28,-.9);lit.visible=false;
  // 运输线贴着南侧设施前缘，避免堵住六站的交谈点。
  box(scene,7.4,.025,.7,0xffd67c,-5.8,.07,5.25);
  const courier=robot(scene,0xffa45f,-10,.35,6.5);courier.scale.setScalar(.7);box(courier,.7,.5,.65,colors.yellow,0,.85,-.48);
  const route=[new T.Vector3(-10,.35,6.5),new T.Vector3(-8.2,.03,5.25),new T.Vector3(-3.5,.03,5.25)];
  animations.push((time,done)=>{
   lit.visible=done(3);if(!done(3)){courier.position.copy(route[0]);courier.rotation.y=-Math.PI/2;return;}
   const cycle=time*.1%2,forward=cycle<1,t=forward?cycle:2-cycle,scaled=t*2,index=Math.min(1,Math.floor(scaled));
   courier.position.lerpVectors(route[index],route[index+1],scaled-index);courier.rotation.y=Math.atan2(route[index+1].x-route[index].x,route[index+1].z-route[index].z)+(forward?0:Math.PI);
  });
 }
 // 牧场的草、奶牛、生态风车共同恢复，避免用一盏灯代替设施修复。
 {
  const g=groups[4];label(g,labels[4],4.3);
  const meadow=box(g,5.7,.05,4.65,0xd2da9b,0,.34,0),healthy=box(g,5.7,.055,4.65,0x9be48c,0,.35,0);healthy.visible=false;
  for(const x of [-2.7,2.7])for(let k=0;k<4;k++)cylinder(g,.055,.8,colors.white,x,.76,-1.8+k*1.2);
  for(const x of [-2.7,2.7])for(const y of [.65,1.02])box(g,.07,.06,4.7,colors.white,x,y,0);
  for(let k=0;k<5;k++)cylinder(g,.055,.8,colors.white,-2.4+k*1.2,.76,2.25);
  for(const y of [.65,1.02])box(g,5.6,.06,.07,colors.white,0,y,2.25);
  const grass=new T.Group();g.add(grass);
  for(let i=0;i<9;i++){
   const tuft=new T.Group();tuft.position.set(-2+(i%3)*1.8,.39,-1.55+Math.floor(i/3)*1.25);grass.add(tuft);
   for(let j=0;j<3;j++){const blade=box(tuft,.08,.38,.08,0x48b96b,(j-1)*.15,.19,0);blade.rotation.z=(j-1)*.22;}
  }
  function cow(x,z,yaw){
   const animal=new T.Group();animal.position.set(x,.4,z);animal.rotation.y=yaw;g.add(animal);
   box(animal,1.05,.55,.55,colors.white,0,.7,0);box(animal,.3,.57,.57,colors.ink,-.1,.7,0);
   const head=ball(animal,.27,colors.white,.65,.84,0);head.scale.set(1.05,1,.95);box(animal,.23,.17,.38,colors.pink,.86,.76,0);
   for(const side of [-1,1]){ball(animal,.035,colors.ink,.72,.93,side*.23);ball(animal,.1,colors.white,.52,1.06,side*.29);}
   for(const a of [-.34,.34])for(const b of [-.18,.18])box(animal,.12,.45,.12,colors.wood,a,.26,b);
   rod(animal,[-.54,.8,0],[-.72,.5,0],.025,colors.wood);return animal;
  }
  const cows=[cow(-1.4,-.65,.25),cow(.45,-.8,-.3),cow(.2,.9,.65)];
  cylinder(g,.06,2.7,colors.wood,2,1.7,1.2);const pinwheel=new T.Group();pinwheel.position.set(2,3.1,1.2);g.add(pinwheel);
  for(let i=0;i<4;i++){const blade=box(pinwheel,.6,.22,.08,[colors.yellow,colors.pink,colors.water,colors.purple][i],Math.cos(i*Math.PI/2)*.4,Math.sin(i*Math.PI/2)*.4,0);blade.rotation.z=i*Math.PI/2;}
  ball(pinwheel,.12,colors.cream,0,0,.09);
  animations.push((time,done)=>{healthy.visible=done(4);meadow.visible=!done(4);grass.scale.y=done(4)?1+Math.sin(time)*.05:.24;pinwheel.rotation.z=done(4)?time*.8:0;cows.forEach((cow,i)=>{cow.rotation.z=done(4)?Math.sin(time*1.4+i)*.025:0;});});
 }
 // 控制塔的透明水箱、管道与中央喷泉连接，最后一站启动全港水循环。
 {
  const g=groups[5];label(g,labels[5],5.7);
  cylinder(g,1.5,.28,0x9481cf,0,.48,0);
  for(const x of [-1,1])for(const z of [-.75,.75])cylinder(g,.1,3.8,colors.purple,x,2.35,z);
  cylinder(g,1.4,.2,colors.purple,0,4.2,0);
  mesh(g,geometry('tank-shell',()=>new T.CylinderGeometry(1.3,1.3,2.1,24,1,true)),0xc4f6fb,0,3,0,true);
  const tank=cylinder(g,1.22,1.5,colors.water,0,2.65,0);
  const pipe=rod(g,[1.7,.65,0],[1.7,3.7,0],.15,colors.water);rod(g,[0,3.7,0],[1.7,3.7,0],.15,colors.water);rod(g,[1.7,.65,0],[2.6,.65,0],.15,colors.water);
  const valve=ring(g,.32,.07,colors.yellow,1.7,1.5,.2);for(let i=0;i<3;i++){const spoke=box(valve,.55,.05,.04,colors.yellow);spoke.rotation.z=i*Math.PI/3;}
  box(g,1.4,.7,.45,colors.ink,-1.9,.8,-1.1);
  const panelLamps=[];for(let i=0;i<3;i++){const lamp=ball(g,.11,[colors.yellow,colors.green,colors.pink][i],-2.32+i*.4,1.22,-1.1);lamp.visible=false;panelLamps.push(lamp);}
  const arrow=mesh(g,geometry('eco-core',()=>new T.OctahedronGeometry(.45)),colors.yellow,0,4.9,0);
  animations.push((time,done,complete)=>{tank.scale.y=done(5)?.85+Math.sin(time*.7)*.07:.35;tank.position.y=2.03+tank.scale.y*.75;valve.rotation.z=done(5)?Math.sin(time*.65)*.25:0;panelLamps.forEach(l=>l.visible=done(5));arrow.rotation.y=time*.8;arrow.position.y=4.9+(complete?Math.sin(time*2)*.15:0);pipe.visible=true;});
 }
 // 中心喷泉全部位于既有不可行走圆形区域内，喷弧与水珠确实在流动。
 cylinder(scene,1.8,.24,colors.purple,0,.2,0);cylinder(scene,1.57,.15,colors.water,0,.36,0);
 const rim=ring(scene,1.67,.13,colors.cream,0,.43,0);rim.rotation.x=Math.PI/2;
 cylinder(scene,.42,.65,colors.cream,0,.65,0);const core=ball(scene,.38,colors.yellow,0,1.12,0);
 const fountain=new T.Group();fountain.name='ecoport-fountain-water';fountain.visible=false;scene.add(fountain);
 const drops=[];
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,c=Math.cos(angle),s=Math.sin(angle);
  const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,1.18,0),new T.Vector3(c*.95,2.5,s*.95),new T.Vector3(c*1.32,.47,s*1.32));
  mesh(fountain,geometry(`fountain:${i}`,()=>new T.TubeGeometry(curve,20,.035,5,false)),0x85e9f8);
  for(let j=0;j<2;j++){const drop=ball(fountain,.065,colors.white);drops.push({drop,curve,phase:j*.5+i*.09});}
 }
 const pulses=[];for(let i=0;i<12;i++){const pulse=box(scene,.45,.015,.12,0xd1ffff,-14+i*2.5,.085,0);pulse.visible=false;pulses.push(pulse);}
 animations.push((time,done,complete)=>{fountain.visible=done(5);core.rotation.y=time*.5;drops.forEach(({drop,curve,phase})=>curve.getPoint((time*.6+phase)%1,drop.position));pulses.forEach((pulse,i)=>{pulse.visible=done(5);pulse.position.x=-14+(time*1.4+i*2.5)%28;});if(complete)core.scale.setScalar(1+Math.sin(time*3)*.08);});
 const dock=new T.Group();dock.name='ecoport-dock';dock.position.set(0,0,12);scene.add(dock);
 box(dock,5,.14,2.7,colors.wood,0,.12,0);for(let i=0;i<9;i++)box(dock,.06,.02,2.6,0xe6bf94,-2.2+i*.55,.2,0);
 let elapsed=0;
 return {scene,animate(dt){elapsed+=Math.max(0,Math.min(dt,.1));const progress=getProgress()||{};const repaired=i=>!!progress.stations?.[i]?.repaired;lamps.forEach((lamp,i)=>lamp.visible=repaired(i));animations.forEach(update=>update(elapsed,repaired,!!progress.complete));}};
}
