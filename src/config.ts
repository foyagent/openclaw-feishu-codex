export type AttachMode = "attached" | "toolOnly";
export type RawMode = "off" | "cli" | "all";

export interface PluginConfig {
  transport: "stdio" | "websocket";
  command: string;
  args: string[];
  defaultWorkspaceDir?: string;
  defaultModel?: string;
  attachModeDefault?: AttachMode;
  rawModeDefault?: RawMode;
  feishu?: {
    pinControlCard?: boolean;
    rotateControlCardAfterDays?: number;
    controlCardEditMinIntervalMs?: number;
    streamFlushMs?: number;
    streamChunkChars?: number;
    liveTailChars?: number;
    sendJsonlOnTurnComplete?: boolean;
    sendReadableTranscriptOnTurnComplete?: boolean;
    buttonsOnly?: boolean;
  };
  dataDir?: string;
}

export function resolveConfig(raw: unknown): Required<PluginConfig> {
  const input = (raw ?? {}) as PluginConfig;

  return {
    transport: input.transport ?? "stdio",
    command: input.command ?? "codex",
    args: input.args ?? ["app-server", "--listen", "stdio://"],
    defaultWorkspaceDir: input.defaultWorkspaceDir ?? process.cwd(),
    defaultModel: input.defaultModel ?? "gpt-5.4",
    attachModeDefault: input.attachModeDefault ?? "attached",
    rawModeDefault: input.rawModeDefault ?? "cli",
    dataDir: input.dataDir ?? ".openclaw-codex-feishu",
    feishu: {
      pinControlCard: input.feishu?.pinControlCard ?? true,
      rotateControlCardAfterDays: input.feishu?.rotateControlCardAfterDays ?? 12,
      controlCardEditMinIntervalMs: input.feishu?.controlCardEditMinIntervalMs ?? 1000,
      streamFlushMs: input.feishu?.streamFlushMs ?? 750,
      streamChunkChars: input.feishu?.streamChunkChars ?? 1500,
      liveTailChars: input.feishu?.liveTailChars ?? 1200,
      sendJsonlOnTurnComplete: input.feishu?.sendJsonlOnTurnComplete ?? true,
      sendReadableTranscriptOnTurnComplete: input.feishu?.sendReadableTranscriptOnTurnComplete ?? false,
      buttonsOnly: input.feishu?.buttonsOnly ?? true
    }
  };
}
