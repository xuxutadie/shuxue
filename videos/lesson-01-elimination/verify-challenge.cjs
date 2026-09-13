// 独立枚举单价，复核题目唯一性，并确认仅改动第一课三题。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname;
const lessons=file=>vm.runInNewContext(fs.readFileSync(file,'utf8')+';JSON.parse(JSON.stringify(LESSONS))');
const old=lessons(path.join(root,'versions/a-before-challenge/data.js'));
const current=lessons(path.join(root,'../../data.js'));
assert.equal(JSON.stringify(old.slice(1)),JSON.stringify(current.slice(1)));
assert.equal(JSON.stringify({...old[0],practice:[]}),JSON.stringify({...current[0],practice:[]}));
const equations=[{a:[3,2,24],b:[6,7,57],expected:[6,3]}, {a:[3,4,37],b:[3,7,49],expected:[7,4]}, {a:[2,3,29],b:[4,7,61],expected:[10,3]}, {a:[3,2,54],b:[2,3,51],expected:[12,9]}];
for(const q of equations){const found=[];for(let x=1;x<=60;x++)for(let y=1;y<=60;y++)if(q.a[0]*x+q.a[1]*y===q.a[2]&&q.b[0]*x+q.b[1]*y===q.b[2])found.push([x,y]);assert.deepEqual(found,[q.expected]);assert.notEqual(q.a[0]*q.b[1]-q.a[1]*q.b[0],0);}
assert.deepEqual(Array.from(current[0].practice,q=>q.answer),['34','10','21']);
const script=JSON.parse(fs.readFileSync(path.join(root,'script.json')));
const oldScript=JSON.parse(fs.readFileSync(path.join(root,'versions/a-before-challenge/script.json')));
assert.deepEqual(script.slice(0,5),oldScript.slice(0,5));
assert.doesNotMatch(fs.readFileSync(path.join(root,'compositions/teach.html'),'utf8'),/老师追问|每支笔是2元|先配成一样多/);
console.log('验证通过：4道题条件一致且单价唯一；仅第一课3题变化；视频前5段讲稿不变；挑战段无旧解法或追问。');
