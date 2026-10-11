import { describe, expect, it } from "vitest";
import { whiteboardSceneHash } from "@/lib/threadWhiteboardSync";

const base = [
  { id: "a", version: 1, versionNonce: 111, isDeleted: false },
  { id: "b", version: 3, versionNonce: 222, isDeleted: false },
  { id: "c", version: 2, versionNonce: 333, isDeleted: false },
];

describe("whiteboardSceneHash", () => {
  it("is stable for an identical scene", () => {
    expect(whiteboardSceneHash(base)).toBe(whiteboardSceneHash(base.map((el) => ({ ...el }))));
  });

  it("changes when a middle element's version changes", () => {
    const edited = [base[0], { ...base[1], version: base[1].version + 1 }, base[2]];
    expect(whiteboardSceneHash(edited)).not.toBe(whiteboardSceneHash(base));
  });

  it("changes when a middle element's versionNonce changes", () => {
    const edited = [base[0], { ...base[1], versionNonce: 999 }, base[2]];
    expect(whiteboardSceneHash(edited)).not.toBe(whiteboardSceneHash(base));
  });

  it("changes when a middle element is deleted", () => {
    const edited = [base[0], { ...base[1], isDeleted: true }, base[2]];
    expect(whiteboardSceneHash(edited)).not.toBe(whiteboardSceneHash(base));
  });

  it("changes when element order changes", () => {
    const reordered = [base[1], base[0], base[2]];
    expect(whiteboardSceneHash(reordered)).not.toBe(whiteboardSceneHash(base));
  });

  it("changes when the element count changes", () => {
    expect(whiteboardSceneHash([...base, { id: "d", version: 1, versionNonce: 4 }])).not.toBe(
      whiteboardSceneHash(base)
    );
  });

  it("reflects referenced file ids independent of order", () => {
    expect(whiteboardSceneHash(base, ["f2", "f1"])).toBe(whiteboardSceneHash(base, ["f1", "f2"]));
    expect(whiteboardSceneHash(base, ["f1"])).not.toBe(whiteboardSceneHash(base, ["f1", "f2"]));
  });

  it("handles missing optional fields", () => {
    expect(() => whiteboardSceneHash([{}, { id: "x" }])).not.toThrow();
    expect(whiteboardSceneHash([{}])).not.toBe(whiteboardSceneHash([{ id: "x" }]));
  });
});
