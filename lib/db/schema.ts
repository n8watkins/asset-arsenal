/**
 * Drizzle schema for Turso (libSQL / SQLite).
 *
 * Two groups:
 *  1. Auth.js adapter tables (users, accounts, sessions, verificationTokens)
 *  2. Product tables (credit ledger, projects, runs, generated icons, usage)
 *
 * Credit model: 1 credit = 1 generated icon (see lib/pricing.ts). Balance lives
 * on the user row; every change is recorded in creditTransactions.
 */

import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/* ---------------------------------------------------------------- Auth.js -- */

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  // Product fields layered onto the Auth.js user row:
  creditsBalance: integer("credits_balance").notNull().default(0),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(now),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ---------------------------------------------------------------- Product -- */

/** Append-only ledger. Every credit change writes a row here. */
export const creditTransactions = sqliteTable("credit_transaction", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: text("run_id"),
  // purchase | free_grant | spend | refund | admin_adjustment
  type: text("type").notNull(),
  amount: integer("amount").notNull(), // signed: +grant, -spend
  balanceAfter: integer("balance_after"),
  description: text("description"),
  // Stripe event id for idempotency — unique so we never grant twice.
  stripeEventId: text("stripe_event_id").unique(),
  createdAt: integer("created_at").notNull().default(now),
});

export const projects = sqliteTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const iconRuns = sqliteTable("icon_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id),
  // created | analyzing | ready | generating | complete | failed
  status: text("status").notNull().default("created"),
  sourceImageKey: text("source_image_key"),
  sourceImageUrl: text("source_image_url"),
  iconManifest: text("icon_manifest", { mode: "json" }),
  collectionPrompt: text("collection_prompt"),
  collectionImageKey: text("collection_image_key"),
  collectionImageUrl: text("collection_image_url"),
  individualPromptPack: text("individual_prompt_pack", { mode: "json" }),
  modelConfig: text("model_config", { mode: "json" }),
  creditsSpent: integer("credits_spent").notNull().default(0),
  iconCount: integer("icon_count").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const generatedIcons = sqliteTable("generated_icon", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => iconRuns.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  iconKey: text("icon_key"), // e.g. icon_001
  iconName: text("icon_name"),
  concept: text("concept"),
  prompt: text("prompt"),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  modelUsed: text("model_used"),
  status: text("status").notNull().default("success"), // success | failed
  error: text("error"),
  creditCost: integer("credit_cost").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
});

/** Server-side cost/usage telemetry for margin tracking (admin only). */
export const aiUsageEvents = sqliteTable("ai_usage_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  runId: text("run_id"),
  operation: text("operation").notNull(),
  model: text("model").notNull(),
  estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  inputImages: integer("input_images").notNull().default(0),
  outputImages: integer("output_images").notNull().default(0),
  rawUsage: text("raw_usage", { mode: "json" }),
  createdAt: integer("created_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type IconRun = typeof iconRuns.$inferSelect;
export type GeneratedIcon = typeof generatedIcons.$inferSelect;
