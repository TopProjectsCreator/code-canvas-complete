export const hasTrackedFileContentChanges = (
  fileContents: Record<string, string>,
  originalFileContents: Record<string, string>,
): boolean => Object.entries(fileContents).some(([fileId, content]) => content !== originalFileContents[fileId]);
