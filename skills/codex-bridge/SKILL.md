# codex-bridge

## 目的
将“把任务交给 Codex”的自然语言意图路由到 `codex_bridge.send` 工具，避免主 agent 转述长输出。

## 工作流
1. 识别用户意图（例如“用 codex 做这个”）。
2. 调用 `codex_bridge.send`，仅传入任务目标与上下文。
3. 返回简短确认：`Codex 已接管，输出将直接回流到当前 Feishu 聊天。`
4. 不在主 agent 中复述 Codex 的持续流式输出。

## 约束
- 长输出由插件直发 Feishu。
- skill 不负责会话生命周期或审批逻辑。
