import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { PluginConfig } from "../config.js";
import { resolveConfig } from "../config.js";
import { RawChunkRenderer, type ChunkSink } from "../render/rawChunkRenderer.js";
import { BindingStore, type BindingIdentity } from "../state/bindingStore.js";
import { JournalStore } from "../state/journalStore.js";
import type { BindingState, JournalEnvelope } from "../state/schemas.js";
import { AppServerClient } from "../transport/appServerClient.js";
import { KeyedQueue } from "../utils/keyedQueue.js";
import type { LoggerLike } from "../utils/logger.js";

export interface ChatSink {
  sendText(identity: BindingIdentity, text: string): Promise<void>;
}

export class BridgeRuntime implements ChunkSink {
  private readonly config: Required<PluginConfig>;
  private readonly bindingStore: BindingStore;
  private readonly journalStore: JournalStore;
  private readonly renderer: RawChunkRenderer;
  private readonly queue = new KeyedQueue();
  private readonly client: AppServerClient;

  constructor(
    rawConfig: unknown,
    private readonly logger: LoggerLike,
    private readonly chatSink: ChatSink
  ) {
    this.config = resolveConfig(rawConfig);
    this.bindingStore = new BindingStore(this.config.dataDir);
    this.journalStore = new JournalStore(this.config.dataDir);
    this.renderer = new RawChunkRenderer(this, this.config.feishu.streamChunkChars ?? 1500);
    this.client = new AppServerClient(this.config.command, this.config.args, logger);

    this.client.onNotification((notification) => {
      void this.handleNotification(notification.method, notification.params ?? {});
    });

    this.client.onExit(() => {
      this.logger.error("Codex app-server transport exited unexpectedly");
    });
  }

  async start(): Promise<void> {
    await mkdir(this.config.dataDir, { recursive: true });
    await this.client.initialize();
  }

  stop(): void {
    this.client.stop();
  }

  async sendChunk(bindingKey: string, chunk: string): Promise<void> {
    const [channel, accountId, peerKey] = bindingKey.split(":");
    if (channel !== "feishu") return;

    await this.chatSink.sendText({ channel, accountId, peerKey }, chunk);
  }

  async handleCodexToolTask(identity: BindingIdentity, task: string, context?: string): Promise<string> {
    const input = context ? `${task}\n\nContext:\n${context}` : task;
    await this.dispatchUserInput(identity, input);
    return "Codex 已接管，输出将直接回流到当前 Feishu 聊天。";
  }

  async handleCodexCommand(identity: BindingIdentity, argsRaw: string): Promise<string> {
    const args = argsRaw.trim();
    if (!args) {
      return "可用子命令: new | resume | status | detach | stop | steer | plan | raw | model | permissions | review | approve | replay | log";
    }

    const [subcommand, ...rest] = args.split(/\s+/g);
    const tail = rest.join(" ").trim();

    switch (subcommand) {
      case "new":
        return this.handleNew(identity, tail || this.config.defaultWorkspaceDir);
      case "resume":
        return this.handleResume(identity, tail);
      case "status":
        return this.handleStatus(identity);
      case "detach":
        return this.handleDetach(identity);
      case "stop":
        return this.handleStop(identity);
      case "steer":
        return this.handleSteer(identity, tail);
      case "plan":
        return this.handlePlan(identity, tail);
      case "raw":
        return this.handleRaw(identity, tail);
      case "model":
        return this.handleModel(identity, tail);
      case "permissions":
        return this.handlePermissions(identity, tail);
      case "review":
        return this.handleReview(identity, tail);
      case "approve":
        return this.handleApprove(identity, tail);
      case "replay":
        return this.handleReplay(identity, tail);
      case "log":
        return `日志目录: ${path.join(this.config.dataDir, "threads")}`;
      default:
        return this.dispatchUserInput(identity, args);
    }
  }

  private async handleSteer(identity: BindingIdentity, text: string): Promise<string> {
    if (!text) return "用法: /codex steer <text>";

    const state = await this.bindingStore.load(identity);
    if (!state.threadId || !state.activeTurnId) return "当前没有运行中的 turn。";

    await this.client.turnSteer(state.threadId, state.activeTurnId, text);
    await this.journalStore.appendEvent({
      ts: Date.now(),
      bindingKey: state.bindingKey,
      threadId: state.threadId,
      turnId: state.activeTurnId,
      direction: "out",
      raw: { method: "turn/steer", params: { input: text } }
    });
    return `已发送 steer 指令: ${text.slice(0, 100)}`;
  }

