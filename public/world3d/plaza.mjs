import * as T from './vendor/three.module.js';
import {seats} from './seats.mjs';

// 原小镇按材质合并过网格，只调整长椅顶点，保留同材质的其他建筑。
export function preparePlaza(town){
 town.updateMatrixWorld(true);
 const point=new T.Vector3(),normal=new T.Vector3();
 const report={rotatedVertices:0,removedTriangles:0};
 town.traverse(o=>{
  if(!o.isMesh||!o.name.startsWith('Landscape_'))return;
  if(o.name==='Landscape_广场水面'){o.visible=false;return;}
  const original=o.geometry,positions=original.attributes.position,targets=[];
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
   const seat=seats.find(s=>s.z>0&&Math.abs(point.x-s.x)<1.35&&Math.abs(point.z-s.z)<.72&&point.y>0&&point.y<1.65);
   if(seat)targets.push([i,seat]);
  }
  let geometry;
  if(targets.length){
   geometry=original.clone();const inverse=o.matrixWorld.clone().invert();
   const toWorld=new T.Matrix3().getNormalMatrix(o.matrixWorld),toLocal=new T.Matrix3().getNormalMatrix(inverse);
   for(const [i,seat] of targets){
    point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
    point.x=2*seat.x-point.x;point.z=2*seat.z-point.z;point.applyMatrix4(inverse);
    geometry.attributes.position.setXYZ(i,point.x,point.y,point.z);
    if(geometry.attributes.normal){normal.fromBufferAttribute(original.attributes.normal,i).applyMatrix3(toWorld);normal.x*=-1;normal.z*=-1;normal.applyMatrix3(toLocal).normalize();geometry.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);}
   }
   report.rotatedVertices+=targets.length;
  }
  // 清除旧池座的独立三角形；广场地面和六枚通关印章保留。
  if(o.name==='Landscape_奶油白'){
   const keep=[],index=original.index,count=index?index.count:positions.count;
   for(let i=0;i<count;i+=3){
    const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const inPool=triangle.every(v=>{point.fromBufferAttribute(positions,v).applyMatrix4(o.matrixWorld);return Math.hypot(point.x,point.z)<1.9&&point.y>=0&&point.y<2.5;});
    if(inPool)report.removedTriangles++;else keep.push(...triangle);
   }
   if(report.removedTriangles){geometry??=original.clone();geometry.setIndex(keep);}
  }
  if(geometry){geometry.computeBoundingBox();geometry.computeBoundingSphere();o.geometry=geometry;original.dispose();}
 });
 return report;
}

export function createPlazaFountain(){
 const group=new T.Group();group.name='plaza-fountain';
 const stone=new T.MeshStandardMaterial({color:0xffecc8,roughness:.65});
 const trim=new T.MeshStandardMaterial({color:0xd6b2df,roughness:.5});
 const gold=new T.MeshStandardMaterial({color:0xf1c879,metalness:.3,roughness:.3});
 const water=new T.MeshStandardMaterial({color:0x36c6e4,emissive:0x087d9c,emissiveIntensity:.15,roughness:.18,transparent:true,opacity:.83,depthWrite:false});
 const spray=new T.MeshBasicMaterial({color:0x9cf3ff,transparent:true,opacity:.72,depthWrite:false});
 const white=new T.MeshBasicMaterial({color:0xedffff,transparent:true,opacity:.82,depthWrite:false});
 function mesh(geometry,material,x,y,z){const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=material===stone||material===trim||material===gold;o.receiveShadow=o.castShadow;group.add(o);return o;}
 const cylinder=(rt,rb,h,m,y)=>mesh(new T.CylinderGeometry(rt,rb,h,48),m,0,y,0);
 const ring=(radius,tube,m,y)=>{const o=mesh(new T.TorusGeometry(radius,tube,10,64),m,0,y,0);o.rotation.x=-Math.PI/2;return o;};
 cylinder(1.87,1.9,.15,stone,.16);cylinder(1.75,1.83,.26,trim,.32);
 cylinder(1.61,1.61,.025,water,.465);ring(1.73,.14,stone,.48);ring(1.73,.027,gold,.605);
 cylinder(.46,.6,.15,stone,.52);cylinder(.22,.34,.63,stone,.9);
 cylinder(.67,.26,.22,stone,1.25);cylinder(.60,.60,.025,water,1.373);ring(.64,.055,gold,1.38);
 cylinder(.11,.14,.22,gold,1.46);
 // 水流曲线从上层池边射出，再落回下层水面。
 function jetPoint(t,angle){const radius=.49+1.02*t;return new T.Vector3(Math.sin(angle)*radius,1.4+3.5*t*(1-t)-.93*t,Math.cos(angle)*radius);}
 const jets=[],ripples=[];
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,points=Array.from({length:25},(_,k)=>jetPoint(k/24,angle));
  const jet=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.043,6,false),spray,0,0,0);jet.name='fountain-arc';jets.push(jet);
  const end=jetPoint(1,angle);
  for(let k=0;k<2;k++){const ripple=ring(.12,.012,white.clone(),.488);ripple.position.x=end.x;ripple.position.z=end.z;ripples.push({mesh:ripple,phase:k*.5+i*.12});}
 }
 const plume=mesh(new T.CylinderGeometry(.025,.09,1,12),spray,0,2,0);plume.name='fountain-main-jet';
 const core=mesh(new T.CylinderGeometry(.012,.035,1,8),white,0,2,0);
 // 所有流动水滴一次绘制，避免给地图增加大量绘制调用。
 const drops=new T.InstancedMesh(new T.SphereGeometry(.035,7,5),white,144);drops.name='fountain-moving-droplets';drops.instanceMatrix.setUsage(T.DynamicDrawUsage);drops.frustumCulled=false;group.add(drops);
 const dummy=new T.Object3D();let elapsed=0;
 function update(dt){
  elapsed+=Math.min(.1,Math.max(0,dt));const height=1.52+Math.sin(elapsed*1.8)*.12;
  for(const stream of [plume,core]){stream.scale.y=height;stream.position.y=1.56+height/2;}
  for(let i=0;i<144;i++){
   if(i<96){const arc=Math.floor(i/12),t=(i%12/12+elapsed*.7)%1;dummy.position.copy(jetPoint(t,arc*Math.PI/4));dummy.scale.set(.7,1.8,.7);}
   else{const n=i-96,t=(n/48+elapsed*.65)%1,a=n*2.4,r=.1+.25*t;dummy.position.set(Math.sin(a)*r*t,1.58+5.9*t*(1-t),Math.cos(a)*r*t);dummy.scale.set(.8,1.6,.8);}
   dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);
  }
  drops.instanceMatrix.needsUpdate=true;
  for(const {mesh:ripple,phase} of ripples){const t=(elapsed*.9+phase)%1;ripple.scale.setScalar(.35+2.2*t);ripple.material.opacity=.6*(1-t);}
 }
 update(0);return {group,update};
}
