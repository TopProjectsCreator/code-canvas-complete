/**
 * Utilities for parsing and applying unified diffs.
 */

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/**
 * Parse a unified diff string into hunks.
 */
export function parseDiff(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diffText.split('\n');
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldCount: parseInt(hunkMatch[2] ?? '1'),
        newStart: parseInt(hunkMatch[3]),
        newCount: parseInt(hunkMatch[4] ?? '1'),
        lines: [],
      };
      hunks.push(currentHunk);
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      continue;
    }

    if (!currentHunk) continue;

    // Skip file header lines
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ')) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'added', content: line.slice(1), newLineNum: newLine++ });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'removed', content: line.slice(1), oldLineNum: oldLine++ });
    } else {
      // Context line (starts with space or is empty)
      const content = line.startsWith(' ') ? line.slice(1) : line;
      currentHunk.lines.push({ type: 'context', content, oldLineNum: oldLine++, newLineNum: newLine++ });
    }
  }

  return hunks;
}

/**
 * Apply parsed diff hunks to source code, returning the patched result.
 */
export function applyDiff(originalCode: string, diffText: string): string {
  const hunks = parseDiff(diffText);
  if (hunks.length === 0) return originalCode;

  const originalLines = originalCode.split('\n');
  const result: string[] = [];
  let originalIdx = 0; // 0-based index into originalLines

  for (const hunk of hunks) {
    const hunkStart = hunk.oldStart - 1; // Convert 1-based to 0-based

    // Copy lines before this hunk
    while (originalIdx < hunkStart && originalIdx < originalLines.length) {
      result.push(originalLines[originalIdx]);
      originalIdx++;
    }

    // Apply hunk
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        result.push(originalLines[originalIdx] ?? line.content);
        originalIdx++;
      } else if (line.type === 'removed') {
        originalIdx++; // Skip the removed line
      } else if (line.type === 'added') {
        result.push(line.content);
      }
    }
  }

  // Copy remaining lines after last hunk
  while (originalIdx < originalLines.length) {
    result.push(originalLines[originalIdx]);
    originalIdx++;
  }

  return result.join('\n');
}

/**
 * Parse diff lines for display purposes (colored diff view).
 */
export function getDiffLines(diffText: string): DiffLine[] {
  const hunks = parseDiff(diffText);
  return hunks.flatMap(h => h.lines);
}