  private async handlePlan(identity: BindingIdentity, goal: string): Promise<string> {
    const input = goal ? `请先给出执行计划，再开始执行。\n\n目标：${goal}` : "请先给出执行计划，再开始执行。";
    return this.dispatchUserInput(identity, input);
  }

  private async handleNew(identity: BindingIdentity, workspaceRoot: string): Promise<string> {
    const thread = (await this.client.threadStart(workspaceRoot, this.config.defaultModel)) as { threadId?: string };
    const threadId = thread.threadId ?? "";

    const state = await this.bindingStore.patch(identity, {
      threadId,
      workspaceRoot,
      preferredModel: this.config.defaultModel,
      status: "idle",
      attachMode: this.config.attachModeDefault,
      rawMode: this.config.rawModeDefault
    });

    await this.journalStore.writeMeta(threadId, {
      workspaceRoot,
      model: state.preferredModel,
      createdAt: Date.now()
    });

    return `已创建 Codex 线程: ${threadId || "(未返回 threadId)"}`;
  }

  private async handleResume(identity: BindingIdentity, threadId: string): Promise<string> {
    if (!threadId) return "用法: /codex resume <threadId>";

    await this.client.threadResume(threadId);
    await this.bindingStore.patch(identity, { threadId, status: "idle" });
    return `已恢复线程: ${threadId}`;
  }

  private async handleStatus(identity: BindingIdentity): Promise<string> {
    const state = await this.bindingStore.load(identity);
    return [
      `bindingKey: ${state.bindingKey}`,
      `status: ${state.status}`,
      `threadId: ${state.threadId ?? "(none)"}`,
      `workspace: ${state.workspaceRoot ?? "(none)"}`,
      `model: ${state.preferredModel ?? this.config.defaultModel}`,
      `rawMode: ${state.rawMode}`,
      `attachMode: ${state.attachMode}`
    ].join("\n");
  }

  private async handleDetach(identity: BindingIdentity): Promise<string> {
    await this.bindingStore.patch(identity, {
      threadId: null,
      activeTurnId: undefined,
      status: "unbound"
    });
    return "已解绑当前聊天与 Codex 线程。";
  }

  private async handleStop(identity: BindingIdentity): Promise<string> {
    const state = await this.bindingStore.load(identity);
    if (!state.threadId || !state.activeTurnId) return "当前没有运行中的 turn。";

    await this.client.turnInterrupt(state.threadId, state.activeTurnId);
    await this.bindingStore.patch(identity, { status: "idle", activeTurnId: undefined });
    return `已请求停止 turn: ${state.activeTurnId}`;
  }

  private async handleRaw(identity: BindingIdentity, mode: string): Promise<string> {
    if (!["off", "cli", "all"].includes(mode)) {
      return "用法: /codex raw off|cli|all";
    }
    await this.bindingStore.patch(identity, { rawMode: mode as BindingState["rawMode"] });
    return `raw 模式已更新为: ${mode}`;
  }

  private async handleModel(identity: BindingIdentity, model: string): Promise<string> {
    if (!model) return "用法: /codex model <name>";
    await this.bindingStore.patch(identity, { preferredModel: model });
    return `默认模型已更新: ${model}`;
  }

  private async handlePermissions(identity: BindingIdentity, mode: string): Promise<string> {
    if (mode !== "default" && mode !== "full") {
      return "用法: /codex permissions default|full";
    }

    const approvalMode = mode === "full" ? "fullAccess" : "default";
    const state = await this.bindingStore.load(identity);
    await this.bindingStore.save({ ...state, approvalMode, updatedAt: Date.now() });
    return `权限模式已更新: ${approvalMode}`;
  }

  private async handleReview(identity: BindingIdentity, focus: string): Promise<string> {
    const state = await this.bindingStore.load(identity);
    if (!state.threadId) return "请先执行 /codex new 或 /codex resume";

    await this.client.reviewStart(state.threadId, focus || undefined);
    return "已提交 review 请求。";
  }

