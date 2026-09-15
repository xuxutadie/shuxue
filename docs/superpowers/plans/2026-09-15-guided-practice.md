# 视频配套与 AI 引导练习 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. 本轮用户已要求开始，主代理连续执行，不重复确认，不自动提交。

**Goal:** 完整题目配独立解析，AI只出题和引导、不透露标准答案。

**Architecture:** 教学内容在 server/practice-alignment.js 统一覆盖，页面复用题卡；AI 模板、兼容接口客户端和API权限路由独立文件，PostgreSQL保存加密配置与个人题目记录。

**Tech Stack:** 现有 Express / PostgreSQL / Node crypto、https / 原生 JavaScript。

**Spec:** ../specs/2026-09-15-guided-practice-design.md

## Global Constraints
- 不新增依赖，不自动提交或推送，不修改.env，不更改前后测题目与成绩。
- 中文界面、注释；标准答案只存在于AI服务端私有题目字段中。

## Task 1：视频配套内容和题卡
Files: server/practice-alignment.js、server/content.js、public/views.js、public/practice-cards.css、public/ai-practice.css、public/teacher-flow.js。
- [x] 核对当前字幕和所有母题，第一课将母题参数设为水瓶3、茶杯20/16、总价134/118，补配套例题3橡皮5铅笔10.6元、4橡皮4铅笔12元。
- [x] 实现 `alignPractice(lessons)` 返回带 mothers（逐题）、variants（changed片段）的课程。逐题渲染 `motherProblem`、`variantsView`，每题分别展开答案。
- [x] 使用 Node assert 验证红字片段必须存在于题干，所有题卡包含 asks/answer/explain，原题库与前后测版本不变。

## Task 2：受控出题和密钥后端
Files: server/ai-templates.js、server/ai-provider.js、server/ai-practice.js、server/schema.sql、server/index.js。
- [x] `buildProblem(lesson,difficulty,seed)` 返回 `{text,answer,hints,topic}`；12课分别覆盖等量、周期、因数倍数、面积空间、追及、生长、枚举平均数与复盘。
- [x] `requestPlan(config,lesson,difficulty,count)` 请求兼容chat/completions接口，仅接受JSON整数seed，忽略所有其他模型字段；HTTPS目标预检查、DNS固定、禁重定向、超时和响应上限。
- [x] `setupAiPractice(app,pool,options)` 提供教师配置GET/PUT/test、生成POST、个人历史GET、单题answer/hint POST；教师记录按学生所属教师过滤。
- [x] 数据库新增 ai_settings、ai_usage、ai_questions、ai_submissions；测试用随机账号清理，真实数据不变。
- [x] 所有学生可见记录通过白名单组装，`answer`字段只接收学生作答，返回只含correct与受控hint。

## Task 3：教师与学生界面
Files: public/ai-practice.js、public/index.html、public/app.js、public/practice-cards.css、public/ai-practice.css。
- [x] 练习页AI入口展示规则、课程/难度/题量、历史、逐题作答与逐级提示；教师班级资源入口配置模型与密钥。
- [x] 仅点击AI入口后请求AI状态，避免每次切页加载AI或调用付费模型。
- [x] 题目以textContent/转义字符串渲染，模型原文不会进入HTML。

## Task 4：验证与交付
Files: tests/ai-practice.test.cjs、tests/practice-alignment.test.cjs、docs/AI出题使用说明.md、package.json、scripts/local-runtime.cjs。
- [x] 对每个模板多种seed核验、越权/答案泄露/额度/考试拦截/密钥和网络失败测试；运行既有全部回归。
- [x] 写明部署AI_ENCRYPTION_KEY的用途、设置方法、密钥轮换与备份注意事项。无实际供应商Key时如实说明只完成模拟接口验证。

## 验证结果
- 完整回归70项通过；随后修复模型返回null的边界并新增测试，AI后端9项复测通过，共71项检查均已验证。
- 浏览器在独立测试数据库中验证学生生成、提示、错误反馈与教师只读查看记录；确认设置密钥不回显、红色条件和逐题展开解析的实际显示。
- 本机8771正常启动并通过健康检查。测试用8772模拟服务已关闭。
- 实现验收阶段未使用真实服务商Key联调；用户随后授权提交并推送。
- 推送前已再次运行完整71项检查，全部通过。
