import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { BridgeRuntime } from "./runtime/bridgeRuntime.js";
import type { BindingIdentity } from "./state/bindingStore.js";
import { noopLogger } from "./utils/logger.js";

let runtime: BridgeRuntime | undefined;

function resolveIdentity(ctx: any): BindingIdentity {
  return {
    channel: String(ctx?.channel ?? "feishu"),
    accountId: String(ctx?.senderId ?? "unknown"),
    peerKey: String(ctx?.senderId ?? "unknown")
  };
}

export default definePluginEntry({
  id: "codex-feishu",
  name: "OpenClaw Codex Feishu Bridge",
  description: "Production bridge for Codex app-server sessions in Feishu with journaling and command routing.",
  register(api: any) {
    const logger = api?.logger ?? noopLogger;

    runtime = new BridgeRuntime(
      api?.config,
      logger,
      {
        async sendText(identity, text) {
          logger.info(`[codex-feishu][${identity.channel}:${identity.accountId}:${identity.peerKey}] ${text}`);
        }
      }
    );

    api.registerService({
      id: "codex-feishu-runtime",
      start: async () => {
        await runtime?.start();
      },
      stop: () => {
        runtime?.stop();
      }
    });

    api.registerCommand({
      name: "codex",
      description: "Manage Codex session binding and runtime operations.",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx: any) => {
        const identity = resolveIdentity(ctx);
        const text = await runtime?.handleCodexCommand(identity, ctx?.args ?? "");
        return { text: text ?? "runtime not ready" };
      }
    });

    api.registerTool({
      name: "codex_bridge_send",
      label: "Codex Bridge Send",
      description: "Send a task to the bound Codex thread and return an ACK.",
      parameters: Type.Object({
        task: Type.String({ minLength: 1, description: "Task goal or user instruction for Codex." }),
        context: Type.Optional(Type.String({ description: "Optional context excerpt." }))
      }),
      async execute(_id: string, params: { task: string; context?: string }) {
        const identity: BindingIdentity = { channel: "feishu", accountId: "tool", peerKey: "tool" };
        const ack = await runtime?.handleCodexToolTask(identity, params.task, params.context);

        return {
          content: [{ type: "text", text: ack ?? "Codex runtime unavailable" }],
          details: {
            accepted: Boolean(ack),
            taskPreview: params.task.slice(0, 120),
            hasContext: Boolean(params.context)
          }
        };
      }
    });
  }
});
