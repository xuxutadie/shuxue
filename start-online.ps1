$ErrorActionPreference = 'Stop'
# 保持与旧版不同端口；旧浏览器记录仍可通过原本地版导出。
Set-Location -LiteralPath $PSScriptRoot
Write-Host '在线教学版：http://127.0.0.1:8766'
Write-Host '保持窗口运行。按 Ctrl+C 可停止网站服务。'
if ($env:DATABASE_URL) {
    node server/index.js
} elseif (Test-Path -LiteralPath '.runtime/postgres/pgsql/bin/pg_ctl.exe') {
    node scripts/local-runtime.cjs
} else {
    throw '请先配置 PostgreSQL 的 DATABASE_URL，或按在线版说明完成本机预览环境准备。'
}
