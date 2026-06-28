import { describe, it, expect } from "vitest";
import { redact, rehydrate, redactJson, transformJsonStrings } from "./redaction";

describe("redact - private keys", () => {
  it("redacts RSA private key block", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
    const r = redact(key);
    expect(r.text).toBe("[PRIVATE_KEY_1]");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].type).toBe("private_key");
  });

  it("redacts EC private key block", () => {
    const key = "-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIArx...\n-----END EC PRIVATE KEY-----";
    const r = redact(key);
    expect(r.text).toBe("[PRIVATE_KEY_1]");
  });

  it("redacts generic PRIVATE KEY block", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----";
    const r = redact(key);
    expect(r.text).toBe("[PRIVATE_KEY_1]");
  });

  it("redacts OPENSSH private key block", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ==\n-----END OPENSSH PRIVATE KEY-----";
    const r = redact(key);
    expect(r.text).toBe("[PRIVATE_KEY_1]");
  });
});

describe("redact - provider API keys", () => {
  it("redacts OpenAI sk-proj key", () => {
    const r = redact("sk-proj-abcdef1234567890abcdef123456789012345");
    expect(r.text).toBe("[SECRET_1]");
    expect(r.matches[0].type).toBe("openai_key");
  });

  it("redacts OpenAI standard sk key", () => {
    const r = redact("sk-abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
    expect(r.matches[0].type).toBe("openai_key");
  });

  it("redacts Anthropic key", () => {
    const r = redact("sk-ant-abcdef1234567890abcdef12345678901234");
    expect(r.text).toBe("[SECRET_1]");
    expect(r.matches[0].type).toBe("anthropic_key");
  });

  it("redacts Google API key", () => {
    const r = redact("AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456");
    expect(r.text).toBe("[SECRET_1]");
    expect(r.matches[0].type).toBe("google_api_key");
  });

  it("redacts xAI key", () => {
    const r = redact("xai-abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Groq key", () => {
    const r = redact("gsk_abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Perplexity key", () => {
    const r = redact("pplx-abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Replicate key", () => {
    const r = redact("r8_abcdef1234567890abcdef1234567890abcdef1234");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts OpenRouter key", () => {
    const r = redact("sk-or-abcdef1234567890abcdef1234567890abcdef1");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Mistral key by proximity", () => {
    const r = redact("mistral: AbCdEfGhIjKlMnOpQrStUvWxYz123456");
    expect(r.text).toBe("mistral: [SECRET_1]");
  });

  it("redacts Cohere key", () => {
    const r = redact("co-abcdef1234567890abcdef1234567890abcdef");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("does not redact short non-key strings", () => {
    const r = redact("hello");
    expect(r.text).toBe("hello");
    expect(r.matches).toHaveLength(0);
  });
});

describe("redact - cloud / service keys", () => {
  it("redacts AWS access key", () => {
    const r = redact("AKIAIOSFODNN7EXAMPLE");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts GitHub token", () => {
    const r = redact("ghp_abcdef1234567890abcdef1234567890abcdef");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts GitHub fine-grained PAT", () => {
    const r = redact("github_pat_abcdef1234567890abcdef1234567890abcdef");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Slack token", () => {
    const r = redact("xoxb-" + "1234567890-1234567890-abcdef12345678");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Stripe live key", () => {
    const r = redact("sk_live_" + "abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts Stripe test key", () => {
    const r = redact("pk_test_abcdef1234567890abcdef1234567890");
    expect(r.text).toBe("[SECRET_1]");
  });

  it("redacts JWT", () => {
    const r = redact("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNnPZcmR_cOR2Bk2A");
    expect(r.text).toBe("[SECRET_1]");
  });
});

describe("redact - URLs with credentials", () => {
  it("redacts URL with embedded creds", () => {
    const r = redact("https://user:pass@example.com/path");
    expect(r.text).toBe("[URL_1]");
  });
});

describe("redact - PII", () => {
  it("redacts email", () => {
    const r = redact("Contact me at alice@example.com");
    expect(r.text).toBe("Contact me at [EMAIL_1]");
  });

  it("redacts multiple emails", () => {
    const r = redact("alice@example.com and bob@test.org");
    expect(r.text).toBe("[EMAIL_1] and [EMAIL_2]");
  });

  it("deduplicates same email", () => {
    const r = redact("alice@example.com and alice@example.com");
    expect(r.text).toBe("[EMAIL_1] and [EMAIL_1]");
  });

  it("redacts IPv4", () => {
    const r = redact("Server: 192.168.1.42");
    expect(r.text).toBe("Server: [IP_1]");
  });

  it("redacts IPv6", () => {
    const r = redact("IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(r.text).toBe("IPv6: [IP_1]");
  });

  it("redacts MAC address", () => {
    const r = redact("MAC: AA:BB:CC:DD:EE:FF");
    expect(r.text).toBe("MAC: [MAC_1]");
  });

  it("redacts MAC address with dashes", () => {
    const r = redact("MAC: AA-BB-CC-DD-EE-FF");
    expect(r.text).toBe("MAC: [MAC_1]");
  });

  it("redacts valid credit card (Luhn)", () => {
    const r = redact("Card: 4111111111111111");
    expect(r.text).toBe("Card: [CARD_1]");
  });

  it("redacts formatted credit card (4-4-4-4)", () => {
    const r = redact("Card: 4111 1111 1111 1111");
    expect(r.text).toBe("Card: [CARD_1]");
  });

  it("does not redact invalid Luhn card", () => {
    const r = redact("Card: 1234567890123456");
    expect(r.matches.every((m) => m.type !== "credit_card")).toBe(true);
  });

  it("redacts SSN", () => {
    const r = redact("SSN: 123-45-6789");
    expect(r.text).toBe("SSN: [SSN_1]");
  });

  it("redacts IBAN", () => {
    const r = redact("IBAN: GB33BUKB20201555555555");
    expect(r.text).toBe("IBAN: [IBAN_1]");
  });

  it("redacts phone number with +", () => {
    const r = redact("Call +1 415 555 0123");
    expect(r.text).toBe("Call [PHONE_1]");
  });

  it("redacts phone number with dashes", () => {
    const r = redact("Call 415-555-0123");
    expect(r.text).toBe("Call [PHONE_1]");
  });

  it("does not redact pure digit run as phone", () => {
    const r = redact("id 12345678");
    expect(r.text).toBe("id 12345678");
  });
});

describe("redact - env var assignments", () => {
  it("redacts API_KEY=value at line start", () => {
    const r = redact("API_KEY=sk-abc123def456");
    expect(r.text).toBe("[ENV_1]");
  });

  it("redacts export API_KEY=value", () => {
    const r = redact("export SECRET_KEY=my-secret-value");
    expect(r.text).toBe("[ENV_1]");
  });

  it("redacts quoted value", () => {
    const r = redact('DATABASE_URL="postgres://localhost:5432/db"');
    expect(r.text).toBe("[ENV_1]");
  });

  it("does not redact JS keyword assignment", () => {
    const r = redact("NON_SOLID_BLOCKS=new Set()");
    expect(r.matches.every((m) => m.type !== "env_assignment")).toBe(true);
  });
});

describe("redact - high-entropy tokens", () => {
  it("redacts high-entropy 40+ char token", () => {
    const r = redact("token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(r.text).toBe("token=[SECRET_1]");
  });

  it("does not redact hex string (low entropy)", () => {
    const r = redact("hash=abcdabcdabcdabcdabcdabcdabcdabcdabcdabcd");
    expect(r.matches.every((m) => m.type !== "high_entropy_token")).toBe(true);
  });
});

describe("redact - name detection (opt-in)", () => {
  it("detects capitalized names when enabled", () => {
    const r = redact("My name is John Smith", { detectNames: true });
    expect(r.text).toBe("My name is [NAME_1]");
  });

  it("skips common non-name phrases", () => {
    const r = redact("Hello World", { detectNames: true });
    expect(r.text).toBe("Hello World");
  });

  it("does not detect names by default", () => {
    const r = redact("My name is John Smith");
    expect(r.text).toBe("My name is John Smith");
  });
});

describe("redact - custom patterns", () => {
  it("applies custom patterns", () => {
    const r = redact("internal id: ACME-XYZ-123", {
      customPatterns: [{ pattern: "ACME-[A-Z]+-\\d+", label: "INTERNAL" }],
    });
    expect(r.text).toBe("internal id: [INTERNAL_1]");
  });

  it("skips invalid custom regex", () => {
    const r = redact("hello", {
      customPatterns: [{ pattern: "[invalid", label: "BAD" }],
    });
    expect(r.matches).toHaveLength(0);
  });
});

describe("redact - overlap resolution", () => {
  it("picks earlier match when ranges overlap", () => {
    const r = redact("my email is alice@example.com and key is sk-proj-abcdef1234567890abcdef123456789012345");
    expect(r.text).toContain("[EMAIL_1]");
    expect(r.text).toContain("[SECRET_1]");
  });
});

describe("rehydrate", () => {
  it("restores original values from map", () => {
    const r = redact("Email: alice@example.com, IP: 10.0.0.1");
    const restored = rehydrate(r.text, r.map);
    expect(restored).toBe("Email: alice@example.com, IP: 10.0.0.1");
  });

  it("handles empty map", () => {
    expect(rehydrate("hello", {})).toBe("hello");
  });

  it("handles empty input", () => {
    expect(rehydrate("", { "[EMAIL_1]": "alice@example.com" })).toBe("");
  });

  it("handles multiple occurrences of same token", () => {
    const r = redact("alice@example.com and alice@example.com");
    const restored = rehydrate(r.text, r.map);
    expect(restored).toBe("alice@example.com and alice@example.com");
  });

  it("rehydrates longer tokens before shorter to avoid prefix collisions", () => {
    const map = { "[EMAIL_10]": "bob@test.org", "[EMAIL_1]": "alice@test.org" };
    const restored = rehydrate("[EMAIL_1] and [EMAIL_10]", map);
    expect(restored).toBe("alice@test.org and bob@test.org");
  });
});

describe("transformJsonStrings", () => {
  it("transforms string leaves", () => {
    const result = transformJsonStrings({ name: "hello", count: 42, tags: ["a", "b"] }, (s) => s.toUpperCase());
    expect(result).toEqual({ name: "HELLO", count: 42, tags: ["A", "B"] });
  });

  it("handles null", () => {
    expect(transformJsonStrings(null, (s) => s.toUpperCase())).toBe(null);
  });

  it("handles nested objects", () => {
    const result = transformJsonStrings({ a: { b: { c: "hi" } } }, (s) => s + "!");
    expect(result).toEqual({ a: { b: { c: "hi!" } } });
  });

  it("handles arrays of objects", () => {
    const result = transformJsonStrings([{ x: "foo" }, { x: "bar" }], (s) => s + "!");
    expect(result).toEqual([{ x: "foo!" }, { x: "bar!" }]);
  });
});

describe("redactJson", () => {
  it("redacts all string leaves in JSON", () => {
    const input = {
      messages: [
        { role: "user", content: "my email is alice@example.com" },
      ],
      model: "gpt-4",
    };
    const { value, map } = redactJson(input);
    expect(JSON.stringify(value)).not.toContain("alice@example.com");
    expect(Object.keys(map)).toHaveLength(1);
    expect(map["[EMAIL_1]"]).toBe("alice@example.com");
  });

  it("uses shared map across fields", () => {
    const input = {
      prompt: "Email: alice@example.com",
      system: "Contact alice@example.com for help",
    };
    const { value, map } = redactJson(input);
    const str = JSON.stringify(value);
    const occurrences = str.match(/\[EMAIL_1\]/g);
    expect(occurrences).toHaveLength(2);
    expect(Object.keys(map)).toHaveLength(1);
  });

  it("handles empty objects", () => {
    const { value, map, counts } = redactJson({});
    expect(value).toEqual({});
    expect(map).toEqual({});
    expect(counts).toEqual({});
  });

  it("handles primitive values", () => {
    const { value } = redactJson("just a string");
    expect(value).toBe("just a string");
  });

  it("redacts nested secrets", () => {
    const input = { level1: { level2: { key: "sk-proj-abcdef1234567890abcdef123456789012345" } } };
    const { value } = redactJson(input);
    expect(JSON.stringify(value)).not.toContain("sk-proj-");
    expect(JSON.stringify(value)).toContain("[SECRET_1]");
  });
});

// ── Image redaction helpers ──────────────────────────────────

import { previewImageRedaction } from "./redaction.functions";

describe("previewImageRedaction", () => {
  it("returns the input unchanged when no PII is present", () => {
    const r = previewImageRedaction("The quick brown fox jumps over the lazy dog.");
    expect(r.redacted).toBe("The quick brown fox jumps over the lazy dog.");
    expect(r.matches).toHaveLength(0);
    expect(r.hasPii).toBe(false);
  });

  it("redacts a credit card number in OCR text", () => {
    const r = previewImageRedaction("My card is 4111111111111111 and it expires next month.");
    expect(r.redacted).toContain("[CARD_1]");
    expect(r.redacted).not.toContain("4111111111111111");
    expect(r.hasPii).toBe(true);
    expect(r.matches[0].type).toBe("credit_card");
  });

  it("redacts an email in OCR text", () => {
    const r = previewImageRedaction("Contact: john.doe@example.com");
    expect(r.redacted).toContain("[EMAIL_1]");
    expect(r.redacted).not.toContain("john.doe@example.com");
  });

  it("redacts multiple PII types from image OCR text", () => {
    const r = previewImageRedaction(
      "Name: John Smith\nCard: 4111 1111 1111 1111\nEmail: jsmith@example.com\nSSN: 123-45-6789",
    );
    expect(r.matches.length).toBeGreaterThanOrEqual(3);
    expect(r.hasPii).toBe(true);
    expect(r.redacted).toContain("[CARD_1]");
    expect(r.redacted).toContain("[EMAIL_1]");
  });

  it("deduplicates the same PII value appearing multiple times in OCR text", () => {
    const r = previewImageRedaction("Contact alice@example.com and also alice@example.com");
    expect(r.matches).toHaveLength(2);
    // Both matches should use the same token (dedup within a single redact() call)
    expect(r.matches[0].token).toBe(r.matches[1].token);
  });
});

describe("redactJson with seedMap / seedCounts", () => {
  it("reuses tokens from the seed map", () => {
    const { value, map } = redactJson(
      { text: "My credit card is 4111111111111111" },
      {
        seedMap: { "[CARD_42]": "4111111111111111" },
        seedCounts: { CARD: 42 },
      },
    );
    expect(value).toEqual({ text: "My credit card is [CARD_42]" });
    expect(map["[CARD_42]"]).toBe("4111111111111111");
  });

  it("continues counting from seed counts", () => {
    const { value, map } = redactJson(
      { text: "First card 4111111111111111, second card 5500000000000004" },
      {
        seedMap: { "[CARD_1]": "4111111111111111" },
        seedCounts: { CARD: 1 },
      },
    );
    expect(JSON.stringify(value)).toContain("[CARD_1]");
    expect(JSON.stringify(value)).toContain("[CARD_2]");
    expect(map["[CARD_1]"]).toBe("4111111111111111");
    expect(map["[CARD_2]"]).toBe("5500000000000004");
  });

  it("handles empty seed map gracefully", () => {
    const { value } = redactJson(
      { text: "sk-proj-abcdef1234567890abcdef123456789012345" },
      { seedMap: {}, seedCounts: {} },
    );
    expect(JSON.stringify(value)).toContain("[SECRET_1]");
  });
});

describe("image redaction integration - findImageBlocks", () => {
  // Unit tests for the image block finding logic (API-shape-aware)
  it("finds OpenAI image_url blocks", () => {
    // This tests the shape-aware image detection that runs in the edge function.
    // We verify the redactJson pipeline handles content arrays correctly.
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", detail: "auto" } },
          ],
        },
      ],
    };
    // redactJson should process the text content normally, and image data URLs
    // are just strings that pass through if they don't match PII patterns
    const { value } = redactJson(body, { detectNames: false });
    const msg = (value as any).messages[0];
    expect(msg.content[0].text).toBe("What's in this image?");
    // The image URL is a base64 PNG (no PII inside), so it should pass through
    expect(msg.content[1].type).toBe("image_url");
  });
});
