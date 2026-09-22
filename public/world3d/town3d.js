import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {stations,meetingPoint,stepPosition,findPath,advancePath} from './navigation3d.mjs';
import {createHeroActions} from './hero-actions.mjs?v=20260922-motion1';
import {seats as townSeats,campSeats,seatHeight,nearbySeat,seatAtPoint} from './seats.mjs';
import {preparePlaza,createPlazaFountain} from './plaza.mjs';
import {createIslandClouds} from './island-clouds.mjs';
import {valleyGate} from './valley-layout.mjs';
import {hideOldValley,createValleyEntrance} from './valley-model.mjs';
import {heroes,heroFor} from './hero-catalog.mjs?v=20260922-motion1';
import {createHomeEntrance,createHomeDistrict} from './home-model.mjs';
import {townHome} from './home-layout.mjs';
import {mountPlayground} from './playground.mjs';
import {parkEntrance,rides} from './playground-rules.mjs';

// 仅保留一次场景往返的落点，不保存或改变学习进度。
let nextArrival=null;
export function mountWorld(root,data,onTalk,options={}){
  const config=data.sceneConfig||{};
  const seats=config.camp?campSeats:townSeats;
  const region=config.camp?'camp':'town',gatePoint=config.camp?{x:0,z:11.5}:valleyGate.approach;
  const atGate=()=>Math.hypot(position.x-gatePoint.x,position.z-gatePoint.z)<1.8;
  const atHome=()=>!config.camp&&Math.hypot(position.x-townHome.door.x,position.z-townHome.door.z)<1;
  function showHome(){route=[];destination=null;resetInput();const box=root.querySelector('#town-dialogue');shell.append(box);box.hidden=false;box.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>关闭</button><span class="pill">探险家之家</span><h2>${data.character==='girl'?'星光花园之家':'森林探索之家'}</h2><p>回家休息，也可以换一套喜欢的装饰。</p><button data-enter-home>进入家园 →</button>`;}
  const gateOpen=()=>!!data.campaign?.first?.unlocked;
  function showGate(){
    route=[];destination=null;resetInput();yaw=Math.PI;pitch=.55;distance=18;
    const box=root.querySelector('#town-dialogue');shell.append(box);box.hidden=false;
    const first=data.campaign?.first;
    box.innerHTML=`<button class="outline mini dialogue-close" data-close-dialogue>关闭对话</button><span class="pill">山谷通道</span><h2>${config.camp?'返回好奇心小镇':gateOpen()?'通往星光营地的路已开放':'远方就是星光营地'}</h2><p>${config.camp?'沿原路回到小镇，继续拜访朋友。':gateOpen()?'你已完成第一关，可以出发探索营地了。':`这里只能远眺。第一关全部 ${first?.total||48} 道题答对后才能通行，当前已答对 ${first?.correct||0} 道，还差 ${Math.max(0,(first?.total||48)-(first?.correct||0))} 道。`}</p>${config.camp||gateOpen()?'<button data-cross-gate>穿过山谷通道 →</button>':'<button disabled>通道尚未开放</button>'}`;
  }
  const viewport=root.querySelector('#town-viewport'),status=root.querySelector('#town-position'),loading=root.querySelector('#town-loading');
  let disposed=false,frame=0,renderer,scene,hero,actions,observer,homeEntrance,park,fountain,clouds;
  let seatLock=null,seatingPending=false;
  let characterLoading=false;
  let position={x:-4,z:4},yaw=.18,pitch=.85,distance=20,route=[],destination=null,drag=null,stick={x:0,z:0};
  if(nextArrival===region){position={...gatePoint};nextArrival=null;}
  const returningHome=(nextArrival==='home'||options.homeArrival)&&!config.camp;
  if(returningHome){position={...townHome.door};yaw=1.05;pitch=.7;nextArrival=null;}
  const keys=new Set(),listeners=[],owned=[];const shell=root.querySelector('.world3d-shell');let expanded=false,previousOverflow='';
  function expand(){expanded=!expanded;shell.classList.toggle('is-expanded',expanded);document.body.classList.toggle('world-expanded',expanded);const button=root.querySelector('[data-camera-full]');button.textContent=expanded?'显示菜单':'返回全屏游戏';button.setAttribute('aria-pressed',String(expanded));if(expanded){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}else{document.body.style.overflow=previousOverflow;if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}}
  const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);listeners.push(()=>target.removeEventListener(type,fn,opts));};
  const say=message=>{if(!disposed&&status.textContent!==message)status.textContent=message;};
  function updateHomeEntrance(){if(config.camp)return;if(homeEntrance){scene.remove(homeEntrance);owned.splice(owned.indexOf(homeEntrance),1);disposeModel(homeEntrance);}homeEntrance=createHomeEntrance(data.character);scene.add(homeEntrance);owned.push(homeEntrance);}
  const characterLabel=document.createElement('label');characterLabel.className='hero-choice';
  characterLabel.innerHTML=`角色 <select aria-label="选择主角" disabled>${heroes.map(h=>`<option value="${h.id}">${h.label}</option>`).join('')}</select>`;
  const characterSelect=characterLabel.querySelector('select');characterSelect.value=heroFor(data.character).id;
  root.querySelector('.world3d-toolbar>div').prepend(characterLabel);
  listeners.push(()=>characterLabel.remove());
  const controls=document.createElement('div');controls.className='hero-controls';controls.setAttribute('aria-label','主角动作');
  controls.innerHTML='<button type="button" class="outline mini" data-hero-action="run" aria-pressed="false" disabled>跑步 R</button><button type="button" class="outline mini" data-hero-action="jump" disabled>跳跃 空格</button><button type="button" class="outline mini" data-hero-action="sit" aria-pressed="false" disabled>坐下 C</button>';
  root.querySelector('[data-talk]').before(controls);
  listeners.push(()=>controls.remove());
  const modalOpen=()=>characterLoading||park?.panelOpen||!!root.querySelector('.question-card[open],.town-dialogue:not([hidden])');
  function command(name){
    if(!actions||modalOpen()||park?.active)return;
    if(seatingPending)return;
    if(name==='sit'&&!actions.sitting){
      if(actions.busy)return;
      const seat=nearbySeat(position,seats);
      if(!seat){say('请先走到木凳旁，再按 C 坐凳子。');return;}
      travel(seat.approach,`seat:${seat.id}`);say('正在走到凳前，准备坐下……');return;
    }
    if(!actions.request(name))return;
    if(name==='sit'){route=[];destination=null;resetInput();}
    say(name==='run'?(actions.running?'跑步已开启 · 再按 R 恢复走路':'已恢复走路'):name==='jump'?'轻轻起跳，稳稳落地。':actions.sitting?'坐下来休息一下，按 C 或移动即可起身。':'正在起身……');
    viewport.focus({preventScroll:true});
  }
  let controlsState='';
  function updateControls(blocked){
    characterSelect.disabled=!actions||blocked||actions.busy||actions.sitting||seatingPending||options.readonly||!options.saveCharacter;
    const nearSeat=nearbySeat(position,seats);
    const state=`${!!actions}:${blocked}:${actions?.phase}:${actions?.running}:${nearSeat?.id}:${seatingPending}`;
    if(state===controlsState)return;
    controlsState=state;
    for(const button of controls.children){
      const name=button.dataset.heroAction;
      button.disabled=!actions||blocked||seatingPending||(name!=='run'&&(actions.busy||(name==='jump'&&actions.sitting)))||(name==='sit'&&!actions.sitting&&!nearSeat);
      if(!actions)continue;
      if(name==='run'){button.textContent=actions.running?'走路 R':'跑步 R';button.setAttribute('aria-pressed',String(actions.running));}
      if(name==='sit'){button.textContent=actions.sitting?'起身 C':nearSeat?'坐凳子 C':'靠近凳子';button.title=actions.sitting?'按 C 起身':'走到木凳旁，按 C 坐凳子';button.setAttribute('aria-pressed',String(actions.sitting));}
    }
  }
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
  function requestStand(){if(seatingPending){seatingPending=false;seatLock=null;}actions?.request('stand');}
  function travel(target,index=null){if(modalOpen()||park?.active)return;const path=findPath(position,target,!config.camp);if(!path){say('那里无法到达，请点击道路或选择一位朋友。');return;}requestStand();route=path;route.push({...target});destination=index;say('正在走向目的地……');viewport.focus({preventScroll:true});}
  function talk(){if(park?.active)return;const ride=park?.nearby(position);if(ride){park.offer(ride.id);return;}if(actions?.busy){say('等动作完成后再交谈。');return;}if(atHome()){showHome();return;}if(atGate()){showGate();return;}const index=nearest();if(index<0){say('走到人物身边再交谈，或点击下方地点让角色自动前往。');return;}route=[];resetInput();onTalk(index);}
  function fail(){if(disposed)return;loading.hidden=false;loading.innerHTML='<strong>暂时无法打开3D场景</strong><p>请检查网络与浏览器的图形加速，刷新页面重试。你仍然可以从下方学习路线进入练习。</p><a class="button outline" href="#courses">进入课程与练习</a>';say('3D场景未就绪，课程和学习记录仍可使用。');}
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.domElement.setAttribute('aria-label','可旋转视角的三维思维小镇');viewport.prepend(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color('#c5e8ee');scene.fog=new THREE.Fog('#c6deed',65,145);
    const camera=new THREE.PerspectiveCamera(46,1,.1,180);camera.position.set(0,16,24);
    scene.add(new THREE.HemisphereLight(0xfff7de,0x819987,2.0));const sunlight=new THREE.DirectionalLight(0xfff0dd,2.5);sunlight.position.set(-12,24,10);sunlight.castShadow=true;sunlight.shadow.mapSize.set(config.camp?2048:1024,config.camp?2048:1024);Object.assign(sunlight.shadow.camera,{left:-45,right:45,top:38,bottom:-38,near:1,far:70});sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.0001;scene.add(sunlight);
    observer=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(viewport);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    on(viewport,'pointerdown',e=>{if(e.target!==renderer.domElement)return;viewport.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};viewport.setPointerCapture(e.pointerId);});
    on(viewport,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){yaw-=dx*.007;pitch=THREE.MathUtils.clamp(pitch+dy*.005,.32,1.15);}drag.lastX=e.clientX;drag.lastY=e.clientY;});
    on(viewport,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const click=!drag.moved;drag=null;if(!hero||!click||park?.active)return;const rect=viewport.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(scene.children,true);for(const hit of hits){const seat=seatAtPoint(hit.point,seats);if(seat){travel(seat.approach,`seat:${seat.id}`);return;}let o=hit.object;while(o){if(o.userData.rideId&&park){travel(rides[o.userData.rideId].entry,`ride:${o.userData.rideId}`);return;}if(o.userData.homeDoor&&!config.camp){travel(townHome.door,'home');return;}if(o.userData.worldGate){travel(gatePoint,'gate');return;}if(Number.isInteger(o.userData.stationIndex)){const i=o.userData.stationIndex;travel(meetingPoint(i),i);return;}o=o.parent;}}const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,point))travel({x:point.x,z:point.z});});
    on(viewport,'pointercancel',()=>drag=null);
    on(viewport,'wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.012,8,31);},{passive:false});
    const codes=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
    on(viewport,'keydown',e=>{if(e.target!==viewport||modalOpen()||park?.active)return;if(codes.includes(e.code)){e.preventDefault();requestStand();route=[];destination=null;keys.add(e.code);}const name={KeyR:'run',Space:'jump',KeyC:'sit'}[e.code];if(name){e.preventDefault();if(!e.repeat)command(name);}if(e.code==='Escape'&&expanded)expand();if(e.code==='Enter'){e.preventDefault();if(!e.repeat)talk();}});
    on(window,'keyup',e=>keys.delete(e.code));on(window,'blur',resetInput);on(viewport,'blur',()=>keys.clear());
    on(document,'visibilitychange',()=>{if(document.hidden){resetInput();route=[];}});
    const joystick=root.querySelector('#town-joystick'),knob=joystick.querySelector('span');let stickPointer=null;
    function moveStick(e){if(stickPointer!==e.pointerId||modalOpen()||park?.active)return;const r=joystick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/35,dz=(e.clientY-r.top-r.height/2)/35,length=Math.max(1,Math.hypot(dx,dz));stick={x:dx/length,z:dz/length};if(Math.hypot(stick.x,stick.z)>.1)requestStand();knob.style.transform=`translate(${stick.x*28}px,${stick.z*28}px)`;route=[];destination=null;}
    on(joystick,'pointerdown',e=>{stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});on(joystick,'pointermove',moveStick);
    const stopStick=()=>{stickPointer=null;stick={x:0,z:0};knob.style.transform='';};on(joystick,'pointerup',stopStick);on(joystick,'pointercancel',stopStick);on(window,'blur',stopStick);
    on(controls,'click',e=>{const button=e.target.closest('[data-hero-action]');if(button&&!button.disabled)command(button.dataset.heroAction);});
    on(root,'click',e=>{if(park?.active)return;if(e.target.closest('[data-go-park]'))travel(parkEntrance,'park');if(e.target.closest('[data-go-home]'))travel(townHome.door,'home');if(e.target.closest('[data-enter-home]')&&atHome()){nextArrival='home';location.hash='home';return;}if(e.target.closest('[data-close-dialogue]')){root.querySelector('#town-dialogue').hidden=true;viewport.focus({preventScroll:true});}if(e.target.closest('[data-camera-full]'))expand();if(e.target.closest('[data-goto-gate]')&&hero)travel(gatePoint,'gate');if(e.target.closest('[data-cross-gate]')&&atGate()){if(!config.camp&&!gateOpen()){showGate();return;}nextArrival=config.camp?'town':'camp';window.location.hash=config.camp?'world':'expedition';return;}const place=e.target.closest('[data-place]');if(place&&hero){const i=Number(place.dataset.place);travel(meetingPoint(i),i);}if(e.target.closest('[data-talk]')&&hero)talk();if(e.target.closest('[data-camera-reset]')){yaw=.18;pitch=.85;distance=20;}if(e.target.closest('[data-camera-out]'))distance=Math.min(31,distance+3);if(e.target.closest('[data-camera-in]'))distance=Math.max(8,distance-3);});
    on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);resetInput();fail();});
    const loader=new GLTFLoader();
    on(characterSelect,'change',async()=>{
      const previous=heroFor(data.character).id,chosen=heroFor(characterSelect.value);
      if(chosen.id===previous)return;
      characterLoading=true;characterSelect.disabled=true;resetInput();route=[];destination=null;
      let loaded=null,nextActions=null;
      say('正在准备新角色……');
      try{
        loaded=await loader.loadAsync(chosen.asset);
        if(disposed)return;
        nextActions=createHeroActions(loaded.scene,loaded.animations,{canSit:()=>!!seatLock||!!park?.canSit});
        await options.saveCharacter(chosen.id);
        if(disposed)return;
        const old=hero;loaded.scene.position.copy(old.position);loaded.scene.rotation.copy(old.rotation);
        loaded.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
        if(actions.running)nextActions.request('run');
        actions.dispose();scene.remove(old);owned.splice(owned.indexOf(old),1);disposeModel(old);
        hero=loaded.scene;actions=nextActions;scene.add(hero);owned.push(hero);
        loaded=null;nextActions=null;data.character=chosen.id;viewport.dataset.character=chosen.id;updateHomeEntrance();
        say(`已换成${chosen.label}，继续探索吧！`);
      }catch(error){say('角色更换未完成，已保留原角色，请稍后重试。');}
      finally{
        nextActions?.dispose();if(loaded)disposeModel(loaded.scene);
        characterLoading=false;
        if(!disposed){characterSelect.value=heroFor(data.character).id;updateControls(modalOpen());viewport.focus({preventScroll:true});}
      }
    });
    // 模型来自 Blender 导出；网页仅负责显示、镜头和任务交互。
    Promise.all([config.asset||'/world3d/assets/thinking-town.glb',heroFor(data.character).asset].map(url=>loader.loadAsync(url).then(g=>{if(disposed){disposeModel(g.scene);return null;}owned.push(g.scene);return g;}))).then(([town,player])=>{
      if(disposed||!town||!player)return;
      if(!config.camp){preparePlaza(town.scene);hideOldValley(town.scene);}
      scene.add(town.scene);hero=player.scene;scene.add(hero);if(returningHome)hero.rotation.y=townHome.yaw;updateHomeEntrance();
      if(!config.camp){
       const district=createHomeDistrict();scene.add(district);owned.push(district);
       park=mountPlayground({shell,viewport,scene,travel,payRide:options.payRide,wallet:data.playground,readonly:options.readonly,stopWalking(){route=[];destination=null;resetInput();},getHero:()=>hero,getActions:()=>actions,leave(point){position={...point};hero.position.set(position.x,.09,position.z);hero.rotation.z=0;resetInput();},say});owned.push(park.group);
       const button=document.createElement('button');button.className='outline mini';button.dataset.goPark='';button.textContent='游乐场';root.querySelector('.world3d-toolbar>div').append(button);listeners.push(()=>button.remove());
      }
      if(!config.camp){const b=document.createElement('button');b.className='outline mini';b.dataset.goHome='';b.textContent='回家';root.querySelector('.world3d-toolbar>div').append(b);listeners.push(()=>b.remove());}
      // 未通关时横杆仅作关口提示，真正的跨区动作还要核对服务端返回的通关状态。
      if(!config.camp){const entrance=createValleyEntrance(gateOpen());scene.add(entrance);owned.push(entrance);}
      const gateButton=document.createElement('button');gateButton.className='outline mini';gateButton.dataset.gotoGate='';gateButton.textContent=config.camp?'前往小镇出口':'前往山谷入口';root.querySelector('.world3d-toolbar>div').append(gateButton);listeners.push(()=>gateButton.remove());
      scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.name.startsWith('Reward_')){const i=Number(o.name.slice(7));o.visible=!!data.areas[i]?.stamps;}});
      clouds=createIslandClouds({camp:!!config.camp});scene.add(clouds.group);owned.push(clouds.group);scene.background=clouds.background;
      if(!config.camp){fountain=createPlazaFountain();scene.add(fountain.group);owned.push(fountain.group);}
      // 与动作预览保持一致，避免头发和面部的细节产生斑驳自阴影。
      hero.traverse(o=>{if(o.isMesh)o.receiveShadow=false;});
      actions=createHeroActions(hero,player.animations,{canSit:()=>!!seatLock||!!park?.canSit});
      viewport.dataset.character=heroFor(data.character).id;
      // 营地原木凳过高；统一座面高度，让同一主角的脚底和膝盖都能自然落位。
      if(config.camp)town.scene.traverse(o=>{if(!o.isMesh||!o.name.startsWith('休息木凳'))return;o.position.y=seatHeight-.2;const legs=new THREE.Group();for(const x of [-.9,.9])for(const z of [-.25,.25]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.32,.12),new THREE.MeshStandardMaterial({color:0x94704b}));leg.position.set(o.position.x+x,.22,o.position.z+z);leg.castShadow=true;legs.add(leg);}scene.add(legs);owned.push(legs);});
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
    let last=performance.now();
    function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((time-last)/1000,.05);last=time;if(document.hidden)return;
      // 弹出答题卡时停止角色移动，场景仍保持渲染。
      const blocked=modalOpen();
      if(blocked){resetInput();stopStick();route=[];destination=null;if(seatingPending){seatingPending=false;seatLock=null;}}
      const wasRiding=park?.active;
      clouds?.update(dt);
      fountain?.update(dt);
      park?.update(dt,position);
      if(wasRiding){
        updateControls(true);root.querySelector('#town-nearby').hidden=true;
        const view=park.camera;if(view){const offset=view.offset.clone();if(view.orbit!==false)offset.applyAxisAngle(new THREE.Vector3(0,1,0),yaw-.18).multiplyScalar(distance/20);camera.position.lerp(view.look.clone().add(offset),Math.min(1,dt*5));camera.lookAt(view.look);}
        renderer.render(scene,camera);return;
      }
      if(hero){
        const old={...position};let dx=stick.x+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dz=stick.z+(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
        const wantsMove=Math.hypot(dx,dz)>.1||route.length>0,moveSpeed=actions?.speed||2.4;
        if(!blocked&&!seatingPending&&actions?.canMove){
          if(Math.hypot(dx,dz)>.1){const length=Math.max(1,Math.hypot(dx,dz)),vx=(dx*Math.cos(yaw)+dz*Math.sin(yaw))/length,vz=(-dx*Math.sin(yaw)+dz*Math.cos(yaw))/length;position=stepPosition(position,vx*moveSpeed*dt,vz*moveSpeed*dt,!config.camp);}
          else if(route.length){const step=advancePath(position,route,moveSpeed*dt,!config.camp);position=step.position;if(step.blocked){route=[];destination=null;say('前面有障碍，请换一条路。');}}
        }
        const moving=Math.hypot(position.x-old.x,position.z-old.z)>.001;
        hero.position.set(position.x,.09,position.z);
        if(moving){
          const heading=Math.atan2(position.x-old.x,position.z-old.z);
          const turn=Math.atan2(Math.sin(heading-hero.rotation.y),Math.cos(heading-hero.rotation.y));
          hero.rotation.y+=turn*(1-Math.exp(-16*dt));
        }
        if(seatingPending&&seatLock){
          const turn=Math.atan2(Math.sin(seatLock.yaw-hero.rotation.y),Math.cos(seatLock.yaw-hero.rotation.y));
          hero.rotation.y+=turn*(1-Math.exp(-12*dt));
          if(Math.abs(turn)<.03){hero.rotation.y=seatLock.yaw;seatingPending=false;actions.request('sit');say('坐在凳子上休息 · 按 C 或方向键起身');}
        }
        const wasSeated=actions?.phase==='StandUp';
        actions?.update(dt,{moving,wantsMove,blocked,pace:Math.hypot(position.x-old.x,position.z-old.z)/Math.max(dt*moveSpeed,.0001)});
        if(wasSeated&&actions.phase==='Idle')seatLock=null;
        updateControls(blocked);
        if(viewport.dataset.heroState!==actions?.phase)viewport.dataset.heroState=actions?.phase||'loading';
        if(!route.length&&destination!==null&&!actions?.busy){const i=destination;destination=null;if(typeof i==='string'&&i.startsWith('seat:')){seatLock=seats.find(s=>`seat:${s.id}`===i);if(seatLock){seatingPending=true;resetInput();}}else if(i==='park'&&park){park.showMenu();}else if(typeof i==='string'&&i.startsWith('ride:')&&park){say('已到达设施入口，按 Enter 游玩 · 20 星光。');}else if(i==='home'&&atHome()){showHome();}else if(i==='gate'&&atGate()){showGate();}else if(nearest()===i){onTalk(i);say('已经到达，可以接受这位朋友的任务。');}}
        const overview=park?.overview,look=overview?.look||new THREE.Vector3(position.x,1.15,position.z),offset=overview?.offset||new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.position.lerp(look.clone().add(offset),Math.min(1,dt*6));camera.lookAt(look);
        const interaction=root.querySelector('[data-talk]');interaction.textContent=park?.nearby(position)?'游玩 · 20 星光':config.camp?'检查附近设施':'与附近人物交谈';
        const label=root.querySelector('#town-nearby'),i=nearest(),ride=park?.nearby(position);label.hidden=i<0&&!atGate()&&!atHome()&&!ride;label.textContent=ride?`${ride.name} · Enter 游玩 · 20 星光`:atHome()?'家门口 · 按 Enter 进入家园':atGate()?'山谷入口 · 按 Enter 查看通道':i<0?'':`附近：${(config.names||['面包师米米','乐手多多','侦探阿布','建筑师方方','园丁芽芽','店长圆圆'])[i]} · 按 Enter ${config.camp?'检查':'交谈'}`;
      }
      for(const o of owned){if(!o.userData.nameplate)continue;const d=camera.position.distanceTo(o.position),height=2*d*Math.tan(camera.fov*Math.PI/360)/Math.max(1,viewport.clientHeight)*(nearest()===o.userData.stationIndex?38:30);o.scale.set(height,height,1);}
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(animate);
  }catch{fail();}
  return ()=>{document.body.classList.remove('world-expanded');if(expanded){document.body.style.overflow=previousOverflow;expanded=false;}disposed=true;cancelAnimationFrame(frame);resetInput();observer?.disconnect();listeners.forEach(remove=>remove());park?.dispose();clouds?.background.dispose();actions?.dispose();owned.forEach(disposeModel);renderer?.dispose();renderer?.domElement.remove();};
}
