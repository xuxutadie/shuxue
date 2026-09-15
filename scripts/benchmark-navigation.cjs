/* 在相同模拟网络延迟下比较旧版与当前页面代码，不连接生产数据库。 */
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { lessons, bank } = require('../server/content');
const latency = 250;
async function measure(label, appSource) {
 const nodes = new Map(), calls = [];
 const element = id => {
  if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: false, style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, focus(){}, querySelector(){return null;} });
  return nodes.get(id);
 };
 const context = vm.createContext({ console, URL, setTimeout, clearTimeout, setInterval, clearInterval,
  document: { getElementById: element, addEventListener(){}, body: element('body') },
  window: { addEventListener(){} }, location: { hash: '#courses' } });
 for (const file of ['course-videos.js','figures.js','lesson-lab.js','games.js','teacher-flow.js','views.js','data-loader.js']) {
  vm.runInContext(fs.readFileSync('public/' + file, 'utf8'), context);
 }
 vm.runInContext(appSource.replace(/^startSession\(\);/m, ''), context);
 context.material = { lessons: lessons(true), flow: bank.flow, testFlow: bank.testFlow };
 context.read = async url => {
  calls.push(url); await new Promise(resolve => setTimeout(resolve, latency));
  return url === '/api/content' ? context.material : { classes: [], students: [] };
 };
 vm.runInContext("user={id:'benchmark',role:'teacher',name:'测试老师'};teacher=true;api=read;", context);
 const results = [];
 for (const hash of ['#courses','#lesson/0/learn','#lesson/0/guide','#lesson/0/talk']) {
  context.location.hash = hash; const before = calls.length, start = performance.now();
  await vm.runInContext('render()', context);
  if (!element('main').innerHTML.includes('page-head')) throw new Error('页面未正常渲染：' + hash);
  results.push({ page: hash, ms: Math.round(performance.now() - start), requests: calls.length - before });
 }
 return { label, simulatedRequestLatencyMs: latency, results };
}
(async () => {
 const baseline = execFileSync('git',['show','HEAD:public/app.js'],{encoding:'utf8',windowsHide:true});
 console.log(JSON.stringify(await measure('HEAD（修复前）',baseline),null,2));
 console.log(JSON.stringify(await measure('工作区（修复后）',fs.readFileSync('public/app.js','utf8')),null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
