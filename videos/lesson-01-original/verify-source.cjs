// 核对数学条件、字幕边界和动效时序；不会改动平台数据。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));
const timing=read('timing.json'),motions=read('motion-map.json');
const equations=[
 {name:'教材原题',a:[3,20,134],b:[3,16,118],answer:[18,4]},
 {name:'比赛原题',a:[3,5,1060],b:[4,4,1200],answer:[220,80]},
 {name:'原创讲解题',a:[5,3,1490],b:[3,5,1310],answer:[220,130]}
];
for(const {a,b,answer} of equations){
 const det=a[0]*b[1]-a[1]*b[0];assert.notEqual(det,0);
 assert.deepEqual([(a[2]*b[1]-a[1]*b[2])/det,(a[0]*b[2]-a[2]*b[0])/det],answer);
}
for(const scene of timing.scenes){
 assert(scene.duration>0);
 for(const line of scene.lines){
  assert(line.start+line.duration<scene.duration);
  assert(fs.existsSync(path.join(__dirname,line.file)));
  for(const caption of line.captions){assert(caption.duration>0);assert(caption.start+caption.duration<=scene.duration);}
 }
}
for(let i=1;i<timing.captions.length;i++)assert(timing.captions[i].start>=timing.captions[i-1].end-.002);
for(const scene of motions)for(const event of scene.events){const end=event.time+(event.props.duration??.8)*(1+(event.props.repeat||0));assert(end<=scene.duration,scene.scene+'/'+event.subject+'动画超出片段');}
const challenge=fs.readFileSync(path.join(__dirname,'compositions/challenge.html'),'utf8');
assert(!challenge.includes('2.2元')&&!challenge.includes('1.3元')&&!challenge.includes('老师追问'));
console.log(JSON.stringify({math:'3题唯一解与原条件一致',scenes:timing.scenes.length,captions:timing.captions.length,motions:motions.reduce((sum,s)=>sum+s.events.length,0),duration:timing.duration,challenge:'完整题干且无答案或教师追问'},null,2));
