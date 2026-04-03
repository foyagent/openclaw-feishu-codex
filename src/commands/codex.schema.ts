export const codexCommandSchema = {
  name: "codex",
  description: "Manage Codex sessions bridged to the current Feishu conversation.",
  subcommands: [
    { name: "new", args: [{ name: "workspaceOrProject", required: false }] },
    { name: "resume", args: [{ name: "queryOrThreadId", required: false }] },
    { name: "detach", args: [] },
    { name: "stop", args: [] },
    { name: "steer", args: [{ name: "text", required: true, variadic: true }] },
    { name: "plan", args: [{ name: "goal", required: false, variadic: true }] },
    { name: "review", args: [{ name: "focus", required: false, variadic: true }] },
    {
      name: "raw",
      args: [{ name: "mode", required: true, enum: ["off", "cli", "all"] }]
    },
    { name: "model", args: [{ name: "name", required: true }] },
    {
      name: "permissions",
      args: [{ name: "mode", required: true, enum: ["default", "full"] }]
    },
    { name: "log", args: [{ name: "turnId", required: false }] },
    { name: "replay", args: [{ name: "turnId", required: false }] },
    { name: "status", args: [] },
    {
      name: "approve",
      args: [
        { name: "requestId", required: true },
        { name: "action", required: true, enum: ["allow-once", "allow-always", "deny", "cancel", "amend"] },
        { name: "amendedCommand", required: false, variadic: true }
      ]
    }
  ],
  aliases: {
    cas_resume: "codex resume",
    cas_status: "codex status",
    cas_stop: "codex stop",
    cas_steer: "codex steer",
    cas_plan: "codex plan",
    cas_review: "codex review",
    cas_detach: "codex detach"
  }
} as const;

export type CodexCommandSchema = typeof codexCommandSchema;
