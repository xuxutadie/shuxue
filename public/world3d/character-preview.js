import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {createHeroActions} from './hero-actions.mjs';

const scene=new THREE.Scene();scene.background=new THREE.Color('#f8f7ff');
const canvasHeight=()=>Math.max(240,innerHeight-145);
const camera=new THREE.PerspectiveCamera(36,innerWidth/canvasHeight(),.01,30);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,canvasHeight());
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','可旋转查看的新主角骨骼动画');document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0xb2a2ca,2));
const key=new THREE.DirectionalLight(0xfff4e5,2.4);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.015;scene.add(key);
const fill=new THREE.DirectionalLight(0xd0ebff,1);fill.position.set(-3,2,-2);scene.add(fill);
const ground=new THREE.Mesh(new THREE.CircleGeometry(1.25,64),new THREE.MeshStandardMaterial({color:0xeae4f5,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;scene.add(ground);
// 预览凳子与小镇长凳保持相同座高和前后距离；角色脚底基准在此为 0。
const bench=new THREE.Group();bench.position.z=-.85;bench.visible=false;scene.add(bench);
const wood=new THREE.MeshStandardMaterial({color:0xc69654,roughness:.85});
function benchPart(size,position){const p=new THREE.Mesh(new THREE.BoxGeometry(...size),wood);p.position.set(...position);p.castShadow=true;p.receiveShadow=true;bench.add(p);}
benchPart([2.5,.10,.6],[0,.53,0]);
benchPart([2.5,.5,.10],[0,.97,-.28]);
for(const x of [-.9,.9])for(const z of [-.2,.2])benchPart([.12,.48,.12],[x,.24,z]);
let yaw=.6,pitch=.06,distance=5.1,drag,actions,helper,paused=false,mode='Walk',speed=1;
function positionCamera(){const targetY=1.15;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,targetY+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,targetY,0);}
positionCamera();
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.009;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.y)*.006,-.15,.7);drag.x=e.clientX;drag.y=e.clientY;positionCamera();});
for(const event of ['pointerup','pointercancel'])renderer.domElement.addEventListener(event,()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.005,2.7,8);positionCamera();},{passive:false});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{yaw=Number(button.dataset.view);pitch=.04;positionCamera();}));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  if(!actions)return;
  const name=button.dataset.action;
  if(name==='Jump'){mode='Idle';actions.request('jump');}
  else if(name==='SitDown'){mode='Idle';bench.visible=true;actions.request('sit');}
  else {
    mode=name;
    if((name==='Run')!==actions.running)actions.request('run');
    if(actions.phase==='Seated')actions.request('sit');
  }
}));
document.querySelector('#pause').addEventListener('click',e=>{paused=!paused;e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'继续播放':'暂停';});
document.querySelector('#bones').addEventListener('click',e=>{if(!helper)return;helper.visible=!helper.visible;e.currentTarget.setAttribute('aria-pressed',String(helper.visible));e.currentTarget.textContent=helper.visible?'隐藏骨骼':'显示骨骼';});
document.querySelector('#speed').addEventListener('change',e=>{speed=Number(e.target.value);});
addEventListener('resize',()=>{renderer.setSize(innerWidth,canvasHeight());camera.aspect=innerWidth/canvasHeight();camera.updateProjectionMatrix();});
try{
  const gltf=await new GLTFLoader().loadAsync('./assets/explorer-actions-v2.glb?v=20260922-seats');
  scene.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
  helper=new THREE.SkeletonHelper(gltf.scene);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=10;scene.add(helper);
  actions=createHeroActions(gltf.scene,gltf.animations,{canSit:()=>bench.visible});
  document.querySelector('#status').textContent='跳跃时双臂展开 · 坐在长凳上休息';
}catch(error){const box=document.querySelector('#error');box.hidden=false;box.textContent='模型未能加载，请刷新重试。';console.error(error);}
const clock=new THREE.Clock();
// 仅在诊断链接中显示帧率，区分动作曲线顿挫与浏览器实际掉帧。
const diagnostics=new URLSearchParams(location.search).has('diagnostics');
let samples=[];
renderer.setAnimationLoop(()=>{
  const elapsed=clock.getDelta(),dt=Math.min(elapsed,.1);
  if(!paused&&!document.hidden)actions?.update(dt*speed,{moving:mode!=='Idle',wantsMove:mode!=='Idle'});
  if(actions){
    bench.visible=['SitDown','Seated','StandUp'].includes(actions.phase);
    document.body.dataset.heroState=actions.phase;
    document.querySelectorAll('[data-action]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.action===actions.phase||(b.dataset.action==='SitDown'&&actions.sitting)));
      b.disabled=actions.busy||(b.dataset.action==='Jump'&&actions.sitting);
    });
  }
  renderer.render(scene,camera);
  if(diagnostics&&!paused&&!document.hidden){
    samples.push(elapsed);
    if(samples.length===120){
      const sorted=[...samples].sort((a,b)=>a-b);
      document.querySelector('#status').textContent=`重心与脚掌滚动版 · 实测 ${(120/samples.reduce((a,b)=>a+b,0)).toFixed(0)} FPS · 95% 帧耗时 ${(sorted[113]*1000).toFixed(1)} 毫秒`;
      samples=[];
    }
  }else samples=[];
});
