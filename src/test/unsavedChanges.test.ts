import { describe, expect, it } from "vitest";
import { hasTrackedFileContentChanges } from "@/components/ide/unsavedChanges";

describe("hasTrackedFileContentChanges", () => {
  it("returns false when no tracked file contents exist", () => {
    expect(hasTrackedFileContentChanges({}, { "file-1": "hello" })).toBe(false);
  });

  it("returns true when tracked content differs from original", () => {
    expect(hasTrackedFileContentChanges({ "file-1": "updated" }, { "file-1": "original" })).toBe(true);
  });

  it("returns false when tracked content matches original", () => {
    expect(hasTrackedFileContentChanges({ "file-1": "same" }, { "file-1": "same" })).toBe(false);
  });

  it("treats tracked files missing in originals as unsaved changes", () => {
    expect(hasTrackedFileContentChanges({ "new-file": "new content" }, {})).toBe(true);
  });
});
