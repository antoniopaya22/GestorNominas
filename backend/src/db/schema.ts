import { pgTable, text, integer, serial, boolean, doublePrecision, timestamp } from "drizzle-orm/pg-core";

// Nota: las columnas de dinero usan doublePrecision (float8) en vez de numeric.
// numeric devuelve string en el driver de Postgres (para no perder precisión
// decimal exacta), lo que rompería en silencio las sumas (`+`) que hacen
// dashboard/analytics/finance sobre estos campos. SQLite's `real` ya era un
// float8 sin precisión decimal exacta, así que esto no es una regresión.

// ─── Users ──────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  supabaseUserId: text("supabase_user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Profiles ───────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payslips = pgTable("payslips", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  periodMonth: integer("period_month"),
  periodYear: integer("period_year"),
  company: text("company"),
  grossSalary: doublePrecision("gross_salary"),
  netSalary: doublePrecision("net_salary"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payslipConcepts = pgTable("payslip_concepts", {
  id: serial("id").primaryKey(),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["devengo", "deduccion", "otros"],
  }).notNull(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull(),
  isPercentage: boolean("is_percentage").notNull().default(false),
});

// ─── Payslip Notes (document management) ────────────────────────
export const payslipNotes = pgTable("payslip_notes", {
  id: serial("id").primaryKey(),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Tags (document organization) ──────────────────────────────
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
});

export const payslipTags = pgTable("payslip_tags", {
  id: serial("id").primaryKey(),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

// ─── Alert Rules (automation) ───────────────────────────────────
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["salary_drop", "missing_payslip", "concept_change", "custom_threshold"],
  }).notNull(),
  config: text("config").notNull().default("{}"), // JSON config
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Alert History ──────────────────────────────────────────────
export const alertHistory = pgTable("alert_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Financial Accounts ─────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
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
  initialBalance: doublePrecision("initial_balance").notNull().default(0),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Category Groups ────────────────────────────────────────────
export const categoryGroups = pgTable("category_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => categoryGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Financial Transactions ─────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
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
  amount: doublePrecision("amount").notNull(),
  date: text("date").notNull(),
  recurringTransactionId: integer("recurring_transaction_id").references(
    () => recurringTransactions.id,
    { onDelete: "set null" },
  ),
  scheduledFor: text("scheduled_for"),
  payee: text("payee"),
  memo: text("memo"),
  cleared: boolean("cleared").notNull().default(false),
  transferId: integer("transfer_id"),
  flag: text("flag"),
  importedFrom: text("imported_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Recurring Transactions ────────────────────────────────────
export const recurringTransactions = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
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
  amount: doublePrecision("amount").notNull(),
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
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
