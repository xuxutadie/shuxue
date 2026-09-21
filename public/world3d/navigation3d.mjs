// 游戏坐标采用 X/Z 平面，所有移动方式复用相同碰撞和寻路。
export const stations=[[-10,-8],[0,-8],[10,-8],[-10,8],[0,8],[10,8]];
export const meetingPoint=i=>({x:stations[i][0],z:i<3?-2.5:2.5});
export function canStand(x,z){
  if(Math.abs(x)>15.7||Math.abs(z)>13.8)return false;
  if(x*x+z*z<4.1)return false;
  if(stations.some(([a,b])=>Math.abs(x-a)<3.35&&Math.abs(z-b)<2.8))return false;
  if([-6,6].some(a=>[-2.4,2.4].some(b=>Math.abs(x-a)<1.3&&Math.abs(z-b)<.7)))return false;
  return true;
}
export function stepPosition(p,dx,dz){
  let {x,z}=p;
  // 分段检测，防止低帧率或较大步长穿过房屋。
  const parts=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<parts;i++){
    if(canStand(x+dx/parts,z))x+=dx/parts;
    if(canStand(x,z+dz/parts))z+=dz/parts;
  }
  return {x,z};
}
export function findPath(start,end){
  const snap=v=>Math.round(v*2),from={x:snap(start.x),z:snap(start.z)},to={x:snap(end.x),z:snap(end.z)};
  if(!canStand(to.x/2,to.z/2))return null;
  const key=p=>p.x+','+p.z,queue=[from],seen=new Map([[key(from),null]]);let found=null;
  for(let head=0;head<queue.length;head++){
    const current=queue[head];if(key(current)===key(to)){found=current;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:current.x+dx,z:current.z+dz};
      if(seen.has(key(next))||!canStand(next.x/2,next.z/2))continue;
      seen.set(key(next),current);queue.push(next);
    }
  }
  if(!found)return null;
  const path=[];for(let p=found;seen.get(key(p));p=seen.get(key(p)))path.unshift({x:p.x/2,z:p.z/2});
  return path;
}

// 在同一帧内消耗完整移动距离，经过路点时不插入停顿帧。
export function advancePath(position,route,distance){
  let current={...position},remaining=Math.max(0,distance);
  while(route.length){
    const target=route[0],dx=target.x-current.x,dz=target.z-current.z;
    const length=Math.hypot(dx,dz);
    if(length<.000001){route.shift();continue;}
    if(remaining<=.000001)break;
    const step=Math.min(length,remaining);
    const next=stepPosition(current,dx/length*step,dz/length*step);
    if(Math.hypot(next.x-current.x,next.z-current.z)<.000001)return {position:current,blocked:true};
    current=next;remaining-=step;
    if(Math.hypot(target.x-current.x,target.z-current.z)<.000001)route.shift();
  }
  return {position:current,blocked:false};
}
