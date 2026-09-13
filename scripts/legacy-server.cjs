/* 旧版仅用于本机查阅、导出。白名单防止公开新版数据库与凭据文件。 */
const express = require('express');
const path = require('node:path');
const app = express(), root = path.resolve(__dirname, '..');
const allowed = new Set(['index.html','styles.css','data.js','exam-legacy.js','exams.js','core.js','games.js','app.js']);
app.get('/{*file}', (req,res) => {
 const name = req.path === '/' ? 'index.html' : req.path.slice(1);
 if (!allowed.has(name)) return res.status(404).send('页面不存在。');
 res.sendFile(path.join(root, name));
});
app.listen(8765,'127.0.0.1',()=>console.log('旧版本机查阅入口：http://127.0.0.1:8765（在线版为8766）'));