  private async handleApprove(identity: BindingIdentity, tail: string): Promise<string> {
    const [requestId, action, ...rest] = tail.split(/\s+/g).filter(Boolean);
    if (!requestId || !action) {
      return "用法: /codex approve <requestId> <allow-once|allow-always|deny|cancel|amend> [amendedCommand]";
    }

    const allowedActions = new Set(["allow-once", "allow-always", "deny", "cancel", "amend"]);
    if (!allowedActions.has(action)) {
      return "approve action 仅支持: allow-once | allow-always | deny | cancel | amend";
    }

    const amendedCommand = rest.join(" ").trim() || undefined;
    await this.client.approve(requestId, action, amendedCommand);

    const state = await this.bindingStore.load(identity);
    if (state.threadId) {
      await this.journalStore.appendEvent({
        ts: Date.now(),
        bindingKey: state.bindingKey,
        threadId: state.threadId,
        turnId: state.activeTurnId ?? "unknown",
        direction: "out",
        raw: { method: "approval/respond", params: { requestId, action, amendedCommand } }
      });
    }

    return `已提交审批响应: ${action} (${requestId})`;
  }

  private async handleReplay(identity: BindingIdentity, turnId: string): Promise<string> {
    const state = await this.bindingStore.load(identity);
    if (!state.threadId) return "请先执行 /codex new 或 /codex resume";

    const targetTurnId = turnId || state.activeTurnId;
    if (!targetTurnId) return "用法: /codex replay <turnId>";

    return `turn 日志路径: ${path.join(this.config.dataDir, "threads", state.threadId, "turns", `${targetTurnId}.jsonl`)}`;
  }

  private async dispatchUserInput(identity: BindingIdentity, text: string): Promise<string> {
    return this.queue.enqueue(`${identity.channel}:${identity.accountId}:${identity.peerKey}`, async () => {
      const state = await this.bindingStore.load(identity);
      if (!state.threadId) {
        return "当前未绑定线程，请先执行 /codex new";
      }

      const turnResult = (await this.client.turnStart(state.threadId, text, {
        approvalMode: state.approvalMode
      })) as { turnId?: string };
      const turnId = turnResult.turnId ?? "";

      await this.bindingStore.patch(identity, {
        status: "running",
        activeTurnId: turnId
      });

      await this.journalStore.appendEvent({
        ts: Date.now(),
        bindingKey: state.bindingKey,
        threadId: state.threadId,
        turnId,
        direction: "out",
        raw: { method: "turn/start", params: { input: text } }
      });

      return `已发送到 Codex: ${text.slice(0, 100)}`;
    });
  }

  private async handleNotification(method: string, params: Record<string, unknown>): Promise<void> {
    const bindingKey = typeof params.bindingKey === "string" ? params.bindingKey : undefined;
    const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
    const turnId = typeof params.turnId === "string" ? params.turnId : "unknown";

    if (bindingKey && threadId) {
      const event: JournalEnvelope = {
        ts: Date.now(),
        bindingKey,
        threadId,
        turnId,
        direction: "in",
        raw: { method, params }
      };
      await this.journalStore.appendEvent(event);

      const maybeText = this.extractRenderableText(method, params);
      if (maybeText) {
        const state = await this.bindingStore.load(this.identityFromBindingKey(bindingKey));
        if (this.shouldRenderRaw(state.rawMode, method)) {
          await this.renderer.push(bindingKey, maybeText, method === "turn/completed" || method === "error");
        }
      }
    }
  }

  private identityFromBindingKey(key: string): BindingIdentity {
    const [channel, accountId, peerKey] = key.split(":");
    return { channel: channel ?? "feishu", accountId: accountId ?? "unknown", peerKey: peerKey ?? "unknown" };
  }

  private shouldRenderRaw(rawMode: BindingState["rawMode"], method: string): boolean {
    if (rawMode === "off") return method === "error" || method === "turn/completed";
    if (rawMode === "all") return true;

    // cli: only CLI-like text deltas and terminal events.
    if (method === "error" || method === "turn/completed") return true;
    return method.includes("outputDelta") || method.includes("summaryTextDelta");
  }

  private extractRenderableText(method: string, params: Record<string, unknown>): string | undefined {
    const delta = typeof params.delta === "string" ? params.delta : undefined;
    const message = typeof params.message === "string" ? params.message : undefined;

    if (method.includes("outputDelta") || method.includes("agentMessage") || method.includes("summaryTextDelta")) {
      return delta ?? message;
    }

    if (method === "error") {
      return `\n[error] ${message ?? "unknown error"}\n`;
    }

    if (method === "turn/completed") {
      return "\n[turn completed]\n";
    }

    return undefined;
  }
}
