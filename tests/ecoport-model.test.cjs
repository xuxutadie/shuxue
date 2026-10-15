const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

async function withModel(check){
 const previous=global.document;
 global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){},beginPath(){},roundRect(){},fill(){},stroke(){}})})};
 try{
  const {createEcoport}=await import(pathToFileURL(path.resolve('public/world3d/ecoport-model.mjs')));
  const progress={complete:false,stations:Array.from({length:6},()=>({repaired:false}))};
  const model=createEcoport(()=>progress);
  await check(model,progress);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  model.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.material?.map)textures.add(o.material.map);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
 }finally{if(previous===undefined)delete global.document;else global.document=previous;}
}

test('生态港六处设施沿用既有站点及通行契约，所有站点与飞艇码头可达',async()=>withModel(async(model)=>{
 const nav=await import(pathToFileURL(path.resolve('public/world3d/navigation3d.mjs')));
 const facilities=model.scene.children.filter(o=>Number.isInteger(o.userData.stationIndex));
 assert.equal(facilities.length,6);
 assert.equal(new Set(facilities.map(o=>o.userData.facilityKind)).size,6);
 for(let i=0;i<6;i++){
  const facility=facilities.find(o=>o.userData.stationIndex===i);
  assert.equal(facility.position.x,nav.stations[i][0]);assert.equal(facility.position.z,nav.stations[i][1]);
  assert.ok(nav.findPath({x:0,z:12.5},nav.meetingPoint(i),false)?.length,`第${i+1}站应有步行路线`);
 }
 const dock=model.scene.getObjectByName('ecoport-dock');assert.ok(dock);assert.equal(dock.position.x,0);
}));

test('修复前后桥面和供水有可见变化，重复动画不创建新几何或材质',async()=>withModel(async(model,progress)=>{
 const bridge=model.scene.getObjectByName('ecoport-bridge-repaired');
 const fountain=model.scene.getObjectByName('ecoport-fountain-water');
 assert.ok(bridge&&fountain);
 model.animate(.016);assert.equal(bridge.visible,false);assert.equal(fountain.visible,false);
 const snapshot=()=>{const geometries=new Set(),materials=new Set();let count=0;model.scene.traverse(o=>{count++;if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});return {count,geometries:geometries.size,materials:materials.size};};
 const before=snapshot();progress.stations.forEach(m=>m.repaired=true);progress.complete=true;
 for(let i=0;i<120;i++)model.animate(1/60);
 assert.equal(bridge.visible,true);assert.equal(fountain.visible,true);assert.deepEqual(snapshot(),before);
 assert.ok(before.count<750,'场景规模应适合教学电脑');assert.ok(before.geometries<140,'重复装饰应复用几何体');
 model.scene.updateMatrixWorld(true);
 model.scene.traverse(o=>{
  for(const n of [...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()])assert.ok(Number.isFinite(n));
  if(o.geometry){const positions=o.geometry.getAttribute('position');for(const n of positions.array)assert.ok(Number.isFinite(n));}
 });
}));
