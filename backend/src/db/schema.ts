import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Profiles ───────────────────────────────────────────────────
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const payslips = sqliteTable("payslips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  periodMonth: integer("period_month"),
  periodYear: integer("period_year"),
  company: text("company"),
  grossSalary: real("gross_salary"),
  netSalary: real("net_salary"),
  rawText: text("raw_text"),
  parsingStatus: text("parsing_status", {
    enum: ["pending", "parsed", "error", "review"],
  })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const payslipConcepts = sqliteTable("payslip_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["devengo", "deduccion", "otros"],
  }).notNull(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  isPercentage: integer("is_percentage", { mode: "boolean" })
    .notNull()
    .default(false),
});

// ─── Payslip Notes (document management) ────────────────────────
export const payslipNotes = sqliteTable("payslip_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Tags (document organization) ──────────────────────────────
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#6366f1"),
});

export const payslipTags = sqliteTable("payslip_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

// ─── Alert Rules (automation) ───────────────────────────────────
export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["salary_drop", "missing_payslip", "concept_change", "custom_threshold"],
  }).notNull(),
  config: text("config").notNull().default("{}"), // JSON config
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Alert History ──────────────────────────────────────────────
export const alertHistory = sqliteTable("alert_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  message: text("message").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
