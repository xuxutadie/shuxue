"""从旧版绘图工具生成配套版构建器；每次都从原文件读取，避免重复插入。"""
from pathlib import Path

root=Path(__file__).resolve().parent
source=(root.parent/'lesson-01-original'/'build.cjs').read_text(encoding='utf-8')
source=source.replace("blue:'#75C9FF',yellow:'#FFDB58',purple:'#C6B1FF',mint:'#A8E4CA',coral:'#FF9B77'", "blue:'#45C7FF',yellow:'#FFD43B',purple:'#B395FF',mint:'#62DDB5',coral:'#FF8666'")
start=source.index('const renderers=')
end=source.index('\nconst css=',start)
source=source[:start]+(root/'pair-scenes.inc.js').read_text(encoding='utf-8')+"\nconst renderers={read:()=>readScene(),pair:pairScene,share:shareScene,back:backScene,contest:()=>readScene(true),bundle:bundleScene,usebundle:useBundleScene,prices:pricesScene,verify:pairVerifyScene,challenge:pairChallengeScene};"+source[end:]
# 学生画面没有资料出处；原始来源仅保留在教师交付说明。
source=source.replace('<div class="source">${source}</div>','')
source=source.replace("contest?'两种数量都变了：还不能直接抵消。'", "contest?'先找容易入手的条件：4块橡皮与4支铅笔。'")
source=source.replace('原题精讲','配套讲解')
source=source.replace("scene.duration=+(cursor+.7).toFixed(3);duration+=scene.duration;", "scene.duration=Math.ceil((cursor+.7)*24)/24;duration+=scene.duration;")
# 短于240秒的分段可以边渲染边编码，减少临时磁盘占用。
anchor="fs.writeFileSync(path.join(root,'timing.json')"
pos=source.index(anchor)
source=source[:pos]+'''
fs.mkdirSync(path.join(root,'segments'),{recursive:true});
let segments=[],part=[],partDuration=0;
for(const s of scenes){if(part.length&&partDuration+s.duration>235){segments.push(part);part=[];partDuration=0;}part.push(s);partDuration+=s.duration;}
if(part.length)segments.push(part);
const segmentMeta=[];
for(const [i,chunk] of segments.entries()){
 const base=chunk[0].start,len=chunk.reduce((v,s)=>v+s.duration,0);
 const hosts=chunk.map(s=>`<div class="clip scene-slot" id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${(s.start-base).toFixed(6)}" data-duration="${s.duration}" data-track-index="0" data-width="1920" data-height="1080"></div>`).join('');
 const audio=chunk.flatMap(s=>s.lines.map((l,j)=>`<audio id="part-${i}-${s.id}-${j}" src="${l.file}" data-start="${(s.start-base+l.start).toFixed(6)}" data-duration="${l.duration}" data-track-index="10" data-volume="1"></audio>`)).join('');
 const name=`part-${i+1}`;
 fs.writeFileSync(path.join(root,'segments',name+'.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>body{margin:0;background:${C.cream}}#${name}{position:relative;width:1920px;height:1080px;overflow:hidden}.scene-slot{position:absolute;inset:0;width:1920px;height:1080px}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div id="${name}" data-composition-id="${name}" data-width="1920" data-height="1080" data-duration="${len}">${hosts}${audio}</div><script>window.__timelines['${name}']=gsap.timeline({paused:true});</script></body></html>`);
 segmentMeta.push({name,duration:len,start:base});
}
fs.writeFileSync(path.join(root,'segments.json'),JSON.stringify(segmentMeta,null,2));
''' +source[pos:]
(root/'build.cjs').write_text(source,encoding='utf-8')
print('已写入鲜亮配色与配套动画。')
