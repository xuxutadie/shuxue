/* 互动验证沿用课堂同一组 SVG 参数；记录参与，不计入测评分数。 */
const GAME_META={shop:['神秘商店','比较订单，找出隐藏价格。'],cycle:['循环列车','把序号放进循环，看看它落在哪里。'],factor:['数字工厂','装袋找因数，分类认质数，再来闯一关。'],area:['图形工坊','补回缺角，看见整体与部分。'],chase:['公交追赶','让时间前进，观察两个人的距离。'],pasture:['牧场管理','调节牛的数量，比较增长和消耗。'],allocation:['书店配货','一套有顺序的清单，胜过随意尝试。']};
let gameState={};
function gameView(type,index){
 if(type==='factor'&&(index===undefined||index===3))return factorGameView();
 gameState={type};
 const visual=labView(index,index===undefined?type:undefined),m=labModel(labState.type,labState.values);
 return visual+`<section class="panel game-challenge"><span class="tag">把观察变成答案</span><h2>验证我的发现</h2><p id="game-question">${m.question}</p><div class="controls"><label for="game-answer">我的答案<input id="game-answer" autocomplete="off" placeholder="只填结果，可以打草稿"></label><button data-game="check">检查本次预测</button></div><div id="game-feedback" class="inline-feedback" role="status"></div><p class="tiny">条件变化后，请重新预测。完成一次验证只记录参与，不代表已经掌握。</p></section>`;
}
function drawGame(){ /* 图形在页面渲染时已经就位，交互由课堂实验统一处理。 */ }
function gameSuccess(message){
 document.getElementById('game-feedback').textContent=message;
 if(teacher||!pupil()||(typeof previewStudentId!=='undefined'&&previewStudentId))return;
 api('/api/students/'+pupil().id+'/games/'+({align:'shop',reflection:'area',stacks:'area',stopped:'chase',grid:'area',multiples:'factor',balance:'shop'}[labState.type]||labState.type),{method:'POST',body:{}}).then(()=>{pupil().games[gameState.type]={date:new Date().toISOString()};}).catch(err=>toast('探索记录尚未保存：'+err.message));
}
function gameAction(action){
 if(action!=='check'||!labState)return;
 const model=labModel(labState.type,labState.values,labState.step);
 const answer=document.getElementById('game-answer').value.normalize('NFKC').trim().replace(/色$/,'');
 if(isCorrect(answer,model.answer))gameSuccess('验证成功！请指出图中的依据，再用自己的话解释。');
 else document.getElementById('game-feedback').textContent='还没有对上。读清当前条件，观察图形与单位，再试一次。';
}
