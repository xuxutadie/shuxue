// 地图间交通只影响画面与落点，不改写学习进度、奖励或地图权限。
export const flightDuration=3.5;
export const ports={
 camp:{position:{x:18.5,z:0},yaw:-Math.PI/2,approach:{x:14.5,z:0},destination:'sky',route:'observatory'},
 sky:{position:{x:0,z:16.5},yaw:Math.PI,approach:{x:0,z:12.5},destination:'camp',route:'expedition'}
};

export function createVoyageClock(onFinish,arriving=false){
 const phases=arriving?['landing','disembarking']:['boarding','flying'];
 // 空中总时长包含目的地的0.65秒降落，登艇和下艇另计。
 const durations={boarding:.9,flying:flightDuration-.65,landing:.65,disembarking:.9};
 let index=0,elapsed=0,finished=false,disposed=false;
 function finish(skipped=false){if(finished||disposed)return;finished=true;onFinish(skipped);}
 return {
  get phase(){return finished?'finished':phases[index];},
  get progress(){return finished?1:elapsed/durations[phases[index]];},
  update(dt){
   if(disposed||finished||!Number.isFinite(dt)||dt<0)return;
   let remaining=dt;
   while(!finished){
    const left=durations[phases[index]]-elapsed;
    if(remaining+1e-9<left){elapsed+=remaining;break;}
    remaining=Math.max(0,remaining-left);elapsed=0;index++;
    if(index===phases.length){finish();break;}
   }
  },
  skip(){finish(true);},
  dispose(){disposed=true;}
 };
}

let pendingArrival=null;
export function queueArrival(region,skip=false){pendingArrival={region,skip};}
export function takeArrival(region){const arrival=pendingArrival;pendingArrival=null;return arrival?.region===region?arrival:null;}
