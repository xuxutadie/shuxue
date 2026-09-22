import * as T from './vendor/three.module.js';

// 岛底云海与岛外高云错层分布；用两批实例绘制，避免每朵云单独产生绘制调用。
export function createIslandClouds({camp=false}={}){
 const group=new T.Group();group.name='floating-island-clouds';
 let seed=73291,time=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const near=[],far=[];
 function cluster(target,x,y,z,size){
  const phase=random()*Math.PI*2;
  for(let i=0;i<7;i++){
   const angle=i*Math.PI*2/7,radius=i===0?0:size*(.38+random()*.35);
   const width=size*(.5+random()*.38),height=width*(.48+random()*.22);
   target.push({x:x+Math.cos(angle)*radius,y:y+(i===0?size*.12:0),z:z+Math.sin(angle)*radius,
    sx:width,sy:height,sz:width*(.7+random()*.3),phase,tint:random()});
  }
 }
 const left=camp?-19:-36,right=camp?19:62;
 // 外围云沿住宅、小镇、游乐场各自的边沿分布，留出高低错落的天空缝隙。
 for(let x=left,n=0;x<=right;x+=6.3,n++){
  const edge=!camp&&x< -22?12:17;
  for(const side of [-1,1]){
   const raised=(n+(side>0?1:0))%3===0;
   if(!raised&&n%3!==1)continue;
   // 新山谷平台旁留出清晰轮廓，不让云遮住入口。
   if(!camp&&side>0&&x> -3&&x<16)continue;
   // 抬高的云同时外移，云团连同漂动范围也不进入岛上道路。
   cluster(near,x,raised?.7+random()*.65:-3.15-random()*.5,side*(edge+(raised?5.5:0)+random()*2),2.3+random()*.6);
  }
 }
 for(const x of [left,right])for(let z=-10,n=0;z<=10;z+=6.5,n++){
  const raised=n%2===0;
  cluster(near,x+(raised?(x===left?-5:5):0),raised?.9:-3.2,z,2.7);
 }
 // 岛底只留零散小云团，避免铺成一整块白色地毯。
 for(let x=left+6,n=0;x<right;x+=19,n++)cluster(near,x,-6.8-random(),n%2?5:-6,2.4+random()*.5);
 for(let x=left-12,n=0;x<=right+12;x+=23,n++)cluster(far,x,-12-random()*4,(n%2?1:-1)*(32+random()*10),3.4+random());
 const geometry=new T.SphereGeometry(1,12,8),dummy=new T.Object3D();
 const makeLayer=(items,distant)=>{
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1,emissive:0xb4c4e3,emissiveIntensity:distant?.45:.25});
  const clouds=new T.InstancedMesh(geometry,material,items.length);clouds.name=distant?'distant-cloud-sea':'island-edge-clouds';clouds.instanceMatrix.setUsage(T.DynamicDrawUsage);clouds.frustumCulled=false;
  // 云仅作背景，不参与点击命中，也不向建筑投下大块阴影。
  clouds.raycast=()=>{};clouds.castShadow=false;clouds.receiveShadow=false;
  for(let i=0;i<items.length;i++)clouds.setColorAt(i,new T.Color().setRGB(1-items[i].tint*.045,1-items[i].tint*.025,1));
  group.add(clouds);return {mesh:clouds,items,distant};
 };
 const layers=[makeLayer(near,false),makeLayer(far,true)];
 const pixels=new Uint8Array(128*4),bottom=new T.Color('#e5e7fa').toArray(),top=new T.Color('#8ac9e6').toArray();
 for(let i=0;i<128;i++){const t=i/127;for(let c=0;c<3;c++)pixels[i*4+c]=Math.round((bottom[c]*(1-t)+top[c]*t)*255);pixels[i*4+3]=255;}
 const background=new T.DataTexture(pixels,1,128);background.magFilter=T.LinearFilter;background.minFilter=T.LinearFilter;background.needsUpdate=true;
 function update(dt){
  time+=Math.min(.1,Math.max(0,dt));
  for(const {mesh,items,distant} of layers){
   for(let i=0;i<items.length;i++){
    const p=items[i],drift=distant?1.1:.45;
    dummy.position.set(p.x+Math.sin(time*.06+p.phase)*drift,p.y+Math.sin(time*.13+p.phase)*.12,p.z+Math.cos(time*.05+p.phase)*drift);
    dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
 update(0);return {group,background,update};
}
