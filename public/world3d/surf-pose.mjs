import * as T from './vendor/three.module.js';

// 在待机动画之上叠加冲浪姿势。每帧先还原，避免骨骼旋转越积越大。
export function createSurfPose(hero){
 // GLTFLoader 会清理骨骼名称中的点；同时兼容原始骨架与浏览器加载后的骨架。
 const boneNamed=name=>hero.getObjectByName(T.PropertyBinding.sanitizeNodeName(name))||hero.getObjectByName(name);
 const hips=boneNamed('Hips');
 let saved=[];
 function restore(){for(const [bone,p,q] of saved){bone.position.copy(p);bone.quaternion.copy(q);}saved=[];}
 const position=bone=>bone.getWorldPosition(new T.Vector3());
 function aim(bone,child,target){
  const origin=position(bone),from=position(child).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const world=new T.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
  hero.updateMatrixWorld(true);
 }
 return {restore,apply(time=0){
  restore();if(!hips)return;
  hero.traverse(bone=>{if(bone.isBone)saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);});
  hero.updateMatrixWorld(true);
  const legs=['L','R'].map((side,i)=>{
   const thigh=boneNamed(`Thigh.${side}`),shin=boneNamed(`Shin.${side}`),foot=boneNamed(`Foot.${side}`);
   if(!thigh||!shin||!foot)return null;
   const target=hero.worldToLocal(position(foot));target.x=(i===0?1:-1)*.34;
   return {thigh,shin,foot,target:hero.localToWorld(target),rotation:foot.getWorldQuaternion(new T.Quaternion()),a:position(thigh).distanceTo(position(shin)),b:position(shin).distanceTo(position(foot))};
  }).filter(Boolean);
  // 脚踝保持板面高度，降低重心，再按两段腿长求膝盖位置。
  hips.position.y-=.19+Math.sin(time*3)*.018;hero.updateMatrixWorld(true);
  const forward=new T.Vector3(0,0,1).transformDirection(hero.matrixWorld);
  for(const {thigh,shin,foot,target,rotation,a,b} of legs){
   const origin=position(thigh),delta=target.clone().sub(origin),distance=T.MathUtils.clamp(delta.length(),Math.abs(a-b)+.001,a+b-.001),direction=delta.normalize();
   const along=(a*a-b*b+distance*distance)/(2*distance);
   const bend=forward.clone().addScaledVector(direction,-forward.dot(direction)).normalize();
   const knee=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
   aim(thigh,shin,knee);aim(shin,foot,target);
   foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));hero.updateMatrixWorld(true);
  }
  // 从腰部前倾，胸部跟随；头部稍抬起，避免整个人连脚一起倾倒。
  const waistBend=T.MathUtils.degToRad(18)+Math.sin(time*3)*.012;
  for(const [name,angle] of [['Spine',waistBend],['Chest',T.MathUtils.degToRad(8)],['Neck',T.MathUtils.degToRad(-10)]]){
   const bone=boneNamed(name);if(!bone)continue;
   const axis=new T.Vector3(1,0,0).transformDirection(hero.matrixWorld)
    .applyQuaternion(bone.parent.getWorldQuaternion(new T.Quaternion()).invert());
   bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,angle));
   hero.updateMatrixWorld(true);
  }
  // 双臂向两侧展开并略屈肘，随浪轻微调整平衡。
  for(const [side,sign] of [['L',1],['R',-1]]){
   const upper=boneNamed(`UpperArm.${side}`),fore=boneNamed(`Forearm.${side}`),hand=boneNamed(`Hand.${side}`);if(!upper||!fore||!hand)continue;
   const elbow=position(upper).add(new T.Vector3(sign*.34,-.11+Math.sin(time*3)*.015,.08).transformDirection(hero.matrixWorld).multiplyScalar(.34));
   aim(upper,fore,elbow);
   aim(fore,hand,position(fore).add(new T.Vector3(sign*.2,.06,.12).transformDirection(hero.matrixWorld).multiplyScalar(.24)));
  }
 }};
}
