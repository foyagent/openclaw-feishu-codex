import { normalizeTranscriptChunk } from "./transcriptNormalizer.js";

export interface ChunkSink {
  sendChunk(bindingKey: string, chunk: string): Promise<void>;
}

export class RawChunkRenderer {
  private readonly buffers = new Map<string, string>();

  constructor(
    private readonly sink: ChunkSink,
    private readonly chunkSize: number
  ) {}

  async push(bindingKey: string, text: string, forceFlush = false): Promise<void> {
    const normalized = normalizeTranscriptChunk(text);
    const current = this.buffers.get(bindingKey) ?? "";
    const combined = `${current}${normalized}`;

    if (!forceFlush && combined.length < this.chunkSize) {
      this.buffers.set(bindingKey, combined);
      return;
    }

    await this.flushCombined(bindingKey, combined);
  }

  async flush(bindingKey: string): Promise<void> {
    const combined = this.buffers.get(bindingKey);
    if (!combined) return;
    await this.flushCombined(bindingKey, combined);
  }

  private async flushCombined(bindingKey: string, combined: string): Promise<void> {
    this.buffers.set(bindingKey, "");

    let offset = 0;
    while (offset < combined.length) {
      const chunk = combined.slice(offset, offset + this.chunkSize);
      offset += this.chunkSize;
      if (!chunk) continue;
      await this.sink.sendChunk(bindingKey, chunk);
    }
  }
}
