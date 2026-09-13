---
workflow: general-video
flow: automation
storyboard: no
message: 相同部分可以成对消去，多付的钱对应多出的商品。
audience: 五年级学生
destination: 数学教学平台和课堂投屏
aspect: 1920x1080
language: zh-CN
length: 以中文旁白实测时长为准，约4分钟
---

## Intent
用户请求参考 BV1LT4y1U78a 的讲解思路制作第一课讲解视频。该来源目前不能完整读取，因此本次交付为基于平台母题的原创教学样片，不声称复现原视频的步骤或例题。
完整题目先出现，然后分析、图示消去、计算检验、变式和学生复述。

## Assets
- ../../server/lesson-problems.js 第1课：母题及变式1。
- 电脑已有的 Microsoft Huihui Desktop 中文合成语音，明确为合成旁白。
- 原创 SVG 本子、笔、订单图示；不使用参考视频画面、声音或逐字稿。

## Customizations
用户既有偏好：卡通风格、多巴胺配色、完整母题、费曼讲解环节。
制作默认：16:9横屏，中文旁白与逐句字幕，关键步骤留思考时间，无背景音乐，保持数学推理清晰。
用户已授权制作视频，完成检查后导出本地 MP4；不公开发布或修改平台数据库。

## Notes
渲染复用已缓存 HyperFrames 0.8.17 和系统 FFmpeg；不增加平台依赖。
学生可暂停视频打草稿。变式先出题，稍后给解析。最后提供可照着说的讲解开头。
