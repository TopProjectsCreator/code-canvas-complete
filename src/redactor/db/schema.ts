// @ts-expect-error - drizzle-orm not installed in this environment
import { pgTable, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// ----- Better-Auth tables -----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ----- App tables -----
export const providerKeys = pgTable(
  "redactor_provider_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // openai, anthropic, gemini, custom
    label: text("label").notNull(),
    baseUrl: text("base_url"), // for custom providers
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    salt: text("salt").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t: any) => ({
    userIdx: index("provider_keys_user_idx").on(t.userId),
  }),
);

export const proxyKeys = pgTable(
  "redactor_proxy_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    name: text("name").notNull(),
    allowedProviders: text("allowed_providers").array().notNull().default([]),
    rateLimitRpm: integer("rate_limit_rpm"),
    monthlyCapUsd: integer("monthly_cap_usd"),
    ipAllowlist: text("ip_allowlist").array().notNull().default([]),
    logRequests: boolean("log_requests").notNull().default(true),
    redactImages: boolean("redact_images").notNull().default(true),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t: any) => ({
    hashIdx: uniqueIndex("proxy_keys_hash_idx").on(t.keyHash),
    userIdx: index("proxy_keys_user_idx").on(t.userId),
  }),
);

export const redactionRules = pgTable(
  "redactor_redaction_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    label: text("label").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t: any) => ({
    userIdx: index("redaction_rules_user_idx").on(t.userId),
  }),
);

export const requestLogs = pgTable(
  "redactor_request_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    proxyKeyId: text("proxy_key_id").references(() => proxyKeys.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    model: text("model"),
    status: integer("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    redactions: jsonb("redactions"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t: any) => ({
    userIdx: index("request_logs_user_idx").on(t.userId, t.createdAt),
  }),
);
