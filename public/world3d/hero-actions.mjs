import {AnimationMixer, LoopOnce, LoopRepeat} from './vendor/three.module.js';

// 动作只管理姿态，地图继续负责位置、碰撞和通关权限。
export function createHeroActions(hero, clips, {canSit=()=>false}={}) {
  const mixer=new AnimationMixer(hero);
  const actions=new Map(clips.map(clip=>[clip.name,mixer.clipAction(clip)]));
  for(const name of ['Idle','Walk','Run','Jump','SitDown','StandUp']) {
    if(!actions.has(name))throw new Error(`主角缺少 ${name} 动作`);
  }
  let phase='Idle',active=null,running=false,blocked=false,standRequested=false;
  const single=new Set(['Jump','SitDown','StandUp']);
  function play(name) {
    if(active===actions.get(name)&&phase===name)return;
    const next=actions.get(name);
    active?.stopFading().fadeOut(.18);
    next.reset().stopFading().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(single.has(name)?LoopOnce:LoopRepeat,single.has(name)?1:Infinity);
    next.clampWhenFinished=single.has(name);
    next.fadeIn(.18).play();active=next;phase=name;
  }
  function finished(event) {
    if(event.action!==active)return;
    if(phase==='SitDown'){
      if(standRequested&&!blocked){standRequested=false;play('StandUp');}
      else phase='Seated';
    }
    else if(phase==='Jump'||phase==='StandUp')play('Idle');
  }
  mixer.addEventListener('finished',finished);
  play('Idle');
  return {
    get phase(){return phase;},
    get running(){return running;},
    get speed(){return running?3.6:2.9;},
    get sitting(){return phase==='SitDown'||phase==='Seated';},
    get busy(){return single.has(phase);},
    get canMove(){return !blocked&&!['SitDown','Seated','StandUp'].includes(phase);},
    // 从游乐设施安全退出时立即恢复站姿，避免把半空坐姿带回地面。
    resetToIdle(){mixer.stopAllAction();active=null;standRequested=false;blocked=false;play('Idle');active.stopFading().setEffectiveWeight(1);mixer.update(0);},
    request(command) {
      if(blocked)return false;
      if(command==='stand'){
        if(phase==='SitDown'){standRequested=true;return true;}
        if(phase==='Seated'){standRequested=false;play('StandUp');return true;}
        return false;
      }
      if(command==='run'){running=!running;return true;}
      if(command==='sit'){
        if(phase==='Seated'){play('StandUp');return true;}
        if(single.has(phase))return false;
        if(!canSit())return false;
        standRequested=false;play('SitDown');return true;
      }
      if(command==='jump'&&!single.has(phase)&&phase!=='Seated'){play('Jump');return true;}
      return false;
    },
    update(dt,{moving=false,wantsMove=false,blocked:paused=false,pace=1}={}) {
      blocked=paused;
      if(blocked)standRequested=false;
      if(!blocked&&wantsMove&&phase==='SitDown')standRequested=true;
      if(!blocked&&wantsMove&&phase==='Seated')play('StandUp');
      if(['Idle','Walk','Run'].includes(phase)) {
        play(!blocked&&moving?(running?'Run':'Walk'):'Idle');
        // 走路提速时同步提高步频，避免只移动得快、脚下却在滑行。
        if(moving&&!blocked)active.setEffectiveTimeScale(Math.max(.35,Math.min(1,pace))*(running?1.15:2.9/2.4));
      }
      // 答题时完成落地或起坐，不把人物冻结在空中。
      mixer.update(Math.min(Math.max(dt,0),.05));
    },
    dispose(){mixer.removeEventListener('finished',finished);mixer.stopAllAction();mixer.uncacheRoot(hero);}
  };
}
