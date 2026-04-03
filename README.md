# OpenClaw × Codex × Feishu Plugin

该仓库现在提供了可运行的生产实现骨架（不仅是文档草图），核心能力包括：

- `/codex` 命令路由（`new/resume/status/detach/stop/steer/plan/raw/model/permissions/review/approve/replay/log`）
- `codex_bridge_send` 工具（给主 agent 做轻量 handoff）
- `codex app-server` `stdio` transport 与 JSON-RPC 请求/通知处理（当前仅 stdio）
- 绑定状态持久化（`bindings/*.json`）
- turn 级 JSONL journal 落盘（`threads/<threadId>/turns/*.jsonl`）
- raw chunk 渲染与 ANSI/`\r` 规范化

## 运行环境

- Node.js **>= 22.12**（OpenClaw CLI 要求）
- npm 10+

## 安装与试用

```bash
npm install
npm run typecheck
npm run build
npm run validate:json
openclaw plugins install .
openclaw plugins enable codex-feishu
```

## 快速验证

1. 在 Feishu 聊天发送 `/codex new /path/to/workspace`
2. 发送普通任务文本（attached 模式会转为 `turn/start`）
3. 发送 `/codex status` 查看绑定状态
4. 发送 `/codex stop` 中断当前 turn
5. 查看 `.openclaw-codex-feishu/threads/*/turns/*.jsonl` 确认日志落盘

## 当前实现范围

已实现生产必需基础链路：会话绑定、transport、命令路由、日志先写后渲染。
若需要进一步增强，可继续补充：Feishu 卡片 API 实发、审批卡按钮回传、diff 文件上传等 UI 细节。
