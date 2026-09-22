// 共用排版与时间轴，专题图示独立维护；真实语音长度决定每一步停留时间。
const fs=require('node:fs'),path=require('node:path'),figure=require('./figures.cjs');
const base=__dirname,C={ink:'#243047',cream:'#FFF9E9',blue:'#45C7FF',yellow:'#FFD43B',purple:'#B395FF',mint:'#62DDB5',coral:'#FF8666'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(x,y,v,size=34)=>`<text x="${x}" y="${y}" fill="${C.ink}" font-size="${size}" font-weight="600">${esc(v)}</text>`;
const box=(x,y,w,h,fill='white')=>`<rect x="${x+4}" y="${y+5}" width="${w}" height="${h}" rx="20" fill="${C.ink}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="${C.ink}" stroke-width="3"/>`;
// 按中英文实际宽度近似换行，禁止长算式挤出右侧推导卡片。
function split(v,max){let lines=[],line='',n=0;for(const char of v){const weight=/[\x20-\x7e]/.test(char)?.57:1;if(n+weight>max){lines.push(line);line='';n=0;}line+=char;n+=weight;}if(line)lines.push(line);return lines;}
const wrap=(x,y,v,size=34,max=27,gap=48)=>split(v,max).map((l,i)=>text(x,y+i*gap,l,size)).join('');
const stamp=n=>{const m=Math.round(n*1000);return `${String(Math.floor(m/3600000)).padStart(2,'0')}:${String(Math.floor(m/60000)%60).padStart(2,'0')}:${String(Math.floor(m/1000)%60).padStart(2,'0')}.${String(m%1000).padStart(3,'0')}`;};
const css=`@font-face{font-family:'Microsoft YaHei';src:local('Microsoft YaHei')}*{box-sizing:border-box}body{margin:0}.scene{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;background:${C.cream};color:${C.ink};font-family:'Microsoft YaHei',sans-serif;padding:36px 70px}.head{display:flex;justify-content:space-between;align-items:center;height:56px;font-size:27px;font-weight:700}.tag{padding:10px 22px;border:3px solid ${C.ink};border-radius:17px;background:${C.purple}}h1{font-size:56px;line-height:1.2;margin:25px 0 20px}.board{width:1780px;height:687px;display:block;overflow:visible}.subtitle{position:absolute;left:72px;right:72px;bottom:26px;min-height:103px;padding:16px 28px;background:${C.ink};color:white;border-radius:20px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:35px;line-height:1.45}.progress{position:absolute;bottom:0;left:0;width:1920px;height:8px;background:${C.coral};transform-origin:left}.dot{display:inline-block;width:13px;height:13px;border-radius:50%;margin:0 5px;border:2px solid ${C.ink}}.active{background:${C.ink}}`;
function build(root,drawFigure=figure){
 const l=JSON.parse(fs.readFileSync(path.join(root,'lesson.json'),'utf8')),scenes=l.scenes,voice=JSON.parse(fs.readFileSync(path.join(root,'voice-meta.json'),'utf8'));
 let duration=0,captions=[],maps=[];
 fs.mkdirSync(path.join(root,'compositions'),{recursive:true});
 for(const s of scenes){
  s.start=duration;let cursor=.65,code='',events=[];
  s.lines=s.lines.map((line,index)=>{
   const a=voice.find(v=>v.scene===s.id&&v.index===index);if(!a)throw Error('缺配音');
   const row={...line,...a,start:+cursor.toFixed(6)};
   const bounds=fs.readFileSync(path.join(root,a.file.replace('.mp3','.jsonl')),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(b=>b.type==='SentenceBoundary');
   row.captions=bounds.flatMap((b,j)=>{const start=b.offset/1e7,end=Math.min(a.duration,start+b.duration/1e7+.1,bounds[j+1]?bounds[j+1].offset/1e7:Infinity),pieces=split(b.text,48);return pieces.map((t,k)=>({start:row.start+start+(end-start)*k/pieces.length,duration:(end-start)/pieces.length,text:t}));});
   for(const c of row.captions)captions.push({start:duration+c.start,end:duration+c.start+c.duration,text:c.text});
   cursor+=a.duration+.6+(line.pause||0);return row;
  });
  s.duration=Math.ceil((cursor+.8)*24)/24;duration+=s.duration;
  const id=n=>`${s.id}-${n}`,g=(n,html)=>`<g id="${id(n)}">${html}</g>`,lineAt=(n,off=0)=>s.lines[Math.min(n,s.lines.length-1)].start+off;
  function move(n,props,cue,off=0){const time=lineAt(cue,off);if(time+(props.duration||.85)>s.duration)throw Error('动效超出章节 '+s.id+' '+n);code+=`tl.to('#${id(n)}',${JSON.stringify({duration:.85,ease:'power2.inOut',...props})},${time});`;events.push({subject:n,time,props});}
  function show(n,cue,off=0,from={y:24}){code+=`gsap.set('#${id(n)}',${JSON.stringify({opacity:0,...from})});`;move(n,{opacity:1,x:0,y:0,scaleX:1,rotation:0},cue,off);}
  function pulse(n,cue,off=0){move(n,{scale:1.035,transformOrigin:'50% 50%',duration:.4,yoyo:true,repeat:1},cue,off);}
  const svgPath=(n,d,col=C.ink,w=4)=>g(n,`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`);
  let art='';
  if(['question','challenge'].includes(s.kind)){
   const lines=split(s.data.stem,40);if(lines.length>9)throw Error('题干过长 '+l.number+s.id);
   art=box(25,20,1700,Math.max(405,lines.length*59+ seventy()),'white')+lines.map((v,i)=>text(65,92+i*59,v,40)).join('');
   art+=g('prompt',box( sixty(),565,1620,90,s.kind==='challenge'?C.mint:C.yellow)+text(90,624,s.kind==='challenge'?'暂停视频，写草稿、画图，准备好后上台讲解。':'先读完整条件，圈出已知与所求，再开始分析。',37));
   show('prompt',0,1,{x:-55});
  }else{
   art=box(10,12,980,650,'white')+drawFigure(s,{C,text,box,g,show,move,pulse,svgPath,lineAt,wrap});
   s.notes.forEach((v,i)=>{const n='note'+i,y=35+i*153,lines=split(v,19);art+=g(n,box(1040,y,680,125,[C.yellow,C.blue,C.purple,C.mint][i%4])+lines.map((t,j)=>text(1065,y+49+j*44,t,33)).join(''));show(n,Math.min(i,s.lines.length-1),1,{x:55});});
  }
  code+=`tl.fromTo('#${id('heading')}',{opacity:0,x:-35},{opacity:1,x:0,duration:.6},0);tl.fromTo('#${id('progress')}',{scaleX:0},{scaleX:1,duration:${s.duration},ease:'none'},0);`;
  const subs=s.lines.flatMap(a=>a.captions).map((c,i)=>`<div class="clip subtitle" id="${id('cap'+i)}" data-start="${c.start}" data-duration="${c.duration}" data-track-index="5">${esc(c.text)}</div>`).join('');
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><template><style>${css}</style><div id="${s.id}" data-composition-id="${s.id}" data-width="1920" data-height="1080" data-duration="${s.duration}"><div class="scene"><div class="head"><span class="tag">第${l.number}课 · ${s.kind==='challenge'?'小老师讲堂':s.kind==='question'?'先读完整题目':'跟着图形想一想'}</span><span>思维实验室 · 把数学讲明白</span><span>${scenes.map((_,j)=>`<i class="dot ${j<=scenes.indexOf(s)?'active':''}"></i>`).join('')}</span></div><h1 id="${id('heading')}">${s.title}</h1><svg class="board" viewBox="0 0 1760 680" role="img" aria-label="${s.title}">${art}</svg>${subs}<div class="progress" id="${id('progress')}"></div></div></div><script>{const tl=gsap.timeline({paused:true});${code}window.__timelines['${s.id}']=tl;}</script></template></body></html>`;
  fs.writeFileSync(path.join(root,'compositions',s.id+'.html'),html);maps.push({scene:s.id,start:s.start,duration:s.duration,events});
 }
 function html(chunk,name){const start=chunk[0].start,dur=chunk.reduce((v,s)=>v+s.duration,0);return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${l.title}</title><style>body{margin:0;background:${C.cream}}#${name}{position:relative;width:1920px;height:1080px;overflow:hidden}.scene-slot{position:absolute;inset:0;width:1920px;height:1080px}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div id="${name}" data-composition-id="${name}" data-width="1920" data-height="1080" data-duration="${dur}">${chunk.map(s=>`<div class="clip scene-slot" id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${(s.start-start).toFixed(6)}" data-duration="${s.duration}" data-track-index="0" data-width="1920" data-height="1080"></div>`).join('')}${chunk.flatMap(s=>s.lines.map((a,i)=>`<audio id="audio-${s.id}-${i}" src="${a.file}" data-start="${(s.start-start+a.start).toFixed(6)}" data-duration="${a.duration}" data-track-index="10" data-volume="1"></audio>`)).join('')}</div><script>window.__timelines['${name}']=gsap.timeline({paused:true});</script></body></html>`;}
 fs.writeFileSync(path.join(root,'index.html'),html(scenes,'main'));
 fs.mkdirSync(path.join(root,'segments'),{recursive:true});let chunks=[],chunk=[],len=0;
 for(const s of scenes){if(chunk.length&&len+s.duration>225){chunks.push(chunk);chunk=[];len=0;}chunk.push(s);len+=s.duration;}if(chunk.length)chunks.push(chunk);
 const segments=chunks.map((ch,i)=>{const name=`part-${i+1}`;fs.writeFileSync(path.join(root,'segments',name+'.html'),html(ch,name));return {name,start:ch[0].start,duration:ch.reduce((v,s)=>v+s.duration,0)};});
 fs.writeFileSync(path.join(root,'segments.json'),JSON.stringify(segments,null,2));
 fs.writeFileSync(path.join(root,'timing.json'),JSON.stringify({duration,scenes,captions},null,2));
 fs.writeFileSync(path.join(root,'motion-map.json'),JSON.stringify(maps,null,2));
 fs.writeFileSync(path.join(root,'captions.vtt'),'WEBVTT\n\n'+captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
 fs.writeFileSync(path.join(root,'SCRIPT.md'),`# 第${l.number}课 ${l.title}\n\n`+scenes.map(s=>`## ${s.title}\n\n${s.lines.map(a=>a.text).join('\n\n')}`).join('\n\n')+`\n\n## 教师用：末尾独立讲解题答案\n\n${l.challengeAnswer}\n`);
 fs.writeFileSync(path.join(root,'STORYBOARD.md'),scenes.map((s,i)=>`## Frame ${i+1}\n\nstatus: animated\nsrc: compositions/${s.id}.html\nstart: ${s.start}\nduration: ${s.duration}\n\n${s.title}：dynamic-content-sequencing、svg-path-draw、stat-bars-and-fills，图示${s.kind}/${s.data.phase||'read'}随旁白定位。\n`).join('\n'));
 console.log(JSON.stringify({lesson:l.number,seconds:duration,scenes:scenes.length,motions:maps.reduce((v,s)=>v+s.events.length,0)}));
}
module.exports=build;
if(require.main===module)for(const folder of fs.readdirSync(base).filter(f=>/^lesson-\d+$/.test(f)))if(!process.argv[2]||folder===process.argv[2])build(path.join(base,folder));
function sixty(){return 60;}function seventy(){return 70;}
