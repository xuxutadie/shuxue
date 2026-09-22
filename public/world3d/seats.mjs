// 两张地图的四张休息凳位置相同。朝向 +Z，站位在凳前，仍位于可行走区域。
export const seatHeight=.67;
export const seats=[-6,6].flatMap(x=>[-2.4,2.4].map(z=>({
  id:`${x}:${z}`,x,z,height:seatHeight,yaw:0,approach:{x,z:z+.85}
})));
export function nearbySeat(position){
  return seats.filter(s=>Math.hypot(position.x-s.x,position.z-s.z)<=2.1)
    .sort((a,b)=>Math.hypot(position.x-a.x,position.z-a.z)-Math.hypot(position.x-b.x,position.z-b.z))[0]||null;
}
export function seatAtPoint(point){
  return seats.find(s=>Math.abs(point.x-s.x)<=1.25&&Math.abs(point.z-s.z)<=.42&&point.y>.35&&point.y<1.4)||null;
}
