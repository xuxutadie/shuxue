// 两位主角共用动作控制和地图规则，仅替换外观资产。
export const heroes=Object.freeze([
  {id:'boy',label:'男生探险家',asset:'/world3d/assets/explorer-actions-v2.glb?v=20260922-motion1'},
  {id:'girl',label:'女生探险家',asset:'/world3d/assets/girl-explorer-v1.glb?v=20260922-motion1'}
]);
export function heroFor(id){return heroes.find(hero=>hero.id===id)||heroes[0];}
