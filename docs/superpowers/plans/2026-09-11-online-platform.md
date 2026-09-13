# 在线教学平台实施计划

> 本会话顺序实施，用户已批准方案和依赖；不提交 Git、不改 .env。

**Goal:** 独立账号、云端数据、教师工作台及卡通学习界面。

**Architecture:** 保留现有本地文件，新建 server 与 public。服务器加载原题库作为私有内容，通过授权接口返回题目；静态服务只开放 public。

**Tech Stack:** Node.js、Express、PostgreSQL、pg、argon2、helmet、express-rate-limit。

**Spec:** docs/superpowers/specs/2026-09-11-online-design.md

## Global Constraints
中文界面和关键注释；前后测各20题、120分；数据库强制身份隔离；不得覆盖旧成绩；不添加未批准的软件包；不提交Git；不改.env。

## 1. 数据与账号
- [x] 新增 package.json、server/db.js、server/schema.sql、server/auth.js、server/content.js、server/index.js。
- [x] 使用参数化SQL和事务，账号与班级通过外键关联；密码Argon2id，会话随机令牌摘要存库。
- [x] 验证未登录401、学生访问教师接口403、跨学生/跨教师访问404、重置密码撤销旧会话。

## 2. 学习与测评
- [x] 新增 server/learning.js、server/exams.js、server/teacher.js，提供学习档案、题目、练习、讲课记录、测评和导入接口。
- [x] 服务器确定截止时间、保存修订号、原子交卷和计分；学生接口从不直接接收成绩。
- [x] 验证A全对120、空白0、过期拒绝修改、重复提交同一记录、答案开放控制与旧版迁移。

## 3. 界面
- [x] 新增 public/index.html、public/app.js、public/views.js、public/styles.css，复用原游戏与课堂呈现。
- [x] 学生首页地图、账号设置、练习错题、测评报告；教师班级概览、学生详情、资源设置和迁移预览。
- [x] 验证登录、首登改密、教师创建学生、分配测评、学生提交、教师讲评完整链路。

## 4. 交付
- [x] 新增容器配置、启动脚本、备份恢复说明和在线版说明；不公开开发文件或题库。
- [x] 使用真实PostgreSQL运行接口集成测试，浏览器验证320/768/1024/1440宽度和错误日志。
- [x] 记录测试结果及公网部署尚需的服务器、域名条件。
