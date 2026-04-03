import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";

import { makeId } from "../utils/ids.js";
import type { LoggerLike } from "../utils/logger.js";
import type { JsonRpcInbound, JsonRpcRequest, JsonRpcResponse } from "./protocol.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class StdioTransport extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, PendingRequest>();
  private buffer = "";

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly logger: LoggerLike
  ) {
    super();
  }

  start(): void {
    if (this.child && !this.child.killed) return;

    this.child = spawn(this.command, this.args, {
      stdio: "pipe",
      env: process.env
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flushLines();
    });

    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.logger.warn("codex-app-server stderr", chunk.trim());
    });

    this.child.on("exit", (code, signal) => {
      this.logger.error(`codex-app-server exited code=${code} signal=${signal}`);
      for (const [id, pending] of this.pending) {
        pending.reject(new Error(`Transport closed before response for request ${id}`));
      }
      this.pending.clear();
      this.emit("exit", { code, signal });
    });
  }

  stop(): void {
    this.child?.kill();
    this.child = undefined;
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    this.start();
    const id = makeId("rpc");
    const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const raw = `${JSON.stringify(req)}\n`;

    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.child?.stdin.write(raw);
    return promise;
  }

  notify(method: string, params?: Record<string, unknown>): void {
    this.start();
    const raw = `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`;
    this.child?.stdin.write(raw);
  }

  private flushLines(): void {
    while (true) {
      const idx = this.buffer.indexOf("\n");
      if (idx < 0) break;

      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as JsonRpcInbound;
        this.handleInbound(parsed);
      } catch (error) {
        this.logger.warn("Failed to parse app-server JSON line", { line, error });
      }
    }
  }

  private handleInbound(inbound: JsonRpcInbound): void {
    if ("id" in inbound) {
      const response = inbound as JsonRpcResponse;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    this.emit("notification", inbound);
  }
}
