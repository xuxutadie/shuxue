const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
function database(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('请配置 DATABASE_URL 后启动在线版。');
  return new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}
async function migrate(pool) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}
async function transaction(pool, action) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await action(client); await client.query('COMMIT'); return result; }
  catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
function fail(status, message) { const err = new Error(message); err.status = status; throw err; }
function string(value, max = 100, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(400, '请检查填写内容及长度。');
  return value.trim();
}
module.exports = { database, migrate, transaction, fail, string };
