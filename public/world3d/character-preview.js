import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

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
let yaw=.6,pitch=.06,distance=4.2,drag,mixer,helper,current,paused=false;
const clips=new Map();
function positionCamera(){const targetY=1.0;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,targetY+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,targetY,0);}
positionCamera();
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.009;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.y)*.006,-.15,.7);drag.x=e.clientX;drag.y=e.clientY;positionCamera();});
for(const event of ['pointerup','pointercancel'])renderer.domElement.addEventListener(event,()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.005,2.7,8);positionCamera();},{passive:false});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{yaw=Number(button.dataset.view);pitch=.04;positionCamera();}));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  const next=clips.get(button.dataset.action);if(!next||next===current)return;
  next.reset().setEffectiveWeight(1).play();current?.fadeOut(.25);next.fadeIn(.25);current=next;
  document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
document.querySelector('#pause').addEventListener('click',e=>{paused=!paused;e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'继续播放':'暂停';});
document.querySelector('#bones').addEventListener('click',e=>{if(!helper)return;helper.visible=!helper.visible;e.currentTarget.setAttribute('aria-pressed',String(helper.visible));e.currentTarget.textContent=helper.visible?'隐藏骨骼':'显示骨骼';});
document.querySelector('#speed').addEventListener('change',e=>{if(mixer)mixer.timeScale=Number(e.target.value);});
addEventListener('resize',()=>{renderer.setSize(innerWidth,canvasHeight());camera.aspect=innerWidth/canvasHeight();camera.updateProjectionMatrix();});
try{
  const gltf=await new GLTFLoader().loadAsync('./assets/explorer-rigged-v1.glb?v=20260921-gait3');
  scene.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
  helper=new THREE.SkeletonHelper(gltf.scene);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=10;scene.add(helper);
  mixer=new THREE.AnimationMixer(gltf.scene);for(const clip of gltf.animations)clips.set(clip.name,mixer.clipAction(clip));
  current=clips.get('Walk');current?.play();
  document.querySelector('#status').textContent='重心与脚掌滚动版 · 站立与行走 · 轻量版 4.0 MB';
}catch(error){const box=document.querySelector('#error');box.hidden=false;box.textContent='模型未能加载，请刷新重试。';console.error(error);}
const clock=new THREE.Clock();
// 仅在诊断链接中显示帧率，区分动作曲线顿挫与浏览器实际掉帧。
const diagnostics=new URLSearchParams(location.search).has('diagnostics');
let samples=[];
renderer.setAnimationLoop(()=>{
  const elapsed=clock.getDelta(),dt=Math.min(elapsed,.1);
  if(!paused&&!document.hidden)mixer?.update(dt);
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
