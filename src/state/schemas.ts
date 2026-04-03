export type ApprovalMode = "default" | "fullAccess";
export type RawMode = "off" | "cli" | "all";
export type AttachMode = "attached" | "toolOnly";
export type BindingStatus =
  | "unbound"
  | "idle"
  | "running"
  | "awaitingApproval"
  | "error"
  | "transportStale";

export interface BindingState {
  bindingKey: string;
  channel: "feishu";
  accountId: string;
  peerKey: string;
  threadId: string | null;
  workspaceRoot: string | null;
  preferredModel: string | null;
  approvalMode: ApprovalMode;
  rawMode: RawMode;
  attachMode: AttachMode;
  status: BindingStatus;
  activeTurnId?: string;
  controlMessageId?: string;
  controlPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEnvelope {
  ts: number;
  bindingKey: string;
  threadId: string;
  turnId: string;
  direction: "in" | "out";
  raw: Record<string, unknown>;
}
