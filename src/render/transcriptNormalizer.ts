const ANSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export function normalizeTranscriptChunk(input: string): string {
  const noAnsi = input.replace(ANSI_RE, "");

  // Handle carriage-return overwrite behavior from terminals.
  return noAnsi
    .split("\n")
    .map((line) => {
      const lastCarriageReturn = line.lastIndexOf("\r");
      return lastCarriageReturn >= 0 ? line.slice(lastCarriageReturn + 1) : line;
    })
    .join("\n");
}
