/* 页面间复用当前账号的数据；只在内存中保存，退出登录即清空。 */
function createLearningDataSource(request, { now = Date.now, maxAge = 30000 } = {}) {
 let owner = '', session = 0, revision = 0, content = null, records = null;
 function reset() {
  owner = ''; session++; revision++; content = null; records = null;
 }
 function invalidate() { revision++; records = null; }
 function entry(url) {
  const item = { promise: null, expires: Infinity };
  item.promise = Promise.resolve().then(() => request(url)).then(value => {
   item.expires = now() + maxAge;
   return value;
  });
  return item;
 }
 async function load(user, { fresh = false } = {}) {
  const key = user.id + ':' + user.role;
  if (owner !== key) { reset(); owner = key; }
  if (fresh) invalidate();
  const startedSession = session, startedRevision = revision;
  // 课程和档案独立，请求并行；连点导航时共用正在进行的请求。
  if (!content) content = entry('/api/content');
  if (!records || now() >= records.expires) {
   records = entry(user.role === 'teacher' ? '/api/teacher/overview' : '/api/students/' + user.id);
  }
  const requestedContent = content, requestedRecords = records;
  let values;
  try { values = await Promise.all([requestedContent.promise, requestedRecords.promise]); }
  catch (error) {
   // 失败不永久缓存，下一次点击可以重新连接。
   if (content === requestedContent) content = null;
   if (records === requestedRecords) records = null;
   throw error;
  }
  if (session !== startedSession) {
   const error = new Error('账号已切换，本次加载已取消。');
   error.obsolete = true; throw error;
  }
  // 请求期间有保存操作时，旧档案不得覆盖刚保存的记录。
  if (revision !== startedRevision) return load(user);
  return { content: values[0], records: values[1] };
 }
 return { load, invalidate, reset };
}
if (typeof module !== 'undefined') module.exports = { createLearningDataSource };
