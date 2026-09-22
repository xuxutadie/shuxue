// 室内坐标与家具碰撞统一定义，鼠标寻路和键盘移动使用同一份数据。
// 西侧独立住宅区；外观、碰撞和返家落点共用尺寸，避免扩大房子后穿墙。
// 正门朝东，面对小镇广场；房屋稍向西移，为东侧庭院留出空间。
export const townHome={x:-27,z:0,width:8,depth:5.6,yaw:Math.PI/2,door:{x:-23,z:0}};
export const homeDistrict={minX:-34,maxX:-15,minZ:-10,maxZ:10};
export const gardenObstacles=[
 ...[[-32.5,-8],[-18,-8],[-32.5,8],[-18,8]].map(([x,z])=>({x,z,w:1.1,d:1.1})),
 ...[-30.8,-19.2].map(x=>({x,z:6.8,w:1.4,d:1.1})),
 {x:-17.2,z:4.8,w:.3,d:.3},
];
export const sofaSeat={x:-4.6,z:-1.35,yaw:0};
export const spots={living:{x:-3,z:1.8},bedroom:{x:2.4,z:1.8},sofa:sofaSeat,exit:{x:-1.6,z:3.7}};
export const obstacles=[
 {x:-4.6,z:-2.25,w:3.5,d:1.1}, // 沙发
 {x:-3.8,z:.15,w:1.8,d:.95}, // 茶几
 {x:4.4,z:-2,w:2.5,d:3.4}, // 床
 {x:1.25,z:-3.7,w:1.7,d:.9}, // 衣柜
 {x:4.6,z:3,w:3,d:1}, // 书桌
 {x:4.6,z:2.15,w:.75,d:.65}, // 书桌椅子
 {x:-6.45,z:-.5,w:.6,d:2.1}, // 书架
 {x:0,z:-1.8,w:.22,d:5.2}, // 隔墙，前方留通道
];
export function canStand(x,z){return x>=-6.65&&x<=6.65&&z>=-4.1&&z<=4.1&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.23&&Math.abs(z-o.z)<o.d/2+.23);}
export function stepPosition(p,dx,dz){
 let {x,z}=p;const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
 for(let i=0;i<count;i++){if(canStand(x+dx/count,z))x+=dx/count;if(canStand(x,z+dz/count))z+=dz/count;}
 return {x,z};
}
export function findPath(from,to){
 if(!canStand(to.x,to.z))return null;
 const size=.2,key=p=>`${p.x},${p.z}`,snap=p=>({x:Math.round(p.x/size),z:Math.round(p.z/size)});
 const start=snap(from),end=snap(to),queue=[start],seen=new Map([[key(start),null]]);let found;
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(key(p)===key(end)){found=p;break;}
  for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+x,z:p.z+z};if(seen.has(key(n))||!canStand(n.x*size,n.z*size))continue;seen.set(key(n),p);queue.push(n);}
 }
 if(!found)return null;
 const path=[];for(let p=found;seen.get(key(p));p=seen.get(key(p)))path.unshift({x:p.x*size,z:p.z*size});path.push({x:to.x,z:to.z});return path;
}
export function advancePath(position,path,distance){
 let p={...position};while(path.length&&distance>.000001){const target=path[0],dx=target.x-p.x,dz=target.z-p.z,length=Math.hypot(dx,dz);if(length<.01){path.shift();continue;}const amount=Math.min(distance,length),next=stepPosition(p,dx/length*amount,dz/length*amount);if(Math.hypot(next.x-p.x,next.z-p.z)<.0001)return {position:p,blocked:true};p=next;distance-=amount;}return {position:p,blocked:false};
}
