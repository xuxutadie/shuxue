// 游戏坐标采用 X/Z 平面，所有移动方式复用相同碰撞和寻路。
import {townHome,homeDistrict,gardenObstacles} from './home-layout.mjs';
import {inPark,parkBlocked} from './playground-rules.mjs';
import {inValleyDeck,valleyBlocked} from './valley-layout.mjs';
export const stations=[[-10,-8],[0,-8],[10,-8],[-10,8],[0,8],[10,8]];
export const meetingPoint=i=>({x:stations[i][0],z:i<3?-2.5:2.5});
export function canStand(x,z,home=true){
  const inTown=Math.abs(x)<=15.7&&Math.abs(z)<=13.8;
  const inGarden=home&&x>=homeDistrict.minX+.4&&x<=homeDistrict.maxX&&z>=homeDistrict.minZ+.4&&z<=homeDistrict.maxZ-.4;
  if(!inTown&&!inGarden&&!(home&&(inPark(x,z)||inValleyDeck(x,z))))return false;
  if(home&&inValleyDeck(x,z)&&valleyBlocked(x,z))return false;
  if(home&&parkBlocked(x,z))return false;
  // 将世界坐标转回房屋坐标，碰撞范围随正门朝向一起旋转。
  const hx=x-townHome.x,hz=z-townHome.z,c=Math.cos(townHome.yaw),s=Math.sin(townHome.yaw);
  if(home&&Math.abs(hx*c-hz*s)<townHome.width/2+.3&&Math.abs(hx*s+hz*c)<townHome.depth/2+.3)return false;
  if(home&&gardenObstacles.some(o=>Math.abs(x-o.x)<o.w/2+.25&&Math.abs(z-o.z)<o.d/2+.25))return false;
  if(x*x+z*z<4.1)return false;
  if(stations.some(([a,b])=>Math.abs(x-a)<3.35&&Math.abs(z-b)<2.8))return false;
  if([-6,6].some(a=>[-2.4,2.4].some(b=>Math.abs(x-a)<1.3&&Math.abs(z-b)<.7)))return false;
  return true;
}
export function stepPosition(p,dx,dz,home=true){
  let {x,z}=p;
  // 分段检测，防止低帧率或较大步长穿过房屋。
  const parts=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<parts;i++){
    if(canStand(x+dx/parts,z,home))x+=dx/parts;
    if(canStand(x,z+dz/parts,home))z+=dz/parts;
  }
  return {x,z};
}
export function findPath(start,end,home=true){
  const snap=v=>Math.round(v*2),from={x:snap(start.x),z:snap(start.z)},to={x:snap(end.x),z:snap(end.z)};
  if(!canStand(to.x/2,to.z/2,home))return null;
  const key=p=>p.x+','+p.z,queue=[from],seen=new Map([[key(from),null]]);let found=null;
  for(let head=0;head<queue.length;head++){
    const current=queue[head];if(key(current)===key(to)){found=current;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:current.x+dx,z:current.z+dz};
      if(seen.has(key(next))||!canStand(next.x/2,next.z/2,home))continue;
      seen.set(key(next),current);queue.push(next);
    }
  }
  if(!found)return null;
  const path=[];for(let p=found;seen.get(key(p));p=seen.get(key(p)))path.unshift({x:p.x/2,z:p.z/2});
  return path;
}

// 在同一帧内消耗完整移动距离，经过路点时不插入停顿帧。
export function advancePath(position,route,distance,home=true){
  let current={...position},remaining=Math.max(0,distance);
  while(route.length){
    const target=route[0],dx=target.x-current.x,dz=target.z-current.z;
    const length=Math.hypot(dx,dz);
    if(length<.000001){route.shift();continue;}
    if(remaining<=.000001)break;
    const step=Math.min(length,remaining);
    const next=stepPosition(current,dx/length*step,dz/length*step,home);
    if(Math.hypot(next.x-current.x,next.z-current.z)<.000001)return {position:current,blocked:true};
    current=next;remaining-=step;
    if(Math.hypot(target.x-current.x,target.z-current.z)<.000001)route.shift();
  }
  return {position:current,blocked:false};
}
