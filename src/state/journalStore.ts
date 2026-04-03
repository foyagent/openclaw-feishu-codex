import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { JournalEnvelope } from "./schemas.js";

export class JournalStore {
  constructor(private readonly rootDir: string) {}

  private threadDir(threadId: string): string {
    return path.join(this.rootDir, "threads", threadId);
  }

  async writeMeta(threadId: string, meta: Record<string, unknown>): Promise<void> {
    const dir = this.threadDir(threadId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  }

  async appendEvent(event: JournalEnvelope): Promise<void> {
    const turnDir = path.join(this.threadDir(event.threadId), "turns");
    await mkdir(turnDir, { recursive: true });
    await appendFile(path.join(turnDir, `${event.turnId}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
  }
}
