// 主站只加载轻量入口；Three.js 和模型由游戏页面按需加载。
function gameWorldEntry(){return `<section class="panel world-entry"><span class="tag">新区域 · 3D 数学探险</span><h2>走进小镇，修复星光营地</h2><p>拜访六位朋友，完成数学任务；铺桥、装车、调信号、找线索、量水、规划路线。</p><a class="start-teaching" href="#world3d">进入 3D 游戏世界 →</a></section>`;}
function gameWorldPage(view=''){
 const readonly=!!previewStudentId||teacher&&view==='student',id=readonly?pupil()?.id:teacher?'demo':user.id;
 if(!id)return title('3D 游戏世界','请先选择学生，或进入教师试玩。')+'<a href="#world3d">教师试玩 →</a>';
 const src='/world3d/'+(id==='demo'?'':'?student='+encodeURIComponent(id))+(readonly?'#report':'#world');
 // 替换中转路由，浏览器后退时不会再次自动跳进游戏。
 location.replace(src);
 return `<p role="status">正在进入游戏… <a href="${src}">直接进入</a></p>`;
}
