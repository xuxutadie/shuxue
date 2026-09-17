const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function harness(request){
 const listeners={},body={innerHTML:''},message={textContent:''},fieldset={disabled:false};
 const form={isConnected:true,elements:{title:{value:'变式测试'},dueAt:{value:''},text0:{value:'一本书和一支笔共12元，书8元，笔多少钱？'},answer0:{value:'4'},explain0:{value:'总价减去书的价格。'},unit0:{value:'元'}},querySelectorAll:s=>s==='[data-hw-question]'?[{}]:[{value:'student'}],querySelector:()=>fieldset};
 const root={isConnected:true,dataset:{id:'homework'},querySelector:s=>s==='[data-homework-body]'?body:s==='.homework-message'?message:s==='[name=reviewed]'?{checked:true}:form};
 const ctx=vm.createContext({console,Date,Set,Uint16Array,teacher:true,user:{id:'teacher'},previewStudentId:null,overview:{students:[],classes:[]},location:{hash:'#homework/homework'},
  document:{getElementById:()=>root,addEventListener:(name,fn)=>listeners[name]=fn},api:request,toast(){},esc:v=>String(v??'').replace(/</g,'&lt;')});
 for(const f of ['homework-text.js','homework.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx);
 return {ctx,root,body,message,listeners,load:()=>vm.runInContext('homeworkUI.load()',ctx)};
}
const draft={id:'homework',title:'变式测试',revision:0,status:'draft',studentIds:['student'],source:{kind:'A',topic:'消去',text:'原题'},questions:[{text:'一本书和一支笔共12元，书8元，笔多少钱？',answer:'4',explain:'总价减书价',unit:'元'}]};
test('发布响应只有摘要时先载入报告，不能误渲染没有学生明细的摘要',async()=>{
 const calls=[];let published=false;
 const h=harness(async(url,options={})=>{calls.push([url,options.method||'GET']);if(url.endsWith('/publish')){published=true;return {...draft,status:'published',revision:2};}if(options.method==='PUT')return {...draft,revision:1};return published?{...draft,status:'published',questionCount:1,students:[]}:draft;});
 await h.load();const button={disabled:false,dataset:{homeworkAction:'publish'},closest:()=>h.root};
 await h.listeners.click({target:{closest:()=>button}});
 assert.match(h.body.innerHTML,/学生训练情况/);assert.match(h.message.textContent,/已发布/);assert.doesNotMatch(h.message.textContent,/undefined|Cannot/);
 assert.deepEqual(calls.map(x=>x[1]),['GET','PUT','POST','GET']);
});
test('切换账号后不接收上一教师的迟到作业详情',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));const pending=h.load();vm.runInContext("user={id:'another'}",h.ctx);resolve(draft);await pending;assert.equal(h.body.innerHTML,'');
});
test('差异标记完整数字，不把未变化的乘号和条件整段标红',()=>{
 const {homeworkSegments}=require('../public/homework-text');
 const result=homeworkSegments('计算：3.6×25＋3.6×75。','计算：4.8×25＋4.8×75。');
 assert.deepEqual(result.filter(s=>s.changed).map(s=>s.text),['4.8','4.8']);
 assert.equal(result.map(s=>s.text).join(''),'计算：4.8×25＋4.8×75。');
});
