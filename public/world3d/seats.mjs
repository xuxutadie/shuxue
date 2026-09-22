// 广场南北两排长椅面对面；营地仍沿用原来的朝向。
export const seatHeight=.67;
export const seats=[-6,6].flatMap(x=>[-2.4,2.4].map(z=>({
  id:`${x}:${z}`,x,z,height:seatHeight,yaw:z>0?Math.PI:0,approach:{x,z:z+(z>0?-.85:.85)}
})));
export const campSeats=seats.map(s=>({...s,yaw:0,approach:{x:s.x,z:s.z+.85}}));
export function nearbySeat(position,layout=seats){
  return layout.filter(s=>Math.hypot(position.x-s.x,position.z-s.z)<=2.1)
    .sort((a,b)=>Math.hypot(position.x-a.x,position.z-a.z)-Math.hypot(position.x-b.x,position.z-b.z))[0]||null;
}
export function seatAtPoint(point,layout=seats){
  return layout.find(s=>Math.abs(point.x-s.x)<=1.25&&Math.abs(point.z-s.z)<=.42&&point.y>.35&&point.y<1.4)||null;
}
