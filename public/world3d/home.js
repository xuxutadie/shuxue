'use strict';
window.ThinkingHome=(()=>{
 let cleanup=null,generation=0;
 function dispose(){generation++;cleanup?.();cleanup=null;}
 function html(){return '<section class="home-shell" aria-label="探险家之家"><div id="home-loading" role="status">正在打开你的家……</div></section>';}
 function mount(root,world,options){dispose();const token=generation;import('./home-scene.mjs?v=20260922-valley1').then(m=>{if(token===generation)cleanup=m.mountHome(root,world,options);}).catch(()=>{if(token===generation)root.innerHTML='<section class="card"><h1>家园暂未打开</h1><p>请刷新重试。</p><a href="#world">返回小镇</a></section>';});}
 return {html,mount,dispose};
})();
