import { redactVideosInBody, serveRedactedVideo } from "./video-redaction.ts";

// ── Helpers ──────────────────────────────────────────────────

function createOpenAIBody(videoDataUri: string): Record<string, unknown> {
  return {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this video" },
          { type: "image_url", image_url: { url: videoDataUri } },
        ],
      },
    ],
  };
}

function createAnthropicBody(videoDataUri: string): Record<string, unknown> {
  return {
    model: "claude-3-5-sonnet-20241022",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this video" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "video/mp4",
              data: videoDataUri.replace("data:video/mp4;base64,", ""),
            },
          },
        ],
      },
    ],
  };
}

const SAMPLE_VIDEO_URI = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA";

// ── Tests ────────────────────────────────────────────────────

Deno.test("integration: redactVideosInBody replaces video URI with session URL in OpenAI shape", async () => {
  const body = createOpenAIBody(SAMPLE_VIDEO_URI);
  const result = await redactVideosInBody(
    body,
    "openai",
    { customPatterns: [], detectNames: false },
    true,
  );

  const msg = (result.body.messages as any[])[0];
  const part = msg.content[1];
  if (part.image_url.url !== result.body.messages?.[0]?.content?.[1]?.image_url?.url) {
    throw new Error("body was mutated in place");
  }

  const videoUrl = part.image_url.url as string;
  if (!videoUrl.includes("/v/") || !videoUrl.endsWith(".mp4")) {
    throw new Error(`Expected session URL, got: ${videoUrl}`);
  }

  // Verify result shape
  if (result.videoCount !== 1) throw new Error(`Expected 1 video, got ${result.videoCount}`);
  if (result.redactedVideoCount !== 1) throw new Error(`Expected 1 redacted, got ${result.redactedVideoCount}`);

  console.log("OpenAI video URL:", videoUrl);
});

Deno.test("integration: redactVideosInBody replaces video in Anthropic shape", async () => {
  const body = createAnthropicBody(SAMPLE_VIDEO_URI);
  const result = await redactVideosInBody(
    body,
    "anthropic",
    { customPatterns: [], detectNames: false },
    true,
  );

  const msg = (result.body.messages as any[])[0];
  const part = msg.content[1];
  const videoUrl = part.source.data as string;
  if (!videoUrl.includes("/v/") || !videoUrl.endsWith(".mp4")) {
    throw new Error(`Expected session URL, got: ${videoUrl}`);
  }
  if (part.source.media_type !== "video/mp4") throw new Error("Expected video/mp4 media_type");
  if (part.source.type !== "base64") throw new Error("Expected base64 type");
});

Deno.test("integration: serveRedactedVideo returns 404 for unknown session", async () => {
  const resp = await serveRedactedVideo("00000000-0000-0000-0000-000000000000");
  if (resp.status !== 404) throw new Error(`Expected 404, got ${resp.status}`);
});

Deno.test("integration: serveRedactedVideo returns streaming response for valid session", async () => {
  const body = createOpenAIBody(SAMPLE_VIDEO_URI);
  const result = await redactVideosInBody(
    body,
    "openai",
    { customPatterns: [], detectNames: false },
    true,
  );

  // Extract session ID from the video URL
  const videoUrl = (result.body.messages?.[0]?.content as any[])[1].image_url.url as string;
  const sessionId = videoUrl.match(/\/v\/([a-f0-9-]+)\.mp4$/)?.[1];
  if (!sessionId) throw new Error("Could not extract session ID");

  const resp = await serveRedactedVideo(sessionId);
  if (resp.status !== 200) throw new Error(`Expected 200, got ${resp.status}`);
  if (resp.headers.get("Content-Type") !== "video/mp4") throw new Error("Expected video/mp4 Content-Type");
  if (resp.headers.get("Transfer-Encoding") !== "chunked") throw new Error("Expected chunked Transfer-Encoding");

  console.log("Session ID:", sessionId);
  console.log("Response headers:", Object.fromEntries(resp.headers.entries()));
});

Deno.test("integration: redactVideosInBody returns passthrough when no videos present", async () => {
  const body = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
        ],
      },
    ],
  };
  const result = await redactVideosInBody(
    body as Record<string, unknown>,
    "openai",
    { customPatterns: [], detectNames: false },
    true,
  );
  if (result.videoCount !== 0) throw new Error("Expected 0 videos");
  if (result.redactedVideoCount !== 0) throw new Error("Expected 0 redacted");
});

Deno.test("integration: redactVideosInBody handles Gemini shape with inline_data", async () => {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: "Describe this video" },
          {
            inline_data: {
              mime_type: "video/mp4",
              data: SAMPLE_VIDEO_URI.replace("data:video/mp4;base64,", ""),
            },
          },
        ],
      },
    ],
  };
  const result = await redactVideosInBody(
    body as Record<string, unknown>,
    "gemini",
    { customPatterns: [], detectNames: false },
    true,
  );

  const part = (result.body.contents as any[])[0].parts[1];
  const videoUrl = part.inline_data.data as string;
  if (!videoUrl.includes("/v/") || !videoUrl.endsWith(".mp4")) {
    throw new Error(`Expected session URL, got: ${videoUrl}`);
  }
});

Deno.test("integration: redactVideosInBody handles Gemini shape with file_data", async () => {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: "Describe this video" },
          {
            file_data: {
              mime_type: "video/mp4",
              file_uri: "https://example.com/video.mp4",
            },
          },
        ],
      },
    ],
  };
  const result = await redactVideosInBody(
    body as Record<string, unknown>,
    "gemini",
    { customPatterns: [], detectNames: false },
    true,
  );

  const part = (result.body.contents as any[])[0].parts[1];
  const videoUrl = part.file_data.file_uri as string;
  if (!videoUrl.includes("/v/") || !videoUrl.endsWith(".mp4")) {
    throw new Error(`Expected session URL, got: ${videoUrl}`);
  }
});
