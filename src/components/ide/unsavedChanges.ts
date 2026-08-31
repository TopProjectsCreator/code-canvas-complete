export const hasTrackedFileContentChanges = (
  fileContents: Record<string, string>,
  originalFileContents: Record<string, string>,
): boolean => Object.entries(fileContents).some(([fileId, content]) => content !== originalFileContents[fileId]);

export const removeTrackedFileContent = (
  fileContents: Record<string, string>,
  fileId: string,
): Record<string, string> => {
  const { [fileId]: _removed, ...remainingFileContents } = fileContents;
  return remainingFileContents;
};
