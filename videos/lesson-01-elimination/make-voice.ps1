$ErrorActionPreference = 'Stop'
# 使用系统已有的中文语音，逐句保存，让字幕和动画跟随真实录音长度。
Add-Type -AssemblyName System.Speech
$videoRoot = $PSScriptRoot
$voiceDir = Join-Path $videoRoot 'assets/voice'
New-Item -ItemType Directory -Force -Path $voiceDir | Out-Null
$scenes = Get-Content (Join-Path $videoRoot 'script.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Huihui Desktop')
$speaker.Rate = -1
$speaker.Volume = 100
$meta = @()
foreach ($scene in $scenes) {
  $lineIndex = 0
  foreach ($line in $scene.lines) {
    $name = '{0}-{1:d2}.wav' -f $scene.id,$lineIndex
    $target = Join-Path $voiceDir $name
    $speaker.SetOutputToWaveFile($target)
    $speaker.Speak($line.text)
    $speaker.SetOutputToNull()
    $duration = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $target
    if ($LASTEXITCODE -ne 0) {throw "无法检查语音：$name"}
    $meta += [pscustomobject]@{scene=$scene.id;index=$lineIndex;file="assets/voice/$name";duration=[double]::Parse($duration,[cultureinfo]::InvariantCulture)}
    $lineIndex++
  }
}
$speaker.Dispose()
$meta | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $videoRoot 'voice-meta.json') -Encoding UTF8
Write-Output "已生成 $($meta.Count) 段中文语音。"
