const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fail } = require('./db');

function encryptionKey() {
 const value = process.env.AI_ENCRYPTION_KEY;
 if (value) {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(503, 'AI 加密配置不正确，请联系管理员。');
  return key;
 }
 if (process.env.NODE_ENV === 'production') fail(503, '请管理员先配置 AI_ENCRYPTION_KEY，再保存接口密钥。');
 const directory = path.join(__dirname, '..', '.runtime'), file = path.join(directory, 'ai-encryption.key');
 fs.mkdirSync(directory, { recursive: true });
 if (!fs.existsSync(file)) {
  try { fs.writeFileSync(file, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
 }
 const key = fs.readFileSync(file);
 if (key.length !== 32) fail(503, '本机 AI 加密配置不正确。');
 return key;
}
function encryptionReady() { try { encryptionKey(); return true; } catch { return false; } }
function encrypt(secret) {
 const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), nonce);
 const encoded = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
 return [nonce, cipher.getAuthTag(), encoded].map(x => x.toString('base64')).join('.');
}
function decrypt(value) {
 try {
  const [nonce, tag, encoded] = value.split('.').map(x => Buffer.from(x, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), nonce);
  decipher.setAuthTag(tag); return Buffer.concat([decipher.update(encoded), decipher.final()]).toString('utf8');
 } catch { fail(503, '无法读取已保存的 AI 密钥，请老师重新保存配置。'); }
}
function publicAddress(address) {
 if (net.isIP(address) === 4) {
  const [a,b,c] = address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19].includes(b)||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
 }
 // 只接受全局单播IPv6，排除映射地址、链路本地、文档网段及隧道保留网段。
 const a=address.toLowerCase(), groups=a.split(':'), first=parseInt(groups[0],16), second=parseInt(groups[1]||'0',16);
 return net.isIP(address)===6 && first>=0x2000 && first<=0x3fff && first!==0x2002 && !(first===0x2001&&(second<=0x1ff||second===0xdb8));
}
function endpointUrl(value) {
 let url;
 try { url=new URL(value); } catch { fail(400,'请填写完整的 HTTPS 接口地址。'); }
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443')fail(400,'接口只支持无附加参数的 HTTPS 公共地址（443端口）。');
 if(net.isIP(url.hostname.replace(/^\[|\]$/g,''))||!url.hostname.includes('.')||/\.(?:local|internal|localhost|test|invalid)$/i.test(url.hostname))fail(400,'请使用 AI 服务商的公共域名。');
 if(!url.pathname.endsWith('/chat/completions'))url.pathname=url.pathname.replace(/\/$/,'')+'/chat/completions';
 return url;
}
async function requestCompletion(config, body) {
 const url = endpointUrl(config.endpoint);
 let addresses,dnsTimer;
 try { addresses=await Promise.race([dns.lookup(url.hostname,{all:true}),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('dns timeout')),5000);dnsTimer.unref();})]); }
 catch { fail(502,'AI 接口域名暂时无法连接，请检查地址。'); }
 finally { clearTimeout(dnsTimer); }
 if(!addresses.length||addresses.some(x=>!publicAddress(x.address)))fail(400,'AI 接口不能指向本机或内部网络。');
 // 固定已验证的解析结果，防止连接时二次解析转向内部地址；不跟随重定向。
 const selected=addresses.find(x=>x.family===4)||addresses[0], payload=JSON.stringify(body), secret=decrypt(config.key_cipher);
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret,'Content-Length':Buffer.byteLength(payload)},lookup:(hostname,options,callback)=>options.all?callback(null,[selected]):callback(null,selected.address,selected.family)},response=>{
   let size=0;const chunks=[];
   response.on('data',chunk=>{size+=chunk.length;if(size>65536){request.destroy();reject(Object.assign(new Error('AI 返回内容过长，请换用适合简短出题的模型。'),{status:502}));}else chunks.push(chunk);});
   response.on('end',()=>{
    if(response.statusCode!==200)return reject(Object.assign(new Error(response.statusCode===401||response.statusCode===403?'AI 密钥或模型权限不可用，请老师检查配置。':response.statusCode===429?'AI 服务商额度或频率受限，请稍后重试。':'AI 服务未成功响应，请老师检查接口和模型设置。'),{status:502}));
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('AI 返回格式不正确，请重试。'),{status:502})); }
   });
   response.on('error',()=>reject(Object.assign(new Error('AI 连接中断，请稍后重试。'),{status:502})));
  });
  const timeout=setTimeout(()=>request.destroy(new Error('timeout')),20000);timeout.unref();
  request.on('close',()=>clearTimeout(timeout));
  request.on('error',()=>reject(Object.assign(new Error('AI 连接超时或失败，请稍后重试。'),{status:502})));
  request.end(payload);
 });
}
async function requestPlan(config, lesson, difficulty, count, transport=requestCompletion) {
 const topics=['消去与配套','等量关系与整体求值','周期与余数','因数与质数','公因数与公倍数','图形分割补形','格点面积与镜像遮挡','同向追赶','增长与消耗','枚举与平均数','错因复盘','混合选法'];
 const result=await transport(config,{model:config.model,stream:false,max_tokens:400,messages:[
  {role:'system',content:'你是五年级数学出题参数规划员。只输出JSON对象，格式为{"seeds":[正整数]}，不输出题干、答案、解法、注释或Markdown。整数必须在1到1000000000之间，各不相同。题干和逐步提示将由系统的经审核模板构造。'},
  {role:'user',content:`知识点课程序号${lesson+1}：${topics[lesson]}，难度${difficulty}/3，需要${count}个不同出题参数。请求标识${crypto.randomUUID()}。只返回JSON。`}
 ]});
 let value;
 try { const text=result?.choices?.[0]?.message?.content;if(typeof text!=='string'||text.length>4096)throw new Error();value=JSON.parse(text); }catch{fail(502,'AI 未返回有效出题参数，请重试或更换模型。');}
 if(!value||typeof value!=='object'||!Array.isArray(value.seeds)||value.seeds.length!==count||new Set(value.seeds).size!==count||value.seeds.some(x=>!Number.isInteger(x)||x<1||x>1000000000))fail(502,'AI 出题参数未通过检查，请重试。');
 // 严格取整数列表；即使模型额外返回答案或指令，也绝不传给学生。
 return value.seeds;
}
module.exports={encryptionReady,encrypt,decrypt,endpointUrl,publicAddress,requestCompletion,requestPlan};
