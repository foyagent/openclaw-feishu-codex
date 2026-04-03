import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AttachMode, RawMode } from "../config.js";
import type { BindingState } from "./schemas.js";

export interface BindingIdentity {
  channel: string;
  accountId: string;
  peerKey: string;
}

function bindingKey(identity: BindingIdentity): string {
  return `${identity.channel}:${identity.accountId}:${identity.peerKey}`;
}

export class BindingStore {
  constructor(private readonly rootDir: string) {}

  private get dir(): string {
    return path.join(this.rootDir, "bindings");
  }

  private fileForKey(key: string): string {
    return path.join(this.dir, `${encodeURIComponent(key)}.json`);
  }

  async load(identity: BindingIdentity): Promise<BindingState> {
    const key = bindingKey(identity);
    const file = this.fileForKey(key);

    try {
      const raw = await readFile(file, "utf8");
      return JSON.parse(raw) as BindingState;
    } catch {
      const now = Date.now();
      return {
        bindingKey: key,
        channel: "feishu",
        accountId: identity.accountId,
        peerKey: identity.peerKey,
        threadId: null,
        workspaceRoot: null,
        preferredModel: null,
        approvalMode: "default",
        rawMode: "cli",
        attachMode: "attached",
        status: "unbound",
        createdAt: now,
        updatedAt: now
      };
    }
  }

  async save(state: BindingState): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = this.fileForKey(state.bindingKey);
    await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async patch(
    identity: BindingIdentity,
    patch: Partial<
      Pick<BindingState, "threadId" | "workspaceRoot" | "preferredModel" | "status" | "activeTurnId" | "controlMessageId" | "controlPinned">
    > & { attachMode?: AttachMode; rawMode?: RawMode }
  ): Promise<BindingState> {
    const current = await this.load(identity);
    const next: BindingState = {
      ...current,
      ...patch,
      updatedAt: Date.now()
    };

    await this.save(next);
    return next;
  }
}
