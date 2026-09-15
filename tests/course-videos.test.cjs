const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {lessons}=require('../server/content');
const {createApp}=require('../server/index');
function context(teacher=true){
 const element=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){}});
 const c=vm.createContext({console,URL,setTimeout,clearTimeout,setInterval,clearInterval,location:{origin:'http://127.0.0.1:8766',hash:''},document:{getElementById:element,addEventListener(){},body:element()},window:{addEventListener(){}}});
 for(const file of ['course-videos.js','teacher-flow.js','views.js','data-loader.js','app.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8').replace(/startSession\(\);\s*$/,''),c);
 c.materials=lessons(teacher);
 vm.runInContext(`LESSONS=materials;teacher=${teacher};user={id:'reader',name:'试读',role:teacher?'teacher':'student'};state={students:[],current:null,videos:{},dates:{}};`,c);
 return c;
}
test('12节课的默认视频、字幕、封面与章节都有对应交付文件',()=>{
 const c=context();const catalog=vm.runInContext('COURSE_VIDEOS',c);assert.equal(catalog.length,12);
 for(const v of catalog){
  const number=v.lessonId+1,version=[2,4,5,6,8,9,10,11,12].includes(number)?'v2':'v1';
  assert.ok(v.src.endsWith(`lesson-${String(number).padStart(2,'0')}-dopamine-${version}.mp4`));
  if(number>1){
   const material=c.materials[v.lessonId];
   assert.equal(material.videoGuide.question,material.detail.talkChallenge,'视频与上台任务需保持同一道完整题');
   const timing=JSON.parse(fs.readFileSync(`videos/course-series/lesson-${String(number).padStart(2,'0')}/timing.json`,'utf8'));
   assert.ok(Math.abs(v.duration-timing.duration)<.002,'网页章节需对应本次成片');
  }
  assert.ok(v.duration>200);assert.ok(v.chapters.length>=6);assert.equal(v.chapters[0].start,0);
  let previous=-1;for(const chapter of v.chapters){assert.ok(chapter.start>previous&&chapter.start<v.duration);previous=chapter.start;}
  for(const field of ['src','captions','poster']){assert.ok(v[field].startsWith('/media/lessons/'));assert.ok(fs.statSync(path.join('public',v[field])).size>100);}
  assert.match(fs.readFileSync(path.join('public',v.captions),'utf8'),/^WEBVTT/);
 }
});
test('没有学生时教师可看视频，学生不会收到视频末题的教师答案',()=>{
 const c=context(true);
 for(let i=0;i<12;i++){c.number=i;const html=vm.runInContext('lessonId=number;courseVideoPanel()',c);assert.match(html,/<video /);assert.match(html,/video-seek/);assert.match(html,/教师用：视频末尾/);}
 assert.ok(lessons(true).every(l=>l.videoGuide));assert.ok(lessons(false).every(l=>!('videoGuide' in l)));
 const student=context(false);assert.doesNotMatch(vm.runInContext('courseVideoPanel()',student),/教师用：|参考思路：/);
});
test('第11课在提交后测后显示播放器，教师备课不受学生状态影响',()=>{
 const c=context(false);vm.runInContext("lessonId=10;state.current='reader';state.students=[{id:'reader',exams:{}}]",c);
 assert.doesNotMatch(vm.runInContext('courseVideoPanel()',c),/<video /);
 vm.runInContext('state.students[0].exams.B={score:72}',c);assert.match(vm.runInContext('courseVideoPanel()',c),/<video /);
});
test('班级覆盖不混用默认片章节，清空或非法地址恢复默认视频',()=>{
 const c=context();vm.runInContext("state.videos[0]='https://example.com/custom.mp4'",c);
 let html=vm.runInContext('courseVideoPanel()',c);assert.match(html,/custom.mp4/);assert.doesNotMatch(html,/data-action="video-seek"/);assert.doesNotMatch(html,/教师用：视频末尾/);
 vm.runInContext("state.videos[0]='javascript:alert(1)'",c);html=vm.runInContext('courseVideoPanel()',c);assert.match(html,/lesson-01-dopamine-v1.mp4/);assert.doesNotMatch(html,/javascript:/);
 vm.runInContext("state.videos[0]=''",c);assert.match(vm.runInContext('courseVideoPanel()',c),/data-action="video-seek"/);
});
test('部署后的媒体支持分段读取与中文字幕，源稿与教师答案不可静态读取',async()=>{
 const server=createApp({query:async()=>({rows:[]})}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const r=await fetch(base+'/media/lessons/lesson-01-dopamine-v1.mp4',{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,206);assert.match(r.headers.get('content-type'),/video\/mp4/);assert.equal((await r.arrayBuffer()).byteLength,1024);
  const vtt=await fetch(base+'/media/lessons/lesson-01-dopamine-v1.vtt');assert.equal(vtt.status,200);assert.match(vtt.headers.get('content-type'),/text\/vtt/);
  for(const url of ['/server/video-guides.json','/videos/course-series/content.py','/media/lessons/SCRIPT.md'])assert.equal((await fetch(base+url)).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
