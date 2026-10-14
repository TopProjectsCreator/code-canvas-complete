export interface WhiteboardElementLike {
  id?: string | null;
  version?: number | null;
  versionNonce?: number | null;
  isDeleted?: boolean | null;
}

function fnv1a(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}${input.length.toString(36)}`;
}

/**
 * Stable signature of a whiteboard scene used to skip redundant persistence.
 *
 * Reflects every element's identity, version, versionNonce and deleted flag,
 * plus the referenced file ids — not just the element count or the last
 * element's version. Editing any element in the middle of a scene therefore
 * produces a different signature and the save is not skipped.
 */
export function whiteboardSceneHash(
  elements: readonly WhiteboardElementLike[],
  fileIds: readonly string[] = []
): string {
  const parts: string[] = [];
  for (const el of elements) {
    parts.push(
      `${el?.id ?? ''}:${el?.version ?? 0}:${el?.versionNonce ?? 0}:${el?.isDeleted ? 1 : 0}`
    );
  }
  const files = [...fileIds].sort().join(',');
  return fnv1a(`${parts.join('|')}#${files}`);
}
