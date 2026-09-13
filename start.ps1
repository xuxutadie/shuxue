$ErrorActionPreference = 'Stop'
# 旧版使用文件白名单，防止新版数据库文件被静态服务器公开。
Set-Location -LiteralPath $PSScriptRoot
Write-Host '旧版本机查阅入口：http://127.0.0.1:8765；在线版请运行 start-online.ps1。'
Write-Host '保持此窗口运行；按 Ctrl+C 停止。'
node scripts/legacy-server.cjs
