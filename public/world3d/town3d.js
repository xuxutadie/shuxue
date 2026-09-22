import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {stations,meetingPoint,stepPosition,findPath,advancePath} from './navigation3d.mjs';

// 仅保留一次场景往返的落点，不保存或改变学习进度。
let nextArrival=null;
export function mountWorld(root,data,onTalk){
  const config=data.sceneConfig||{};
  const region=config.camp?'camp':'town',gatePoint={x:0,z:11.5};
  const atGate=()=>Math.hypot(position.x-gatePoint.x,position.z-gatePoint.z)<1.8;
  const gateOpen=()=>!!data.campaign?.first?.unlocked;
  function showGate(){
    route=[];destination=null;resetInput();yaw=Math.PI;pitch=.55;distance=18;
    const box=root.querySelector('#town-dialogue');shell.append(box);box.hidden=false;
    const first=data.campaign?.first;
    box.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>关闭对话</button><span class="pill">山谷通道</span><h2>${config.camp?'返回好奇心小镇':gateOpen()?'通往星光营地的路已开放':'远方就是星光营地'}</h2><p>${config.camp?'沿原路回到小镇，继续拜访朋友。':gateOpen()?'你已完成第一关，可以出发探索营地了。':`这里只能远眺。第一关全部 ${first?.total||48} 道题答对后才能通行，当前已答对 ${first?.correct||0} 道，还差 ${Math.max(0,(first?.total||48)-(first?.correct||0))} 道。`}</p>${config.camp||gateOpen()?'<button data-cross-gate>穿过山谷通道 →</button>':'<button disabled>通道尚未开放</button>'}`;
  }
  const viewport=root.querySelector('#town-viewport'),status=root.querySelector('#town-position'),loading=root.querySelector('#town-loading');
  let disposed=false,frame=0,renderer,scene,hero,mixer,walk,idle,observer;
  // 新主角采用完整步态；移动速度与正常走路的节奏配合。
  const moveSpeed=2.4;
  let position={x:-4,z:4},yaw=.18,pitch=.85,distance=20,route=[],destination=null,drag=null,stick={x:0,z:0};
  if(nextArrival===region){position={x:0,z:11.5};nextArrival=null;}
  const keys=new Set(),listeners=[],owned=[];const shell=root.querySelector('.world3d-shell');let expanded=false,previousOverflow='';
  function expand(){expanded=!expanded;shell.classList.toggle('is-expanded',expanded);document.body.classList.toggle('world-expanded',expanded);const button=root.querySelector('[data-camera-full]');button.textContent=expanded?'显示菜单':'返回全屏游戏';button.setAttribute('aria-pressed',String(expanded));if(expanded){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}else{document.body.style.overflow=previousOverflow;if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}}
  const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);listeners.push(()=>target.removeEventListener(type,fn,opts));};
  const say=message=>{if(!disposed&&status.textContent!==message)status.textContent=message;};
  // 默认铺满网页；真正隐藏浏览器栏的全屏需由孩子点击按钮触发。
  expand();
  if(document.fullscreenEnabled){
    const fullButton=document.createElement('button');fullButton.className='outline mini';fullButton.type='button';
    const syncFullscreen=()=>{fullButton.textContent=document.fullscreenElement?'退出全屏':'全屏显示';fullButton.setAttribute('aria-pressed',String(!!document.fullscreenElement));};
    root.querySelector('.world3d-toolbar>div').append(fullButton);syncFullscreen();
    on(document,'fullscreenchange',syncFullscreen);
    on(fullButton,'click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{if(!expanded)expand();await document.documentElement.requestFullscreen();}}catch{say('当前浏览器未允许全屏，游戏已铺满窗口。');}});
  }
  const nearest=()=>stations.findIndex(([x,z],i)=>Math.hypot(position.x-x,position.z-(z+(i<3?4:-4)))<2.3);
  function disposeModel(object){const skeletons=new Set();object.traverse(o=>{o.geometry?.dispose();if(o.skeleton)skeletons.add(o.skeleton);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});skeletons.forEach(skeleton=>skeleton.dispose());}
  function resetInput(){keys.clear();stick={x:0,z:0};drag=null;}
  function travel(target,index=null){const path=findPath(position,target);if(!path){say('那里无法到达，请点击道路或选择一位朋友。');return;}route=path;destination=index;say('正在走向目的地……');viewport.focus({preventScroll:true});}
  function talk(){if(atGate()){showGate();return;}const index=nearest();if(index<0){say('走到人物身边再交谈，或点击下方地点让角色自动前往。');return;}route=[];resetInput();onTalk(index);}
  function fail(){if(disposed)return;loading.hidden=false;loading.innerHTML='<strong>暂时无法打开3D场景</strong><p>请检查网络与浏览器的图形加速，刷新页面重试。你仍然可以从下方学习路线进入练习。</p><a class="button outline" href="#courses">进入课程与练习</a>';say('3D场景未就绪，课程和学习记录仍可使用。');}
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.domElement.setAttribute('aria-label','可旋转视角的三维思维小镇');viewport.prepend(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color('#c5e8ee');scene.fog=new THREE.Fog('#c5e8ee',45,95);
    const camera=new THREE.PerspectiveCamera(46,1,.1,120);camera.position.set(0,16,24);
    scene.add(new THREE.HemisphereLight(0xfff7de,0x819987,2.0));const sunlight=new THREE.DirectionalLight(0xfff0dd,2.5);sunlight.position.set(-12,24,10);sunlight.castShadow=true;sunlight.shadow.mapSize.set(config.camp?2048:1024,config.camp?2048:1024);Object.assign(sunlight.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:70});sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.0001;scene.add(sunlight);
    observer=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(viewport);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    on(viewport,'pointerdown',e=>{if(e.target!==renderer.domElement)return;viewport.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};viewport.setPointerCapture(e.pointerId);});
    on(viewport,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){yaw-=dx*.007;pitch=THREE.MathUtils.clamp(pitch+dy*.005,.32,1.15);}drag.lastX=e.clientX;drag.lastY=e.clientY;});
    on(viewport,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const click=!drag.moved;drag=null;if(!hero||!click)return;const rect=viewport.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(scene.children,true);for(const hit of hits){let o=hit.object;while(o){if(o.userData.worldGate){travel(gatePoint,'gate');return;}if(Number.isInteger(o.userData.stationIndex)){const i=o.userData.stationIndex;travel(meetingPoint(i),i);return;}o=o.parent;}}const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,point))travel({x:point.x,z:point.z});});
    on(viewport,'pointercancel',()=>drag=null);
    on(viewport,'wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.012,8,31);},{passive:false});
    const codes=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
    on(viewport,'keydown',e=>{if(e.target!==viewport)return;if(codes.includes(e.code)){e.preventDefault();route=[];destination=null;keys.add(e.code);}if(e.code==='Escape'&&expanded)expand();if(e.code==='Enter'){e.preventDefault();talk();}});
    on(window,'keyup',e=>keys.delete(e.code));on(window,'blur',resetInput);on(viewport,'blur',()=>keys.clear());
    on(document,'visibilitychange',()=>{if(document.hidden){resetInput();route=[];}});
    const joystick=root.querySelector('#town-joystick'),knob=joystick.querySelector('span');let stickPointer=null;
    function moveStick(e){if(stickPointer!==e.pointerId)return;const r=joystick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/35,dz=(e.clientY-r.top-r.height/2)/35,length=Math.max(1,Math.hypot(dx,dz));stick={x:dx/length,z:dz/length};knob.style.transform=`translate(${stick.x*28}px,${stick.z*28}px)`;route=[];destination=null;}
    on(joystick,'pointerdown',e=>{stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});on(joystick,'pointermove',moveStick);
    const stopStick=()=>{stickPointer=null;stick={x:0,z:0};knob.style.transform='';};on(joystick,'pointerup',stopStick);on(joystick,'pointercancel',stopStick);on(window,'blur',stopStick);
    on(root,'click',e=>{if(e.target.closest('[data-close-dialogue]')){root.querySelector('#town-dialogue').hidden=true;viewport.focus({preventScroll:true});}if(e.target.closest('[data-camera-full]'))expand();if(e.target.closest('[data-goto-gate]')&&hero)travel(gatePoint,'gate');if(e.target.closest('[data-cross-gate]')&&atGate()){if(!config.camp&&!gateOpen()){showGate();return;}nextArrival=config.camp?'town':'camp';window.location.hash=config.camp?'world':'expedition';return;}const place=e.target.closest('[data-place]');if(place&&hero){const i=Number(place.dataset.place);travel(meetingPoint(i),i);}if(e.target.closest('[data-talk]')&&hero)talk();if(e.target.closest('[data-camera-reset]')){yaw=.18;pitch=.85;distance=20;}if(e.target.closest('[data-camera-out]'))distance=Math.min(31,distance+3);if(e.target.closest('[data-camera-in]'))distance=Math.max(8,distance-3);});
    on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);resetInput();fail();});
    const loader=new GLTFLoader();
    // 模型来自 Blender 导出；网页仅负责显示、镜头和任务交互。
    Promise.all([config.asset||'/world3d/assets/thinking-town.glb','/world3d/assets/explorer-rigged-v1.glb?v=20260921-gait3'].map(url=>loader.loadAsync(url).then(g=>{if(disposed){disposeModel(g.scene);return null;}owned.push(g.scene);return g;}))).then(([town,player])=>{
      if(disposed||!town||!player)return;
      scene.add(town.scene);hero=player.scene;scene.add(hero);
      // 未通关时横杆仅作关口提示，真正的跨区动作还要核对服务端返回的通关状态。
      if(!config.camp&&!gateOpen()){const barrier=new THREE.Mesh(new THREE.BoxGeometry(3.2,.18,.18),new THREE.MeshStandardMaterial({color:0xb97d50}));barrier.position.set(0,1.2,12.7);scene.add(barrier);owned.push(barrier);}
      const gateButton=document.createElement('button');gateButton.className='outline mini';gateButton.dataset.gotoGate='';gateButton.textContent=config.camp?'前往小镇出口':'前往山谷入口';root.querySelector('.world3d-toolbar>div').append(gateButton);listeners.push(()=>gateButton.remove());
      scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.name.startsWith('Reward_')){const i=Number(o.name.slice(7));o.visible=!!data.areas[i]?.stamps;}});
      // 与动作预览保持一致，避免头发和面部的细节产生斑驳自阴影。
      hero.traverse(o=>{if(o.isMesh)o.receiveShadow=false;});
      // 按名称选动作，避免把文件中的第一个 Idle 误当作走路。
      mixer=new THREE.AnimationMixer(hero);
      const idleClip=THREE.AnimationClip.findByName(player.animations,'Idle');
      const walkClip=THREE.AnimationClip.findByName(player.animations,'Walk');
      if(idleClip){idle=mixer.clipAction(idleClip);idle.play();}
      if(walkClip)walk=mixer.clipAction(walkClip);
      for(let i=0;i<6;i++){
        // 黄色感叹号标记可交互任务点；透明底与深色描边避免遮挡场景。
        const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
        ctx.fillStyle='#ffd447';ctx.strokeStyle='#6a481d';ctx.lineWidth=5;ctx.lineJoin='round';
        ctx.beginPath();ctx.moveTo(46,12);ctx.lineTo(82,12);ctx.lineTo(77,78);ctx.lineTo(51,78);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.arc(64,103,14,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#fff2a5';ctx.beginPath();ctx.roundRect(53,19,7,44,3);ctx.fill();
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));sprite.scale.set(.65,.65,1);sprite.renderOrder=10;sprite.userData.nameplate=true;sprite.position.set(stations[i][0],2.75,stations[i][1]+(i<3?4:-4));sprite.userData.stationIndex=i;const active=config.camp?data.campaign.missions.findIndex(m=>m.unlocked&&!m.repaired):data.adventure?.activeNpc; sprite.visible=active===undefined||active===i;scene.add(sprite);owned.push(sprite);
      }
      loading.hidden=true;say('3D小镇已就绪。点击道路前往，拖动画面转动镜头。');
      root.querySelectorAll('[data-place],[data-talk]').forEach(b=>{b.disabled=config.camp&&b.dataset.place!==undefined?!data.campaign.missions[Number(b.dataset.place)].unlocked:false;});
    }).catch(fail);
    let last=performance.now(),wasMoving=false;
    function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((time-last)/1000,.05);last=time;if(document.hidden)return;
      // 弹出答题卡时停止角色移动，场景仍保持渲染。
      if(root.querySelector('.question-card[open]')){resetInput();route=[];destination=null;}
      if(hero){
        const old={...position};let dx=stick.x+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dz=stick.z+(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
        if(Math.hypot(dx,dz)>.1){const length=Math.max(1,Math.hypot(dx,dz)),vx=(dx*Math.cos(yaw)+dz*Math.sin(yaw))/length,vz=(-dx*Math.sin(yaw)+dz*Math.cos(yaw))/length;position=stepPosition(position,vx*moveSpeed*dt,vz*moveSpeed*dt);}
        else if(route.length){const step=advancePath(position,route,moveSpeed*dt);position=step.position;if(step.blocked){route=[];destination=null;say('前面有障碍，请换一条路。');}}
        const moving=Math.hypot(position.x-old.x,position.z-old.z)>.001;
        hero.position.set(position.x,.09,position.z);
        if(moving){
          const heading=Math.atan2(position.x-old.x,position.z-old.z);
          const turn=Math.atan2(Math.sin(heading-hero.rotation.y),Math.cos(heading-hero.rotation.y));
          hero.rotation.y+=turn*(1-Math.exp(-16*dt));
          walk?.setEffectiveTimeScale(Math.max(.35,Math.min(1,Math.hypot(position.x-old.x,position.z-old.z)/Math.max(dt*moveSpeed,.0001))));
        }
        // 只在起步、停步时切换，答题和交谈期间也持续播放站立呼吸。
        if(moving!==wasMoving){
          const next=moving?walk:idle,previous=moving?idle:walk;
          previous?.fadeOut(.22);
          next?.reset().setEffectiveWeight(1).fadeIn(.22).play();
        }
        mixer?.update(dt);
        wasMoving=moving;
        if(!route.length&&destination!==null){const i=destination;destination=null;if(i==='gate'&&atGate()){showGate();}else if(nearest()===i){onTalk(i);say('已经到达，可以接受这位朋友的任务。');}}
        const look=new THREE.Vector3(position.x,1.15,position.z),offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.position.lerp(look.clone().add(offset),Math.min(1,dt*6));camera.lookAt(look);
        const label=root.querySelector('#town-nearby'),i=nearest();label.hidden=i<0&&!atGate();label.textContent=atGate()?'山谷入口 · 按 Enter 查看通道':i<0?'':`附近：${(config.names||['面包师米米','乐手多多','侦探阿布','建筑师方方','园丁芽芽','店长圆圆'])[i]} · 按 Enter ${config.camp?'检查':'交谈'}`;
      }
      for(const o of owned){if(!o.userData.nameplate)continue;const d=camera.position.distanceTo(o.position),height=2*d*Math.tan(camera.fov*Math.PI/360)/Math.max(1,viewport.clientHeight)*(nearest()===o.userData.stationIndex?38:30);o.scale.set(height,height,1);}
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(animate);
  }catch{fail();}
  return ()=>{document.body.classList.remove('world-expanded');if(expanded){document.body.style.overflow=previousOverflow;expanded=false;}disposed=true;cancelAnimationFrame(frame);resetInput();observer?.disconnect();listeners.forEach(remove=>remove());mixer?.stopAllAction();owned.forEach(disposeModel);renderer?.dispose();renderer?.domElement.remove();};
}
