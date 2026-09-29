import { afterEach, describe, expect, it, vi } from "vitest";
import runShell from "@/lib/mcp/tools/run-shell";

type ToolInput = {
  command: string;
  stdin?: string;
  timeout_ms?: number;
  executor?: "wandbox" | "server";
  sessionId?: string;
};

type ToolResult = {
  structuredContent?: Record<string, unknown>;
  content?: Array<{ text: string }>;
  isError?: boolean;
};

const tool = runShell as unknown as {
  handler: (input: ToolInput, context: { isAuthenticated: () => boolean; getToken: () => string }) => Promise<ToolResult>;
};

const authenticatedContext = {
  isAuthenticated: () => true,
  getToken: () => "test-user-token",
};

function response(body: Record<string, unknown>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("run_shell executor selection", () => {
  it("creates a persistent server session on the first server call", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ sessionId: "server-session-1" }, 201))
      .mockResolvedValueOnce(response({ stdout: "/workspace", stderr: "", exitCode: 0 }));

    const result = await tool.handler(
      { command: "pwd", executor: "server" },
      authenticatedContext,
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain("/api/replit/container");
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer test-user-token" },
    });
    expect(fetch.mock.calls[1][0]).toContain("/api/replit/container/server-session-1/exec");
    expect(result.structuredContent).toEqual({
      stdout: "/workspace",
      stderr: "",
      exitCode: 0,
      sessionId: "server-session-1",
      executor: "server",
    });
  });

  it("reuses the provided server session without creating another one", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ stdout: "installed", exitCode: 0 }));

    const result = await tool.handler(
      { command: "npm install", executor: "server", sessionId: "server-session-1" },
      authenticatedContext,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("/api/replit/container/server-session-1/exec");
    expect(result.structuredContent).toMatchObject({
      stdout: "installed",
      sessionId: "server-session-1",
      executor: "server",
    });
  });

  it("keeps the configured runtime when executor is omitted", async () => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ output: ["hello"], error: null, executor: "wandbox" }));

    await tool.handler({ command: "echo hello" }, authenticatedContext);

    expect(fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/execute-code",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          language: "bash",
          code: "echo hello",
          stdin: "",
          timeout: 15000,
        }),
      }),
    );
  });

  it("can explicitly select Wandbox", async () => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ output: ["hello"], error: null, executor: "wandbox" }));

    await tool.handler({ command: "echo hello", executor: "wandbox" }, authenticatedContext);

    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      executor: "wandbox",
    });
  });

  it("requires authentication before contacting either executor", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");

    const result = await tool.handler(
      { command: "id", executor: "server" },
      { isAuthenticated: () => false, getToken: () => "" },
    );

    expect(result.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});