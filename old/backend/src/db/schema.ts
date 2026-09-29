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
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  payslipType: text("payslip_type", {
    enum: ["ordinal", "extra"],
  })
    .notNull()
    .default("ordinal"),
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
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
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
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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

// ─── Financial Accounts ─────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["bank", "credit_card", "cash", "investment", "other"],
  })
    .notNull()
    .default("bank"),
  currency: text("currency").notNull().default("EUR"),
  initialBalance: real("initial_balance").notNull().default(0),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Category Groups ────────────────────────────────────────────
export const categoryGroups = sqliteTable("category_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id")
    .notNull()
    .references(() => categoryGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Financial Transactions ─────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  type: text("type", {
    enum: ["expense", "income", "transfer"],
  }).notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  recurringTransactionId: integer("recurring_transaction_id").references(
    () => recurringTransactions.id,
    { onDelete: "set null" },
  ),
  scheduledFor: text("scheduled_for"),
  payee: text("payee"),
  memo: text("memo"),
  cleared: integer("cleared", { mode: "boolean" }).notNull().default(false),
  transferId: integer("transfer_id"),
  flag: text("flag"),
  importedFrom: text("imported_from"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Recurring Transactions ────────────────────────────────────
export const recurringTransactions = sqliteTable("recurring_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  type: text("type", {
    enum: ["expense", "income"],
  }).notNull(),
  amount: real("amount").notNull(),
  cadence: text("cadence", {
    enum: ["weekly", "monthly", "yearly"],
  })
    .notNull()
    .default("monthly"),
  intervalCount: integer("interval_count").notNull().default(1),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  payee: text("payee"),
  memo: text("memo"),
  flag: text("flag"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
