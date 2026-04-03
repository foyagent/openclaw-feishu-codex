#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginId = "codex-feishu";
const command = process.argv[2];

function printHelp() {
  console.log("用法: npx openclaw-codex-feishu install");
}

function runOrThrow(args) {
  const result = spawnSync("npx", ["-y", "openclaw", ...args], {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (command !== "install") {
  printHelp();
  process.exit(command ? 1 : 0);
}

runOrThrow(["plugins", "install", pluginRoot]);
runOrThrow(["plugins", "enable", pluginId]);

console.log(`✅ 已安装并启用插件: ${pluginId}`);
