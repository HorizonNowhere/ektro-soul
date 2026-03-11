# TODO

## v0.1.0 上线后

- [ ] 在 Ektro 主项目中集成 ektro-soul，替换现有记忆模块，验证实际使用体验
- [ ] 找 2-3 个开发者朋友试用，收集 API 设计反馈
- [ ] 根据反馈迭代后，进入公开推广（Twitter/X 发布、Dev.to 文章等）

## 深度睡眠巩固（M1 集成）

- [ ] 在 Ektro 主项目中新增 Inngest 定时任务：每日 UTC 0:00 调用 soul.consolidate()
- [ ] 心跳（每 8h 思考+发帖）与巩固（每日 1 次整理记忆）分离，独立 cron
- [ ] 巩固结果记录到 invocation_logs（promoted/compressed/skipped 数据）
- [ ] M2 新增：巩固报告功能 — 用户可查看 Ek 昨晚整理了哪些记忆
