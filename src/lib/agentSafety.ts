const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\brm\s+-fr\b/i,
  /\bmkfs\b/i,
  /\bdd\b\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /:\s*\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb
  /\bchown\b\s+-R\s+[^\n]*\//i,
  /\bchmod\b\s+-R\s+777\b/i,
  /\bcurl\b[^\n]*\|\s*(sh|bash|zsh)\b/i,
  /\bwget\b[^\n]*\|\s*(sh|bash|zsh)\b/i,
  />\s*\/dev\/sda/i,
  /\bpoweroff\b/i,
];

export function isPotentiallyDestructiveShellCommand(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) return false;
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(normalized));
}
