# OpenClaw × Codex × Feishu v1 Draft Artifacts

这个仓库现在已经是一个**可安装试用**的 OpenClaw 原生插件脚手架（MVP）：

- 提供合法的 `openclaw.plugin.json`（含 `configSchema`）
- 提供可编译的插件入口 `src/index.ts`
- 注册可调用工具 `codex_bridge_send`
- 附带 `/codex` 命令协议草案、绑定状态类型、Feishu 卡片草图与 skill 草案

## 运行环境

- Node.js **>= 22.12**（OpenClaw CLI 要求）
- npm 10+

## 快速试用

```bash
npm install
npm run typecheck
npm run build
npm run validate:json
openclaw plugins install .
openclaw plugins enable codex-feishu
```

安装后可先做最小验证：

1. 在 OpenClaw 中触发工具 `codex_bridge_send`
2. 输入 `task` 参数（例如“修复登录接口 500”）
3. 观察返回 ACK：`Codex 已接管任务...输出将直接回流到当前 Feishu 聊天。`

> 说明：当前版本是“可安装试用”的桥接基础骨架，不包含完整 app-server 会话管理、审批桥、日志落盘与渲染调度实现。
