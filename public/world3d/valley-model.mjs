import * as T from './vendor/three.module.js';
import {valleyGate} from './valley-layout.mjs';

// 保留旧模型资源供统一释放，但关闭其显示和点击命中。
export function hideOldValley(town){
 for(const name of ['ValleyGate','营地远景']){
  const old=town.getObjectByName(name);if(!old)continue;
  old.visible=false;old.traverse(o=>{o.raycast=()=>{};});
 }
 // 原景观按材质合并，单独清掉新通路正中的树，不影响两侧花园。
 town.updateMatrixWorld(true);const point=new T.Vector3();
 town.traverse(o=>{
  if(!['Landscape_蜂蜜木色','Landscape_树冠嫩绿','Landscape_树冠深绿'].includes(o.name))return;
  const original=o.geometry,index=original.index,positions=original.attributes.position,keep=[];
  const count=index?index.count:positions.count;
  for(let i=0;i<count;i+=3){
   const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j);
   const inPath=triangle.every(v=>{point.fromBufferAttribute(positions,v).applyMatrix4(o.matrixWorld);return point.x>3.8&&point.x<8.2&&point.z>9.8&&point.z<15.5;});
   if(!inPath)keep.push(...triangle);
  }
  if(keep.length!==count){const geometry=original.clone();geometry.setIndex(keep);geometry.computeBoundingBox();geometry.computeBoundingSphere();o.geometry=geometry;original.dispose();}
 });
}
export function createValleyEntrance(open){
 const group=new T.Group();group.name='valley-overlook';
 function mesh(geo,color,x,y,z){const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);group.add(m);return m;}
 const box=(w,h,d,c,x,y,z)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z);
 const ball=(r,c,x,y,z)=>mesh(new T.SphereGeometry(r,12,8),c,x,y,z);
 box(10,.9,10,0x91b9a9,6,-.49,18);box(9.9,.06,9.9,0xc8deb2,6,-.01,18);
 box(3,.05,10,0xf3debc,6,.04,18);
 for(let z=12;z<22;z+=1.2)box(2.7,.025,1.04,0xffedcd,6,.085,z);
 // 平台外侧栏杆留出朝小镇的通路。
 for(const x of [1.2,10.8]){
  box(.12,.12,9.4,0x638a83,x,.95,18);
  for(let z=14;z<=22;z+=2)box(.2,1.1,.2,0x739a90,x,.5,z);
 }
 box(9.6,.12,.12,0x638a83,6,.95,22.8);
 for(const x of [2.6,9.4]){
  box(1.4,.3,1.4,0xc4c9c0,x,.15,valleyGate.z);
  box(.92,3.5,.95,0xa6bbb4,x,1.95,valleyGate.z);
  for(const y of [.7,1.5,2.3,3.1])box(1.02,.12,1.03,0xdde1ca,x,y,valleyGate.z);
  box(1.4,.26,1.35,0xf3df9f,x,3.8,valleyGate.z);
  ball(.24,0xffda73,x,4.14,valleyGate.z);
 }
 const arch=new T.Shape();arch.absarc(0,3.45,3.85,0,Math.PI,false);arch.lineTo(-2.94,3.45);arch.absarc(0,3.45,2.94,Math.PI,0,true);arch.closePath();
 mesh(new T.ExtrudeGeometry(arch,{depth:.8,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2,curveSegments:32}),0xa6bbb4,6,0,valleyGate.z-.4);
 box(5.9,1.1,1,0x3d766b,6,5.15,valleyGate.z);
 box(6.1,.12,1.1,0xf3d98a,6,5.74,valleyGate.z);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff5d4';ctx.font='bold 108px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('山谷探险',512,100);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 for(const side of [-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(5.35,1),new T.MeshBasicMaterial({map:texture,transparent:true}));sign.position.set(6,5.15,valleyGate.z+side*.52);sign.rotation.y=side<0?Math.PI:0;group.add(sign);}
 // 山峰徽章与藤叶让入口和山谷主题一致。
 for(const [x,y,r] of [[5.35,6.74,.7],[6.25,6.94,.85],[7.15,6.69,.5]])mesh(new T.ConeGeometry(r,1.25,4),0x76a8a0,x,y,valleyGate.z).rotation.y=Math.PI/4;
 for(const side of [-1,1])for(let i=0;i<8;i++){const leaf=ball(.22,0x68986b,6+side*(3.5-Math.sin(i*.45)*.2),.6+i*.43,valleyGate.z-.58);leaf.scale.set(1.5,.55,1);leaf.rotation.z=side*.5;}
 for(const x of [3.5,8.5])for(const z of [14.5,17]){box(.12,1.25,.12,0x567b75,x,.62,z);box(.48,.6,.48,0xffdd8c,x,1.38,z);box(.65,.12,.65,0x52766c,x,1.72,z);}
 if(!open){const bar=box(5.6,.25,.22,0xf1c45e,6,1.15,valleyGate.z);bar.name='valley-locked-barrier';}
 group.userData.worldGate=true;return group;
}
