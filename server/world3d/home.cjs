const {fail}=require('../db');
const defaults={boy:{wall:'sky',rug:'wave',ornament:'planet'},girl:{wall:'lavender',rug:'flower',ornament:'flowers'}};
const choices={wall:['sky','lavender','mint','cream'],rug:['wave','flower','stars','sun'],ornament:['planet','flowers','books','crystal']};
function view(state){
 return Object.fromEntries(['boy','girl'].map(id=>{
  const saved=state.homes?.[id]||{},home={...defaults[id],revision:Number.isSafeInteger(saved.revision)?saved.revision:0};
  for(const field of Object.keys(choices))if(choices[field].includes(saved[field]))home[field]=saved[field];
  return [id,home];
 }));
}
function decorate(state,body){
 if(!body||!['boy','girl'].includes(body.character))fail(400,'请选择有效的家园。');
 for(const field of Object.keys(choices))if(!choices[field].includes(body[field]))fail(400,'请选择提供的装饰样式。');
 const current=view(state)[body.character];
 if(body.revision!==current.revision)fail(409,'另一页面已修改这间家，请重新打开家园后再布置。');
 const home={wall:body.wall,rug:body.rug,ornament:body.ornament,revision:current.revision+1};
 // 与学习记录分开，男生和女生的布置互不覆盖。
 state.homes={...state.homes,[body.character]:home};
 return {character:body.character,home};
}
module.exports={view,decorate};
