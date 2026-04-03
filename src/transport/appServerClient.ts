import type { LoggerLike } from "../utils/logger.js";
import type { JsonRpcNotification } from "./protocol.js";
import { StdioTransport } from "./stdioTransport.js";

export class AppServerClient {
  private readonly transport: StdioTransport;

  constructor(command: string, args: string[], logger: LoggerLike) {
    this.transport = new StdioTransport(command, args, logger);
  }

  onNotification(listener: (n: JsonRpcNotification) => void): void {
    this.transport.on("notification", listener);
  }

  onExit(listener: (reason: unknown) => void): void {
    this.transport.on("exit", listener);
  }

  initialize(clientName = "openclaw-codex-feishu"): Promise<unknown> {
    return this.transport.request("initialize", {
      clientName,
      protocolVersion: "2026-03-01"
    });
  }

  threadStart(workspaceRoot: string, model: string): Promise<unknown> {
    return this.transport.request("thread/start", { workspaceRoot, model });
  }

  threadResume(threadId: string): Promise<unknown> {
    return this.transport.request("thread/resume", { threadId });
  }

  turnStart(threadId: string, text: string): Promise<unknown> {
    return this.transport.request("turn/start", { threadId, input: text });
  }

  turnSteer(threadId: string, turnId: string, text: string): Promise<unknown> {
    return this.transport.request("turn/steer", { threadId, turnId, input: text });
  }

  turnInterrupt(threadId: string, turnId: string): Promise<unknown> {
    return this.transport.request("turn/interrupt", { threadId, turnId });
  }

  reviewStart(threadId: string, focus?: string): Promise<unknown> {
    return this.transport.request("review/start", { threadId, focus });
  }

  approve(requestId: string, action: string, amendedCommand?: string): Promise<unknown> {
    return this.transport.request("approval/respond", { requestId, action, amendedCommand });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    this.transport.notify(method, params);
  }

  stop(): void {
    this.transport.stop();
  }
}
