import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {heroFor} from './hero-catalog.mjs?v=20260922-motion1';
import {createHeroActions} from './hero-actions.mjs?v=20260922-motion1';
import {buildInterior,disposeGroup} from './home-model.mjs';
import {spots,sofaSeat,findPath,stepPosition,advancePath} from './home-layout.mjs';

export function mountHome(root,world,options){
 document.body.classList.add('home-open');
 const character=heroFor(world.character).id,girl=character==='girl',title=girl?'星光花园之家':'森林探索之家';
 let saved={...world.homes[character]},disposed=false,frame=0,renderer,observer,hero,actions,interior,scene;
 let position={...spots.exit},path=[],goal=null,yaw=.12,distance=15,drag=null,stick={x:0,z:0},saving=false;
 const keys=new Set(),listeners=[],on=(el,event,fn,opts)=>{el.addEventListener(event,fn,opts);listeners.push(()=>el.removeEventListener(event,fn,opts));};
 root.innerHTML=`<section class="home-shell ${girl?'home-girl':'home-boy'}" aria-label="${title}"><div class="home-top"><div><small>探险家之家</small><h1>${title}</h1></div><div class="home-tools"><button data-room="living">客厅</button><button data-room="bedroom">卧室</button><button data-decor ${options.readonly?'disabled':''}>装饰家园</button><a href="#world">返回小镇</a></div></div><div id="home-viewport" tabindex="0" role="group" aria-label="可走动的家园室内"><div id="home-loading" role="status">正在布置你的家……</div></div><div class="home-bottom"><div id="home-stick" aria-label="室内移动摇杆"><span></span></div><div><p id="home-status" role="status">欢迎回家</p><small>方向键 / WASD 移动 · 点击地面前往 · 拖动转动视角</small></div><button data-home-sit>去沙发坐下 C</button><button data-home-jump>跳跃</button><button data-home-exit hidden>出门回小镇</button></div><dialog class="home-decor"><form><h2>装饰我的家</h2><p>为这位角色保存一套专属布置。</p><label>墙面颜色<select name="wall"><option value="sky">晴空蓝</option><option value="lavender">淡紫色</option><option value="mint">薄荷绿</option><option value="cream">奶油黄</option></select></label><label>地毯图案<select name="rug"><option value="wave">海浪</option><option value="flower">花朵</option><option value="stars">星星</option><option value="sun">暖阳</option></select></label><label>主题摆件<select name="ornament"><option value="planet">环绕星球</option><option value="flowers">缤纷花束</option><option value="books">小小书堆</option><option value="crystal">星光水晶</option></select></label><p data-decor-status role="status">选择后可以预览，保存后下次回家仍保留。</p><div><button type="submit">保存布置</button><button type="button" data-cancel-decor>取消</button></div></form></dialog></section>`;
 const viewport=root.querySelector('#home-viewport'),loading=root.querySelector('#home-loading'),status=root.querySelector('#home-status'),dialog=root.querySelector('dialog'),form=dialog.querySelector('form'),message=form.querySelector('[data-decor-status]');
 const say=s=>{if(!disposed&&status.textContent!==s)status.textContent=s;};
 const reset=()=>{keys.clear();stick={x:0,z:0};drag=null;root.querySelector('#home-stick span').style.transform='';};
 const closeDecor=()=>{if(saving)return;interior?.applyDecor(saved);dialog.close();viewport.focus();};
 function walkTo(target,id=null){if(!hero||dialog.open)return;const found=findPath(position,target);if(!found){say('这里有家具，请选择空地。');return;}actions.request('stand');path=found;goal=id;viewport.focus();}
 function sit(){if(!actions||dialog.open||actions.busy)return;if(actions.sitting){actions.request('stand');say('准备起身');}else{walkTo(sofaSeat,'sofa');say('走到沙发前，坐下来歇一会儿。');}}
 on(root,'click',e=>{
  const room=e.target.closest('[data-room]');if(room)walkTo(spots[room.dataset.room],room.dataset.room);
  if(e.target.closest('[data-home-sit]'))sit();
  if(e.target.closest('[data-home-jump]')&&!dialog.open)actions?.request('jump');
  if(e.target.closest('[data-home-exit]'))location.hash='world';
  if(e.target.closest('[data-decor]')&&!options.readonly&&interior){reset();path=[];goal=null;for(const field of ['wall','rug','ornament'])form.elements[field].value=saved[field];message.textContent='选择后可以预览，保存后下次回家仍保留。';dialog.showModal();}
  if(e.target.closest('[data-cancel-decor]'))closeDecor();
 });
 on(dialog,'cancel',e=>{e.preventDefault();closeDecor();});
 const selection=()=>({wall:form.elements.wall.value,rug:form.elements.rug.value,ornament:form.elements.ornament.value});
 on(form,'change',()=>interior.applyDecor(selection()));
 on(form,'submit',async e=>{
  e.preventDefault();if(saving||options.readonly)return;saving=true;form.querySelectorAll('button,select').forEach(b=>b.disabled=true);message.textContent='正在保存……';
  try{const out=await options.saveHome(character,{...selection(),revision:saved.revision});if(disposed)return;saved={...out};interior.applyDecor(saved);dialog.close();say('家园布置已保存');viewport.focus();}
  catch(error){if(!disposed)message.textContent=error.message||'保存未完成，请重试。';}
  finally{saving=false;if(!disposed)form.querySelectorAll('button,select').forEach(b=>b.disabled=false);}
 });
 const fail=()=>{if(!disposed){loading.hidden=false;loading.innerHTML='<p>家园未能加载，请刷新重试。</p><a href="#world">返回小镇</a>';}};
 try{
  renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','客厅与卧室三维场景');viewport.prepend(renderer.domElement);
  scene=new T.Scene();scene.background=new T.Color(girl?0xf8e9ef:0xe5f2ee);scene.add(new T.HemisphereLight(0xfffcf2,0xaaa1b5,2.6));
  const sun=new T.DirectionalLight(0xfff2d8,2.8);sun.position.set(-3,9,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:9,bottom:-9});sun.shadow.normalBias=.025;scene.add(sun);
  const fill=new T.DirectionalLight(0xdcdfff,1.2);fill.position.set(6,6,-1);scene.add(fill);
  interior=buildInterior(character,saved);scene.add(interior.group);
  const camera=new T.PerspectiveCamera(46,1,.1,80);const target=new T.Vector3(0,.6,0);
  function cameraView(){const aspect=viewport.clientWidth/Math.max(1,viewport.clientHeight),radius=distance*Math.max(1,.95/aspect);camera.position.set(Math.sin(yaw)*radius,.76*radius,Math.cos(yaw)*radius);camera.lookAt(target);}
  observer=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();cameraView();}});observer.observe(viewport);cameraView();
  const ray=new T.Raycaster(),mouse=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.07);
  on(viewport,'pointerdown',e=>{if(e.target!==renderer.domElement)return;viewport.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY,last:e.clientX,moved:false};viewport.setPointerCapture(e.pointerId);});
  on(viewport,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;if(drag.moved){yaw=T.MathUtils.clamp(yaw-(e.clientX-drag.last)*.005,-.8,.8);cameraView();}drag.last=e.clientX;});
  on(viewport,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const click=!drag.moved;drag=null;if(!click||!hero)return;const r=viewport.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const point=new T.Vector3();if(ray.ray.intersectPlane(plane,point)){if(Math.abs(point.x+4.6)<1.8&&Math.abs(point.z+2.25)<.8){sit();return;}walkTo({x:point.x,z:point.z});}});
  on(viewport,'pointercancel',()=>drag=null);
  on(viewport,'wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance+e.deltaY*.009,11,22);cameraView();},{passive:false});
  const codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  on(viewport,'keydown',e=>{if(dialog.open||e.target!==viewport||!actions)return;if(codes.includes(e.code)){e.preventDefault();actions.request('stand');keys.add(e.code);path=[];goal=null;}if(!e.repeat&&['KeyC','Space','KeyR'].includes(e.code)){e.preventDefault();if(e.code==='KeyC')sit();else actions.request(e.code==='KeyR'?'run':'jump');}if(e.code==='Enter'&&Math.hypot(position.x-spots.exit.x,position.z-spots.exit.z)<1.3)location.hash='world';});
  on(window,'keyup',e=>keys.delete(e.code));on(window,'blur',reset);on(viewport,'blur',()=>keys.clear());on(document,'visibilitychange',()=>{if(document.hidden){reset();path=[];goal=null;}});
  const joystick=root.querySelector('#home-stick');let pointer=null;
  const move=e=>{if(e.pointerId!==pointer||dialog.open)return;const b=joystick.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/28,z=(e.clientY-b.top-b.height/2)/28,n=Math.max(1,Math.hypot(x,z));stick={x:x/n,z:z/n};joystick.firstElementChild.style.transform=`translate(${stick.x*22}px,${stick.z*22}px)`;actions?.request('stand');path=[];goal=null;};
  on(joystick,'pointerdown',e=>{pointer=e.pointerId;joystick.setPointerCapture(pointer);move(e);});on(joystick,'pointermove',move);for(const event of ['pointerup','pointercancel'])on(joystick,event,()=>{pointer=null;reset();});
  on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);reset();fail();});
  new GLTFLoader().loadAsync(heroFor(character).asset).then(gltf=>{if(disposed){disposeGroup(gltf.scene);return;}hero=gltf.scene;hero.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});scene.add(hero);actions=createHeroActions(hero,gltf.animations,{canSit:()=>Math.hypot(position.x-sofaSeat.x,position.z-sofaSeat.z)<.05});loading.hidden=true;say(options.readonly?'正在参观学生的家，装饰仅可查看':'欢迎回家！先看看客厅和卧室吧。');}).catch(fail);
  let last=performance.now();
  function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((time-last)/1000,.05);last=time;if(document.hidden)return;
   if(hero){const old={...position};let dx=stick.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dz=stick.z+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const wants=Math.hypot(dx,dz)>.1||path.length>0;
    if(!dialog.open&&actions.canMove){if(Math.hypot(dx,dz)>.1){const n=Math.max(1,Math.hypot(dx,dz));position=stepPosition(position,(dx*Math.cos(yaw)+dz*Math.sin(yaw))/n*actions.speed*dt,(-dx*Math.sin(yaw)+dz*Math.cos(yaw))/n*actions.speed*dt);}else if(path.length){const next=advancePath(position,path,actions.speed*dt);position=next.position;if(next.blocked){path=[];goal=null;say('前面有家具，请换一条路。');}}}
    const moved=Math.hypot(position.x-old.x,position.z-old.z);hero.position.set(position.x,.09,position.z);if(moved>.001){const angle=Math.atan2(position.x-old.x,position.z-old.z),diff=Math.atan2(Math.sin(angle-hero.rotation.y),Math.cos(angle-hero.rotation.y));hero.rotation.y+=diff*(1-Math.exp(-16*dt));}
    actions.update(dt,{moving:moved>.001,wantsMove:wants,blocked:dialog.open,pace:moved/Math.max(.0001,actions.speed*dt)});
    if(!path.length&&goal&&!actions.busy){const arrived=goal;goal=null;if(arrived==='sofa'){hero.rotation.y=sofaSeat.yaw;actions.request('sit');say('坐在沙发上休息 · 按 C 或方向键起身');}else say(arrived==='bedroom'?'欢迎来到卧室':'这里是客厅');}
    viewport.dataset.room=position.x>0?'bedroom':'living';viewport.dataset.heroState=actions.phase;viewport.dataset.character=character;
    const sitButton=root.querySelector('[data-home-sit]');sitButton.disabled=actions.busy||dialog.open;sitButton.textContent=actions.sitting?'起身 C':'去沙发坐下 C';root.querySelector('[data-home-jump]').disabled=actions.busy||actions.sitting||dialog.open;root.querySelector('[data-home-exit]').hidden=Math.hypot(position.x-spots.exit.x,position.z-spots.exit.z)>1.3;
   }renderer.render(scene,camera);
  }frame=requestAnimationFrame(animate);
 }catch{fail();}
 return ()=>{document.body.classList.remove('home-open');disposed=true;cancelAnimationFrame(frame);reset();observer?.disconnect();listeners.forEach(fn=>fn());if(dialog.open)dialog.close();actions?.dispose();if(scene)disposeGroup(scene);renderer?.dispose();renderer?.domElement.remove();};
}
