import * as T from './vendor/three.module.js';
import {createAirship} from './airship-model.mjs';
import {ports,createVoyageClock,queueArrival} from './airship-journey.mjs';

const smooth=t=>t*t*(3-2*t);
// 为新增码头留出通行缺口，只隐藏覆盖登艇坡道的两棵松树。
export function prepareCampDock(scene){
 scene.traverse(o=>{if(o.isMesh&&/^(营地松树|松树树干)/.test(o.name)&&o.position.x>13&&Math.abs(o.position.z)<3.2)o.visible=false;});
}
export function mountAirship({root,viewport,scene,region,getHero,getActions,stopWalking,leave,say,enabled,arrival,navigate,routes}){
 const port=ports[region],model=createAirship(),group=new T.Group();
 const names={camp:'星光探险营',sky:'云海天文城',eco:'云海生态港'};
 // 每次打开码头重新读取解锁状态，本站刚通关也能立即出发。
 const itineraries=()=>routes?routes():[{destination:port.destination,route:port.route,label:names[port.destination],enabled}];
 let chosen=itineraries()[0];
 group.name='往返飞艇码头';group.userData.airship=true;group.add(model.group);scene.add(group);
 const home=new T.Vector3(port.position.x,.18,port.position.z);
 model.group.position.copy(home);model.group.rotation.y=port.yaw;
 function box(w,h,d,color,x,y,z){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);group.add(m);return m;}
 if(region==='camp'){
  box(8,.2,5,0xd8ad82,17,.04,0);
  for(let x=13.5;x<21;x+=.5)box(.035,.02,4.8,0xb18469,x,.15,0);
  for(const z of [-2.4,2.4])for(const x of [14,17,20])box(.14,1,.14,0x9982b7,x,.5,z);
 }else{
  box(5,.2,7,0xd8ad82,0,.04,15);
  for(let z=12;z<18.5;z+=.5)box(4.8,.02,.035,0xb18469,0,.15,z);
 }
 // 坡道连接可步行入口与开放甲板，登艇不需要跳跃。
 const rampStart=new T.Vector3(port.approach.x,.12,port.approach.z),rampEnd=home.clone().add(new T.Vector3(0,model.deck,0));
 const ramp=box(1.15,.09,rampStart.distanceTo(rampEnd),0xffe4ae,0,0,0);
 ramp.position.copy(rampStart).lerp(rampEnd,.5);ramp.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),rampEnd.clone().sub(rampStart).normalize());
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=110;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff4c9';ctx.fillRect(0,0,640,110);ctx.fillStyle='#49355f';ctx.font='bold 38px Microsoft Yahei';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(region==='sky'?'云海航站 · 营地 / 生态港':`飞艇码头 · ${names[port.destination]}`,320,55);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const sign=new T.Sprite(new T.SpriteMaterial({map:texture}));sign.position.set(port.approach.x+(region!=='camp'?2.8:0),2.1,port.approach.z);sign.scale.set(4,.69,1);group.add(sign);
 const clouds=new T.Group();clouds.visible=false;group.add(clouds);
 const geometry=new T.SphereGeometry(1,12,8),material=new T.MeshStandardMaterial({color:0xfffdf8,roughness:1});
 for(let i=0;i<16;i++){
  const distance=10+i*2.8,side=i%2?1:-1;
  for(let j=0;j<3;j++){
   const puff=new T.Mesh(geometry,material);
   puff.position.copy(home).add(new T.Vector3(-Math.sin(port.yaw)*distance,3+(i%4)*1.4,-Math.cos(port.yaw)*distance));
   puff.position.x+=Math.cos(port.yaw)*(side*6+j*1.2);puff.position.z-=Math.sin(port.yaw)*(side*6+j*1.2);puff.scale.set(2.2,1.15,1.8);clouds.add(puff);
  }
 }
 const panel=document.createElement('div');panel.className='airship-travel-panel';panel.hidden=true;
 panel.innerHTML='<strong data-flight-status role="status"></strong><progress max="1" value="0" aria-label="飞艇航行进度"></progress><button class="outline mini" data-flight-skip>跳过动画</button>';
 viewport.append(panel);
 let clock=null,view=null,startPoint=null,disposed=false,elapsed=0;
 const deckPoint=()=>{model.group.updateMatrixWorld(true);return model.group.localToWorld(model.rider.clone()).add(new T.Vector3(0,.09,0));};
 const groundPoint=()=>new T.Vector3(port.approach.x,.09,port.approach.z);
 function stop(){clock?.dispose();clock=null;view=null;clouds.visible=false;panel.hidden=true;root.querySelector('.world3d-shell')?.classList.remove('airship-travelling');viewport.dataset.voyage='';}
 function finishArrival(){stop();model.group.position.copy(home);getActions().resetToIdle();leave(port.approach);say(region==='camp'?'已返回星光探险营。':`已抵达${names[region]}，走到黄色感叹号开始修复。`);viewport.focus({preventScroll:true});}
 function depart(skip){
  if(disposed)return;
  queueArrival(chosen.destination,skip);stop();navigate(chosen.route);
 }
 function begin(arriving=false){
  if(disposed||clock||!getHero()||!getActions())return;
  stopWalking();getActions().resetToIdle();startPoint=getHero().position.clone();elapsed=0;
  clock=createVoyageClock(arriving?finishArrival:depart,arriving);
  panel.hidden=false;root.querySelector('.world3d-shell').classList.add('airship-travelling');
  if(arriving)model.group.position.copy(home).add(new T.Vector3(0,8,0));
  update(0);
 }
 function offer(){
  if(clock||disposed)return;
  const box=root.querySelector('#town-dialogue');box.classList.remove('is-playing');box.hidden=false;
  box.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>关闭</button><span class="pill">云海航线</span><h2>选择飞艇目的地</h2><p>登艇穿过云海，约4秒后在对岸下艇。</p>${itineraries().map((trip,i)=>`<p><button data-board-airship data-flight-route="${i}" ${trip.enabled?'':'disabled'}>乘飞艇${trip.destination==='camp'?'返回':'前往'}${trip.label} →</button>${trip.enabled?'':`<small> 完成${region==='sky'?'天文城18项任务':'营地六站修复'}后开放</small>`}</p>`).join('')}`;
 }
 function start(routeIndex=0){
  const trip=itineraries()[routeIndex];
  if(!trip?.enabled||clock||!getHero()||getActions()?.busy)return;
  if(Math.hypot(getHero().position.x-port.approach.x,getHero().position.z-port.approach.z)>1.9)return;
  chosen=trip;
  root.querySelector('#town-dialogue').hidden=true;begin();
 }
 function update(dt){
  if(disposed)return;model.animate(dt);if(!clock)return;
  elapsed+=dt;clock.update(dt);if(!clock)return;
  const phase=clock.phase,p=smooth(clock.progress),hero=getHero(),actions=getActions();
  viewport.dataset.voyage=phase;
  if(phase==='flying'){
   clouds.visible=true;model.group.position.copy(home).add(new T.Vector3(-Math.sin(port.yaw)*34*p,9*Math.sin(Math.min(1,p/.3)*Math.PI/2),-Math.cos(port.yaw)*34*p));
   model.group.rotation.y=port.yaw+Math.PI*smooth(Math.min(1,p/.3));
   model.group.rotation.z=Math.sin(elapsed*2)*.025;
  }else if(phase==='landing')model.group.position.copy(home).add(new T.Vector3(0,8*(1-p),0));
  else model.group.position.copy(home);
  const deck=deckPoint();
  if(phase==='boarding')hero.position.copy(startPoint).lerp(deck,p);
  else if(phase==='disembarking')hero.position.copy(deck).lerp(groundPoint(),p);
  else hero.position.copy(deck);
  const walking=phase==='boarding'||phase==='disembarking';
  actions.update(dt,{moving:walking,wantsMove:walking,blocked:false});
  const direction=phase==='disembarking'?groundPoint().sub(deck):deck.clone().sub(startPoint);
  hero.rotation.set(0,walking?Math.atan2(direction.x,direction.z):model.group.rotation.y,0);
  const look=hero.position.clone().add(new T.Vector3(0,2.3,0));
  view={look,offset:phase==='landing'||phase==='disembarking'?(region==='sky'?new T.Vector3(-10,6,-3):new T.Vector3(-9,5.5,8)):new T.Vector3(8,4.6,9)};
  const labels={boarding:'正在登艇',flying:`穿过云海 · 前往${chosen.label}`,landing:'飞艇正在降落',disembarking:'已停稳，正在下艇'};
  panel.querySelector('[data-flight-status]').textContent=labels[phase];panel.querySelector('progress').value=clock.progress;
 }
 function click(e){const board=e.target.closest('[data-board-airship]');if(board)start(Number(board.dataset.flightRoute||0));if(e.target.closest('[data-flight-skip]')){e.stopPropagation();clock?.skip();}}
 root.addEventListener('click',click);
 if(arrival){if(arrival.skip)finishArrival();else begin(true);}
 return {group,port,offer,start,update,get active(){return !!clock;},get camera(){return view;},nearby:position=>Math.hypot(position.x-port.approach.x,position.z-port.approach.z)<1.9,dispose(){disposed=true;stop();panel.remove();root.removeEventListener('click',click);}};
}
