// 小镇独立山谷平台；营地出口仍使用营地模型原来的坐标。
export const valleyGate={x:6,z:19.5,approach:{x:6,z:17}};
export const valleyDeck={minX:1,maxX:11,minZ:13,maxZ:23};
export function inValleyDeck(x,z){return x>=valleyDeck.minX+.4&&x<=valleyDeck.maxX-.4&&z>=valleyDeck.minZ&&z<=valleyDeck.maxZ-.4;}
export function valleyBlocked(x,z){
 return [2.6,9.4].some(a=>Math.abs(x-a)<.9&&Math.abs(z-valleyGate.z)<.9)||z>21.8;
}
