const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server/index');

test('只有 3D 页面允许读取 GLB 内嵌的本地贴图，普通教学页面保持原策略',async()=>{
  const server=createApp({query(){throw new Error('静态资源不应访问数据库');}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const normal=await fetch(base+'/');
    const preview=await fetch(base+'/world3d/character-preview.html');
    assert.equal(normal.status,200);assert.equal(preview.status,200);
    assert.doesNotMatch(normal.headers.get('content-security-policy'),/blob:/);
    const policy=preview.headers.get('content-security-policy');
    assert.match(policy,/connect-src 'self' blob:/);
    assert.match(policy,/img-src 'self' data: blob:/);
    assert.match(policy,/script-src 'self';/);
    const model=await fetch(base+'/world3d/assets/explorer-rigged-v1.glb');
    assert.equal(model.status,200);
    const bytes=Buffer.from(await model.arrayBuffer());
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
    assert.ok(gltf.skins?.length,'新主角必须包含骨骼');
    for(const name of ['Idle','Walk'])assert.ok(gltf.animations.some(clip=>clip.name===name),`缺少 ${name} 动作`);
    assert.ok(bytes.length<5*1024*1024,'游戏主角应使用压缩后的模型');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
