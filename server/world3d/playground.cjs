const {fail}=require('../db');
const adventure=require('./adventure.cjs');
const rides=['carousel','wheel','surf','swing','trampoline'];
const price=20;
function wallet(s,{demo=false}={}){
 const spent=s.playground?.spent||0;
 const earned=adventure.earned(s)+(demo?120:0);
 return {balance:Math.max(0,earned-spent),spent,price,demo};
}
// 使用原档案的行锁保存扣款；版本校验和请求编号防止双击、重试及多标签重复消费。
function purchase(s,body,options={}){
 const {rideId,requestId,expectedSpent}=body;
 if(!rides.includes(rideId)||typeof requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(requestId)||!Number.isSafeInteger(expectedSpent)||expectedSpent<0)fail(400,'游玩请求不正确，请刷新重试。');
 const last=s.playground?.last;
 if(last?.requestId===requestId){
  if(last.rideId!==rideId||last.expectedSpent!==expectedSpent)fail(409,'游玩请求已变化，请刷新重试。');
  return wallet(s,options);
 }
 const current=wallet(s,options);
 if(current.spent!==expectedSpent)fail(409,'星光余额已更新，请刷新页面后再试。');
 if(current.balance<price)fail(400,'星光不足 20，先完成数学任务获得星光吧。');
 s.playground={spent:current.spent+price,last:{requestId,rideId,expectedSpent}};
 return wallet(s,options);
}
module.exports={wallet,purchase};
