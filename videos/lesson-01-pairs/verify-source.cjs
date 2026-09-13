// 校对配套法的数学结果、字幕时间，以及学生画面中不应出现的文字。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname,read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const timing=read('timing.json'),script=read('script.json'),motions=read('motion-map.json');
for(const q of [{a:[3,20,134],b:[3,16,118],answer:[18,4]},
 {a:[3,5,1060],b:[4,4,1200],answer:[220,80]},
 {a:[4,4,64],b:[2,5,47],answer:[11,5]}]){
 const {a,b,answer}=q,det=a[0]*b[1]-a[1]*b[0];assert.notEqual(det,0);
 assert.deepEqual([(a[2]*b[1]-a[1]*b[2])/det,(a[0]*b[2]-a[2]*b[0])/det],answer);
}
assert.equal(3*11+6*5,63);
for(const s of timing.scenes){
 for(const l of s.lines){assert(l.start+l.duration<s.duration);for(const c of l.captions){assert(c.duration>0);assert(c.start+c.duration<s.duration);}}
 const html=fs.readFileSync(path.join(root,'compositions',s.id+'.html'),'utf8');
 assert.doesNotMatch(html,/依据|希望杯|比赛试卷|公倍数|整单×|复制[45]份/);
}
assert.doesNotMatch(JSON.stringify(script),/依据|希望杯|比赛试卷|公倍数|提供的/);
for(let i=1;i<timing.captions.length;i++)assert(timing.captions[i].start>=timing.captions[i-1].end-.002);
for(const s of motions)for(const e of s.events)assert(e.time+(e.props.duration??.8)*(1+(e.props.repeat||0))<s.duration);
const last=fs.readFileSync(path.join(root,'compositions/challenge.html'),'utf8');
assert.doesNotMatch(last,/63元|11元|老师追问/);
console.log(JSON.stringify({math:'全部题目核对通过',scenes:timing.scenes.length,duration:timing.duration,captions:timing.captions.length,studentCopy:'无出处、公倍数、多单复制或结尾答案'},null,2));
