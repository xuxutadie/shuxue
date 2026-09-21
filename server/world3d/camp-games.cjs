// 操作任务由服务端重放与判定，客户端只能提交操作方案，不能指定对错。
const gameTitles=['铺好山谷吊桥','物资装车','同步营地信号','核对开门线索','量出六升水','规划核心路线'];
const gameTopics=[3,5,1,2,0,4];
const gameRules=['从5、4、3、2、2米桥板中选至多3块，恰好铺满10米。','把五袋7千克和四袋4千克物资放进三辆车，每车不超过18千克。','三盏灯周期从4、6、8、12秒中选择，首次重新同时亮在24秒，三个周期之和不超过20。','甲说乙拿钥匙，乙说丙拿钥匙，丙说乙没拿。恰好两句真话，选出持钥匙者并标记真话。','用8升桶和5升桶，通过装满、倒空、互倒，在8升桶中量出6升。','从(0,0)走到(3,3)，只可向东或向北，避开(1,1)，并经过补给点(2,1)。'];
function waterState(steps){let a=0,b=0;for(const step of steps){if(step==='fillA')a=8;else if(step==='fillB')b=5;else if(step==='emptyA')a=0;else if(step==='emptyB')b=0;else if(step==='AB'){const n=Math.min(a,5-b);a-=n;b+=n;}else if(step==='BA'){const n=Math.min(b,8-a);b-=n;a+=n;}else throw Error('未知倒水操作');}return [a,b];}
function judgeCampGame(index,config){
 if(!Number.isInteger(index)||index<0||index>5||!config||typeof config!=='object')throw Error('操作方案格式不正确');
 const array=(value,n,predicate)=>Array.isArray(value)&&value.length<=n&&value.every(predicate);
 let correct=false,feedback='',description='';
 if(index===0){const xs=config.pieces;if(!array(xs,5,x=>Number.isInteger(x)&&x>=0&&x<5)||new Set(xs).size!==xs.length)throw Error('桥板选择不正确');const sum=xs.reduce((s,i)=>s+[5,4,3,2,2][i],0);correct=sum===10&&xs.length<=3;feedback=correct?'桥板恰好连通两岸！':sum<10?`桥还差${10-sum}米，换一种组合试试。`:sum>10?`桥板超出${sum-10}米，试试替换材料。`:'长度够了，但请减少到最多3块。';description=`桥板长度：${xs.map(i=>[5,4,3,2,2][i]).join('＋')}米`;}
 if(index===1){const xs=config.trucks;if(!array(xs,9,x=>Number.isInteger(x)&&x>=-1&&x<3)||xs.length!==9)throw Error('装车方案不正确');const weights=[7,7,7,7,7,4,4,4,4],loads=[0,0,0];xs.forEach((t,i)=>{if(t>=0)loads[t]+=weights[i];});correct=xs.every(x=>x>=0)&&loads.every(x=>x<=18);feedback=correct?'全部物资装好了，三辆车都能出发！':loads.some(x=>x>18)?'有车辆超重，把一些物资换到其他车上。':'还有物资没有装车。';description=`三车重量：${loads.join('、')}千克；分配：${xs.join('、')}`;}
 if(index===2){const xs=config.periods;if(!array(xs,3,x=>[4,6,8,12].includes(x))||xs.length!==3)throw Error('信号周期不正确');const gcd=(a,b)=>b?gcd(b,a%b):a;const sync=xs.reduce((a,b)=>a*b/gcd(a,b));correct=sync===24&&xs.reduce((s,x)=>s+x,0)<=20;feedback=correct?'第24秒三灯同步，能量也够用！':sync!==24?`三灯第一次重新同步在第${sync}秒，继续调整周期。`:'同步时间对了，但周期总和超过20，再试一种组合。';description=`周期：${xs.join('、')}秒`;}
 if(index===3){const xs=config.truth;if(!['甲','乙','丙'].includes(config.key)||!array(xs,3,x=>typeof x==='boolean')||xs.length!==3)throw Error('线索方案不正确');const actual=[config.key==='乙',config.key==='丙',config.key!=='乙'];correct=actual.filter(Boolean).length===2&&xs.every((v,i)=>v===actual[i]);feedback=correct?'线索一致，观测站打开了！':xs.some((v,i)=>v!==actual[i])?'你标记的真假与选中的持钥匙者不一致，逐句检查。':'这个人选不能让恰好两句话成立，换个人试试。';description=`钥匙在${config.key}；三句话判断：${xs.map(v=>v?'真':'假').join('、')}`;}
 if(index===4){if(!array(config.steps,40,x=>['fillA','fillB','emptyA','emptyB','AB','BA'].includes(x)))throw Error('倒水步骤不正确');const [a,b]=waterState(config.steps);correct=a===6;feedback=correct?'8升桶里恰好6升，温室恢复供水！':`现在两桶分别有${a}升和${b}升，再尝试装满、倒空或互倒。`;description=`倒水操作：${config.steps.join(' → ')}；最终${a}、${b}升`;}
 if(index===5){if(!array(config.steps,6,x=>x==='E'||x==='N'))throw Error('路线格式不正确');let x=0,y=0,blocked=false,supply=false;for(const step of config.steps){if(step==='E')x++;else y++;if(x===1&&y===1||x>3||y>3)blocked=true;if(x===2&&y===1)supply=true;}correct=x===3&&y===3&&!blocked&&supply;feedback=correct?'路线安全，补给已取到，星光核心点亮！':blocked?'路线经过封路点或越过边界，撤回一步再试。':!supply?'记得经过补给点，再去星光核心。':'还没有抵达右上角的星光核心。';description=`路线：${config.steps.join(' → ')}`;}
 return {correct,feedback,description};
}

module.exports={gameTitles,gameTopics,gameRules,waterState,judgeCampGame};