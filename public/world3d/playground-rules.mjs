// 游乐场位于小镇东侧，和西侧住宅隔着广场相对。
export const parkBounds={minX:15,maxX:60,minZ:-14,maxZ:14};
export const parkEntrance={x:19,z:0};
export const rides={
 carousel:{id:'carousel',name:'旋转木马',x:25,z:7,entry:{x:25,z:12},duration:24,description:'坐上小马转两圈，看看小镇。'},
 wheel:{id:'wheel',name:'星光摩天轮',x:35,z:-7,entry:{x:35,z:-1.5},duration:36,description:'坐进座舱，从高处看看你的家。'},
 swing:{id:'swing',name:'彩虹秋千',x:50,z:-7,entry:{x:50,z:-2},duration:30,description:'坐上秋千，按空格或“加把劲”荡得更高。'},
 trampoline:{id:'trampoline',name:'云朵蹦床',x:52,z:7,entry:{x:47,z:7},duration:30,description:'按空格起跳，快落到垫子时再次按下，连续弹跳更高。'},
 surf:{id:'surf',name:'乘风冲浪',x:37,z:7,entry:{x:31,z:7},duration:40,description:'左右换道收集星星，跳过浮标。每局有 3 次碰撞机会。'},
};
export function inPark(x,z){return x>=parkBounds.minX&&x<=parkBounds.maxX-.4&&z>=parkBounds.minZ+.4&&z<=parkBounds.maxZ-.4;}
export function parkBlocked(x,z){
 return Math.abs(x-18)<.6&&Math.abs(Math.abs(z)-2.8)<.6||Math.hypot(x-25,z-7)<4.05||Math.abs(x-35)<5.8&&Math.abs(z+6.4)<4.2||Math.abs(x-37)<4.85&&Math.abs(z-7)<5.85||Math.abs(x-24)<2.3&&Math.abs(z+7)<2.3||Math.abs(x-50)<2.9&&Math.abs(z+7)<4||Math.hypot(x-52,z-7)<3.95;
}
export function nearbyRide(p){return Object.values(rides).find(r=>Math.hypot(p.x-r.entry.x,p.z-r.entry.z)<1.45)||null;}
const smooth=t=>t*t*(3-2*t);
// 正常运行和提前结束都在站台停止，不能在摩天轮高处直接下车。
export function createRideClock(id){
 const ride=rides[id];if(!ride||['surf','trampoline'].includes(id))throw new Error('不支持的乘坐设施');
 let elapsed=0,progress=0,returning=null,done=false;
 return {get progress(){return progress;},get done(){return done;},get returning(){return !!returning;},
  finish(){if(!done&&!returning)returning={start:progress,time:0};},
  update(dt){if(done)return;dt=Math.max(0,Math.min(dt,.1));if(returning){returning.time+=dt;progress=returning.start+(1-returning.start)*smooth(Math.min(1,returning.time/5));}else{elapsed+=dt;progress=smooth(Math.min(1,elapsed/ride.duration));}if(progress>=1-1e-9){progress=1;done=true;}},
 };
}
// 冲浪规则独立于画面，换道、跳跃、碰撞及计分可直接验证。
export function createSurfRound(seed=Date.now()){
 let randomState=seed>>>0;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 let elapsed=0,lane=0,target=0,jumpTime=0,spawnTime=.7,nextId=0,score=0,lives=3,done=false,flash=0;
 const items=[];
 return {items,get elapsed(){return elapsed;},get lane(){return lane;},get target(){return target;},get score(){return score;},get lives(){return lives;},get done(){return done;},get flash(){return flash;},get height(){return jumpTime>0?Math.sin(Math.PI*jumpTime/.9)*1.25:0;},
  steer(direction){if(!done)target=Math.max(-1,Math.min(1,target+Math.sign(direction)));},
  jump(){if(done||jumpTime>0)return false;jumpTime=.9;return true;},
  stop(){done=true;},
  update(dt){
   if(done)return;dt=Math.max(0,Math.min(dt,.1));elapsed+=dt;lane+=(target-lane)*Math.min(1,dt*9);jumpTime=Math.max(0,jumpTime-dt);flash=Math.max(0,flash-dt);spawnTime-=dt;
   if(spawnTime<=0){spawnTime=1.15;const obstacle=nextId%3===2;items.push({id:nextId++,kind:obstacle?'buoy':'star',lane:Math.floor(random()*3)-1,distance:9,passed:false});}
   for(const item of items){const before=item.distance;item.distance-=dt*4.5;if(!item.passed&&before>0&&item.distance<=0){item.passed=true;if(Math.abs(item.lane-lane)<.48){if(item.kind==='star')score+=10;else if(this.height<.48){lives--;flash=.55;}}}}
   for(let i=items.length-1;i>=0;i--)if(items[i].distance<-2)items.splice(i,1);
   if(lives<=0||elapsed>=rides.surf.duration)done=true;
  },
 };
}

// 蹦床采用连续落地判定，提前结束也要等角色落到垫面。
export function createBounceRound(){
 let elapsed=0,height=0,velocity=0,bounces=0,score=0,charged=false,started=false,stopping=false,done=false,launch=0,message='按空格或按钮开始起跳';
 return {get elapsed(){return elapsed;},get height(){return height;},get velocity(){return velocity;},get bounces(){return bounces;},get score(){return score;},get done(){return done;},get launch(){return launch;},get message(){return message;},get ready(){return !stopping&&height<.55&&velocity<=0;},
  jump(){if(done||stopping)return false;if(!started){started=true;velocity=6.5;launch++;message='快落到垫面时再次蓄力';return true;}if(height<.55&&velocity<0&&!charged){charged=true;message='蓄力成功，下一跳更高！';return true;}message=charged?'已经蓄力，等下一次落地':'等快落到垫子上再按';return false;},
  stop(){stopping=true;if(!started)done=true;message='落地后结束';},
  update(dt){if(done)return;dt=Math.max(0,Math.min(dt,.05));elapsed+=dt;if(elapsed>=rides.trampoline.duration)this.stop();if(!started||done)return;velocity-=12*dt;height+=velocity*dt;if(height<=0){height=0;bounces++;if(stopping){done=true;velocity=0;return;}score+=charged?20:5;velocity=charged?8.8:6.5;launch++;message=charged?'漂亮！继续把握落地时机':'快落到垫面时再次蓄力';charged=false;}},
 };
}
