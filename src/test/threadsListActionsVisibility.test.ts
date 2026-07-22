import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ThreadsList action visibility", () => {
  it("uses a group parent for group-hover action controls", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/threads/ThreadsList.tsx"), "utf8");

    expect(source).toContain('<Card key={thread.id} className="group p-3 hover:bg-accent/50 transition-colors">');
    expect(source).toContain("group-hover:opacity-100");
  });
});
