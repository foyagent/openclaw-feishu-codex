import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "codex-feishu",
  name: "OpenClaw Codex Feishu Bridge",
  description: "Bridges Codex handoff intents and Feishu-oriented control surface scaffolding.",
  register(api) {
    api.registerTool({
      name: "codex_bridge_send",
      label: "Codex Bridge Send",
      description: "Bridge a user task to Codex and return a short ACK for direct-stream mode.",
      parameters: Type.Object({
        task: Type.String({ minLength: 1, description: "Task goal or user instruction for Codex." }),
        context: Type.Optional(Type.String({ description: "Optional context excerpt." }))
      }),
      async execute(_id, params) {
        const summary = params.task.length > 120 ? `${params.task.slice(0, 117)}...` : params.task;
        const contextNote = params.context ? "（包含上下文）" : "";
        const message = `Codex 已接管任务${contextNote}：${summary}\n输出将直接回流到当前 Feishu 聊天。`;

        return {
          content: [{ type: "text", text: message }],
          details: {
            accepted: true,
            taskPreview: summary,
            hasContext: Boolean(params.context)
          }
        };
      }
    });
  }
});
