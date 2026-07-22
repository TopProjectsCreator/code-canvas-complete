export const MAX_PREVIEW_LOG_ENTRIES = 500;

export const appendPreviewLogEntry = <T>(entries: T[], entry: T) => {
  const nextEntries = [...entries, entry];
  return nextEntries.length > MAX_PREVIEW_LOG_ENTRIES
    ? nextEntries.slice(-MAX_PREVIEW_LOG_ENTRIES)
    : nextEntries;
};
